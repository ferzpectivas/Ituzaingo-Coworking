import { Injectable } from '@nestjs/common';
import { JsonDbService } from '../storage/json-db.service';

export interface AuditQuery {
  action?: string;
  actorUserId?: string;
  entityType?: string;
  entityId?: string;
  from?: string;
  to?: string;
  q?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class AuditService {
  constructor(private readonly db: JsonDbService) {}

  list(query: AuditQuery) {
    const state = this.db.snapshot;
    const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 1000);
    const offset = Math.max(Number(query.offset) || 0, 0);
    const q = query.q?.trim().toLowerCase();

    const filtered = state.audit.filter((event) => {
      if (query.action && event.action !== query.action) return false;
      if (query.actorUserId && event.actorUserId !== query.actorUserId) return false;
      if (query.entityType && event.entityType !== query.entityType) return false;
      if (query.entityId && event.entityId !== query.entityId) return false;
      if (query.from && event.at.slice(0, 10) < query.from) return false;
      if (query.to && event.at.slice(0, 10) > query.to) return false;
      if (q) {
        const actor = state.users.find((u) => u.id === event.actorUserId);
        const person = actor ? state.persons.find((p) => p.id === actor.personId) : undefined;
        const haystack = [
          event.action,
          event.entityType,
          event.entityId,
          actor?.email,
          person ? `${person.firstName} ${person.lastName}` : '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...filtered].sort((a, b) => b.at.localeCompare(a.at));
    const page = sorted.slice(offset, offset + limit);

    return {
      items: page.map((event) => {
        const actor = state.users.find((u) => u.id === event.actorUserId);
        const person = actor ? state.persons.find((p) => p.id === actor.personId) : undefined;
        return {
          id: event.id,
          at: event.at,
          action: event.action,
          entityType: event.entityType,
          entityId: event.entityId,
          actorRole: event.actorRole ?? 'sistema',
          actor: person ? `${person.firstName} ${person.lastName}` : 'Sistema',
          actorEmail: actor?.email,
          ip: event.ip,
          before: event.before,
          after: event.after,
        };
      }),
      total: sorted.length,
      limit,
      offset,
      actions: [...new Set(state.audit.map((e) => e.action))].sort(),
      revision: state.meta.revision,
    };
  }

  csv(query: AuditQuery): string {
    const result = this.list({ ...query, limit: 1000, offset: 0 });
    const header = ['fecha', 'accion', 'entidad', 'id_entidad', 'actor', 'rol', 'email', 'ip'];
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const lines = [header.join(';')];
    for (const item of result.items) {
      lines.push(
        [
          item.at,
          item.action,
          item.entityType,
          item.entityId,
          item.actor,
          item.actorRole,
          item.actorEmail,
          item.ip,
        ]
          .map(escape)
          .join(';'),
      );
    }
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  }
}
