import { Global, Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { JsonDbService } from './json-db.service';

@Global()
@Module({
  providers: [EventsService, JsonDbService],
  exports: [EventsService, JsonDbService],
})
export class GlobalModule {}
