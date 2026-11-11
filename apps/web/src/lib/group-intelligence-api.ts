import type {
  DestinationSummary,
  MyPreferenceView,
  RecommendationSnapshotDetail,
  RecommendationSnapshotSummary,
  TripPreferencesOverview,
  UpsertMyPreferenceBody,
  DestinationPollView,
  PollResultsView,
  TripDestinationDecisionView,
  CreatePollBody,
  CastVoteBody,
} from '@roamly/shared';
import { fetchCsrfToken } from '@/lib/api-client';
import { API_PREFIX, CSRF_HEADER_NAME } from '@roamly/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:3001${API_PREFIX}`;

export class GroupIntelligenceApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'GroupIntelligenceApiError';
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

async function giFetch<T>(path: string, init: RequestInit & { csrf?: boolean } = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (init.csrf) {
    headers.set(CSRF_HEADER_NAME, await fetchCsrfToken());
  }
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });
  if (!response.ok) {
    throw new GroupIntelligenceApiError(await parseError(response), response.status);
  }
  return (await response.json()) as T;
}

export const groupIntelligenceApi = {
  getPreferences(tripId: string) {
    return giFetch<TripPreferencesOverview>(`/trips/${tripId}/preferences`);
  },
  saveMyPreferences(tripId: string, body: UpsertMyPreferenceBody) {
    return giFetch<MyPreferenceView>(`/trips/${tripId}/preferences/me`, {
      method: 'PUT',
      body: JSON.stringify(body),
      csrf: true,
    });
  },
  listDestinations() {
    return giFetch<DestinationSummary[]>(`/destinations`);
  },
  listRecommendations(tripId: string) {
    return giFetch<RecommendationSnapshotSummary[]>(`/trips/${tripId}/recommendations`);
  },
  generateRecommendations(tripId: string) {
    return giFetch<RecommendationSnapshotDetail>(`/trips/${tripId}/recommendations/generate`, {
      method: 'POST',
      csrf: true,
    });
  },
  getRecommendation(tripId: string, recommendationId: string) {
    return giFetch<RecommendationSnapshotDetail>(
      `/trips/${tripId}/recommendations/${recommendationId}`,
    );
  },
  createPoll(tripId: string, body: CreatePollBody) {
    return giFetch<DestinationPollView>(`/trips/${tripId}/polls`, {
      method: 'POST',
      body: JSON.stringify(body),
      csrf: true,
    });
  },
  listPolls(tripId: string) {
    return giFetch<DestinationPollView[]>(`/trips/${tripId}/polls`);
  },
  getPoll(tripId: string, pollId: string) {
    return giFetch<DestinationPollView>(`/trips/${tripId}/polls/${pollId}`);
  },
  castVote(tripId: string, pollId: string, body: CastVoteBody) {
    return giFetch<DestinationPollView>(`/trips/${tripId}/polls/${pollId}/votes`, {
      method: 'POST',
      body: JSON.stringify(body),
      csrf: true,
    });
  },
  closePoll(tripId: string, pollId: string) {
    return giFetch<DestinationPollView>(`/trips/${tripId}/polls/${pollId}/close`, {
      method: 'POST',
      csrf: true,
    });
  },
  getPollResults(tripId: string, pollId: string) {
    return giFetch<PollResultsView>(`/trips/${tripId}/polls/${pollId}/results`);
  },
  finalizePoll(tripId: string, pollId: string) {
    return giFetch<TripDestinationDecisionView>(`/trips/${tripId}/polls/${pollId}/finalize`, {
      method: 'POST',
      csrf: true,
    });
  },
  getLatestDecision(tripId: string) {
    return giFetch<TripDestinationDecisionView | null>(`/trips/${tripId}/polls/decision`);
  },
};
