import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { TripsModule } from './trips/trips.module';
import { AppConfigModule } from './config/app-config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [AppConfigModule, DatabaseModule, HealthModule, AuthModule, TripsModule],
})
export class AppModule {}
