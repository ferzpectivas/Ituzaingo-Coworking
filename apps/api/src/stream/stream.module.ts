import { Module } from '@nestjs/common';
import { SpacesModule } from '../spaces/spaces.module';
import { StreamController } from './stream.controller';

@Module({
  imports: [SpacesModule],
  controllers: [StreamController],
})
export class StreamModule {}
