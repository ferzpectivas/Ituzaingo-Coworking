import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Roles } from '../common/decorators/roles.decorator';
import { AuditService } from './audit.service';

@ApiTags('Auditoría')
@ApiCookieAuth('cw_access')
@Roles('director')
@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Bitácora de auditoría con filtros (solo director)' })
  list(
    @Query('action') action?: string,
    @Query('actorUserId') actorUserId?: string,
    @Query('entityType') entityType?: string,
    @Query('entityId') entityId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.audit.list({
      action,
      actorUserId,
      entityType,
      entityId,
      from,
      to,
      q,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get('export.csv')
  @ApiOperation({ summary: 'Exporta la bitácora filtrada a CSV' })
  async exportCsv(
    @Res({ passthrough: true }) reply: FastifyReply,
    @Query('action') action?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
  ) {
    const body = this.audit.csv({ action, from, to, q });
    void reply
      .header('content-type', 'text/csv; charset=utf-8')
      .header('content-disposition', 'attachment; filename="auditoria.csv"');
    return body;
  }
}
