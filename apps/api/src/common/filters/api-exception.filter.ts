import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import type { RequestWithUser } from '../auth-user';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<FastifyReply>();
    const request = host.switchToHttp().getRequest<RequestWithUser>();
    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = isHttp ? exception.getResponse() : null;
    const body =
      typeof payload === 'string'
        ? { message: payload }
        : payload && typeof payload === 'object'
          ? (payload as Record<string, unknown>)
          : {};

    const code =
      (typeof body.code === 'string' && body.code) ||
      (status === 401
        ? 'AUTH_INVALID_CREDENTIALS'
        : status === 403
          ? 'FORBIDDEN'
          : status === 404
            ? 'NOT_FOUND'
            : status === 409
              ? 'CONFLICT'
              : status === 422
                ? 'BUSINESS_RULE_VIOLATION'
                : status === 429
                  ? 'RATE_LIMITED'
                  : status >= 500
                    ? 'INTERNAL_ERROR'
                    : 'VALIDATION_ERROR');

    if (!isHttp || status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}: ${(exception as Error)?.message}`,
        (exception as Error)?.stack,
      );
    }

    const problem = {
      type: `https://api.coworking.ituzaingo.gob.ar/errors/${code.toLowerCase()}`,
      title: titleFor(status),
      status,
      code,
      detail:
        (typeof body.message === 'string' && body.message) ||
        (Array.isArray(body.message) ? body.message.join('. ') : undefined) ||
        (status >= 500 ? 'Ocurrió un error inesperado.' : 'Solicitud inválida.'),
      instance: request.url,
      errors: body.errors,
      meta: body.meta,
      timestamp: new Date().toISOString(),
    };

    void response.status(status).header('content-type', 'application/problem+json').send(problem);
  }
}

function titleFor(status: number): string {
  switch (status) {
    case 400:
      return 'Solicitud inválida';
    case 401:
      return 'No autenticado';
    case 403:
      return 'Acceso denegado';
    case 404:
      return 'No encontrado';
    case 409:
      return 'Conflicto';
    case 422:
      return 'Regla de negocio';
    case 429:
      return 'Demasiadas solicitudes';
    default:
      return status >= 500 ? 'Error interno' : 'Error';
  }
}
