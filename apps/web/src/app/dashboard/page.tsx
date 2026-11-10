'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/hooks/use-auth';

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !user) {
    return (
      <AppShell>
        <div className="flex flex-1 items-center justify-center py-20">
          <p className="text-roamly-navy/60">Loading your workspace…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="space-y-6 py-4">
        <StatusPill>Signed in</StatusPill>
        <h1 className="text-3xl font-semibold text-roamly-navy">
          Hello, {user.displayName}
        </h1>
        <p className="max-w-2xl text-roamly-navy/75">
          Your account is ready. Trip creation, invitations, and shared workspaces arrive in the
          next milestone — for now this dashboard confirms secure session authentication.
        </p>
        <div className="rounded-2xl border border-roamly-stone bg-white/85 p-5 shadow-soft">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <ProfileField label="Email" value={user.email} />
            <ProfileField label="Member since" value={new Date(user.createdAt).toLocaleDateString()} />
          </dl>
        </div>
        <Link href="/" className="text-sm font-medium text-roamly-teal hover:underline">
          ← Back to home
        </Link>
      </section>
    </AppShell>
  );
}

function StatusPill({ children }: { children: React.ReactNode }) {
  return (
    <p className="inline-flex rounded-full border border-roamly-teal/30 bg-white/60 px-3 py-1 text-xs font-medium text-roamly-teal">
      {children}
    </p>
  );
}

function ProfileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-roamly-navy/50">{label}</dt>
      <dd className="font-medium text-roamly-navy">{value}</dd>
    </div>
  );
}
