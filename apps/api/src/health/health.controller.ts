import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { EnvConfig } from '../config/env.schema';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly config: ConfigService<EnvConfig, true>,
  ) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getHealth() {
    const env = this.config.get('NODE_ENV', { infer: true });
    return this.healthService.getHealth(env);
  }
}
