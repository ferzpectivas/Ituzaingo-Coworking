import { Controller, Get, Query, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { FastifyReply } from 'fastify';
import { Roles } from '../common/decorators/roles.decorator';
import { ReportsService, type ReportFormat, type ReportType } from './reports.service';

@ApiTags('Reportes')
@ApiCookieAuth('cw_access')
@Roles('director')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('summary')
  @ApiOperation({ summary: 'KPIs ejecutivos del período (solo director)' })
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'space', required: false })
  summary(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('space') space?: string,
  ) {
    return this.reports.summary({ from, to, space });
  }

  @Get('reservations')
  @ApiOperation({ summary: 'Detalle tabular de reservas del período' })
  reservations(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('space') space?: string,
  ) {
    const rows = this.reports.reservationsRows({ from, to, space });
    return { items: rows, total: rows.length };
  }

  @Get('export')
  @ApiOperation({ summary: 'Exporta el reporte en CSV, XLSX o PDF' })
  async export(
    @Res({ passthrough: true }) reply: FastifyReply,
    @Query('format') format?: string,
    @Query('type') type?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('space') space?: string,
  ) {
    const result = await this.reports.export(
      (format as ReportFormat) || 'pdf',
      (type as ReportType) || 'resumen',
      { from, to, space },
    );
    void reply
      .header('content-type', result.contentType)
      .header('content-disposition', `attachment; filename="${result.filename}"`);
    return result.body;
  }
}
