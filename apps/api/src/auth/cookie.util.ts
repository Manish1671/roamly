import type { CookieOptions } from 'express';
import type { EnvConfig } from '../config/env.schema';
import {
  CSRF_COOKIE_NAME,
  SESSION_COOKIE_NAME,
} from '@roamly/shared';

export function sessionCookieOptions(env: EnvConfig, expiresAt: Date): CookieOptions {
  return {
    httpOnly: true,
    secure: cookieSecure(env),
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  };
}

export function clearSessionCookieOptions(env: EnvConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: cookieSecure(env),
    sameSite: 'lax',
    path: '/',
  };
}

export function csrfCookieOptions(env: EnvConfig, maxAgeMs: number): CookieOptions {
  return {
    httpOnly: false,
    secure: cookieSecure(env),
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs,
  };
}

export function clearCsrfCookieOptions(env: EnvConfig): CookieOptions {
  return {
    httpOnly: false,
    secure: cookieSecure(env),
    sameSite: 'lax',
    path: '/',
  };
}

export function cookieSecure(env: EnvConfig): boolean {
  if (env.COOKIE_SECURE === true) {
    return true;
  }
  return env.NODE_ENV === 'production';
}

export { SESSION_COOKIE_NAME, CSRF_COOKIE_NAME };
