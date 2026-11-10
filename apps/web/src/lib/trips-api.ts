import type {
  CreateTripBody,
  InviteMemberBody,
  TripInvitationView,
  TripMemberView,
  TripSummary,
  UpdateTripBody,
} from '@roamly/shared';
import { fetchCsrfToken } from '@/lib/api-client';
import { API_PREFIX, CSRF_HEADER_NAME } from '@roamly/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:3001${API_PREFIX}`;

class TripsApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'TripsApiError';
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message.join('; ');
    if (body.message) return body.message;
  } catch {
    // ignore
  }
  return response.statusText || 'Request failed';
}

async function tripsFetch<T>(path: string, init: RequestInit & { csrf?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  if (init.csrf) {
    const token = await fetchCsrfToken();
    headers.set(CSRF_HEADER_NAME, token);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new TripsApiError(await parseError(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const tripsApi = {
  list(): Promise<{ trips: TripSummary[] }> {
    return tripsFetch('/trips');
  },

  get(tripId: string): Promise<TripSummary> {
    return tripsFetch(`/trips/${tripId}`);
  },

  create(body: CreateTripBody) {
    return tripsFetch<TripSummary>('/trips', {
      method: 'POST',
      body: JSON.stringify(body),
      csrf: true,
    });
  },

  update(tripId: string, body: UpdateTripBody) {
    return tripsFetch<TripSummary>(`/trips/${tripId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
      csrf: true,
    });
  },

  archive(tripId: string) {
    return tripsFetch<TripSummary>(`/trips/${tripId}/archive`, { method: 'POST', csrf: true });
  },

  listMembers(tripId: string): Promise<{ members: TripMemberView[] }> {
    return tripsFetch(`/trips/${tripId}/members`);
  },

  updateMemberRole(tripId: string, userId: string, role: string) {
    return tripsFetch<TripMemberView>(`/trips/${tripId}/members/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
      csrf: true,
    });
  },

  removeMember(tripId: string, userId: string) {
    return tripsFetch<void>(`/trips/${tripId}/members/${userId}`, {
      method: 'DELETE',
      csrf: true,
    });
  },

  invite(tripId: string, body: InviteMemberBody) {
    return tripsFetch<TripInvitationView>(`/trips/${tripId}/invitations`, {
      method: 'POST',
      body: JSON.stringify(body),
      csrf: true,
    });
  },

  listTripInvitations(tripId: string): Promise<{ invitations: TripInvitationView[] }> {
    return tripsFetch(`/trips/${tripId}/invitations`);
  },

  listMyInvitations(): Promise<{ invitations: TripInvitationView[] }> {
    return tripsFetch('/invitations');
  },

  acceptInvitation(invitationId: string) {
    return tripsFetch<TripInvitationView>(`/invitations/${invitationId}/accept`, {
      method: 'POST',
      csrf: true,
    });
  },

  declineInvitation(invitationId: string) {
    return tripsFetch<TripInvitationView>(`/invitations/${invitationId}/decline`, {
      method: 'POST',
      csrf: true,
    });
  },

  revokeInvitation(tripId: string, invitationId: string) {
    return tripsFetch<TripInvitationView>(`/trips/${tripId}/invitations/${invitationId}/revoke`, {
      method: 'POST',
      csrf: true,
    });
  },
};

export { TripsApiError };
