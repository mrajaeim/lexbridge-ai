import { ForbiddenException, Injectable } from '@nestjs/common';
import { OrgRole, Prisma, PrismaService } from '@lexbridge/database';
import { createHash, randomBytes } from 'crypto';
import { appConfig } from '../config';
import { notFound } from '../common/errors';
import { SessionService } from '../auth/session.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(entry: {
    organizationId: string;
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.auditLog.create({ data: entry });
  }
}

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
  ) {}

  listForUser(userId: string) {
    return this.prisma.membership.findMany({
      where: { userId },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async switchOrganization(userId: string, sessionId: string, organizationId: string) {
    const membership = await this.prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      include: { organization: true },
    });
    if (!membership) notFound();
    const updated = await this.sessions.update(sessionId, { activeOrganizationId: organizationId });
    if (!updated) notFound();
    return membership;
  }

  members(organizationId: string) {
    return this.prisma.membership.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  auditLog(organizationId: string) {
    return this.prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async invite(input: {
    organizationId: string;
    actorId: string;
    email: string;
    role: OrgRole;
  }) {
    const email = input.email.trim().toLowerCase();
    const raw = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(raw).digest('hex');
    const invitation = await this.prisma.invitation.create({
      data: {
        organizationId: input.organizationId,
        email,
        role: input.role,
        tokenHash,
        invitedById: input.actorId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    await this.audit.record({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: 'invitation.created',
      targetType: 'Invitation',
      targetId: invitation.id,
      metadata: { email, role: input.role },
    });
    return {
      ...invitation,
      acceptUrl: `${appConfig().webOrigin}/invite?token=${raw}`,
    };
  }

  async accept(user: { id: string; email: string }, token: string, sessionId: string | null) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.prisma.invitation.findUnique({ where: { tokenHash } });
    if (!invitation || invitation.acceptedAt || invitation.expiresAt.getTime() <= Date.now()) {
      notFound();
    }
    if (invitation.email.toLowerCase() !== user.email.toLowerCase()) notFound();
    await this.prisma.$transaction([
      this.prisma.membership.upsert({
        where: {
          userId_organizationId: { userId: user.id, organizationId: invitation.organizationId },
        },
        update: { role: invitation.role },
        create: {
          userId: user.id,
          organizationId: invitation.organizationId,
          role: invitation.role,
        },
      }),
      this.prisma.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      }),
    ]);
    if (sessionId) {
      const session = await this.sessions.get(sessionId);
      if (session && !session.activeOrganizationId) {
        await this.sessions.update(sessionId, { activeOrganizationId: invitation.organizationId });
      }
    }
    return this.prisma.membership.findUniqueOrThrow({
      where: {
        userId_organizationId: { userId: user.id, organizationId: invitation.organizationId },
      },
      include: { organization: true, user: true },
    });
  }

  async changeRole(input: {
    organizationId: string;
    actorId: string;
    membershipId: string;
    role: OrgRole;
  }) {
    const membership = await this.prisma.membership.findFirst({
      where: { id: input.membershipId, organizationId: input.organizationId },
    });
    if (!membership) notFound();
    if (membership.role === OrgRole.ADMIN && input.role !== OrgRole.ADMIN) {
      const admins = await this.prisma.membership.count({
        where: { organizationId: input.organizationId, role: OrgRole.ADMIN },
      });
      if (admins <= 1) throw new ForbiddenException('The organization must keep one admin');
    }
    const updated = await this.prisma.membership.update({
      where: { id: membership.id },
      data: { role: input.role },
      include: { user: true, organization: true },
    });
    await this.audit.record({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: 'membership.role_changed',
      targetType: 'Membership',
      targetId: membership.id,
      metadata: { from: membership.role, to: input.role },
    });
    return updated;
  }
}
