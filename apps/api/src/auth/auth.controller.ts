import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { appConfig, COOKIE_ACCESS, COOKIE_REFRESH } from '../config';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

type CookieReply = FastifyReply & {
  setCookie: (name: string, value: string, options?: Record<string, unknown>) => void;
  clearCookie: (name: string, options?: Record<string, unknown>) => void;
};

function requestMeta(request: FastifyRequest) {
  return {
    ip: request.ip,
    userAgent: typeof request.headers['user-agent'] === 'string' ? request.headers['user-agent'] : undefined,
  };
}

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private setCookies(reply: CookieReply, accessToken: string, refreshToken: string): void {
    const base = {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: appConfig.cookieSecure,
    };
    reply.setCookie(COOKIE_ACCESS, accessToken, {
      ...base,
      path: '/',
      maxAge: 30 * 60,
    });
    reply.setCookie(COOKIE_REFRESH, refreshToken, {
      ...base,
      path: '/api/v1/auth',
      maxAge: 7 * 24 * 60 * 60,
    });
  }

  private clearCookies(reply: CookieReply): void {
    reply.clearCookie(COOKIE_ACCESS, { path: '/' });
    reply.clearCookie(COOKIE_REFRESH, { path: '/api/v1/auth' });
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Inicia sesión y emite cookies httpOnly' })
  async login(
    @Body() dto: LoginDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: CookieReply,
  ) {
    const result = await this.auth.login(dto.email, dto.password, requestMeta(request));
    this.setCookies(reply, result.accessToken, result.refreshToken);
    return { me: result.me };
  }

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Rota el refresh token y renueva el access token' })
  async refresh(
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: CookieReply,
  ) {
    const token = (request.cookies as Record<string, string> | undefined)?.[COOKIE_REFRESH];
    const result = await this.auth.refresh(token, requestMeta(request));
    this.setCookies(reply, result.accessToken, result.refreshToken);
    return { me: result.me };
  }

  @Public()
  @Post('logout')
  @ApiOperation({ summary: 'Cierra la sesión y revoca el refresh token' })
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: CookieReply) {
    const token = (request.cookies as Record<string, string> | undefined)?.[COOKIE_REFRESH];
    await this.auth.logout(token);
    this.clearCookies(reply);
    return { ok: true };
  }

  @Get('me')
  @ApiCookieAuth('cw_access')
  @ApiOperation({ summary: 'Devuelve el perfil y permisos del usuario autenticado' })
  me(@CurrentUser() user: AuthUser | undefined) {
    if (!user) {
      throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'Sesión requerida.' });
    }
    return this.auth.me(user);
  }

  @Post('password')
  @ApiCookieAuth('cw_access')
  @ApiOperation({
    summary: 'Cambia la contraseña del usuario autenticado y revoca sus sesiones',
  })
  async changePassword(
    @Body() dto: ChangePasswordDto,
    @CurrentUser() user: AuthUser | undefined,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: CookieReply,
  ) {
    if (!user) {
      throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'Sesión requerida.' });
    }
    const result = await this.auth.changePassword(
      user,
      dto.currentPassword,
      dto.newPassword,
      requestMeta(request),
    );
    // Las sesiones persistidas quedaron revocadas: se limpian las cookies para
    // forzar un inicio de sesión con la nueva contraseña.
    this.clearCookies(reply);
    return result;
  }
}
