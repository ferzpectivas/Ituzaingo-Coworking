import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { JsonDbService } from '../storage/json-db.service';
import { todayISO } from '../common/time';

@ApiTags('Público')
@Public()
@Controller('public')
export class PublicController {
  constructor(private readonly db: JsonDbService) {}

  @Get('floorplan')
  @ApiOperation({ summary: 'Manifiesto del plano para la vista pública sin autenticación' })
  floorplan() {
    return this.db.floorplan;
  }

  @Get('overview')
  @ApiOperation({ summary: 'Resumen institucional, espacios y políticas de reserva' })
  overview() {
    const state = this.db.snapshot;
    return {
      organization: state.settings.organization,
      spaceName: state.settings.spaceName,
      address: state.settings.address,
      timezone: state.settings.timezone,
      today: todayISO(),
      slots: state.settings.slots,
      openingDays: state.settings.openingDays,
      policies: {
        maxAdvanceDays: state.settings.maxAdvanceDays,
        cancellationHours: state.settings.cancellationHours,
        checkinGraceMinutes: state.settings.checkinGraceMinutes,
      },
      spaces: this.db.floorplan.spaces
        .filter((space) => space.bookable)
        .map((space) => ({
          code: space.code,
          name: space.name,
          description: space.description,
          color: space.color,
          accent: space.accent,
          capacity: space.capacity,
          furnitureCount: space.furnitureCount,
          bounds: space.bounds,
          centroid: space.centroid,
          number: space.number,
        })),
      totals: this.db.floorplan.totals,
      equipment: {
        computers: state.gear.filter((g) => g.type === 'computadora').length,
        projectors: state.gear.filter((g) => g.type === 'proyector').length,
        whiteboards: state.gear.filter((g) => g.type === 'pizarra').length,
      },
    };
  }
}
