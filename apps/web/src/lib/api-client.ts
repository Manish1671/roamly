import { API_PREFIX, CSRF_HEADER_NAME, type CsrfResponse, type PublicUser } from '@roamly/shared';
import type { LoginBody, RegisterBody } from '@roamly/shared';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:3001${API_PREFIX}`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function parseError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) {
      return body.message.join('; ');
    }
    if (body.message) {
      return body.message;
    }
  } catch {
    // ignore
  }
  return response.statusText || 'Request failed';
}

export async function fetchCsrfToken(): Promise<string> {
  const response = await fetch(`${API_BASE}/auth/csrf`, {
    credentials: 'include',
  });
  if (!response.ok) {
    throw new ApiError(await parseError(response), response.status);
  }
  const body = (await response.json()) as CsrfResponse;
  return body.csrfToken;
}

async function apiFetch<T>(
  path: string,
  init: RequestInit & { csrfToken?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (init.csrfToken) {
    headers.set(CSRF_HEADER_NAME, init.csrfToken);
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new ApiError(await parseError(response), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const authApi = {
  async me(): Promise<{ user: PublicUser } | null> {
    const response = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    if (response.status === 401) {
      return null;
    }
    if (!response.ok) {
      throw new ApiError(await parseError(response), response.status);
    }
    return (await response.json()) as { user: PublicUser };
  },

  async register(body: RegisterBody, csrfToken: string) {
    return apiFetch<{ user: PublicUser }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
      csrfToken,
    });
  },

  async login(body: LoginBody, csrfToken: string) {
    return apiFetch<{ user: PublicUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
      csrfToken,
    });
  },

  async logout(csrfToken: string) {
    return apiFetch<void>('/auth/logout', { method: 'POST', csrfToken });
  },
};
