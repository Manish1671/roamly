import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { API_PREFIX } from '@roamly/shared';
import request from 'supertest';
import { createAuthTestApp, fetchCsrf, withAuthHeaders } from './auth-helpers';
import { requirePostgres } from './require-database';
import { createTrip, expectHttpStatus } from './trips-e2e-helpers';

const prisma = new PrismaClient();
const origin = 'http://localhost:3000';
const runId = Date.now().toString(36);

const completePreference = {
  status: 'COMPLETE' as const,
  budgetMin: '15000',
  budgetMax: '45000',
  budgetCurrency: 'INR',
  budgetMaxIsHard: false,
  availability: [{ startDate: '2027-09-01', endDate: '2027-09-14' }],
  interests: ['BEACHES', 'FOOD'],
  travelStyle: 'BALANCED' as const,
  climatePreference: 'WARM' as const,
  destinationTypes: ['BEACHES' as const],
};

async function registerUser(server: Parameters<typeof request>[0], label: string) {
  const csrf = await fetchCsrf(server, origin);
  const email = `${label}.${runId}@roamly.test`;
  await csrf.agent
    .post(`${API_PREFIX}/auth/register`)
    .set(withAuthHeaders(csrf.csrfToken, origin))
    .send({ email, password: 'Str0ngPass!', displayName: label })
    .expect(201);
  return { email, agent: csrf.agent };
}

describe('Group intelligence (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await requirePostgres(prisma);
    app = await createAuthTestApp();
  });

  afterAll(async () => {
    if (app) await app.close();
    await prisma.trip.deleteMany({
      where: { creator: { email: { endsWith: `${runId}@roamly.test` } } },
    });
    await prisma.user.deleteMany({ where: { email: { endsWith: `${runId}@roamly.test` } } });
    await prisma.$disconnect();
  });

  it('lists curated destinations after seed', async () => {
    const owner = await registerUser(app.getHttpServer(), 'catalog');
    const res = await owner.agent.get(`${API_PREFIX}/destinations`).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(12);
    expect(res.body[0].budgetIsEstimate).toBe(true);
  });

  it('allows members to save only their own preferences and generate recommendations', async () => {
    const server = app.getHttpServer();
    const owner = await registerUser(server, 'gi-owner');
    const trip = await expectHttpStatus(
      createTrip(owner.agent, {
        name: 'Group intel',
        destinationName: 'TBD',
        startDate: '2027-09-05',
        endDate: '2027-09-12',
      }),
      201,
    );
    const tripId = trip.body.id as string;

    const csrf = await owner.agent.get(`${API_PREFIX}/auth/csrf`).set('Origin', origin).expect(200);
    await owner.agent
      .put(`${API_PREFIX}/trips/${tripId}/preferences/me`)
      .set(withAuthHeaders(csrf.body.csrfToken, origin))
      .send(completePreference)
      .expect(200);

    const overview = await owner.agent.get(`${API_PREFIX}/trips/${tripId}/preferences`).expect(200);
    expect(overview.body.myPreference.status).toBe('COMPLETE');
    expect(overview.body.status.completedCount).toBe(1);

    const generated = await owner.agent
      .post(`${API_PREFIX}/trips/${tripId}/recommendations/generate`)
      .set(withAuthHeaders(csrf.body.csrfToken, origin))
      .expect(201);

    expect(generated.body.algorithmVersion).toBe('group-intelligence-v1.0.0');
    expect(generated.body.result.ranked.length).toBeGreaterThan(0);

    const stranger = await registerUser(server, 'gi-stranger');
    await stranger.agent.get(`${API_PREFIX}/trips/${tripId}/preferences`).expect(404);
  });

  it('rejects viewer preference mutations', async () => {
    const server = app.getHttpServer();
    const owner = await registerUser(server, 'gi-owner2');
    const viewer = await registerUser(server, 'gi-viewer');

    const trip = await expectHttpStatus(
      createTrip(owner.agent, {
        name: 'Viewer test',
        destinationName: 'TBD',
        startDate: '2027-10-01',
        endDate: '2027-10-08',
      }),
      201,
    );
    const tripId = trip.body.id as string;

    const ownerCsrf = await owner.agent.get(`${API_PREFIX}/auth/csrf`).set('Origin', origin).expect(200);
    await owner.agent
      .post(`${API_PREFIX}/trips/${tripId}/invitations`)
      .set(withAuthHeaders(ownerCsrf.body.csrfToken, origin))
      .send({ email: viewer.email, role: 'VIEWER' })
      .expect(201);

    const viewerInvites = await viewer.agent.get(`${API_PREFIX}/invitations`).expect(200);
    const pending = viewerInvites.body.invitations.find((i: { status: string }) => i.status === 'PENDING');
    const viewerCsrf = await viewer.agent.get(`${API_PREFIX}/auth/csrf`).set('Origin', origin).expect(200);
    await viewer.agent
      .post(`${API_PREFIX}/invitations/${pending.id}/accept`)
      .set(withAuthHeaders(viewerCsrf.body.csrfToken, origin))
      .expect(200);

    await viewer.agent
      .put(`${API_PREFIX}/trips/${tripId}/preferences/me`)
      .set(withAuthHeaders(viewerCsrf.body.csrfToken, origin))
      .send(completePreference)
      .expect(403);
  });
});
