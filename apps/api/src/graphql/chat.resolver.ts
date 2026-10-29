import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Permission } from '@lexbridge/shared';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { GqlContext } from '../auth/types';
import { ChatService } from '../chat/chat.service';
import { ExportsService } from '../exports/exports.service';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { PermissionGuard } from '../permissions/permission.guard';
import { AskQuestionInput, ConversationModel, ConversationSummaryModel, ExportJobModel, MessageModel } from './models';

function requireTenant(ctx: GqlContext) {
  if (!ctx.user || !ctx.membership) throw new ForbiddenException();
  return { userId: ctx.user.id, organizationId: ctx.membership.organizationId };
}

@Resolver()
export class ChatResolver {
  constructor(
    private readonly chat: ChatService,
    private readonly exports: ExportsService,
  ) {}

  @Query(() => [ConversationSummaryModel])
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission(Permission.ChatAsk)
  conversations(@Context() ctx: GqlContext) {
    const tenant = requireTenant(ctx);
    return this.chat.list(tenant.userId, tenant.organizationId);
  }

  @Query(() => ConversationModel)
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission(Permission.ChatAsk)
  conversation(@Context() ctx: GqlContext, @Args('id', { type: () => ID }) id: string) {
    const tenant = requireTenant(ctx);
    return this.chat.get(tenant.userId, tenant.organizationId, id);
  }

  @Query(() => ExportJobModel)
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission(Permission.ExportOwn)
  exportJob(@Context() ctx: GqlContext, @Args('id', { type: () => ID }) id: string) {
    const tenant = requireTenant(ctx);
    return this.exports.get(tenant.userId, tenant.organizationId, id);
  }

  @Mutation(() => MessageModel)
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission(Permission.ChatAsk)
  askQuestion(@Context() ctx: GqlContext, @Args('input') input: AskQuestionInput) {
    const tenant = requireTenant(ctx);
    return this.chat.ask({
      userId: tenant.userId,
      organizationId: tenant.organizationId,
      conversationId: input.conversationId,
      question: input.question,
    });
  }

  @Mutation(() => ExportJobModel)
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission(Permission.ExportOwn)
  requestPdfExport(
    @Context() ctx: GqlContext,
    @Args('conversationId', { type: () => ID }) conversationId: string,
  ) {
    const tenant = requireTenant(ctx);
    return this.exports.request(tenant.userId, tenant.organizationId, conversationId);
  }
}
