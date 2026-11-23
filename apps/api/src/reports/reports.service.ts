import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { JsonDbService } from '../storage/json-db.service';
import { addDays, daysBetween, todayISO, weekday } from '../common/time';
import { countOpenDays, isOpenDate, slotLabel } from '../common/slots';
import type { ReservationRecord } from '../storage/types';

export type ReportFormat = 'csv' | 'xlsx' | 'pdf';
export type ReportType = 'resumen' | 'reservas' | 'ocupacion' | 'equipos';

export interface ReportRange {
  from?: string;
  to?: string;
  space?: string;
}

interface Range {
  from: string;
  to: string;
  days: number;
  label: string;
}

const ACTIVE = new Set(['confirmada', 'en_curso', 'finalizada']);
const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

@Injectable()
export class ReportsService {
  constructor(private readonly db: JsonDbService) {}

  private range(input: ReportRange): Range {
    const to = input.to?.trim() || todayISO();
    const from = input.from?.trim() || addDays(to, -29);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      throw new BadRequestException({
        code: 'INVALID_RANGE',
        message: 'Las fechas deben tener formato YYYY-MM-DD.',
      });
    }
    const days = daysBetween(from, to) + 1;
    if (days <= 0) {
      throw new BadRequestException({
        code: 'INVALID_RANGE',
        message: 'La fecha inicial debe ser anterior a la final.',
      });
    }
    if (days > 366) {
      throw new BadRequestException({
        code: 'RANGE_TOO_LARGE',
        message: 'El rango máximo de reportes es de 366 días.',
      });
    }
    return { from, to, days, label: `${from} a ${to}` };
  }

  private inRange(reservation: ReservationRecord, range: Range, space?: string): boolean {
    if (reservation.date < range.from || reservation.date > range.to) return false;
    if (space && reservation.spaceCode !== space) return false;
    return true;
  }

  summary(input: ReportRange) {
    const range = this.range(input);
    const state = this.db.snapshot;
    const spaces = this.db.floorplan.spaces.filter((s) => s.bookable);
    const slots = state.settings.slots;
    const reservations = state.reservations.filter((r) => this.inRange(r, range, input.space));
    const active = reservations.filter((r) => ACTIVE.has(r.status));
    const activeOpen = active.filter((r) => isOpenDate(r.date, state.settings));
    const openDays = countOpenDays(range.from, range.to, state.settings);
    const totalCapacity = spaces.reduce((acc, s) => acc + (s.capacity ?? 0), 0);
    const availableSeatSlots = totalCapacity * slots.length * openDays;
    const occupiedSeatSlots = activeOpen.reduce((acc, r) => acc + r.partySize, 0);
    const occupancyRate = availableSeatSlots ? occupiedSeatSlots / availableSeatSlots : 0;

    const bySpace = spaces.map((space) => {
      const spaceReservations = reservations.filter((r) => r.spaceCode === space.code);
      const spaceActive = spaceReservations.filter((r) => ACTIVE.has(r.status));
      const spaceActiveOpen = spaceActive.filter((r) => isOpenDate(r.date, state.settings));
      const capacity = space.capacity ?? 0;
      const available = capacity * slots.length * openDays;
      const occupied = spaceActiveOpen.reduce((acc, r) => acc + r.partySize, 0);
      return {
        code: space.code,
        name: space.name,
        color: space.color,
        capacity,
        reservations: spaceReservations.length,
        people: occupied,
        cancelled: spaceReservations.filter((r) => r.status === 'cancelada').length,
        noShow: spaceReservations.filter((r) => r.status === 'no_show').length,
        occupancyRate: available ? occupied / available : 0,
        availableSeatSlots: available,
        occupiedSeatSlots: occupied,
      };
    });

    const bySlot = slots.map((slot) => {
      const slotReservations = reservations.filter((r) => r.slotId === slot.id);
      const slotActive = slotReservations.filter((r) => ACTIVE.has(r.status));
      const slotActiveOpen = slotActive.filter((r) => isOpenDate(r.date, state.settings));
      const available = totalCapacity * openDays;
      const occupied = slotActiveOpen.reduce((acc, r) => acc + r.partySize, 0);
      return {
        id: slot.id,
        label: slot.label,
        reservations: slotReservations.length,
        people: occupied,
        occupancyRate: available ? occupied / available : 0,
      };
    });

    const byWeekday = WEEKDAYS.map((name, index) => {
      const dayReservations = active.filter((r) => weekday(r.date) === index);
      return {
        weekday: index,
        name,
        reservations: dayReservations.length,
        people: dayReservations.reduce((acc, r) => acc + r.partySize, 0),
      };
    });

    const byDay: Array<{
      date: string;
      open: boolean;
      reservations: number;
      people: number;
      cancelled: number;
      noShow: number;
      occupancyRate: number;
    }> = [];
    for (let i = 0; i < range.days; i += 1) {
      const date = addDays(range.from, i);
      const open = isOpenDate(date, state.settings);
      const dayReservations = reservations.filter((r) => r.date === date);
      const dayActive = dayReservations.filter((r) => ACTIVE.has(r.status));
      const available = open ? totalCapacity * slots.length : 0;
      const occupied = dayActive.reduce((acc, r) => acc + r.partySize, 0);
      byDay.push({
        date,
        open,
        reservations: dayReservations.length,
        people: occupied,
        cancelled: dayReservations.filter((r) => r.status === 'cancelada').length,
        noShow: dayReservations.filter((r) => r.status === 'no_show').length,
        occupancyRate: available ? occupied / available : 0,
      });
    }

    const assignments = state.checkouts.filter(
      (c) => c.date >= range.from && c.date <= range.to,
    );
    const assignmentsOpen = assignments.filter((c) => isOpenDate(c.date, state.settings));
    const incidents = assignments.filter((c) => c.incident);
    const equipmentItems = state.gear.filter((g) => g.type);
    const equipmentAvailable = equipmentItems.length * slots.length * openDays;
    const equipment = {
      computers: equipmentItems.filter((g) => g.type === 'computadora').length,
      projectors: equipmentItems.filter((g) => g.type === 'proyector').length,
      reservations: assignments.length,
      deliveries: assignments.filter((c) => c.delivery).length,
      returns: assignments.filter((c) => c.returned).length,
      incidents: incidents.length,
      incidentsOpen: incidents.filter((c) => c.incident && !c.incident.resolved).length,
      utilizationRate: equipmentAvailable ? assignmentsOpen.length / equipmentAvailable : 0,
    };

    const peakDay = [...byDay].filter((day) => day.open).sort((a, b) => b.people - a.people)[0];
    const peakSlot = [...bySlot].sort((a, b) => b.people - a.people)[0];

    return {
      range: { from: range.from, to: range.to, days: range.days, openDays, label: range.label },
      generatedAt: new Date().toISOString(),
      timezone: state.settings.timezone,
      totals: {
        reservations: reservations.length,
        activeReservations: active.length,
        cancelled: reservations.filter((r) => r.status === 'cancelada').length,
        noShow: reservations.filter((r) => r.status === 'no_show').length,
        people: occupiedSeatSlots,
        capacity: totalCapacity,
        availableSeatSlots,
        occupiedSeatSlots,
        occupancyRate,
        cancellationRate: reservations.length
          ? reservations.filter((r) => r.status === 'cancelada').length / reservations.length
          : 0,
        noShowRate: reservations.length
          ? reservations.filter((r) => r.status === 'no_show').length / reservations.length
          : 0,
        averagePartySize: active.length
          ? active.reduce((acc, r) => acc + r.partySize, 0) / active.length
          : 0,
      },
      bySpace,
      bySlot,
      byWeekday,
      byDay,
      equipment,
      peak: {
        day: peakDay ?? null,
        slot: peakSlot ?? null,
      },
    };
  }

  reservationsRows(input: ReportRange) {
    const range = this.range(input);
    const state = this.db.snapshot;
    return state.reservations
      .filter((r) => this.inRange(r, range, input.space))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
      .map((r) => {
        const space = this.db.floorplan.spaces.find((s) => s.code === r.spaceCode);
        const holder = r.people.find((p) => p.personId === r.holderPersonId) ?? r.people[0];
        const assignments = state.checkouts.filter((c) => r.equipmentAssignmentIds.includes(c.id));
        return {
          codigo: r.code,
          fecha: r.date,
          franja: slotLabel(state.settings, r.slotId, r.startsAt, r.endsAt),
          espacio: space?.name ?? r.spaceCode,
          estado: r.status,
          titular: holder ? `${holder.firstName} ${holder.lastName}` : '',
          dniUltimos4: holder?.docLast4 ?? '',
          personas: r.partySize,
          acompanantes: r.partySize - 1,
          equipos: assignments.map((a) => a.assetTag).join(' '),
          computadoras: assignments.filter((a) => a.type === 'computadora').length,
          proyectores: assignments.filter((a) => a.type === 'proyector').length,
          creada: r.createdAt,
          notas: r.notes ?? '',
        };
      });
  }

  // -------------------------------------------------------------------------
  // Exportaciones
  // -------------------------------------------------------------------------
  private csvEscape(value: unknown): string {
    return `"${String(value ?? '').replace(/"/g, '""')}"`;
  }

  private toCsv(rows: Array<Record<string, unknown>>): string {
    if (rows.length === 0) return '\uFEFF';
    const headers = Object.keys(rows[0]);
    const lines = [headers.join(';')];
    for (const row of rows) {
      lines.push(headers.map((header) => this.csvEscape(row[header])).join(';'));
    }
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  }

  async export(format: ReportFormat, type: ReportType, input: ReportRange): Promise<{
    filename: string;
    contentType: string;
    body: Buffer | string;
  }> {
    if (format === 'csv') {
      const body = this.csv(type, input);
      return { filename: `reporte-${type}.csv`, contentType: 'text/csv; charset=utf-8', body };
    }
    if (format === 'xlsx') {
      const body = await this.xlsx(type, input);
      return {
        filename: `reporte-${type}.xlsx`,
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        body,
      };
    }
    if (format === 'pdf') {
      const body = await this.pdf(type, input);
      return { filename: `reporte-${type}.pdf`, contentType: 'application/pdf', body };
    }
    throw new BadRequestException({
      code: 'INVALID_FORMAT',
      message: 'El formato debe ser csv, xlsx o pdf.',
    });
  }

  csv(type: ReportType, input: ReportRange): string {
    const summary = this.summary(input);
    if (type === 'reservas') {
      return this.toCsv(this.reservationsRows(input));
    }
    if (type === 'ocupacion') {
      return this.toCsv(
        summary.byDay.map((day) => ({
          fecha: day.date,
          reservas: day.reservations,
          personas: day.people,
          canceladas: day.cancelled,
          ausentes: day.noShow,
          ocupacion: `${(day.occupancyRate * 100).toFixed(2)}%`,
        })),
      );
    }
    if (type === 'equipos') {
      const state = this.db.snapshot;
      const rows = state.checkouts
        .filter((c) => c.date >= summary.range.from && c.date <= summary.range.to)
        .map((c) => ({
          activo: c.assetTag,
          tipo: c.type,
          fecha: c.date,
          franja: c.slotId,
          estado: c.status,
          reserva: state.reservations.find((r) => r.id === c.reservationId)?.code ?? '',
          entregado: c.delivery?.at ?? '',
          devuelto: c.returned?.at ?? '',
          incidente: c.incident ? `${c.incident.kind}: ${c.incident.description}` : '',
        }));
      return this.toCsv(rows);
    }
    return this.toCsv(
      summary.bySpace.map((space) => ({
        espacio: space.name,
        capacidad: space.capacity,
        reservas: space.reservations,
        personas: space.people,
        canceladas: space.cancelled,
        ausentes: space.noShow,
        ocupacion: `${(space.occupancyRate * 100).toFixed(2)}%`,
      })),
    );
  }

  async xlsx(type: ReportType, input: ReportRange): Promise<Buffer> {
    const summary = this.summary(input);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Espacio de Coworking de Ituzaingó';
    workbook.created = new Date();

    const headerStyle = (sheet: ExcelJS.Worksheet, columns: string[]) => {
      sheet.addRow(columns);
      const row = sheet.getRow(1);
      row.font = { bold: true, color: { argb: 'FFF7F8F6' } };
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF12595A' } };
      row.alignment = { vertical: 'middle' };
      row.height = 22;
      sheet.views = [{ state: 'frozen', ySplit: 1 }];
    };

    const resumen = workbook.addWorksheet('Resumen');
    headerStyle(resumen, ['Indicador', 'Valor']);
    const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
    [
      ['Rango', summary.range.label],
      ['Reservas totales', summary.totals.reservations],
      ['Reservas activas', summary.totals.activeReservations],
      ['Canceladas', summary.totals.cancelled],
      ['Ausentes', summary.totals.noShow],
      ['Personas atendidas', summary.totals.people],
      ['Capacidad total', summary.totals.capacity],
      ['Ocupación', pct(summary.totals.occupancyRate)],
      ['Tasa de cancelación', pct(summary.totals.cancellationRate)],
      ['Tasa de ausencia', pct(summary.totals.noShowRate)],
      ['Promedio de personas por reserva', summary.totals.averagePartySize.toFixed(2)],
      ['Equipos: reservas', summary.equipment.reservations],
      ['Equipos: entregas', summary.equipment.deliveries],
      ['Equipos: devoluciones', summary.equipment.returns],
      ['Equipos: incidentes', summary.equipment.incidents],
      ['Equipos: utilización', pct(summary.equipment.utilizationRate)],
    ].forEach((row) => resumen.addRow(row));
    resumen.getColumn(1).width = 34;
    resumen.getColumn(2).width = 42;

    const espacios = workbook.addWorksheet('Espacios');
    headerStyle(espacios, ['Espacio', 'Capacidad', 'Reservas', 'Personas', 'Canceladas', 'Ausentes', 'Ocupación']);
    for (const space of summary.bySpace) {
      espacios.addRow([
        space.name,
        space.capacity,
        space.reservations,
        space.people,
        space.cancelled,
        space.noShow,
        pct(space.occupancyRate),
      ]);
    }
    espacios.columns.forEach((column, index) => {
      column.width = index === 0 ? 26 : 14;
    });

    const ocupacion = workbook.addWorksheet('Ocupación diaria');
    headerStyle(ocupacion, ['Fecha', 'Reservas', 'Personas', 'Canceladas', 'Ausentes', 'Ocupación']);
    for (const day of summary.byDay) {
      ocupacion.addRow([day.date, day.reservations, day.people, day.cancelled, day.noShow, pct(day.occupancyRate)]);
    }
    ocupacion.getColumn(1).width = 14;
    ocupacion.columns.forEach((column, index) => {
      if (index > 0) column.width = 14;
    });

    const reservas = workbook.addWorksheet('Reservas');
    const rows = this.reservationsRows(input);
    if (rows.length > 0) {
      headerStyle(reservas, Object.keys(rows[0]).map((key) => key.replace(/_/g, ' ')));
      for (const row of rows) reservas.addRow(Object.values(row));
      reservas.columns.forEach((column, index) => {
        column.width = index === 0 ? 18 : 16;
      });
    } else {
      reservas.addRow(['Sin reservas en el período']);
    }

    const equipos = workbook.addWorksheet('Equipos');
    const state = this.db.snapshot;
    const assignments = state.checkouts.filter(
      (c) => c.date >= summary.range.from && c.date <= summary.range.to,
    );
    headerStyle(equipos, ['Activo', 'Tipo', 'Fecha', 'Franja', 'Estado', 'Reserva', 'Incidente']);
    for (const assignment of assignments) {
      equipos.addRow([
        assignment.assetTag,
        assignment.type,
        assignment.date,
        assignment.slotId,
        assignment.status,
        state.reservations.find((r) => r.id === assignment.reservationId)?.code ?? '',
        assignment.incident ? `${assignment.incident.kind}: ${assignment.incident.description}` : '',
      ]);
    }
    equipos.columns.forEach((column, index) => {
      column.width = index === 6 ? 44 : 18;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  async pdf(type: ReportType, input: ReportRange): Promise<Buffer> {
    const summary = this.summary(input);
    const doc = new PDFDocument({ size: 'A4', margin: 46, info: { Title: `Reporte ${type}` } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<void>((resolve, reject) => {
      doc.on('end', () => resolve());
      doc.on('error', reject);
    });

    const teal = '#12595A';
    const gold = '#C9A66B';
    const pageWidth = doc.page.width - 92;

    const header = (title: string, subtitle: string) => {
      doc.rect(0, 0, doc.page.width, 78).fill(teal);
      doc.fillColor('#F7F8F6').font('Helvetica-Bold').fontSize(18).text(title, 46, 22);
      doc.font('Helvetica').fontSize(10).fillColor('#E6F2F0').text(subtitle, 46, 48);
      doc.fillColor('#2B2B2B');
    };

    const section = (title: string) => {
      if (doc.y > 700) doc.addPage();
      doc.moveDown(0.8);
      doc.font('Helvetica-Bold').fontSize(12).fillColor(teal).text(title);
      doc.moveTo(46, doc.y + 3).lineTo(46 + pageWidth, doc.y + 3).strokeColor(gold).lineWidth(1).stroke();
      doc.moveDown(0.4);
      doc.fillColor('#2B2B2B').font('Helvetica').fontSize(9);
    };

    const table = (columns: Array<{ label: string; width: number }>, rows: string[][]) => {
      const startX = 46;
      const drawHeader = () => {
        let x = startX;
        const y = doc.y;
        doc.font('Helvetica-Bold').fontSize(8).fillColor('#FFFFFF');
        doc.rect(startX, y - 2, pageWidth, 16).fill(teal);
        for (const column of columns) {
          doc.fillColor('#FFFFFF').text(column.label, x + 3, y + 2, { width: column.width - 6 });
          x += column.width;
        }
        doc.y = y + 18;
        doc.font('Helvetica').fontSize(8).fillColor('#2B2B2B');
      };
      drawHeader();
      for (const row of rows) {
        if (doc.y > 760) {
          doc.addPage();
          drawHeader();
        }
        let x = startX;
        const y = doc.y;
        for (let i = 0; i < columns.length; i += 1) {
          doc.text(row[i] ?? '', x + 3, y, { width: columns[i].width - 6, lineBreak: false });
          x += columns[i].width;
        }
        doc.moveDown(0.35);
      }
    };

    const kpi = (label: string, value: string) => {
      doc.font('Helvetica').fontSize(8).fillColor('#5A6A66').text(label);
      doc.font('Helvetica-Bold').fontSize(15).fillColor(teal).text(value);
      doc.moveDown(0.35);
    };

    if (type === 'reservas') {
      header('Reporte de reservas', summary.range.label);
      const rows = this.reservationsRows(input);
      section(`Detalle (${rows.length} reservas)`);
      table(
        [
          { label: 'Código', width: 95 },
          { label: 'Fecha', width: 55 },
          { label: 'Franja', width: 90 },
          { label: 'Espacio', width: 100 },
          { label: 'Estado', width: 62 },
          { label: 'Titular', width: 110 },
          { label: 'Pers.', width: 38 },
        ],
        rows.map((r) => [
          r.codigo,
          r.fecha,
          r.franja,
          r.espacio,
          r.estado,
          r.titular,
          String(r.personas),
        ]),
      );
    } else if (type === 'ocupacion') {
      header('Reporte de ocupación', summary.range.label);
      section('Indicadores generales');
      kpi('Ocupación promedio', `${(summary.totals.occupancyRate * 100).toFixed(1)}%`);
      kpi('Personas atendidas', String(summary.totals.people));
      kpi('Reservas', String(summary.totals.reservations));
      section('Ocupación por espacio');
      table(
        [
          { label: 'Espacio', width: 170 },
          { label: 'Capacidad', width: 85 },
          { label: 'Personas', width: 85 },
          { label: 'Reservas', width: 85 },
          { label: 'Ocupación', width: 100 },
        ],
        summary.bySpace.map((s) => [
          s.name,
          String(s.capacity),
          String(s.people),
          String(s.reservations),
          `${(s.occupancyRate * 100).toFixed(1)}%`,
        ]),
      );
      section('Detalle diario');
      table(
        [
          { label: 'Fecha', width: 90 },
          { label: 'Reservas', width: 80 },
          { label: 'Personas', width: 80 },
          { label: 'Canceladas', width: 85 },
          { label: 'Ausentes', width: 80 },
          { label: 'Ocupación', width: 90 },
        ],
        summary.byDay.map((d) => [
          d.date,
          String(d.reservations),
          String(d.people),
          String(d.cancelled),
          String(d.noShow),
          `${(d.occupancyRate * 100).toFixed(1)}%`,
        ]),
      );
    } else if (type === 'equipos') {
      header('Reporte de equipamiento', summary.range.label);
      section('Indicadores');
      kpi('Computadoras', String(summary.equipment.computers));
      kpi('Proyectores', String(summary.equipment.projectors));
      kpi('Entregas', String(summary.equipment.deliveries));
      kpi('Incidentes', String(summary.equipment.incidents));
      section('Asignaciones del período');
      const state = this.db.snapshot;
      const assignments = state.checkouts.filter(
        (c) => c.date >= summary.range.from && c.date <= summary.range.to,
      );
      table(
        [
          { label: 'Activo', width: 80 },
          { label: 'Tipo', width: 90 },
          { label: 'Fecha', width: 70 },
          { label: 'Estado', width: 80 },
          { label: 'Reserva', width: 110 },
          { label: 'Incidente', width: 120 },
        ],
        assignments.map((a) => [
          a.assetTag,
          a.type,
          a.date,
          a.status,
          state.reservations.find((r) => r.id === a.reservationId)?.code ?? '',
          a.incident ? a.incident.kind : '—',
        ]),
      );
    } else {
      header('Reporte ejecutivo', summary.range.label);
      section('Indicadores generales');
      kpi('Reservas', String(summary.totals.reservations));
      kpi('Personas atendidas', String(summary.totals.people));
      kpi('Ocupación promedio', `${(summary.totals.occupancyRate * 100).toFixed(1)}%`);
      kpi('Cancelaciones', `${(summary.totals.cancellationRate * 100).toFixed(1)}%`);
      kpi('Ausencias', `${(summary.totals.noShowRate * 100).toFixed(1)}%`);
      section('Ocupación por espacio');
      table(
        [
          { label: 'Espacio', width: 170 },
          { label: 'Reservas', width: 80 },
          { label: 'Personas', width: 80 },
          { label: 'Canceladas', width: 85 },
          { label: 'Ocupación', width: 100 },
        ],
        summary.bySpace.map((s) => [
          s.name,
          String(s.reservations),
          String(s.people),
          String(s.cancelled),
          `${(s.occupancyRate * 100).toFixed(1)}%`,
        ]),
      );
      section('Ocupación por franja');
      table(
        [
          { label: 'Franja', width: 160 },
          { label: 'Reservas', width: 90 },
          { label: 'Personas', width: 90 },
          { label: 'Ocupación', width: 110 },
        ],
        summary.bySlot.map((s) => [
          s.label,
          String(s.reservations),
          String(s.people),
          `${(s.occupancyRate * 100).toFixed(1)}%`,
        ]),
      );
      section('Equipamiento');
      table(
        [
          { label: 'Indicador', width: 220 },
          { label: 'Valor', width: 190 },
        ],
        [
          ['Computadoras', String(summary.equipment.computers)],
          ['Proyectores', String(summary.equipment.projectors)],
          ['Reservas de equipos', String(summary.equipment.reservations)],
          ['Entregas', String(summary.equipment.deliveries)],
          ['Devoluciones', String(summary.equipment.returns)],
          ['Incidentes', String(summary.equipment.incidents)],
          ['Utilización', `${(summary.equipment.utilizationRate * 100).toFixed(1)}%`],
        ],
      );
    }

    doc.moveDown(1.2);
    doc.font('Helvetica').fontSize(7).fillColor('#5A6A66');
    doc.text(
      `Generado ${new Date().toLocaleString('es-AR', { timeZone: summary.timezone })} · Espacio de Coworking de Ituzaingó · Documento de gestión interna`,
      46,
      undefined,
      { width: pageWidth, align: 'center' },
    );
    doc.end();
    await done;
    return Buffer.concat(chunks);
  }
}
