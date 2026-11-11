import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { API_PREFIX } from '@roamly/shared';
import request from 'supertest';
import type { SuperAgentTest } from 'supertest';
import { createAuthTestApp, fetchCsrf, withAuthHeaders } from './auth-helpers';
import { requirePostgres } from './require-database';
import {
  acceptInvitation,
  createTrip,
  expectHttpStatus,
  fetchCsrfForAgent,
  sendInvitation,
} from './trips-e2e-helpers';

const prisma = new PrismaClient();
const origin = 'http://localhost:3000';
const runId = Date.now().toString(36);
let userSeq = 0;

const completePreference = {
  status: 'COMPLETE' as const,
  budgetMin: '15000',
  budgetMax: '45000',
  budgetCurrency: 'INR',
  budgetMaxIsHard: false,
  availability: [{ startDate: '2028-02-01', endDate: '2028-02-20' }],
  interests: ['BEACHES', 'FOOD'],
  travelStyle: 'BALANCED' as const,
  climatePreference: 'WARM' as const,
  destinationTypes: ['BEACHES' as const],
};

async function registerUser(server: Parameters<typeof request>[0], label: string) {
  const csrf = await fetchCsrf(server, origin);
  const email = `${label}.${runId}.${++userSeq}@roamly.test`;
  await csrf.agent
    .post(`${API_PREFIX}/auth/register`)
    .set(withAuthHeaders(csrf.csrfToken, origin))
    .send({ email, password: 'Str0ngPass!', displayName: label })
    .expect(201);
  return { email, agent: csrf.agent };
}

/** Fresh CSRF header pair; reuse the same headers for back-to-back mutations on one agent when possible. */
async function csrfHeaders(agent: SuperAgentTest) {
  const token = await fetchCsrfForAgent(agent);
  return withAuthHeaders(token, origin);
}

async function postJson(agent: SuperAgentTest, url: string, body?: object) {
  const headers = await csrfHeaders(agent);
  const req = agent.post(url).set(headers);
  return body === undefined ? req : req.send(body);
}

async function putPref(agent: SuperAgentTest, tripId: string) {
  const headers = await csrfHeaders(agent);
  await agent
    .put(`${API_PREFIX}/trips/${tripId}/preferences/me`)
    .set(headers)
    .send(completePreference)
    .expect(200);
  return headers;
}

async function setupTripWithRecommendation(server: Parameters<typeof request>[0]) {
  const owner = await registerUser(server, 'vote-owner');
  const partner = await registerUser(server, 'vote-partner');
  const viewer = await registerUser(server, 'vote-viewer');

  const trip = await expectHttpStatus(
    createTrip(owner.agent, {
      name: 'Voting trip',
      destinationName: 'TBD',
      startDate: '2028-02-05',
      endDate: '2028-02-15',
    }),
    201,
  );
  const tripId = trip.body.id as string;

  const memberInvite = await expectHttpStatus(
    sendInvitation(owner.agent, tripId, { email: partner.email, role: 'MEMBER' }),
    201,
  );
  await expectHttpStatus(acceptInvitation(partner.agent, memberInvite.body.id), 200);

  const viewerInvite = await expectHttpStatus(
    sendInvitation(owner.agent, tripId, { email: viewer.email, role: 'VIEWER' }),
    201,
  );
  await expectHttpStatus(acceptInvitation(viewer.agent, viewerInvite.body.id), 200);

  const ownerHeaders = await putPref(owner.agent, tripId);
  await putPref(partner.agent, tripId);

  const snapshot = await owner.agent
    .post(`${API_PREFIX}/trips/${tripId}/recommendations/generate`)
    .set(ownerHeaders)
    .expect(201);

  const poll = await owner.agent
    .post(`${API_PREFIX}/trips/${tripId}/polls`)
    .set(ownerHeaders)
    .send({ recommendationSnapshotId: snapshot.body.id })
    .expect(201);

  const topId =
    (snapshot.body.result.ranked as Array<{ destinationId: string }>)[0]?.destinationId ?? 'in-goa';

  return { owner, partner, viewer, tripId, pollId: poll.body.id as string, snapshotId: snapshot.body.id, topId };
}

describe('Destination polls (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    await requirePostgres(prisma);
    app = await createAuthTestApp();
  });

  afterAll(async () => {
    if (app) await app.close();
    await prisma.trip.deleteMany({
      where: { creator: { email: { contains: `${runId}.` } } },
    });
    await prisma.user.deleteMany({ where: { email: { contains: `${runId}.` } } });
    await prisma.$disconnect();
  });

  it('allows all member roles to vote, change vote, and blocks after close', async () => {
    const { owner, partner, viewer, tripId, pollId, topId } = await setupTripWithRecommendation(
      app.getHttpServer(),
    );

    await expectHttpStatus(
      postJson(
        viewer.agent,
        `${API_PREFIX}/trips/${tripId}/polls/${pollId}/votes`,
        { destinationId: topId },
      ),
      200,
    );

    const partnerVoteHeaders = await csrfHeaders(partner.agent);
    await expectHttpStatus(
      partner.agent
        .post(`${API_PREFIX}/trips/${tripId}/polls/${pollId}/votes`)
        .set(partnerVoteHeaders)
        .send({ destinationId: topId }),
      200,
    );

    const alt = (await owner.agent.get(`${API_PREFIX}/trips/${tripId}/polls/${pollId}`).expect(200)).body
      .destinationIds[1] as string;
    await expectHttpStatus(
      partner.agent
        .post(`${API_PREFIX}/trips/${tripId}/polls/${pollId}/votes`)
        .set(partnerVoteHeaders)
        .send({ destinationId: alt }),
      200,
    );

    const votes = await prisma.destinationPollVote.count({ where: { pollId } });
    expect(votes).toBe(2);

    await expectHttpStatus(postJson(owner.agent, `${API_PREFIX}/trips/${tripId}/polls/${pollId}/close`), 200);

    await expectHttpStatus(
      postJson(partner.agent, `${API_PREFIX}/trips/${tripId}/polls/${pollId}/votes`, { destinationId: topId }),
      409,
    );
  });

  it('rejects invalid destinations, foreign snapshots, and non-members', async () => {
    const { owner, tripId, pollId, snapshotId } = await setupTripWithRecommendation(app.getHttpServer());
    const outsider = await registerUser(app.getHttpServer(), 'outsider');

  await expectHttpStatus(
    postJson(owner.agent, `${API_PREFIX}/trips/${tripId}/polls/${pollId}/votes`, {
      destinationId: 'not-in-snapshot',
    }),
    400,
  );

    await expectHttpStatus(
      postJson(outsider.agent, `${API_PREFIX}/trips/${tripId}/polls`, { recommendationSnapshotId: snapshotId }),
      404,
    );

    const trip2 = await expectHttpStatus(
      createTrip(owner.agent, {
        name: 'Snapshot scope',
        destinationName: 'TBD',
        startDate: '2028-03-10',
        endDate: '2028-03-15',
      }),
      201,
    );
    const trip2Headers = await putPref(owner.agent, trip2.body.id as string);
    const trip2Snap = await owner.agent
      .post(`${API_PREFIX}/trips/${trip2.body.id}/recommendations/generate`)
      .set(trip2Headers)
      .expect(201);

    await expectHttpStatus(
      owner.agent
        .post(`${API_PREFIX}/trips/${trip2.body.id}/polls`)
        .set(trip2Headers)
        .send({ recommendationSnapshotId: snapshotId }),
      404,
    );

    await expectHttpStatus(
      postJson(owner.agent, `${API_PREFIX}/trips/${trip2.body.id}/polls`, {
        recommendationSnapshotId: trip2Snap.body.id,
      }),
      201,
    );

    await outsider.agent.get(`${API_PREFIX}/trips/${tripId}/polls/${pollId}`).expect(404);
  });

  it('enforces finalization rules and preserves historical decisions', async () => {
    const server = app.getHttpServer();
    const owner = await registerUser(server, 'fin-owner');
    const a = await registerUser(server, 'fin-a');
    const b = await registerUser(server, 'fin-b');
    const c = await registerUser(server, 'fin-c');

    const trip = await expectHttpStatus(
      createTrip(owner.agent, {
        name: 'Finalize rules',
        destinationName: 'TBD',
        startDate: '2028-04-01',
        endDate: '2028-04-14',
      }),
      201,
    );
    const tripId = trip.body.id as string;

    for (const user of [a, b, c]) {
      const inv = await expectHttpStatus(
        sendInvitation(owner.agent, tripId, { email: user.email, role: 'MEMBER' }),
        201,
      );
      await expectHttpStatus(acceptInvitation(user.agent, inv.body.id), 200);
      await putPref(user.agent, tripId);
    }
    const ownerHeaders = await putPref(owner.agent, tripId);

    const snapshot = await owner.agent
      .post(`${API_PREFIX}/trips/${tripId}/recommendations/generate`)
      .set(ownerHeaders)
      .expect(201);
    const ranked = snapshot.body.result.ranked as Array<{ destinationId: string }>;
    const poll = await owner.agent
      .post(`${API_PREFIX}/trips/${tripId}/polls`)
      .set(ownerHeaders)
      .send({ recommendationSnapshotId: snapshot.body.id })
      .expect(201);
    const pollId = poll.body.id as string;

    await expectHttpStatus(postJson(owner.agent, `${API_PREFIX}/trips/${tripId}/polls/${pollId}/close`), 200);
    await expectHttpStatus(postJson(owner.agent, `${API_PREFIX}/trips/${tripId}/polls/${pollId}/finalize`), 400);

    const openPoll = await expectHttpStatus(
      postJson(owner.agent, `${API_PREFIX}/trips/${tripId}/polls`, {
        recommendationSnapshotId: snapshot.body.id,
        destinationIds: ranked.slice(0, 2).map((r) => r.destinationId),
      }),
      201,
    );

    await expectHttpStatus(
      postJson(a.agent, `${API_PREFIX}/trips/${tripId}/polls/${openPoll.body.id}/votes`, {
        destinationId: ranked[0].destinationId,
      }),
      200,
    );
    await expectHttpStatus(
      postJson(b.agent, `${API_PREFIX}/trips/${tripId}/polls/${openPoll.body.id}/votes`, {
        destinationId: ranked[1].destinationId,
      }),
      200,
    );

    await expectHttpStatus(
      postJson(owner.agent, `${API_PREFIX}/trips/${tripId}/polls/${openPoll.body.id}/close`),
      200,
    );
    await expectHttpStatus(
      postJson(owner.agent, `${API_PREFIX}/trips/${tripId}/polls/${openPoll.body.id}/finalize`),
      400,
    );

    const unanimousPoll = await expectHttpStatus(
      postJson(owner.agent, `${API_PREFIX}/trips/${tripId}/polls`, {
        recommendationSnapshotId: snapshot.body.id,
        destinationIds: [ranked[0].destinationId, ranked[1].destinationId],
      }),
      201,
    );
    const upollId = unanimousPoll.body.id as string;

    for (const user of [owner, a, b, c]) {
      await expectHttpStatus(
        postJson(user.agent, `${API_PREFIX}/trips/${tripId}/polls/${upollId}/votes`, {
          destinationId: ranked[0].destinationId,
        }),
        200,
      );
    }

    const closeRes = await expectHttpStatus(
      postJson(owner.agent, `${API_PREFIX}/trips/${tripId}/polls/${upollId}/close`),
      200,
    );
    void closeRes;

    const decision = await expectHttpStatus(
      postJson(owner.agent, `${API_PREFIX}/trips/${tripId}/polls/${upollId}/finalize`),
      201,
    );

    expect(decision.body.destinationId).toBe(ranked[0].destinationId);

    await expectHttpStatus(
      postJson(owner.agent, `${API_PREFIX}/trips/${tripId}/polls/${upollId}/finalize`),
      409,
    );

    const decisions = await prisma.tripDestinationDecision.findMany({ where: { tripId } });
    expect(decisions.length).toBeGreaterThanOrEqual(1);
    expect(decisions.some((d) => d.id === decision.body.id)).toBe(true);
  });
});
