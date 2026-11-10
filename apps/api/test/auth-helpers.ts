import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { API_PREFIX, CSRF_HEADER_NAME } from '@roamly/shared';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import type { EnvConfig } from '../src/config/env.schema';

export async function createAuthTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  const config = app.get(ConfigService<EnvConfig, true>);
  const origins = config
    .get('CORS_ORIGINS', { infer: true })
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));
  app.use(cookieParser());
  app.enableCors({
    origin: origins.length > 0 ? origins : true,
    credentials: true,
  });
  await app.init();
  return app;
}

export async function fetchCsrf(
  server: Parameters<typeof request>[0],
  origin = 'http://localhost:3000',
): Promise<{ csrfToken: string; agent: request.SuperAgentTest }> {
  const agent = request.agent(server);
  const res = await agent
    .get(`${API_PREFIX}/auth/csrf`)
    .set('Origin', origin)
    .expect(200);
  return { csrfToken: res.body.csrfToken, agent };
}

export function withAuthHeaders(csrfToken: string, origin = 'http://localhost:3000') {
  return {
    Origin: origin,
    [CSRF_HEADER_NAME]: csrfToken,
  };
}
