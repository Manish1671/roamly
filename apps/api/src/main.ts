import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { API_PREFIX } from '@roamly/shared';
import { AppModule } from './app.module';
import type { EnvConfig } from './config/env.schema';
import { AllExceptionsFilter } from './common/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn'],
  });

  const config = app.get(ConfigService<EnvConfig, true>);
  const host = config.get('API_HOST', { infer: true });
  const port = config.get('API_PORT', { infer: true });
  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));
  app.enableCors({
    origin: origins.length > 0 ? origins : true,
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());

  await app.listen(port, host);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on http://${host === '0.0.0.0' ? 'localhost' : host}:${port}${API_PREFIX}`);
}

bootstrap();
