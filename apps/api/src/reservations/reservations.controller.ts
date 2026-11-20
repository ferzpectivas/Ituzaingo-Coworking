import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/auth-user';
import { ReservationsService } from './reservations.service';
import {
  CancelReservationDto,
  CreateReservationDto,
  UpdateReservationDto,
} from './dto/reservation.dto';

@ApiTags('Reservas')
@ApiCookieAuth('cw_access')
@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista reservas según rol, con filtros y paginación' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('space') space?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
    @Query('equipment') equipment?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.reservations.list(user, {
      from,
      to,
      space,
      status,
      q,
      equipment,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Post()
  @ApiOperation({ summary: 'Crea una reserva con titular, acompañantes y equipamiento' })
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReservationDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.reservations.create(user, dto, idempotencyKey);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle completo de una reserva' })
  detail(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reservations.getOne(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edita una reserva confirmada' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return this.reservations.update(user, id, dto);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Historial de eventos de la reserva' })
  timeline(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reservations.timeline(user, id);
  }

  @Get(':id/ics')
  @ApiOperation({ summary: 'Descarga el evento en formato iCalendar' })
  async ics(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ) {
    const body = this.reservations.ics(user, id);
    void reply
      .header('content-type', 'text/calendar; charset=utf-8')
      .header('content-disposition', `attachment; filename="reserva-${id}.ics"`);
    return body;
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancela una reserva confirmada' })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.reservations.cancel(user, id, dto.reason);
  }

  @Roles('administrador')
  @Post(':id/check-in')
  @ApiOperation({ summary: 'Registra el ingreso de la reserva (administrador)' })
  checkIn(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reservations.checkIn(user, id);
  }

  @Roles('administrador')
  @Post(':id/check-out')
  @ApiOperation({ summary: 'Finaliza la reserva con devolución completa (administrador)' })
  checkOut(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reservations.checkOut(user, id);
  }

  @Roles('administrador')
  @Post(':id/no-show')
  @ApiOperation({ summary: 'Marca la reserva como ausente (administrador)' })
  noShow(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.reservations.noShow(user, id);
  }
}
