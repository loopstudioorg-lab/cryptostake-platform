import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { Role } from '@prisma/client';

const ROLE_HIERARCHY: Role[] = ['USER', 'SUPPORT', 'ADMIN', 'SUPER_ADMIN'];

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    
    if (!user || !user.role) {
      throw new ForbiddenException('Access denied');
    }

    const userRoleIndex = ROLE_HIERARCHY.indexOf(user.role);
    
    // Check if user has any of the required roles (or higher)
    const hasPermission = requiredRoles.some(role => {
      const requiredRoleIndex = ROLE_HIERARCHY.indexOf(role);
      return userRoleIndex >= requiredRoleIndex;
    });

    if (!hasPermission) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
