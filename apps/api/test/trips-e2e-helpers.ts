import { API_PREFIX } from '@roamly/shared';
import type request from 'supertest';
import { withAuthHeaders } from './auth-helpers';

const origin = 'http://localhost:3000';

export async function fetchCsrfForAgent(agent: request.SuperAgentTest): Promise<string> {
  const res = await agent.get(`${API_PREFIX}/auth/csrf`).set('Origin', origin).expect(200);
  return res.body.csrfToken as string;
}

function withCsrf<T extends request.Test>(agent: request.SuperAgentTest, run: (csrfToken: string) => T) {
  return fetchCsrfForAgent(agent).then(run);
}

export async function expectHttpStatus(responsePromise: Promise<request.Response>, status: number) {
  const res = await responsePromise;
  expect(res.status).toBe(status);
  return res;
}

export function createTrip(
  agent: request.SuperAgentTest,
  payload: {
    name: string;
    destinationName: string;
    startDate: string;
    endDate: string;
  },
) {
  return withCsrf(agent, (csrfToken) =>
    agent
      .post(`${API_PREFIX}/trips`)
      .set(withAuthHeaders(csrfToken, origin))
      .send(payload),
  );
}

export function sendInvitation(
  agent: request.SuperAgentTest,
  tripId: string,
  body: { email: string; role: 'EDITOR' | 'MEMBER' | 'VIEWER' },
) {
  return withCsrf(agent, (csrfToken) =>
    agent
      .post(`${API_PREFIX}/trips/${tripId}/invitations`)
      .set(withAuthHeaders(csrfToken, origin))
      .send(body),
  );
}

export function acceptInvitation(agent: request.SuperAgentTest, invitationId: string) {
  return withCsrf(agent, (csrfToken) =>
    agent
      .post(`${API_PREFIX}/invitations/${invitationId}/accept`)
      .set(withAuthHeaders(csrfToken, origin)),
  );
}

export function archiveTrip(agent: request.SuperAgentTest, tripId: string) {
  return withCsrf(agent, (csrfToken) =>
    agent.post(`${API_PREFIX}/trips/${tripId}/archive`).set(withAuthHeaders(csrfToken, origin)),
  );
}

export function patchTrip(
  agent: request.SuperAgentTest,
  tripId: string,
  body: Record<string, string>,
) {
  return withCsrf(agent, (csrfToken) =>
    agent
      .patch(`${API_PREFIX}/trips/${tripId}`)
      .set(withAuthHeaders(csrfToken, origin))
      .send(body),
  );
}

export function patchMemberRole(
  agent: request.SuperAgentTest,
  tripId: string,
  userId: string,
  role: string,
) {
  return withCsrf(agent, (csrfToken) =>
    agent
      .patch(`${API_PREFIX}/trips/${tripId}/members/${userId}`)
      .set(withAuthHeaders(csrfToken, origin))
      .send({ role }),
  );
}

export function removeMember(agent: request.SuperAgentTest, tripId: string, userId: string) {
  return withCsrf(agent, (csrfToken) =>
    agent
      .delete(`${API_PREFIX}/trips/${tripId}/members/${userId}`)
      .set(withAuthHeaders(csrfToken, origin)),
  );
}
