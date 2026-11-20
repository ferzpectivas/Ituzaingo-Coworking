import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthUser, RequestWithUser } from '../auth-user';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { Role } from '../../storage/types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles || roles.length === 0) return true;
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user as AuthUser | undefined;
    if (!user) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'No tenés permisos para esta operación.',
      });
    }
    if (!roles.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: 'Tu rol no tiene acceso a esta operación.',
      });
    }
    return true;
  }
}
