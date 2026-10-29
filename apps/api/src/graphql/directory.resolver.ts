import { ForbiddenException } from '@nestjs/common';
import { Args, Context, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { Permission } from '@lexbridge/shared';
import { GqlAuthGuard } from '../auth/gql-auth.guard';
import { GqlContext } from '../auth/types';
import { DocumentsService } from '../documents/documents.service';
import { RequirePermission } from '../permissions/require-permission.decorator';
import { PermissionGuard } from '../permissions/permission.guard';
import { OrganizationsService } from '../organizations/organizations.service';
import {
  AuditLogModel,
  ChangeRoleInput,
  CreateDocumentInput,
  DocumentModel,
  InvitationModel,
  InviteUserInput,
  MemberModel,
  OrganizationModel,
  UserModel,
} from './models';

function requireTenant(ctx: GqlContext) {
  if (!ctx.user || !ctx.membership || !ctx.sessionId) throw new ForbiddenException();
  return {
    userId: ctx.user.id,
    organizationId: ctx.membership.organizationId,
    role: ctx.membership.role,
    sessionId: ctx.sessionId,
    email: ctx.user.email,
  };
}

@Resolver()
export class DirectoryResolver {
  constructor(
    private readonly organizationsService: OrganizationsService,
    private readonly documentsService: DocumentsService,
  ) {}

  @Query(() => String)
  health(): string {
    return 'ok';
  }

  @Query(() => UserModel)
  @UseGuards(GqlAuthGuard)
  me(@Context() ctx: GqlContext): UserModel {
    return ctx.user!;
  }

  @Query(() => [OrganizationModel])
  @UseGuards(GqlAuthGuard)
  async organizations(@Context() ctx: GqlContext): Promise<OrganizationModel[]> {
    const rows = await this.organizationsService.listForUser(ctx.user!.id);
    return rows.map((row) => ({
      id: row.organization.id,
      name: row.organization.name,
      slug: row.organization.slug,
      role: row.role,
    }));
  }

  @Query(() => [MemberModel])
  @UseGuards(GqlAuthGuard, PermissionGuard)
  async members(@Context() ctx: GqlContext): Promise<MemberModel[]> {
    const tenant = requireTenant(ctx);
    const rows = await this.organizationsService.members(tenant.organizationId);
    return rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      email: row.user.email,
      name: row.user.name,
      role: row.role,
    }));
  }

  @Query(() => [AuditLogModel])
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MemberRoleChange)
  async auditLogs(@Context() ctx: GqlContext): Promise<AuditLogModel[]> {
    const tenant = requireTenant(ctx);
    const rows = await this.organizationsService.auditLog(tenant.organizationId);
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      targetType: row.targetType,
      targetId: row.targetId,
      createdAt: row.createdAt,
    }));
  }

  @Query(() => [DocumentModel])
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission(Permission.DocumentRead)
  documents(@Context() ctx: GqlContext) {
    const tenant = requireTenant(ctx);
    return this.documentsService.list(tenant.organizationId, tenant.role);
  }

  @Query(() => DocumentModel)
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission(Permission.DocumentRead)
  document(@Context() ctx: GqlContext, @Args('id', { type: () => ID }) id: string) {
    const tenant = requireTenant(ctx);
    return this.documentsService.get(tenant.organizationId, tenant.role, id);
  }

  @Mutation(() => OrganizationModel)
  @UseGuards(GqlAuthGuard)
  async switchOrganization(
    @Context() ctx: GqlContext,
    @Args('organizationId', { type: () => ID }) organizationId: string,
  ): Promise<OrganizationModel> {
    if (!ctx.user || !ctx.sessionId) throw new ForbiddenException();
    const membership = await this.organizationsService.switchOrganization(ctx.user.id, ctx.sessionId, organizationId);
    return {
      id: membership.organization.id,
      name: membership.organization.name,
      slug: membership.organization.slug,
      role: membership.role,
    };
  }

  @Mutation(() => InvitationModel)
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MemberInvite)
  inviteUser(@Context() ctx: GqlContext, @Args('input') input: InviteUserInput) {
    const tenant = requireTenant(ctx);
    return this.organizationsService.invite({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      email: input.email,
      role: input.role,
    });
  }

  @Mutation(() => MemberModel)
  @UseGuards(GqlAuthGuard)
  async acceptInvitation(@Context() ctx: GqlContext, @Args('token') token: string): Promise<MemberModel> {
    if (!ctx.user) throw new ForbiddenException();
    const membership = await this.organizationsService.accept(ctx.user, token, ctx.sessionId);
    return {
      id: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
    };
  }

  @Mutation(() => MemberModel)
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission(Permission.MemberRoleChange)
  async changeUserRole(@Context() ctx: GqlContext, @Args('input') input: ChangeRoleInput): Promise<MemberModel> {
    const tenant = requireTenant(ctx);
    const membership = await this.organizationsService.changeRole({
      organizationId: tenant.organizationId,
      actorId: tenant.userId,
      membershipId: input.membershipId,
      role: input.role,
    });
    return {
      id: membership.id,
      userId: membership.userId,
      email: membership.user.email,
      name: membership.user.name,
      role: membership.role,
    };
  }

  @Mutation(() => DocumentModel)
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission(Permission.DocumentWrite)
  createDocument(@Context() ctx: GqlContext, @Args('input') input: CreateDocumentInput) {
    const tenant = requireTenant(ctx);
    return this.documentsService.create({
      organizationId: tenant.organizationId,
      userId: tenant.userId,
      title: input.title,
      body: input.body,
      publish: input.publish,
    });
  }

  @Mutation(() => DocumentModel)
  @UseGuards(GqlAuthGuard, PermissionGuard)
  @RequirePermission(Permission.DocumentWrite)
  publishDocument(@Context() ctx: GqlContext, @Args('id', { type: () => ID }) id: string) {
    const tenant = requireTenant(ctx);
    return this.documentsService.publish(tenant.organizationId, tenant.userId, id);
  }
}
