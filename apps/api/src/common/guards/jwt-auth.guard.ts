import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { COOKIE_ACCESS } from '../../config';
import { JsonDbService } from '../../storage/json-db.service';
import type { AuthUser, RequestWithUser } from '../auth-user';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  personId: string;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly db: JsonDbService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;
    const bearer = Array.isArray(header) ? header[0] : header;
    const token =
      request.cookies?.[COOKIE_ACCESS] ??
      (bearer?.toLowerCase().startsWith('bearer ') ? bearer.slice(7) : undefined);

    if (!token) {
      if (isPublic) return true;
      throw new UnauthorizedException({
        code: 'AUTH_REQUIRED',
        message: 'Se requiere iniciar sesión.',
      });
    }

    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const state = this.db.snapshot;
      const user = state.users.find((u) => u.id === payload.sub && u.active);
      const person = user ? state.persons.find((p) => p.id === user.personId) : undefined;
      if (!user || !person) throw new Error('Usuario inactivo');
      const authUser: AuthUser = {
        userId: user.id,
        email: user.email,
        role: user.role,
        personId: user.personId,
        firstName: person.firstName,
        lastName: person.lastName,
        docLast4: person.docLast4,
      };
      request.user = authUser;
      return true;
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException({
        code: 'TOKEN_EXPIRED',
        message: 'La sesión expiró. Volvé a iniciar sesión.',
      });
    }
  }
}
