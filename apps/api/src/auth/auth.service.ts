import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import crypto from 'node:crypto';
import { appConfig } from '../config';
import { hashPasswordSync, hashToken, randomId, verifyPassword } from '../common/crypto';
import { JsonDbService } from '../storage/json-db.service';
import type { Role } from '../storage/types';
import type { AuthUser } from '../common/auth-user';

const PERMISSIONS: Record<Role, string[]> = {
  socio: [
    'map:read',
    'reservation:create',
    'reservation:read:own',
    'reservation:cancel:own',
    'reservation:update:own',
    'equipment:read',
  ],
  administrador: ['*'],
  director: [
    'map:read',
    'reservation:read:all',
    'audit:read',
    'reports:read',
    'reports:export',
    'equipment:read',
  ],
};

export interface SessionMeta {
  ip?: string;
  userAgent?: string;
}

const LOGIN_WINDOW_MS = 15 * 60_000;
const LOGIN_MAX_FAILURES = 5;
const LOGIN_BLOCK_MS = 10 * 60_000;

interface LoginAttempt {
  failures: number;
  firstAt: number;
  blockedUntil?: number;
}

@Injectable()
export class AuthService {
  // Control de fuerza bruta en memoria: suficiente para un único nodo con
  // persistencia JSON. Se reinicia al reiniciar la API.
  private readonly loginAttempts = new Map<string, LoginAttempt>();

  constructor(
    private readonly db: JsonDbService,
    private readonly jwt: JwtService,
  ) {}

  private attemptKey(email: string, meta: SessionMeta): string {
    return `${email.trim().toLowerCase()}|${meta.ip ?? 'sin-ip'}`;
  }

  private assertNotBlocked(key: string): void {
    const attempt = this.loginAttempts.get(key);
    if (!attempt?.blockedUntil) return;
    const now = Date.now();
    if (attempt.blockedUntil > now) {
      const minutes = Math.ceil((attempt.blockedUntil - now) / 60_000);
      throw new HttpException(
        {
          code: 'AUTH_RATE_LIMITED',
          message: `Demasiados intentos fallidos. Probá nuevamente en ${minutes} minuto(s).`,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.loginAttempts.delete(key);
  }

  private registerFailure(key: string): void {
    const now = Date.now();
    if (this.loginAttempts.size > 5_000) {
      for (const [entryKey, entry] of this.loginAttempts) {
        const expired = (entry.blockedUntil ?? entry.firstAt + LOGIN_WINDOW_MS) < now;
        if (expired) this.loginAttempts.delete(entryKey);
      }
    }
    const current = this.loginAttempts.get(key);
    if (!current || now - current.firstAt > LOGIN_WINDOW_MS) {
      this.loginAttempts.set(key, { failures: 1, firstAt: now });
      return;
    }
    current.failures += 1;
    if (current.failures >= LOGIN_MAX_FAILURES) {
      current.blockedUntil = now + LOGIN_BLOCK_MS;
    }
  }

  private async accessToken(user: AuthUser): Promise<string> {
    return this.jwt.signAsync({
      sub: user.userId,
      email: user.email,
      role: user.role,
      personId: user.personId,
    });
  }

  private toAuthUser(userId: string): AuthUser | null {
    const state = this.db.snapshot;
    const user = state.users.find((u) => u.id === userId && u.active);
    const person = user ? state.persons.find((p) => p.id === user.personId) : undefined;
    if (!user || !person) return null;
    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      personId: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      docLast4: person.docLast4,
    };
  }

  private meResponse(user: AuthUser) {
    return {
      id: user.userId,
      email: user.email,
      role: user.role,
      permissions: PERMISSIONS[user.role],
      person: {
        id: user.personId,
        firstName: user.firstName,
        lastName: user.lastName,
        docLast4: user.docLast4,
      },
    };
  }

  async login(email: string, password: string, meta: SessionMeta) {
    const key = this.attemptKey(email, meta);
    this.assertNotBlocked(key);
    const state = this.db.snapshot;
    const user = state.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
    if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
      this.registerFailure(key);
      throw new UnauthorizedException({
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Email o contraseña incorrectos.',
      });
    }
    this.loginAttempts.delete(key);
    const authUser = this.toAuthUser(user.id);
    if (!authUser) {
      throw new UnauthorizedException({
        code: 'ACCOUNT_DISABLED',
        message: 'La cuenta está deshabilitada.',
      });
    }

    const accessToken = await this.accessToken(authUser);
    const refreshToken = crypto.randomBytes(48).toString('base64url');
    const now = new Date();
    const session = {
      id: randomId('ses'),
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
      ip: meta.ip,
      userAgent: meta.userAgent,
    };

    await this.db.transaction(
      (draft) => {
        const target = draft.users.find((u) => u.id === user.id);
        if (target) target.lastLoginAt = now.toISOString();
        draft.sessions = draft.sessions.filter(
          (s) => !s.revokedAt && new Date(s.expiresAt).getTime() > now.getTime(),
        );
        draft.sessions.push(session);
        this.db.pushAudit(draft, {
          actorUserId: user.id,
          actorRole: user.role,
          action: 'auth.login',
          entityType: 'user',
          entityId: user.id,
          ip: meta.ip,
        });
      },
      { type: 'auth.login' },
    );

    return { accessToken, refreshToken, me: this.meResponse(authUser) };
  }

  async refresh(refreshToken: string | undefined, meta: SessionMeta) {
    if (!refreshToken) {
      throw new UnauthorizedException({
        code: 'REFRESH_REQUIRED',
        message: 'La sesión no está disponible. Iniciá sesión nuevamente.',
      });
    }
    const tokenHash = hashToken(refreshToken);
    const session = this.db.snapshot.sessions.find((s) => s.tokenHash === tokenHash);
    const now = new Date();
    if (!session || session.revokedAt || new Date(session.expiresAt).getTime() <= now.getTime()) {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'La sesión expiró. Iniciá sesión nuevamente.',
      });
    }
    const authUser = this.toAuthUser(session.userId);
    if (!authUser) {
      throw new UnauthorizedException({ code: 'ACCOUNT_DISABLED', message: 'Cuenta deshabilitada.' });
    }

    const newRefresh = crypto.randomBytes(48).toString('base64url');
    const newSession = {
      id: randomId('ses'),
      userId: session.userId,
      tokenHash: hashToken(newRefresh),
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 7 * 86_400_000).toISOString(),
      ip: meta.ip,
      userAgent: meta.userAgent,
    };
    await this.db.transaction((draft) => {
      const current = draft.sessions.find((s) => s.id === session.id);
      if (current) current.revokedAt = now.toISOString();
      draft.sessions.push(newSession);
    });

    return {
      accessToken: await this.accessToken(authUser),
      refreshToken: newRefresh,
      me: this.meResponse(authUser),
    };
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = hashToken(refreshToken);
    if (!this.db.snapshot.sessions.some((s) => s.tokenHash === tokenHash && !s.revokedAt)) return;
    await this.db.transaction((draft) => {
      const session = draft.sessions.find((s) => s.tokenHash === tokenHash && !s.revokedAt);
      if (session) {
        session.revokedAt = new Date().toISOString();
        this.db.pushAudit(draft, {
          actorUserId: session.userId,
          action: 'auth.logout',
          entityType: 'session',
          entityId: session.id,
        });
      }
    });
  }

  me(user: AuthUser) {
    return this.meResponse(user);
  }

  async changePassword(
    user: AuthUser,
    currentPassword: string,
    newPassword: string,
    meta: SessionMeta,
  ) {
    const record = this.db.snapshot.users.find((u) => u.id === user.userId);
    if (!record) {
      throw new UnauthorizedException({ code: 'AUTH_REQUIRED', message: 'Sesión requerida.' });
    }
    if (!verifyPassword(currentPassword, record.passwordHash)) {
      throw new ForbiddenException({
        code: 'INVALID_CURRENT_PASSWORD',
        message: 'La contraseña actual no es correcta.',
      });
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_REUSED',
        message: 'La nueva contraseña debe ser distinta de la actual.',
      });
    }

    const now = new Date().toISOString();
    await this.db.transaction(
      (draft) => {
        const target = draft.users.find((u) => u.id === user.userId);
        if (!target) return;
        target.passwordHash = hashPasswordSync(newPassword);
        // Al cambiar la contraseña se revocan las sesiones persistidas: el resto
        // de los dispositivos deberá iniciar sesión nuevamente.
        for (const session of draft.sessions) {
          if (session.userId === user.userId && !session.revokedAt) {
            session.revokedAt = now;
          }
        }
        this.db.pushAudit(draft, {
          actorUserId: user.userId,
          actorRole: user.role,
          action: 'auth.password_changed',
          entityType: 'user',
          entityId: user.userId,
          ip: meta.ip,
        });
      },
      { type: 'auth.password_changed' },
    );

    return { ok: true, message: 'Contraseña actualizada. Volvé a iniciar sesión en los demás dispositivos.' };
  }
}
