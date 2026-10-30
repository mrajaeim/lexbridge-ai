import { Controller, Get, Param, Query, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { pipeline } from 'stream/promises';
import { AuthContextService } from './auth/auth-context.service';
import { ChatService } from './chat/chat.service';
import { ExportsService } from './exports/exports.service';

@Controller()
export class HttpApiController {
  constructor(
    private readonly auth: AuthContextService,
    private readonly chat: ChatService,
    private readonly exports: ExportsService,
  ) {}

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  @Get('chat/stream/:conversationId')
  async stream(
    @Param('conversationId') conversationId: string,
    @Query('messageId') messageId: string | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const ctx = await this.auth.build(req);
    if (!ctx.user || !ctx.membership) throw new UnauthorizedException();
    await this.chat.assertReadable(ctx.user.id, ctx.membership.organizationId, conversationId, messageId);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();
    await this.chat.pipe({
      userId: ctx.user.id,
      organizationId: ctx.membership.organizationId,
      conversationId,
      messageId,
      res,
    });
  }

  @Get('exports/:id/file')
  async download(@Param('id') id: string, @Req() req: Request, @Res() res: Response): Promise<void> {
    const ctx = await this.auth.build(req);
    if (!ctx.user || !ctx.membership) throw new UnauthorizedException();
    const opened = await this.exports.openDownload(ctx.user.id, ctx.membership.organizationId, id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="lexbridge-${id}.pdf"`);
    try {
      await pipeline(opened.stream, res);
    } catch {
      if (!res.headersSent) res.status(404).end();
    }
  }
}
