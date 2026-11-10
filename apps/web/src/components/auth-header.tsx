'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROAMLY_APP_NAME } from '@roamly/shared';
import { useAuth } from '@/hooks/use-auth';

export function AuthHeader() {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="border-b border-roamly-stone/80 bg-roamly-canvas/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-roamly-navy text-lg font-semibold text-white shadow-soft"
            aria-hidden
          >
            R
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight text-roamly-navy">{ROAMLY_APP_NAME}</p>
            <p className="text-xs text-roamly-teal">Group travel intelligence</p>
          </div>
        </Link>

        <div className="flex items-center gap-3 text-sm">
          {isLoading ? (
            <span className="text-roamly-navy/50">Loading…</span>
          ) : isAuthenticated && user ? (
            <>
              <Link href="/dashboard" className="text-roamly-navy/80 hover:text-roamly-navy">
                Dashboard
              </Link>
              <span className="hidden text-roamly-navy/60 sm:inline">{user.displayName}</span>
              <button
                type="button"
                className="rounded-lg border border-roamly-stone bg-white/70 px-3 py-1.5 font-medium text-roamly-navy hover:border-roamly-teal/40"
                disabled={logout.isPending}
                onClick={async () => {
                  await logout.mutateAsync();
                  router.push('/');
                }}
              >
                {logout.isPending ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <Link className="text-roamly-navy/80 hover:text-roamly-navy" href="/login">
                Sign in
              </Link>
              <Link
                className="rounded-lg bg-roamly-navy px-3 py-1.5 font-medium text-white shadow-soft hover:bg-roamly-navy/90"
                href="/register"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
