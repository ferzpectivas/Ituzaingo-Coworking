import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { EquipmentModule } from './equipment/equipment.module';
import { HealthController } from './health/health.controller';
import { PublicController } from './public/public.controller';
import { ReportsModule } from './reports/reports.module';
import { ReservationsModule } from './reservations/reservations.module';
import { SpacesModule } from './spaces/spaces.module';
import { StreamModule } from './stream/stream.module';
import { GlobalModule } from './storage/global.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { OriginGuard } from './common/guards/origin.guard';

@Module({
  imports: [
    GlobalModule,
    AuthModule,
    SpacesModule,
    ReservationsModule,
    EquipmentModule,
    AuditModule,
    ReportsModule,
    StreamModule,
  ],
  controllers: [PublicController, HealthController],
  providers: [
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
