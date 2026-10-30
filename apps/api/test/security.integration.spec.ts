import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { randomBytes } from 'crypto';
import { INestApplication } from '@nestjs/common';
import { createPrismaClient, DocumentStatus, OrgRole, PrismaClient } from '@lexbridge/database';
import { CSRF_HEADER, CSRF_HEADER_VALUE, INSUFFICIENT_ANSWER, SESSION_COOKIE } from '@lexbridge/shared';
import { exportPdfPath } from '@lexbridge/shared/export-paths';
import { appConfig } from '../src/config';
import Redis from 'ioredis';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../src/create-application';

const stamp = randomBytes(4).toString('hex');
const marker = `BETA-CONFIDENTIAL-${stamp}`;

describe('tenant isolation and protected delivery', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let redis: Redis;
  const orgIds: string[] = [];
  const userIds: string[] = [];

  beforeAll(async () => {
    prisma = createPrismaClient();
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    const alpha = await prisma.organization.create({
      data: { name: 'Alpha Test', slug: `alpha-${stamp}` },
    });
    const beta = await prisma.organization.create({
      data: { name: 'Beta Test', slug: `beta-${stamp}` },
    });
    orgIds.push(alpha.id, beta.id);
    const alice = await user('alice', alpha.id, OrgRole.ADMIN);
    const bob = await user('bob', alpha.id, OrgRole.EDITOR);
    const carol = await user('carol', alpha.id, OrgRole.READER);
    const david = await user('david', beta.id, OrgRole.ADMIN);
    const secret = await prisma.document.create({
      data: {
        organizationId: beta.id,
        createdById: david.id,
        title: `Zephyr ${stamp}`,
        body: `${marker} zephyrquill private merger notes`,
        status: DocumentStatus.PUBLISHED,
        chunks: {
          create: [{ organizationId: beta.id, ordinal: 0, content: `${marker} zephyrquill private merger notes` }],
        },
      },
    });
    const draft = await prisma.document.create({
      data: {
        organizationId: alpha.id,
        createdById: alice.id,
        title: `Draft ${stamp}`,
        body: 'Unpublished alpha draft',
        status: DocumentStatus.DRAFT,
      },
    });
    const harbor = await prisma.document.create({
      data: {
        organizationId: alpha.id,
        createdById: alice.id,
        title: 'Harbor Services Agreement',
        body: 'The Harbor Services Agreement requires a written notice period of thirty days.',
        status: DocumentStatus.PUBLISHED,
        chunks: {
          create: [
            {
              organizationId: alpha.id,
              ordinal: 0,
              content: 'The Harbor Services Agreement requires a written notice period of thirty days.',
            },
          ],
        },
      },
    });
    app = await createApplication();
    await app.init();
    Object.assign(fixtures, { alpha, beta, alice, bob, carol, david, secret, draft, harbor });
  });

  afterAll(async () => {
    await app?.close();
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
    await redis.quit();
  });

  const fixtures = {} as {
    alpha: { id: string };
    beta: { id: string };
    alice: { id: string; cookie: string };
    bob: { id: string; cookie: string };
    carol: { id: string; cookie: string };
    david: { id: string; cookie: string };
    secret: { id: string };
    draft: { id: string };
    harbor: { id: string };
  };

  async function user(name: string, organizationId: string, role: OrgRole) {
    const created = await prisma.user.create({
      data: { email: `${name}-${stamp}@example.test`, name, emailVerified: true },
    });
    userIds.push(created.id);
    await prisma.membership.create({ data: { userId: created.id, organizationId, role } });
    const sessionId = randomBytes(16).toString('hex');
    await redis.set(
      `session:${sessionId}`,
      JSON.stringify({
        userId: created.id,
        activeOrganizationId: organizationId,
        expiresAt: Date.now() + 10 * 60 * 1000,
      }),
      'EX',
      600,
    );
    return { id: created.id, cookie: `${SESSION_COOKIE}=${sessionId}` };
  }

  function gql(cookie: string | undefined, query: string, variables?: Record<string, unknown>) {
    const call = request(app.getHttpServer()).post('/graphql').set(CSRF_HEADER, CSRF_HEADER_VALUE);
    if (cookie) call.set('Cookie', cookie);
    return call.send({ query, variables });
  }

  it('rejects graphql without the CSRF header', async () => {
    const response = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query: '{ health }' });
    expect(response.status).toBe(403);
  });

  it('does not return a Firm Beta document to a Firm Alpha user', async () => {
    const response = await gql(
      fixtures.alice.cookie,
      'query ($id: ID!) { document(id: $id) { id title body } }',
      { id: fixtures.secret.id },
    );
    expect(response.status).toBe(200);
    expect(response.body.data?.document ?? null).toBeNull();
    expect(JSON.stringify(response.body)).not.toContain(marker);
    expect(JSON.stringify(response.body)).not.toContain('zephyrquill');
  });

  it('stops a reader from publishing and an editor from changing roles', async () => {
    const publish = await gql(
      fixtures.carol.cookie,
      'mutation ($id: ID!) { publishDocument(id: $id) { id } }',
      { id: fixtures.draft.id },
    );
    expect(publish.body.data?.publishDocument ?? null).toBeNull();
    expect(JSON.stringify(publish.body)).toMatch(/Forbidden|FORBIDDEN/);

    const bobMembership = await prisma.membership.findFirstOrThrow({
      where: { userId: fixtures.bob.id },
    });
    const roleChange = await gql(
      fixtures.bob.cookie,
      'mutation ($input: ChangeRoleInput!) { changeUserRole(input: $input) { id } }',
      { input: { membershipId: bobMembership.id, role: 'ADMIN' } },
    );
    expect(roleChange.body.data?.changeUserRole ?? null).toBeNull();
    expect(JSON.stringify(roleChange.body)).toMatch(/Forbidden|FORBIDDEN/);
  });

  it('writes audit rows for invites and role changes', async () => {
    const invite = await gql(
      fixtures.alice.cookie,
      'mutation ($input: InviteUserInput!) { inviteUser(input: $input) { id email } }',
      { input: { email: `new-${stamp}@example.test`, role: 'READER' } },
    );
    expect(invite.body.data.inviteUser.email).toBe(`new-${stamp}@example.test`);
    const carolMembership = await prisma.membership.findFirstOrThrow({ where: { userId: fixtures.carol.id } });
    const changed = await gql(
      fixtures.alice.cookie,
      'mutation ($input: ChangeRoleInput!) { changeUserRole(input: $input) { role } }',
      { input: { membershipId: carolMembership.id, role: 'EDITOR' } },
    );
    expect(changed.body.data.changeUserRole.role).toBe('EDITOR');
    const audit = await gql(fixtures.alice.cookie, '{ auditLogs { action } }');
    const actions = audit.body.data.auditLogs.map((row: { action: string }) => row.action);
    expect(actions).toContain('invitation.created');
    expect(actions).toContain('membership.role_changed');
  });

  it('rejects graphql after logout and rejects an expired session', async () => {
    const me = '{ me { email } }';
    const before = await gql(fixtures.david.cookie, me);
    expect(before.body.data.me.email).toContain('david');
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', fixtures.david.cookie)
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .expect(200);
    const after = await gql(fixtures.david.cookie, me);
    expect(after.body.data?.me ?? null).toBeNull();

    const expiredId = randomBytes(8).toString('hex');
    await redis.set(
      `session:${expiredId}`,
      JSON.stringify({ userId: fixtures.alice.id, activeOrganizationId: fixtures.alpha.id, expiresAt: Date.now() - 1000 }),
      'EX',
      60,
    );
    const expired = await gql(`${SESSION_COOKIE}=${expiredId}`, me);
    expect(expired.body.data?.me ?? null).toBeNull();
  });

  it('streams only the owner conversation and backfills the saved answer', async () => {
    const conversation = await prisma.conversation.create({
      data: {
        organizationId: fixtures.alpha.id,
        userId: fixtures.alice.id,
        title: 'Saved answer',
        messages: {
          create: [
            {
              organizationId: fixtures.alpha.id,
              role: 'ASSISTANT',
              content: `final answer ${stamp}`,
              status: 'COMPLETE',
              sequence: 2,
            },
          ],
        },
      },
    });
    const denied = await request(app.getHttpServer())
      .get(`/chat/stream/${conversation.id}`)
      .set('Cookie', fixtures.bob.cookie);
    expect(denied.status).toBe(404);

    const owned = await request(app.getHttpServer())
      .get(`/chat/stream/${conversation.id}`)
      .set('Cookie', fixtures.alice.cookie);
    expect(owned.status).toBe(200);
    expect(owned.text).toContain(`final answer ${stamp}`);
    expect(owned.text).toContain('event: snapshot');
  });

  it('answers from the caller organization only', async () => {
    const asked = await gql(
      fixtures.alice.cookie,
      'mutation ($input: AskQuestionInput!) { askQuestion(input: $input) { id conversationId } }',
      { input: { question: 'zephyrquill' } },
    );
    const messageId = asked.body.data.askQuestion.id as string;
    let content = '';
    for (let i = 0; i < 20; i += 1) {
      const message = await prisma.message.findUniqueOrThrow({ where: { id: messageId } });
      if (message.status === 'COMPLETE' || message.status === 'FAILED') {
        content = message.content;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(content).toContain(INSUFFICIENT_ANSWER);
    expect(content).not.toContain(marker);
  });

  it('keeps PDF downloads inside the owning organization and dedupes jobs', async () => {
    const conversation = await prisma.conversation.create({
      data: {
        organizationId: fixtures.alpha.id,
        userId: fixtures.alice.id,
        title: 'Export me',
        messages: {
          create: {
            organizationId: fixtures.alpha.id,
            role: 'USER',
            content: 'Export this',
            status: 'COMPLETE',
            sequence: 1,
          },
        },
      },
    });
    const first = await gql(
      fixtures.alice.cookie,
      'mutation ($conversationId: ID!) { requestPdfExport(conversationId: $conversationId) { id status } }',
      { conversationId: conversation.id },
    );
    const second = await gql(
      fixtures.alice.cookie,
      'mutation ($conversationId: ID!) { requestPdfExport(conversationId: $conversationId) { id status } }',
      { conversationId: conversation.id },
    );
    expect(first.body.data.requestPdfExport.status).toBe('QUEUED');
    expect(second.body.data.requestPdfExport.id).toBe(first.body.data.requestPdfExport.id);
    const audits = await prisma.auditLog.findMany({
      where: { targetId: first.body.data.requestPdfExport.id },
    });
    expect(audits.map((row) => row.action)).toContain('export.requested');

    const job = await prisma.exportJob.create({
      data: {
        organizationId: fixtures.alpha.id,
        conversationId: conversation.id,
        requestedById: fixtures.alice.id,
        contentVersion: `done-${stamp}`,
        status: 'COMPLETE',
        filePath: 'stored-for-audit',
      },
    });
    const filePath = exportPdfPath(appConfig().exportDir, fixtures.alpha.id, job.id);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, '%PDF-1.4 test');
    const other = await request(app.getHttpServer()).get(`/exports/${job.id}/file`).set('Cookie', fixtures.bob.cookie);
    expect(other.status).toBe(404);
    const owner = await request(app.getHttpServer())
      .get(`/exports/${job.id}/file`)
      .set('Cookie', fixtures.alice.cookie);
    expect(owner.status).toBe(200);
    expect(owner.headers['content-type']).toContain('application/pdf');
  });
});
