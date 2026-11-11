import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { API_PREFIX } from '@roamly/shared';
import { INDIA_CURATED_DESTINATIONS, CATALOG_VERSION } from '../src/group-intelligence/catalog-seed-data';
import request from 'supertest';
import type { SuperAgentTest } from 'supertest';
import { createAuthTestApp, fetchCsrf, withAuthHeaders } from './auth-helpers';
import { requirePostgres } from './require-database';
import {
  acceptInvitation,
  createTrip,
  expectHttpStatus,
  sendInvitation,
} from './trips-e2e-helpers';

const prisma = new PrismaClient();
const origin = 'http://localhost:3000';
const runId = Date.now().toString(36);

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

async function csrfToken(agent: SuperAgentTest): Promise<string> {
  const res = await agent.get(`${API_PREFIX}/auth/csrf`).set('Origin', origin).expect(200);
  return res.body.csrfToken as string;
}

async function putPreferences(agent: SuperAgentTest, tripId: string, body: Record<string, unknown>) {
  const token = await csrfToken(agent);
  return agent
    .put(`${API_PREFIX}/trips/${tripId}/preferences/me`)
    .set(withAuthHeaders(token, origin))
    .send(body);
}

async function generateRecommendations(agent: SuperAgentTest, tripId: string) {
  const token = await csrfToken(agent);
  return agent
    .post(`${API_PREFIX}/trips/${tripId}/recommendations/generate`)
    .set(withAuthHeaders(token, origin));
}

const beachMemberPref = {
  status: 'COMPLETE' as const,
  budgetMin: '15000',
  budgetMax: '45000',
  budgetCurrency: 'INR',
  budgetMaxIsHard: false,
  availability: [{ startDate: '2027-09-01', endDate: '2027-09-20' }],
  interests: ['BEACHES', 'FOOD'],
  travelStyle: 'BALANCED' as const,
  climatePreference: 'WARM' as const,
  destinationTypes: ['BEACHES' as const],
};

const mountainMemberPref = {
  ...beachMemberPref,
  interests: ['TREKKING', 'NATURE'],
  destinationTypes: ['MOUNTAINS' as const],
  climatePreference: 'COOL' as const,
};

describe('Group intelligence hardening (e2e)', () => {
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

  describe('group completeness', () => {
    it('rejects generation when any participating member lacks COMPLETE preferences', async () => {
      const server = app.getHttpServer();
      const owner = await registerUser(server, 'gc-owner');
      const partner = await registerUser(server, 'gc-partner');

      const trip = await expectHttpStatus(
        createTrip(owner.agent, {
          name: 'Completeness',
          destinationName: 'TBD',
          startDate: '2027-09-05',
          endDate: '2027-09-20',
        }),
        201,
      );
      const tripId = trip.body.id as string;

      const invite = await expectHttpStatus(
        sendInvitation(owner.agent, tripId, { email: partner.email, role: 'MEMBER' }),
        201,
      );
      await expectHttpStatus(acceptInvitation(partner.agent, invite.body.id), 200);

      await expectHttpStatus(putPreferences(owner.agent, tripId, beachMemberPref), 200);
      await expectHttpStatus(generateRecommendations(owner.agent, tripId), 400);

      await expectHttpStatus(
        putPreferences(partner.agent, tripId, {
          status: 'DRAFT',
          budgetMin: '15000',
          budgetMax: '45000',
          budgetCurrency: 'INR',
          interests: [],
          availability: [{ startDate: '2027-09-01', endDate: '2027-09-20' }],
        }),
        200,
      );
      await expectHttpStatus(generateRecommendations(owner.agent, tripId), 400);

      await expectHttpStatus(putPreferences(partner.agent, tripId, mountainMemberPref), 200);
      await expectHttpStatus(generateRecommendations(owner.agent, tripId), 201);
    });

    it('rejects generation after a new member joins until they complete preferences', async () => {
      const server = app.getHttpServer();
      const owner = await registerUser(server, 'gc-owner2');
      const late = await registerUser(server, 'gc-late');

      const trip = await expectHttpStatus(
        createTrip(owner.agent, {
          name: 'Late joiner',
          destinationName: 'TBD',
          startDate: '2027-10-01',
          endDate: '2027-10-10',
        }),
        201,
      );
      const tripId = trip.body.id as string;

      await expectHttpStatus(putPreferences(owner.agent, tripId, beachMemberPref), 200);
      await expectHttpStatus(generateRecommendations(owner.agent, tripId), 201);

      const invite = await expectHttpStatus(
        sendInvitation(owner.agent, tripId, { email: late.email, role: 'MEMBER' }),
        201,
      );
      await expectHttpStatus(acceptInvitation(late.agent, invite.body.id), 200);

      await expectHttpStatus(generateRecommendations(owner.agent, tripId), 400);
    });
  });

  describe('multi-member scoring', () => {
    it('includes both members, fairness, and per-member hard constraints', async () => {
      const server = app.getHttpServer();
      const owner = await registerUser(server, 'mm-owner');
      const partner = await registerUser(server, 'mm-partner');

      const trip = await expectHttpStatus(
        createTrip(owner.agent, {
          name: 'Two member fit',
          destinationName: 'TBD',
          startDate: '2027-11-01',
          endDate: '2027-11-15',
        }),
        201,
      );
      const tripId = trip.body.id as string;

      const invite = await expectHttpStatus(
        sendInvitation(owner.agent, tripId, { email: partner.email, role: 'MEMBER' }),
        201,
      );
      await expectHttpStatus(acceptInvitation(partner.agent, invite.body.id), 200);

      await expectHttpStatus(putPreferences(owner.agent, tripId, beachMemberPref), 200);
      await expectHttpStatus(
        putPreferences(partner.agent, tripId, {
          ...mountainMemberPref,
          budgetMax: '12000',
          budgetMaxIsHard: true,
        }),
        200,
      );

      const generated = await expectHttpStatus(generateRecommendations(owner.agent, tripId), 201);
      const ranked = generated.body.result.ranked as Array<{
        memberScores: Array<{ memberId: string; totalScore: number }>;
        groupScore: number;
        averageMemberScore: number;
        lowestMemberScore: number;
      }>;

      expect(ranked.length).toBeGreaterThan(0);
      expect(ranked[0].memberScores).toHaveLength(2);
      expect(ranked[0].lowestMemberScore).toBeLessThanOrEqual(ranked[0].averageMemberScore);
      expect(ranked[0].groupScore).toBeLessThanOrEqual(ranked[0].averageMemberScore);

      const rejected = generated.body.result.rejected as Array<{ reasons: string[] }>;
      expect(
        rejected.some((r) => r.reasons.some((reason) => reason.includes('hard per-person maximum'))),
      ).toBe(true);
      expect(rejected.some((r) => r.reasons.some((reason) => reason.includes('mm-partner')))).toBe(true);
    });

    it('keeps most destinations feasible when hard per-person max is INR 22000', async () => {
      const server = app.getHttpServer();
      const owner = await registerUser(server, 'budget22-owner');
      const partner = await registerUser(server, 'budget22-partner');

      const trip = await expectHttpStatus(
        createTrip(owner.agent, {
          name: 'Budget 22k',
          destinationName: 'TBD',
          startDate: '2028-05-01',
          endDate: '2028-05-15',
        }),
        201,
      );
      const tripId = trip.body.id as string;

      const invite = await expectHttpStatus(
        sendInvitation(owner.agent, tripId, { email: partner.email, role: 'MEMBER' }),
        201,
      );
      await expectHttpStatus(acceptInvitation(partner.agent, invite.body.id), 200);

      const budget22 = {
        ...beachMemberPref,
        budgetMin: '5000',
        budgetMax: '22000',
        budgetMaxIsHard: true,
        availability: [{ startDate: '2028-05-01', endDate: '2028-05-15' }],
      };
      await expectHttpStatus(putPreferences(owner.agent, tripId, budget22), 200);
      await expectHttpStatus(putPreferences(partner.agent, tripId, budget22), 200);

      const generated = await expectHttpStatus(generateRecommendations(owner.agent, tripId), 201);
      expect(generated.body.infeasible).toBe(false);
      const ranked = generated.body.result.ranked as Array<{ destinationId: string }>;
      expect(ranked.length).toBeGreaterThan(10);
      expect(ranked.some((r) => r.destinationId === 'in-goa')).toBe(true);

      const rejected = generated.body.result.rejected as Array<{ destinationId: string; reasons: string[] }>;
      const andaman = rejected.find((r) => r.destinationId === 'in-andaman');
      expect(andaman).toBeDefined();
      expect(andaman!.reasons.join(' ')).toMatch(/22,000|22000/);
      expect(andaman!.reasons.join(' ')).not.toMatch(
        /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
      );
    });
  });

  describe('currency safety (integration)', () => {
    it('records currency mismatch rejections for non-INR member budgets against INR catalog', async () => {
      const server = app.getHttpServer();
      const owner = await registerUser(server, 'fx-owner');

      const trip = await expectHttpStatus(
        createTrip(owner.agent, {
          name: 'FX',
          destinationName: 'TBD',
          startDate: '2027-12-01',
          endDate: '2027-12-10',
        }),
        201,
      );
      const tripId = trip.body.id as string;

      await expectHttpStatus(
        putPreferences(owner.agent, tripId, {
          ...beachMemberPref,
          budgetCurrency: 'USD',
        }),
        200,
      );

      const generated = await expectHttpStatus(generateRecommendations(owner.agent, tripId), 201);
      expect(generated.body.infeasible).toBe(true);
      const rejected = generated.body.result.rejected as Array<{ reasons: string[] }>;
      expect(rejected.length).toBeGreaterThan(0);
      expect(
        rejected.every((row) =>
          row.reasons.some((reason) => reason.toLowerCase().includes('currency mismatch')),
        ),
      ).toBe(true);
    });
  });

  describe('snapshot integrity', () => {
    it('appends snapshots and preserves historical preference and version data', async () => {
      const server = app.getHttpServer();
      const owner = await registerUser(server, 'snap-owner');

      const trip = await expectHttpStatus(
        createTrip(owner.agent, {
          name: 'Snapshots',
          destinationName: 'TBD',
          startDate: '2028-01-01',
          endDate: '2028-01-14',
        }),
        201,
      );
      const tripId = trip.body.id as string;

      await expectHttpStatus(putPreferences(owner.agent, tripId, beachMemberPref), 200);
      const first = await expectHttpStatus(generateRecommendations(owner.agent, tripId), 201);
      const firstId = first.body.id as string;

      await expectHttpStatus(
        putPreferences(owner.agent, tripId, { ...beachMemberPref, interests: ['SHOPPING'] }),
        200,
      );
      const second = await expectHttpStatus(generateRecommendations(owner.agent, tripId), 201);

      expect(second.body.id).not.toBe(firstId);

      const rows = await prisma.recommendationSnapshot.findMany({ where: { tripId } });
      expect(rows).toHaveLength(2);

      const storedFirst = rows.find((r) => r.id === firstId)!;
      const prefSnapshot = storedFirst.preferenceSnapshotJson as { members: Array<{ interests: string[] }> };
      expect(prefSnapshot.members[0].interests).toContain('BEACHES');
      expect(storedFirst.algorithmVersion).toBe('group-intelligence-v1.0.0');
      expect(storedFirst.catalogVersion).toBe(CATALOG_VERSION);

      const originalName =
        (await prisma.catalogDestination.findUnique({ where: { id: 'in-goa' } }))?.name ?? 'Goa';
      await prisma.catalogDestination.update({
        where: { id: 'in-goa' },
        data: { name: 'Goa (updated catalog label)' },
      });

      try {
        const fetched = await owner.agent
          .get(`${API_PREFIX}/trips/${tripId}/recommendations/${firstId}`)
          .expect(200);

        expect(fetched.body.catalogVersion).toBe(CATALOG_VERSION);
        const historicInterests = (fetched.body.result as { ranked?: unknown[] }).ranked;
        expect(historicInterests).toBeDefined();
        expect(fetched.body.algorithmVersion).toBe('group-intelligence-v1.0.0');
      } finally {
        await prisma.catalogDestination.update({
          where: { id: 'in-goa' },
          data: { name: originalName },
        });
      }
    });
  });

  describe('catalog reliability', () => {
    it('seeds idempotently and tolerates concurrent catalog reads', async () => {
      const server = app.getHttpServer();
      const user = await registerUser(server, 'cat');

      const before = await prisma.catalogDestination.count();
      if (before === 0) {
        await user.agent.get(`${API_PREFIX}/destinations`).expect(200);
      }

      const countAfterFirst = await prisma.catalogDestination.count();
      expect(countAfterFirst).toBe(INDIA_CURATED_DESTINATIONS.length);

      await user.agent.get(`${API_PREFIX}/destinations`).expect(200);
      const countAfterSecond = await prisma.catalogDestination.count();
      expect(countAfterSecond).toBe(countAfterFirst);

      const concurrent = await Promise.all(
        Array.from({ length: 5 }, () => user.agent.get(`${API_PREFIX}/destinations`).expect(200)),
      );
      const counts = concurrent.map((r) => (r.body as unknown[]).length);
      expect(new Set(counts).size).toBe(1);
      expect(counts[0]).toBe(INDIA_CURATED_DESTINATIONS.length);

      const goa = await user.agent.get(`${API_PREFIX}/destinations/in-goa`).expect(200);
      expect(goa.body.budgetIsEstimate).toBe(true);
      expect(goa.body.catalogVersion).toBe(CATALOG_VERSION);
    });
  });
});
