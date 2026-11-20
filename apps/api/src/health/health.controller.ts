import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { JsonDbService } from '../storage/json-db.service';

@ApiTags('Sistema')
@Public()
@Controller('health')
export class HealthController {
  constructor(private readonly db: JsonDbService) {}

  @Get()
  @ApiOperation({ summary: 'Estado del servicio y revisión de datos' })
  check() {
    const state = this.db.snapshot;
    return {
      status: 'ok',
      uptimeSeconds: Math.round(process.uptime()),
      revision: state?.meta?.revision ?? 0,
      updatedAt: state?.meta?.updatedAt,
      storage: 'json-wal',
      timezone: state?.settings?.timezone,
      serverTime: new Date().toISOString(),
    };
  }
}
