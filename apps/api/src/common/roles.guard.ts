import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '@prisma/client';
import { hasAdminPermission, type AdminPermission } from './admin-permissions';
import type { AuthenticatedRequest } from './authenticated-request';
import { PERMISSIONS_KEY } from './permissions.decorator';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (requiredRoles?.length && !requiredRoles.includes(request.user.role)) {
      throw new ForbiddenException('当前账号没有执行该操作的权限');
    }

    const requiredPermissions = this.reflector.getAllAndOverride<AdminPermission[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredPermissions?.some((permission) => !hasAdminPermission(request.user.role, permission))) {
      throw new ForbiddenException('当前账号没有执行该操作的权限');
    }
    return true;
  }
}
