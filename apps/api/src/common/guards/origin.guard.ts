import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { appConfig } from '../../config';
import type { RequestWithUser } from '../auth-user';

@Injectable()
export class OriginGuard implements CanActivate {
  private readonly allowed = appConfig.webOrigin
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const method = (request.method ?? 'GET').toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return true;

    const header = request.headers.origin;
    const origin = Array.isArray(header) ? header[0] : header;
    const fetchSite = request.headers['sec-fetch-site'];
    if (fetchSite === 'cross-site') {
      throw new ForbiddenException({
        code: 'CROSS_SITE_BLOCKED',
        message: 'Solicitud cruzada bloqueada.',
      });
    }
    if (origin && !this.allowed.includes(origin)) {
      throw new ForbiddenException({
        code: 'ORIGIN_NOT_ALLOWED',
        message: 'Origen no autorizado.',
      });
    }
    return true;
  }
}
