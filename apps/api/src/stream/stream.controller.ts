import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../common/auth-user';
import { EventsService } from '../storage/events.service';
import { SpacesService } from '../spaces/spaces.service';

@ApiTags('Tiempo real')
@Controller('stream')
export class StreamController {
  constructor(
    private readonly events: EventsService,
    private readonly spaces: SpacesService,
  ) {}

  @Get('occupancy')
  @ApiOperation({ summary: 'Server-Sent Events con la ocupación del mapa en vivo' })
  occupancy(
    @CurrentUser() user: AuthUser,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
    @Query('date') date?: string,
    @Query('slot') slot?: string,
  ): void {
    const raw = reply.raw;
    raw.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    });
    raw.write('retry: 5000\n\n');

    const send = (event: string, payload: unknown) => {
      raw.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    };

    try {
      send('snapshot', this.spaces.getOccupancy(user, date, slot));
    } catch (error) {
      send('error', { message: (error as Error).message });
    }

    const subscription = this.events.stream().subscribe((event) => {
      send('change', event);
    });
    const heartbeat = setInterval(() => raw.write(': ping\n\n'), 25_000);

    const close = () => {
      clearInterval(heartbeat);
      subscription.unsubscribe();
    };
    request.raw.on('close', close);
    request.raw.on('error', close);
  }
}
