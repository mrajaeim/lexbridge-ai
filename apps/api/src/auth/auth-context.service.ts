import { Injectable } from '@nestjs/common';
import { PrismaService } from '@lexbridge/database';
import { SESSION_COOKIE } from '@lexbridge/shared';
import { Request } from 'express';
import { SessionService } from './session.service';
import { AuthMembership, AuthUser, GqlContext } from './types';

@Injectable()
export class AuthContextService {
  constructor(
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
  ) {}

  async build(req: Request): Promise<Omit<GqlContext, 'res'>> {
    const sessionId = req.cookies?.[SESSION_COOKIE] ?? null;
    if (!sessionId) return { req, sessionId: null, user: null, membership: null };
    const session = await this.sessions.get(sessionId);
    if (!session) return { req, sessionId: null, user: null, membership: null };
    const user = await this.prisma.user.findUnique({ where: { id: session.userId } });
    if (!user) return { req, sessionId: null, user: null, membership: null };
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      emailVerified: user.emailVerified,
    };
    let membership: AuthMembership | null = null;
    if (session.activeOrganizationId) {
      const row = await this.prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: session.activeOrganizationId,
          },
        },
        include: { organization: true },
      });
      if (row) {
        membership = {
          organizationId: row.organizationId,
          role: row.role,
          organizationName: row.organization.name,
          organizationSlug: row.organization.slug,
        };
      }
    }
    return { req, sessionId, user: authUser, membership };
  }
}
