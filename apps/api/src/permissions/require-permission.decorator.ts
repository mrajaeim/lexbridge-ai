import { SetMetadata } from '@nestjs/common';
import { Permission } from '@lexbridge/shared';
import { PERMISSION_KEY } from './permission.guard';

export const RequirePermission = (permission: Permission) => SetMetadata(PERMISSION_KEY, permission);
