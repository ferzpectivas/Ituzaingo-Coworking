import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthUser } from '../common/auth-user';
import { EquipmentService } from './equipment.service';
import {
  CreateEquipmentDto,
  DeliveryDto,
  IncidentDto,
  ReturnDto,
  UpdateEquipmentDto,
} from './dto/equipment.dto';

@ApiTags('Equipamiento')
@ApiCookieAuth('cw_access')
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipment: EquipmentService) {}

  @Get()
  @Roles('administrador', 'director')
  @ApiOperation({ summary: 'Inventario de notebooks, proyectores y pizarras' })
  inventory(
    @Query('type') type?: string,
    @Query('status') status?: string,
    @Query('q') q?: string,
  ) {
    return this.equipment.inventory({ type, status, q });
  }

  @Get('assignments')
  @Roles('administrador', 'director')
  @ApiOperation({ summary: 'Asignaciones de equipamiento y sus checklists' })
  assignments(
    @Query('reservationId') reservationId?: string,
    @Query('status') status?: string,
    @Query('date') date?: string,
  ) {
    return this.equipment.assignments({ reservationId, status, date });
  }

  @Get(':id')
  @Roles('administrador', 'director')
  @ApiOperation({ summary: 'Detalle de un equipo por id o código de inventario' })
  detail(@Param('id') id: string) {
    return this.equipment.getItem(id);
  }

  @Post()
  @Roles('administrador')
  @ApiOperation({ summary: 'Alta de equipo con accesorios completos' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateEquipmentDto) {
    return this.equipment.create(dto, user);
  }

  @Patch(':id')
  @Roles('administrador')
  @ApiOperation({ summary: 'Actualiza estado o notas del equipo' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateEquipmentDto,
  ) {
    return this.equipment.update(id, dto, user);
  }

  @Post('assignments/:id/deliver')
  @Roles('administrador')
  @ApiOperation({ summary: 'Entrega el equipo con checklist obligatorio' })
  deliver(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: DeliveryDto,
  ) {
    return this.equipment.deliver(id, dto, user);
  }

  @Post('assignments/:id/return')
  @Roles('administrador')
  @ApiOperation({ summary: 'Devuelve el equipo y registra incidentes si faltan accesorios' })
  returnItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: ReturnDto,
  ) {
    return this.equipment.returnItem(id, dto, user);
  }

  @Post('assignments/:id/incident')
  @Roles('administrador')
  @ApiOperation({ summary: 'Registra un incidente sobre una asignación' })
  incident(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: IncidentDto,
  ) {
    return this.equipment.reportIncident(id, dto, user);
  }
}
