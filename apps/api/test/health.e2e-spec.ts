import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { API_PREFIX } from '@roamly/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        onModuleDestroy: async () => undefined,
        ping: async () => true,
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix(API_PREFIX.replace(/^\//, ''));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it(`GET ${API_PREFIX}/health returns 200 with status payload`, async () => {
    const response = await request(app.getHttpServer())
      .get(`${API_PREFIX}/health`)
      .expect(200);

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'roamly-api',
      checks: {
        database: { status: 'ok' },
      },
    });
    expect(response.body.timestamp).toBeDefined();
  });
});
