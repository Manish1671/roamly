import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { API_PREFIX } from '@roamly/shared';
import request from 'supertest';
import { createAuthTestApp, fetchCsrf, withAuthHeaders } from './auth-helpers';
import { requirePostgres } from './require-database';
import {
  acceptInvitation,
  archiveTrip,
  createTrip,
  expectHttpStatus,
  patchMemberRole,
  patchTrip,
  removeMember,
  sendInvitation,
} from './trips-e2e-helpers';

const prisma = new PrismaClient();
const origin = 'http://localhost:3000';
const runId = Date.now().toString(36);

async function registerUser(
  server: Parameters<typeof request>[0],
  label: string,
): Promise<{ email: string; agent: request.SuperAgentTest; userId: string }> {
  const csrf = await fetchCsrf(server, origin);
  const email = `${label}.${runId}@roamly.test`;
  await csrf.agent
    .post(`${API_PREFIX}/auth/register`)
    .set(withAuthHeaders(csrf.csrfToken, origin))
    .send({ email, password: 'Str0ngPass!', displayName: label })
    .expect(201);
  const me = await csrf.agent.get(`${API_PREFIX}/auth/me`).expect(200);
  return { email, agent: csrf.agent, userId: me.body.user.id as string };
}

async function setupTripWithEditor(server: Parameters<typeof request>[0]) {
  const owner = await registerUser(server, `own-${runId}`);
  const editor = await registerUser(server, `ed-${runId}`);

  const trip = await expectHttpStatus(
    createTrip(owner.agent, {
      name: 'Editor Trip',
      destinationName: 'Madrid',
      startDate: '2027-04-01',
      endDate: '2027-04-08',
    }),
    201,
  );

  const invite = await expectHttpStatus(
    sendInvitation(owner.agent, trip.body.id, {
      email: editor.email,
      role: 'EDITOR',
    }),
    201,
  );

  await expectHttpStatus(acceptInvitation(editor.agent, invite.body.id), 200);

  return { owner, editor, tripId: trip.body.id as string };
}

describe('Trips (e2e)', () => {
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

  it('creates trip with OWNER membership and blocks non-member access', async () => {
    const server = app.getHttpServer();
    const owner = await registerUser(server, 'owner');
    const other = await registerUser(server, 'stranger');

    const created = await expectHttpStatus(
      createTrip(owner.agent, {
        name: 'Lisbon Long Weekend',
        destinationName: 'Lisbon',
        startDate: '2026-12-01',
        endDate: '2026-12-07',
      }),
      201,
    );

    expect(created.body.myRole).toBe('OWNER');

    const membership = await prisma.tripMembership.findFirst({
      where: { tripId: created.body.id, role: 'OWNER' },
    });
    expect(membership).not.toBeNull();

    await other.agent.get(`${API_PREFIX}/trips/${created.body.id}`).expect(404);
  });

  it('enforces member role restrictions on updates and invites', async () => {
    const server = app.getHttpServer();
    const owner = await registerUser(server, 'owner2');
    const member = await registerUser(server, 'member2');

    const trip = await expectHttpStatus(
      createTrip(owner.agent, {
        name: 'Andalusia',
        destinationName: 'Seville',
        startDate: '2027-01-10',
        endDate: '2027-01-17',
      }),
      201,
    );

    const invite = await expectHttpStatus(
      sendInvitation(owner.agent, trip.body.id, {
        email: member.email,
        role: 'MEMBER',
      }),
      201,
    );

    await expectHttpStatus(acceptInvitation(member.agent, invite.body.id), 200);

    await expectHttpStatus(patchTrip(member.agent, trip.body.id, { name: 'Hacked' }), 403);

    await expectHttpStatus(
      sendInvitation(member.agent, trip.body.id, {
        email: owner.email,
        role: 'VIEWER',
      }),
      403,
    );
  });

  it('handles invitation lifecycle rules', async () => {
    const server = app.getHttpServer();
    const owner = await registerUser(server, 'owner3');
    const invitee = await registerUser(server, 'invitee3');

    const trip = await expectHttpStatus(
      createTrip(owner.agent, {
        name: 'Paris',
        destinationName: 'Paris',
        startDate: '2027-03-01',
        endDate: '2027-03-05',
      }),
      201,
    );

    await expectHttpStatus(
      sendInvitation(owner.agent, trip.body.id, {
        email: owner.email,
        role: 'MEMBER',
      }),
      400,
    );

    const inv = await expectHttpStatus(
      sendInvitation(owner.agent, trip.body.id, {
        email: invitee.email,
        role: 'VIEWER',
      }),
      201,
    );

    await expectHttpStatus(
      sendInvitation(owner.agent, trip.body.id, {
        email: invitee.email,
        role: 'VIEWER',
      }),
      409,
    );

    const stranger = await registerUser(server, 'stranger3');
    const strangerCsrf = await stranger.agent
      .get(`${API_PREFIX}/auth/csrf`)
      .set('Origin', origin)
      .expect(200);
    await stranger.agent
      .post(`${API_PREFIX}/invitations/${inv.body.id}/accept`)
      .set(withAuthHeaders(strangerCsrf.body.csrfToken, origin))
      .expect(404);
  });

  describe('archived trip protection', () => {
    it('rejects edits, new invites, and accepting pending invites after archive', async () => {
      const server = app.getHttpServer();
      const owner = await registerUser(server, 'arch-owner');
      const editor = await registerUser(server, 'arch-editor');
      const pendingInvitee = await registerUser(server, 'arch-pending');

      const trip = await expectHttpStatus(
        createTrip(owner.agent, {
          name: 'Rome',
          destinationName: 'Rome',
          startDate: '2027-05-01',
          endDate: '2027-05-10',
        }),
        201,
      );
      const tripId = trip.body.id as string;

      const editorInvite = await expectHttpStatus(
        sendInvitation(owner.agent, tripId, {
          email: editor.email,
          role: 'EDITOR',
        }),
        201,
      );
      await expectHttpStatus(acceptInvitation(editor.agent, editorInvite.body.id), 200);

      const pending = await expectHttpStatus(
        sendInvitation(owner.agent, tripId, {
          email: pendingInvitee.email,
          role: 'MEMBER',
        }),
        201,
      );

      await expectHttpStatus(archiveTrip(owner.agent, tripId), 200);

      await expectHttpStatus(patchTrip(owner.agent, tripId, { name: 'Renamed' }), 403);
      await expectHttpStatus(patchTrip(editor.agent, tripId, { name: 'Renamed' }), 403);

      await expectHttpStatus(
        sendInvitation(owner.agent, tripId, {
          email: editor.email,
          role: 'VIEWER',
        }),
        403,
      );

      await expectHttpStatus(
        acceptInvitation(pendingInvitee.agent, pending.body.id as string),
        409,
      );

      const membershipCount = await prisma.tripMembership.count({
        where: { tripId, userId: pendingInvitee.userId },
      });
      expect(membershipCount).toBe(0);

      const invitation = await prisma.tripInvitation.findUnique({ where: { id: pending.body.id } });
      expect(invitation?.status).toBe('PENDING');
    });
  });

  describe('editor permissions', () => {
    it('allows editing trip details but not membership management or archive', async () => {
      const server = app.getHttpServer();
      const { owner, editor, tripId } = await setupTripWithEditor(server);
      const viewer = await registerUser(server, 'ed-viewer');

      const viewerInvite = await expectHttpStatus(
        sendInvitation(owner.agent, tripId, {
          email: viewer.email,
          role: 'VIEWER',
        }),
        201,
      );
      await expectHttpStatus(acceptInvitation(viewer.agent, viewerInvite.body.id), 200);

      await expectHttpStatus(patchTrip(editor.agent, tripId, { name: 'Updated by editor' }), 200);

      await expectHttpStatus(
        sendInvitation(editor.agent, tripId, {
          email: owner.email,
          role: 'VIEWER',
        }),
        403,
      );

      await expectHttpStatus(patchMemberRole(editor.agent, tripId, viewer.userId, 'MEMBER'), 403);
      await expectHttpStatus(removeMember(editor.agent, tripId, viewer.userId), 403);
      await expectHttpStatus(archiveTrip(editor.agent, tripId), 403);
    });
  });

  describe('last-owner protection', () => {
    it('prevents the sole owner from removing or demoting themselves', async () => {
      const server = app.getHttpServer();
      const owner = await registerUser(server, 'solo-owner');

      const trip = await expectHttpStatus(
        createTrip(owner.agent, {
          name: 'Solo',
          destinationName: 'Oslo',
          startDate: '2027-06-01',
          endDate: '2027-06-05',
        }),
        201,
      );
      const tripId = trip.body.id as string;

      await expectHttpStatus(patchMemberRole(owner.agent, tripId, owner.userId, 'MEMBER'), 403);
      await expectHttpStatus(removeMember(owner.agent, tripId, owner.userId), 403);

      const owners = await prisma.tripMembership.count({ where: { tripId, role: 'OWNER' } });
      expect(owners).toBe(1);
    });

    it('allows an owner to demote themselves when another owner remains', async () => {
      const server = app.getHttpServer();
      const owner = await registerUser(server, 'co-owner1');
      const partner = await registerUser(server, 'co-owner2');

      const trip = await expectHttpStatus(
        createTrip(owner.agent, {
          name: 'Shared ownership',
          destinationName: 'Berlin',
          startDate: '2027-07-01',
          endDate: '2027-07-07',
        }),
        201,
      );
      const tripId = trip.body.id as string;

      const invite = await expectHttpStatus(
        sendInvitation(owner.agent, tripId, {
          email: partner.email,
          role: 'EDITOR',
        }),
        201,
      );
      await expectHttpStatus(acceptInvitation(partner.agent, invite.body.id), 200);

      await expectHttpStatus(patchMemberRole(owner.agent, tripId, partner.userId, 'OWNER'), 200);

      await expectHttpStatus(patchMemberRole(owner.agent, tripId, owner.userId, 'EDITOR'), 200);

      const owners = await prisma.tripMembership.count({ where: { tripId, role: 'OWNER' } });
      expect(owners).toBe(1);

      const ownerMembership = await prisma.tripMembership.findUnique({
        where: { tripId_userId: { tripId, userId: partner.userId } },
      });
      expect(ownerMembership?.role).toBe('OWNER');
    });
  });

  describe('concurrent invitation acceptance', () => {
    it('creates a single membership when accept is called in parallel', async () => {
      const server = app.getHttpServer();
      const owner = await registerUser(server, 'race-owner');
      const invitee = await registerUser(server, 'race-invitee');

      const trip = await expectHttpStatus(
        createTrip(owner.agent, {
          name: 'Concurrency',
          destinationName: 'Tokyo',
          startDate: '2027-08-01',
          endDate: '2027-08-05',
        }),
        201,
      );
      const tripId = trip.body.id as string;

      const invite = await expectHttpStatus(
        sendInvitation(owner.agent, tripId, {
          email: invitee.email,
          role: 'MEMBER',
        }),
        201,
      );
      const invitationId = invite.body.id as string;

      const csrf = await invitee.agent.get(`${API_PREFIX}/auth/csrf`).set('Origin', origin).expect(200);
      const headers = withAuthHeaders(csrf.body.csrfToken as string, origin);
      const url = `${API_PREFIX}/invitations/${invitationId}/accept`;

      const [first, second] = await Promise.all([
        invitee.agent.post(url).set(headers),
        invitee.agent.post(url).set(headers),
      ]);

      const statuses = [first.status, second.status].sort((a, b) => a - b);
      expect(statuses).toEqual([200, 409]);

      for (const res of [first, second]) {
        expect([200, 409]).toContain(res.status);
        if (res.status >= 500) {
          fail(`Unexpected server error: ${res.status} ${JSON.stringify(res.body)}`);
        }
      }

      const membershipCount = await prisma.tripMembership.count({
        where: { tripId, userId: invitee.userId },
      });
      expect(membershipCount).toBe(1);

      const invitation = await prisma.tripInvitation.findUnique({ where: { id: invitationId } });
      expect(invitation?.status).toBe('ACCEPTED');
    });
  });

  it('rejects unauthenticated access', async () => {
    await request(app.getHttpServer()).get(`${API_PREFIX}/trips`).expect(401);
  });
});
