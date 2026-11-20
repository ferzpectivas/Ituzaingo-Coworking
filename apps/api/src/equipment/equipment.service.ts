import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JsonDbService } from '../storage/json-db.service';
import type { AuthUser } from '../common/auth-user';
import { randomId } from '../common/crypto';
import type {
  AccessoryChecklist,
  AccessoryCode,
  ChecklistRecord,
  EquipmentAssignmentRecord,
  EquipmentItemRecord,
  EquipmentType,
} from '../storage/types';
import { ACCESSORY_LABELS, REQUIRED_ACCESSORIES } from '../storage/types';
import type {
  ChecklistDto,
  CreateEquipmentDto,
  IncidentDto,
  UpdateEquipmentDto,
} from './dto/equipment.dto';

@Injectable()
export class EquipmentService {
  constructor(private readonly db: JsonDbService) {}

  private required(type: EquipmentType): AccessoryCode[] {
    return REQUIRED_ACCESSORIES[type];
  }

  private toChecklist(type: EquipmentType, dto: ChecklistDto): AccessoryChecklist {
    const out: AccessoryChecklist = {};
    for (const code of this.required(type)) out[code] = Boolean(dto[code]);
    return out;
  }

  inventory(filters: { type?: string; status?: string; q?: string }) {
    const state = this.db.snapshot;
    const q = filters.q?.trim().toLowerCase();
    const items = state.gear.filter((item) => {
      if (filters.type && item.type !== filters.type) return false;
      if (filters.status && item.status !== filters.status) return false;
      if (q) {
        const haystack = `${item.assetTag} ${item.model} ${item.serial}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
    return {
      items: items.map((item) => this.serializeItem(item)),
      totals: {
        total: items.length,
        computadoras: items.filter((i) => i.type === 'computadora').length,
        proyectores: items.filter((i) => i.type === 'proyector').length,
        disponibles: items.filter((i) => i.status === 'disponible').length,
        enUso: items.filter((i) => i.status === 'en_uso').length,
        mantenimiento: items.filter((i) => i.status === 'mantenimiento').length,
      },
      revision: state.meta.revision,
    };
  }

  private serializeItem(item: EquipmentItemRecord) {
    return {
      id: item.id,
      assetTag: item.assetTag,
      type: item.type,
      model: item.model,
      serial: item.serial,
      status: item.status,
      notes: item.notes,
      accessories: this.required(item.type).map((code) => ({
        code,
        label: ACCESSORY_LABELS[code],
        present: item.accessories[code],
      })),
      updatedAt: item.updatedAt,
    };
  }

  getItem(id: string) {
    const item = this.db.snapshot.gear.find((g) => g.id === id || g.assetTag === id);
    if (!item) {
      throw new NotFoundException({ code: 'EQUIPMENT_NOT_FOUND', message: 'El equipo no existe.' });
    }
    return this.serializeItem(item);
  }

  create(dto: CreateEquipmentDto, actor: AuthUser) {
    return this.db.transaction(
      (state) => {
        const assetTag = dto.assetTag.trim().toUpperCase();
        if (state.gear.some((g) => g.assetTag === assetTag)) {
          throw new ConflictException({
            code: 'ASSET_TAG_DUPLICATED',
            message: `Ya existe un equipo con el código ${assetTag}.`,
          });
        }
        const now = new Date().toISOString();
        const item: EquipmentItemRecord = {
          id: randomId('eq'),
          assetTag,
          type: dto.type,
          model: dto.model.trim(),
          serial: dto.serial.trim(),
          status: 'disponible',
          accessories: {
            funda: true,
            cargador: true,
            caja: true,
            hdmi: true,
            vga: true,
            cable_energia: true,
          },
          notes: dto.notes?.trim(),
          createdAt: now,
          updatedAt: now,
        };
        state.gear.push(item);
        this.db.pushAudit(state, {
          actorUserId: actor?.userId,
          actorRole: actor?.role,
          action: 'equipo.creado',
          entityType: 'equipment_item',
          entityId: item.id,
          after: { assetTag: item.assetTag, type: item.type },
        });
        return this.serializeItem(item);
      },
      { type: 'equipment.created' },
    );
  }

  update(id: string, dto: UpdateEquipmentDto, actor: AuthUser) {
    return this.db.transaction(
      (state) => {
        const item = state.gear.find((g) => g.id === id);
        if (!item) {
          throw new NotFoundException({ code: 'EQUIPMENT_NOT_FOUND', message: 'El equipo no existe.' });
        }
        if (dto.status === 'mantenimiento') {
          const assigned = state.checkouts.some(
            (c) => c.itemId === item.id && (c.status === 'reservada' || c.status === 'entregada'),
          );
          if (assigned) {
            throw new ConflictException({
              code: 'EQUIPMENT_ASSIGNED',
              message: 'No se puede poner en mantenimiento un equipo con reservas activas.',
            });
          }
        }
        const before = { status: item.status, notes: item.notes };
        if (dto.status) item.status = dto.status;
        if (dto.notes !== undefined) item.notes = dto.notes.trim();
        item.updatedAt = new Date().toISOString();
        this.db.pushAudit(state, {
          actorUserId: actor.userId,
          actorRole: actor.role,
          action: 'equipo.actualizado',
          entityType: 'equipment_item',
          entityId: item.id,
          before,
          after: { status: item.status, notes: item.notes },
        });
        return this.serializeItem(item);
      },
      { type: 'equipment.updated' },
    );
  }

  assignments(query: { reservationId?: string; status?: string; date?: string }) {
    const state = this.db.snapshot;
    const items = state.checkouts
      .filter((c) => {
        if (query.reservationId && c.reservationId !== query.reservationId) return false;
        if (query.status && c.status !== query.status) return false;
        if (query.date && c.date !== query.date) return false;
        return true;
      })
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((assignment) => this.serializeAssignment(assignment));
    return { items, total: items.length };
  }

  private serializeAssignment(assignment: EquipmentAssignmentRecord) {
    const state = this.db.snapshot;
    const item = state.gear.find((g) => g.id === assignment.itemId);
    const reservation = state.reservations.find((r) => r.id === assignment.reservationId);
    return {
      id: assignment.id,
      reservationId: assignment.reservationId,
      reservationCode: reservation?.code,
      itemId: assignment.itemId,
      assetTag: assignment.assetTag,
      type: assignment.type,
      model: item?.model,
      status: assignment.status,
      date: assignment.date,
      slotId: assignment.slotId,
      startsAt: assignment.startsAt,
      endsAt: assignment.endsAt,
      requiredAccessories: this.required(assignment.type).map((code) => ({
        code,
        label: ACCESSORY_LABELS[code],
      })),
      delivery: assignment.delivery,
      returned: assignment.returned,
      incident: assignment.incident,
    };
  }

  /**
   * Entrega de equipamiento con checklist obligatorio. Todos los accesorios
   * requeridos para el tipo de equipo deben estar presentes para poder entregar.
   */
  deliver(id: string, dto: { checklist: ChecklistDto }, actor: AuthUser) {
    return this.db.transaction(
      (state) => {
        const assignment = state.checkouts.find((c) => c.id === id);
        if (!assignment) {
          throw new NotFoundException({
            code: 'ASSIGNMENT_NOT_FOUND',
            message: 'La asignación de equipamiento no existe.',
          });
        }
        if (assignment.status !== 'reservada') {
          throw new ConflictException({
            code: 'INVALID_STATE_TRANSITION',
            message: 'Solo se pueden entregar equipos reservados.',
          });
        }
        const reservation = state.reservations.find((r) => r.id === assignment.reservationId);
        if (!reservation) {
          throw new NotFoundException({ code: 'RESERVATION_NOT_FOUND', message: 'La reserva no existe.' });
        }
        if (reservation.status === 'cancelada' || reservation.status === 'no_show') {
          throw new ConflictException({
            code: 'INVALID_STATE_TRANSITION',
            message: 'La reserva está cancelada o ausente.',
          });
        }
        const checklist = this.toChecklist(assignment.type, dto.checklist);
        const missing = this.required(assignment.type).filter((code) => !checklist[code]);
        if (missing.length > 0) {
          throw new UnprocessableEntityException({
            code: 'INCOMPLETE_CHECKLIST',
            message: `Faltan accesorios obligatorios: ${missing.map((c) => ACCESSORY_LABELS[c]).join(', ')}.`,
            meta: { missing },
          });
        }
        const at = new Date().toISOString();
        const record: ChecklistRecord = {
          at,
          byUserId: actor.userId,
          checklist,
          allOk: true,
          observations: dto.checklist.observations?.trim(),
        };
        assignment.delivery = record;
        assignment.status = 'entregada';
        const item = state.gear.find((g) => g.id === assignment.itemId);
        if (item) {
          item.status = 'en_uso';
          item.updatedAt = at;
        }
        this.db.pushAudit(state, {
          actorUserId: actor.userId,
          actorRole: actor.role,
          action: 'equipo.entregado',
          entityType: 'equipment_assignment',
          entityId: assignment.id,
          after: {
            reservationId: assignment.reservationId,
            assetTag: assignment.assetTag,
            checklist,
          },
        });
        return this.serializeAssignment(assignment);
      },
      { type: 'equipment.delivered', reservationId: undefined },
    );
  }

  /**
   * Devolución: los accesorios faltantes deben declararse como incidente con
   * descripción. Si el checklist está completo, el equipo vuelve a disponible.
   */
  returnItem(id: string, dto: { checklist: ChecklistDto; incident?: IncidentDto }, actor: AuthUser) {
    return this.db.transaction(
      (state) => {
        const assignment = state.checkouts.find((c) => c.id === id);
        if (!assignment) {
          throw new NotFoundException({
            code: 'ASSIGNMENT_NOT_FOUND',
            message: 'La asignación de equipamiento no existe.',
          });
        }
        if (assignment.status !== 'entregada') {
          throw new ConflictException({
            code: 'INVALID_STATE_TRANSITION',
            message: 'Solo se pueden devolver equipos entregados.',
          });
        }
        const checklist = this.toChecklist(assignment.type, dto.checklist);
        const missing = this.required(assignment.type).filter((code) => !checklist[code]);
        if (missing.length > 0 && !dto.incident) {
          throw new UnprocessableEntityException({
            code: 'INCIDENT_REQUIRED',
            message: 'Declará el incidente por los accesorios faltantes antes de devolver.',
            meta: { missing },
          });
        }
        if (dto.incident) {
          if (!dto.incident.description?.trim()) {
            throw new BadRequestException({
              code: 'INCIDENT_DESCRIPTION_REQUIRED',
              message: 'Describí el incidente detectado.',
            });
          }
          if (
            dto.incident.kind === 'faltante' &&
            dto.incident.accessories.some((code) => !missing.includes(code as AccessoryCode))
          ) {
            throw new BadRequestException({
              code: 'INCIDENT_MISMATCH',
              message: 'Los accesorios del incidente deben coincidir con los faltantes del checklist.',
            });
          }
        }
        const at = new Date().toISOString();
        const record: ChecklistRecord = {
          at,
          byUserId: actor.userId,
          checklist,
          allOk: missing.length === 0,
          observations: dto.checklist.observations?.trim(),
        };
        assignment.returned = record;
        assignment.status = 'devuelta';
        if (dto.incident) {
          assignment.incident = {
            at,
            byUserId: actor.userId,
            kind: dto.incident.kind,
            accessories: dto.incident.accessories as AccessoryCode[],
            description: dto.incident.description.trim(),
            resolved: Boolean(dto.incident.resolved),
          };
        }
        const item = state.gear.find((g) => g.id === assignment.itemId);
        if (item) {
          item.status = dto.incident && !dto.incident.resolved ? 'mantenimiento' : 'disponible';
          item.updatedAt = at;
        }
        this.db.pushAudit(state, {
          actorUserId: actor.userId,
          actorRole: actor.role,
          action: 'equipo.devuelto',
          entityType: 'equipment_assignment',
          entityId: assignment.id,
          after: {
            reservationId: assignment.reservationId,
            assetTag: assignment.assetTag,
            checklist,
            incident: assignment.incident,
          },
        });
        return this.serializeAssignment(assignment);
      },
      { type: 'equipment.returned' },
    );
  }

  reportIncident(id: string, dto: IncidentDto, actor: AuthUser) {
    return this.db.transaction(
      (state) => {
        const assignment = state.checkouts.find((c) => c.id === id);
        if (!assignment) {
          throw new NotFoundException({
            code: 'ASSIGNMENT_NOT_FOUND',
            message: 'La asignación de equipamiento no existe.',
          });
        }
        assignment.incident = {
          at: new Date().toISOString(),
          byUserId: actor.userId,
          kind: dto.kind,
          accessories: dto.accessories as AccessoryCode[],
          description: dto.description.trim(),
          resolved: Boolean(dto.resolved),
        };
        const item = state.gear.find((g) => g.id === assignment.itemId);
        if (item && !dto.resolved) {
          item.status = 'mantenimiento';
          item.updatedAt = assignment.incident.at;
        }
        this.db.pushAudit(state, {
          actorUserId: actor.userId,
          actorRole: actor.role,
          action: 'equipo.incidente',
          entityType: 'equipment_assignment',
          entityId: assignment.id,
          after: assignment.incident,
        });
        return this.serializeAssignment(assignment);
      },
      { type: 'equipment.incident' },
    );
  }
}
