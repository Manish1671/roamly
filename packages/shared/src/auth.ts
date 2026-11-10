import { z } from 'zod';

export const SESSION_COOKIE_NAME = 'roamly_session' as const;
export const CSRF_COOKIE_NAME = 'roamly_csrf' as const;
export const CSRF_HEADER_NAME = 'x-csrf-token' as const;

export const registerBodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  displayName: z
    .string()
    .trim()
    .min(1, 'Display name is required')
    .max(100, 'Display name is too long'),
});

export const loginBodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

export type RegisterBody = z.infer<typeof registerBodySchema>;
export type LoginBody = z.infer<typeof loginBodySchema>;

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface AuthSessionResponse {
  user: PublicUser;
}

export interface CsrfResponse {
  csrfToken: string;
}
