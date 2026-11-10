import { Injectable } from '@nestjs/common';
import { ROAMLY_APP_NAME, type ServiceHealthStatus } from '@roamly/shared';
import { PrismaService } from '../database/prisma.service';

export interface HealthResponse {
  status: ServiceHealthStatus;
  service: string;
  version: string;
  timestamp: string;
  environment: string;
  checks: {
    database: { status: ServiceHealthStatus; latencyMs?: number };
  };
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getHealth(environment: string): Promise<HealthResponse> {
    const started = Date.now();
    const databaseOk = await this.prisma.ping();
    const latencyMs = Date.now() - started;

    const dbStatus: ServiceHealthStatus = databaseOk ? 'ok' : 'error';
    const overall: ServiceHealthStatus = databaseOk ? 'ok' : 'degraded';

    return {
      status: overall,
      service: `${ROAMLY_APP_NAME.toLowerCase()}-api`,
      version: '0.0.0',
      timestamp: new Date().toISOString(),
      environment,
      checks: {
        database: {
          status: dbStatus,
          latencyMs,
        },
      },
    };
  }
}
