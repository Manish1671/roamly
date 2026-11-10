import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { API_PREFIX, CSRF_HEADER_NAME, SESSION_COOKIE_NAME } from '@roamly/shared';
import {
  createAuthTestApp,
  fetchCsrf,
  withAuthHeaders,
} from './auth-helpers';
import { requirePostgres } from './require-database';

const prisma = new PrismaClient();
const origin = 'http://localhost:3000';
const emailDomain = `@m3-auth-${Date.now()}.test`;

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await requirePostgres(prisma);
    app = await createAuthTestApp();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await prisma.user.deleteMany({ where: { email: { endsWith: emailDomain } } });
    await prisma.$disconnect();
  });

  it('registers a user, sets session cookie, and returns profile via /me', async () => {
    const { csrfToken, agent } = await fetchCsrf(app.getHttpServer(), origin);
    const email = `alice${emailDomain}`;

    const register = await agent
      .post(`${API_PREFIX}/auth/register`)
      .set(withAuthHeaders(csrfToken, origin))
      .send({
        email,
        password: 'Str0ngPass!',
        displayName: 'Alice',
      })
      .expect(201);

    expect(register.body.user.email).toBe(email);

    const setCookie = register.headers['set-cookie'] as string[];
    const sessionCookie = setCookie.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toMatch(/HttpOnly/i);

    const me = await agent.get(`${API_PREFIX}/auth/me`).expect(200);
    expect(me.body.user.email).toBe(email);
  });

  it('rejects duplicate registration', async () => {
    const { csrfToken, agent } = await fetchCsrf(app.getHttpServer(), origin);
    const email = `dup${emailDomain}`;

    await agent
      .post(`${API_PREFIX}/auth/register`)
      .set(withAuthHeaders(csrfToken, origin))
      .send({ email, password: 'Str0ngPass!', displayName: 'Dup' })
      .expect(201);

    const csrf2 = await fetchCsrf(app.getHttpServer(), origin);
    await csrf2.agent
      .post(`${API_PREFIX}/auth/register`)
      .set(withAuthHeaders(csrf2.csrfToken, origin))
      .send({ email, password: 'Str0ngPass!', displayName: 'Dup 2' })
      .expect(409);
  });

  it('rejects invalid login credentials', async () => {
    const { csrfToken, agent } = await fetchCsrf(app.getHttpServer(), origin);
    const email = `login${emailDomain}`;

    await agent
      .post(`${API_PREFIX}/auth/register`)
      .set(withAuthHeaders(csrfToken, origin))
      .send({ email, password: 'Str0ngPass!', displayName: 'Login User' })
      .expect(201);

    const loginCsrf = await fetchCsrf(app.getHttpServer(), origin);
    await loginCsrf.agent
      .post(`${API_PREFIX}/auth/login`)
      .set(withAuthHeaders(loginCsrf.csrfToken, origin))
      .send({ email, password: 'WrongPassword1!' })
      .expect(401);
  });

  it('logs in successfully and rejects unauthenticated /me', async () => {
    const email = `session${emailDomain}`;
    const regCsrf = await fetchCsrf(app.getHttpServer(), origin);
    await regCsrf.agent
      .post(`${API_PREFIX}/auth/register`)
      .set(withAuthHeaders(regCsrf.csrfToken, origin))
      .send({ email, password: 'Str0ngPass!', displayName: 'Session User' })
      .expect(201);

    const guest = await import('supertest').then((m) => m.default(app.getHttpServer()));
    await guest.get(`${API_PREFIX}/auth/me`).expect(401);

    const loginCsrf = await fetchCsrf(app.getHttpServer(), origin);
    const login = await loginCsrf.agent
      .post(`${API_PREFIX}/auth/login`)
      .set(withAuthHeaders(loginCsrf.csrfToken, origin))
      .send({ email, password: 'Str0ngPass!' })
      .expect(200);

    expect(login.body.user.email).toBe(email);
  });

  it('logs out and invalidates the session', async () => {
    const email = `logout${emailDomain}`;
    const regCsrf = await fetchCsrf(app.getHttpServer(), origin);
    const agent = regCsrf.agent;

    await agent
      .post(`${API_PREFIX}/auth/register`)
      .set(withAuthHeaders(regCsrf.csrfToken, origin))
      .send({ email, password: 'Str0ngPass!', displayName: 'Logout User' })
      .expect(201);

    const logoutCsrf = await agent
      .get(`${API_PREFIX}/auth/csrf`)
      .set('Origin', origin)
      .expect(200);

    await agent
      .post(`${API_PREFIX}/auth/logout`)
      .set({
        Origin: origin,
        [CSRF_HEADER_NAME]: logoutCsrf.body.csrfToken as string,
      })
      .expect(204);

    await agent.get(`${API_PREFIX}/auth/me`).expect(401);
  });

  it('rejects expired sessions', async () => {
    const email = `expired${emailDomain}`;
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: 'not-used',
        displayName: 'Expired',
      },
    });

    const token = 'test-session-token-expired';
    const secret = process.env.SESSION_SECRET ?? '';
    const { hashToken } = await import('../src/auth/crypto.util');
    const tokenHash = hashToken(token, secret);

    await prisma.session.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() - 60_000),
      },
    });

    const agent = await import('supertest').then((m) => m.default.agent(app.getHttpServer()));
    agent.jar.setCookie(`${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly`);

    await agent.get(`${API_PREFIX}/auth/me`).expect(401);
  });
});
