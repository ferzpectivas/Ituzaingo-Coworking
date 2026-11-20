import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { SpacesService } from './spaces.service';

@ApiTags('Mapa y espacios')
@ApiCookieAuth('cw_access')
@Controller()
export class SpacesController {
  constructor(private readonly spaces: SpacesService) {}

  @Get('config')
  @ApiOperation({ summary: 'Configuración pública autenticada (franjas, espacios, políticas)' })
  config() {
    return this.spaces.getConfig();
  }

  @Get('spaces')
  @ApiOperation({ summary: 'Lista de ambientes y ocupación de la franja actual' })
  list() {
    return { spaces: this.spaces.getSpaces() };
  }

  @Get('spaces/:code')
  @ApiOperation({ summary: 'Detalle de un ambiente con su mobiliario' })
  detail(@Param('code') code: string) {
    return this.spaces.getSpace(code);
  }

  @Get('map/floorplan')
  @ApiOperation({ summary: 'Manifiesto arquitectónico generado desde el SVG' })
  floorplan() {
    return this.spaces.getFloorplan();
  }

  @Get('map/occupancy')
  @ApiOperation({ summary: 'Ocupación en vivo por asiento, mesa y ambiente' })
  occupancy(
    @CurrentUser() user: AuthUser,
    @Query('date') date?: string,
    @Query('slot') slot?: string,
  ) {
    return this.spaces.getOccupancy(user, date, slot);
  }

  @Get('availability')
  @ApiOperation({ summary: 'Disponibilidad de asientos y equipos por fecha y franja' })
  availability(
    @CurrentUser() user: AuthUser,
    @Query('space') space?: string,
    @Query('date') date?: string,
    @Query('slot') slot?: string,
    @Query('partySize') partySize?: string,
  ) {
    return this.spaces.getAvailability(user, {
      spaceCode: space,
      date,
      slotId: slot,
      partySize: partySize ? Number(partySize) : undefined,
    });
  }
}
