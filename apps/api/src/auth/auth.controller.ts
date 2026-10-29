import { BadRequestException, Controller, Get, Post, Query, Req, Res } from '@nestjs/common';
import { PrismaService } from '@lexbridge/database';
import { isSafeReturnPath, SESSION_COOKIE } from '@lexbridge/shared';
import { Request, Response } from 'express';
import { appConfig } from '../config';
import { RateLimiter } from '../common/rate-limiter';
import { AuthContextService } from './auth-context.service';
import { AuthFlowService } from './auth-flow.service';
import { OidcService } from './oidc.service';
import { SessionService } from './session.service';

function cookieOptions() {
  const config = appConfig();
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: config.cookieSecure,
    path: '/',
    maxAge: config.sessionTtlSeconds * 1000,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly flow: AuthFlowService,
    private readonly sessions: SessionService,
    private readonly limiter: RateLimiter,
    private readonly context: AuthContextService,
    private readonly oidc: OidcService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('login')
  async login(
    @Query('returnTo') returnTo = '/app',
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const path = returnTo || '/app';
    if (!isSafeReturnPath(path)) throw new BadRequestException('Unsafe redirect');
    await this.limiter.consumeLogin(req.ip || req.socket.remoteAddress || 'unknown');
    const url = await this.flow.begin(path);
    res.redirect(url);
  }

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    const current = new URL(req.originalUrl, appConfig().apiOrigin);
    const result = await this.flow.complete(current);
    const sessionId = await this.sessions.create({
      userId: result.userId,
      activeOrganizationId: result.organizationId,
      idToken: result.idToken,
    });
    res.cookie(SESSION_COOKIE, sessionId, cookieOptions());
    res.redirect(`${appConfig().webOrigin}${result.returnTo}`);
  }

  @Get('logout')
  async logout(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.finishLogout(req, res, true);
  }

  @Post('logout')
  async logoutPost(@Req() req: Request, @Res() res: Response): Promise<void> {
    await this.finishLogout(req, res, false);
  }

  @Get('session')
  async session(@Req() req: Request, @Res() res: Response): Promise<void> {
    const ctx = await this.context.build(req);
    if (!ctx.user) {
      res.status(401).json({ user: null });
      return;
    }
    const memberships = await this.prisma.membership.findMany({
      where: { userId: ctx.user.id },
      include: { organization: true },
      orderBy: { createdAt: 'asc' },
    });
    res.json({
      user: ctx.user,
      membership: ctx.membership,
      organizations: memberships.map((membership) => ({
        id: membership.organizationId,
        name: membership.organization.name,
        slug: membership.organization.slug,
        role: membership.role,
      })),
    });
  }

  private async finishLogout(req: Request, res: Response, redirect: boolean): Promise<void> {
    const sessionId = req.cookies?.[SESSION_COOKIE] as string | undefined;
    let idToken: string | undefined;
    if (sessionId) {
      const session = await this.sessions.get(sessionId);
      idToken = session?.idToken;
      await this.sessions.revoke(sessionId);
    }
    res.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'lax',
      secure: appConfig().cookieSecure,
      path: '/',
    });
    if (!redirect) {
      res.status(200).json({ ok: true });
      return;
    }
    if (idToken) {
      try {
        res.redirect(await this.oidc.logoutUrl(idToken));
        return;
      } catch {
        // Local session is already revoked if the provider cannot be reached.
      }
    }
    res.redirect(appConfig().webOrigin);
  }
}
