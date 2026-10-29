import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { OrgRole, Permission, hasPermission } from '@lexbridge/shared';
import { GqlContext } from '../auth/types';

export const PERMISSION_KEY = 'lexbridge:permission';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const permission = this.reflector.getAllAndOverride<Permission | undefined>(PERMISSION_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!permission) return true;
    const ctx = GqlExecutionContext.create(context).getContext<GqlContext>();
    if (!ctx.membership) throw new ForbiddenException();
    const role = ctx.membership.role as OrgRole;
    if (!hasPermission(role, permission)) throw new ForbiddenException();
    return true;
  }
}
