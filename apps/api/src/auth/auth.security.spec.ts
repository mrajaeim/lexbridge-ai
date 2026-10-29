import { BadRequestException, HttpException, UnauthorizedException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { CSRF_HEADER, CSRF_HEADER_VALUE, LOGIN_RATE_LIMIT, SESSION_COOKIE } from '@lexbridge/shared';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { consumeLimit } from '../common/rate-limiter';
import { RedisService } from '../common/redis.service';
import { MemoryRedis } from '../testing/memory-redis';
import { AccountLinkService } from './account-link.service';
import { AuthController } from './auth.controller';
import { AuthFlowService } from './auth-flow.service';
import { assertIdTokenClaims } from './id-token-claims';
import { OAuthTransactionStore } from './oauth-transaction.store';
import { SessionService } from './session.service';
import { IdTokenClaims } from './types';

const issuer = 'http://localhost:8180/realms/lexbridge';
const audience = 'lexbridge-api';

function validClaims(overrides: Partial<IdTokenClaims> = {}): IdTokenClaims {
  return {
    iss: issuer,
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 300,
    nonce: 'nonce-1',
    sub: 'subject-1',
    email: 'alice@alpha.example',
    email_verified: true,
    name: 'Alice',
    ...overrides,
  };
}

function services() {
  const memory = new MemoryRedis();
  const redis = { client: memory } as unknown as RedisService;
  return {
    memory,
    sessions: new SessionService(redis),
    transactions: new OAuthTransactionStore(redis),
  };
}

describe('assertIdTokenClaims', () => {
  const expected = { issuer, audience, nonce: 'nonce-1', now: Date.now() };

  it('accepts a token with the expected issuer, audience, expiry, and nonce', () => {
    expect(() => assertIdTokenClaims(validClaims(), expected)).not.toThrow();
  });

  it('rejects an expired token', () => {
    expect(() => assertIdTokenClaims(validClaims({ exp: Math.floor(Date.now() / 1000) - 10 }), expected)).toThrow(
      'expired',
    );
  });

  it('rejects a mismatched nonce, issuer, or audience', () => {
    expect(() => assertIdTokenClaims(validClaims({ nonce: 'other' }), expected)).toThrow('nonce');
    expect(() => assertIdTokenClaims(validClaims({ iss: 'https://evil.example' }), expected)).toThrow('issuer');
    expect(() => assertIdTokenClaims(validClaims({ aud: 'other-client' }), expected)).toThrow('audience');
  });
});

describe('OAuth transaction replay', () => {
  it('consumes state once', async () => {
    const { transactions } = services();
    await transactions.save('state-1', { codeVerifier: 'v', nonce: 'n', returnTo: '/app' });
    await expect(transactions.consume('state-1')).resolves.toMatchObject({ nonce: 'n' });
    await expect(transactions.consume('state-1')).resolves.toBeNull();
  });
});

describe('sessions', () => {
  it('rejects an expired session and a revoked session', async () => {
    const { memory, sessions } = services();
    const id = await sessions.create({ userId: 'user-1', activeOrganizationId: 'org-1' });
    expect(await sessions.get(id)).toMatchObject({ userId: 'user-1' });
    await memory.set(
      `session:${id}`,
      JSON.stringify({ userId: 'user-1', activeOrganizationId: 'org-1', expiresAt: Date.now() - 1000 }),
      'EX',
      60,
    );
    expect(await sessions.get(id)).toBeNull();

    const next = await sessions.create({ userId: 'user-1', activeOrganizationId: null });
    await sessions.revoke(next);
    expect(await sessions.get(next)).toBeNull();
  });
});

describe('rate limiter', () => {
  it('blocks the request after the login limit', async () => {
    const memory = new MemoryRedis();
    for (let i = 0; i < LOGIN_RATE_LIMIT; i += 1) {
      await consumeLimit(memory, 'rl:login:test', LOGIN_RATE_LIMIT, 60);
    }
    await expect(consumeLimit(memory, 'rl:login:test', LOGIN_RATE_LIMIT, 60)).rejects.toBeInstanceOf(HttpException);
  });
});

describe('account linking', () => {
  it('does not attach a login to an existing user unless email_verified is true', async () => {
    const users = new Map([
      ['alice@alpha.example', { id: 'user-1', email: 'alice@alpha.example', name: 'Alice', emailVerified: true }],
    ]);
    const identities: Array<{ issuer: string; subject: string; userId: string }> = [];
    const prisma = {
      externalIdentity: {
        findUnique: async () => null,
        create: async ({ data }: { data: { issuer: string; subject: string; userId: string } }) => {
          identities.push(data);
          return data;
        },
      },
      user: {
        findUnique: async ({ where }: { where: { email: string } }) => users.get(where.email) ?? null,
        update: async () => users.get('alice@alpha.example'),
        create: async () => {
          throw new Error('should not create');
        },
      },
    };
    const accounts = new AccountLinkService(prisma as never);
    await expect(
      accounts.link(validClaims({ email_verified: false })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(identities).toHaveLength(0);

    await accounts.link(validClaims({ email_verified: true }));
    expect(identities).toEqual([{ issuer, subject: 'subject-1', userId: 'user-1' }]);
  });
});

describe('auth flow', () => {
  const expectedClaims = validClaims();

  function flowFor(grant: ReturnType<typeof vi.fn>) {
    const { transactions, sessions } = services();
    const oidc = { begin: vi.fn(), grant, logoutUrl: vi.fn() };
    const accounts = { link: vi.fn(async () => ({ id: 'user-1', email: 'alice@alpha.example', name: 'Alice' })) };
    const prisma = { membership: { findFirst: vi.fn(async () => ({ organizationId: 'org-1' })) } };
    const flow = new AuthFlowService(oidc as never, transactions, accounts as never, prisma as never);
    return { flow, transactions, sessions, grant };
  }

  it('rejects a replayed callback and an invalid token from the OIDC library', async () => {
    const grant = vi.fn(async () => {
      throw new Error('signature');
    });
    const { flow, transactions } = flowFor(grant);
    await transactions.save('state-1', { codeVerifier: 'v', nonce: 'nonce-1', returnTo: '/app' });
    const url = new URL('http://localhost:4000/auth/callback?state=state-1&code=abc');
    await expect(flow.complete(url)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(flow.complete(url)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects claims that fail nonce or expiry checks after the library returns them', async () => {
    const grant = vi.fn(async () => ({
      claims: () => validClaims({ nonce: 'wrong' }),
      idToken: 'token',
    }));
    const { flow, transactions } = flowFor(grant);
    await transactions.save('state-2', { codeVerifier: 'v', nonce: 'nonce-1', returnTo: '/app' });
    await expect(
      flow.complete(new URL('http://localhost:4000/auth/callback?state=state-2&code=abc')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(grant).toHaveBeenCalledWith(
      expect.any(URL),
      'state-2',
      expect.objectContaining({ nonce: 'nonce-1', codeVerifier: 'v' }),
    );
    expect(expectedClaims.nonce).toBe('nonce-1');
  });
});

describe('auth http', () => {
  const apps: Array<{ close: () => Promise<void> }> = [];

  afterEach(async () => {
    while (apps.length) {
      await apps.pop()?.close();
    }
  });

  it('rejects an absolute post-login redirect and rate limits before starting OIDC', async () => {
    const { sessions, flow } = services() && {
      sessions: services().sessions,
      flow: { begin: vi.fn(async () => 'http://idp.test/auth') },
    };
    const limiter = { consumeLogin: vi.fn(async () => undefined), consumeAsk: vi.fn() };
    const blocked = { consumeLogin: vi.fn(async () => { throw new HttpException('Too many requests', 429); }), consumeAsk: vi.fn() };
    const prisma = { membership: { findMany: vi.fn(async () => []) } };
    const context = {
      build: async () => ({ req: {}, sessionId: null, user: null, membership: null }),
    };

    async function controllerApp(rate: typeof limiter) {
      const moduleRef = await Test.createTestingModule({
        controllers: [AuthController],
        providers: [
          { provide: AuthFlowService, useValue: flow },
          { provide: SessionService, useValue: sessions },
          { provide: (await import('../common/rate-limiter')).RateLimiter, useValue: rate },
          { provide: (await import('./auth-context.service')).AuthContextService, useValue: context },
          { provide: (await import('./oidc.service')).OidcService, useValue: { logoutUrl: vi.fn() } },
          { provide: (await import('@lexbridge/database')).PrismaService, useValue: prisma },
        ],
      }).compile();
      const app = moduleRef.createNestApplication();
      await app.init();
      apps.push(app);
      return app;
    }

    const open = await controllerApp(limiter);
    await request(open.getHttpServer()).get('/auth/login?returnTo=https://evil.example').expect(400);
    expect(flow.begin).not.toHaveBeenCalled();

    const limited = await controllerApp(blocked);
    await request(limited.getHttpServer()).get('/auth/login?returnTo=/app').expect(429);
    expect(flow.begin).not.toHaveBeenCalled();
  });

  it('rejects a cookie after logout', async () => {
    const { sessions } = services();
    const sessionId = await sessions.create({ userId: 'user-1', activeOrganizationId: 'org-1' });
    const context = {
      build: async (req: { cookies?: Record<string, string> }) => {
        const id = req.cookies?.[SESSION_COOKIE];
        if (!id) return { req, sessionId: null, user: null, membership: null };
        const session = await sessions.get(id);
        if (!session) return { req, sessionId: null, user: null, membership: null };
        return {
          req,
          sessionId: id,
          user: { id: session.userId, email: 'alice@alpha.example', name: 'Alice', emailVerified: true },
          membership: {
            organizationId: 'org-1',
            role: 'ADMIN',
            organizationName: 'Firm Alpha',
            organizationSlug: 'firm-alpha',
          },
        };
      },
    };
    const prisma = { membership: { findMany: vi.fn(async () => []) } };
    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthFlowService, useValue: { begin: vi.fn(), complete: vi.fn() } },
        { provide: SessionService, useValue: sessions },
        {
          provide: (await import('../common/rate-limiter')).RateLimiter,
          useValue: { consumeLogin: vi.fn(), consumeAsk: vi.fn() },
        },
        { provide: (await import('./auth-context.service')).AuthContextService, useValue: context },
        { provide: (await import('./oidc.service')).OidcService, useValue: { logoutUrl: vi.fn() } },
        { provide: (await import('@lexbridge/database')).PrismaService, useValue: prisma },
      ],
    }).compile();
    const app = moduleRef.createNestApplication();
    const cookieParser = (await import('cookie-parser')).default;
    app.use(cookieParser());
    await app.init();
    apps.push(app);
    const server = app.getHttpServer();
    await request(server).get('/auth/session').set('Cookie', `${SESSION_COOKIE}=${sessionId}`).expect(200);
    await request(server)
      .post('/auth/logout')
      .set('Cookie', `${SESSION_COOKIE}=${sessionId}`)
      .set(CSRF_HEADER, CSRF_HEADER_VALUE)
      .expect(200);
    await request(server).get('/auth/session').set('Cookie', `${SESSION_COOKIE}=${sessionId}`).expect(401);
  });
});
