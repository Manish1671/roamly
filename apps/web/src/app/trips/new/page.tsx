'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AppShell } from '@/components/app-shell';
import { TripCreateForm } from '@/components/trip-create-form';
import { useAuth } from '@/hooks/use-auth';

export default function NewTripPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <AppShell>
        <p className="py-20 text-center text-roamly-navy/60">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="mx-auto max-w-xl space-y-4 py-6">
        <Link href="/dashboard" className="text-sm text-roamly-teal hover:underline">
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold text-roamly-navy">Create a trip</h1>
        <p className="text-sm text-roamly-navy/70">You will be the trip owner and can invite members next.</p>
        <div className="rounded-2xl border border-roamly-stone bg-white/90 p-6 shadow-soft">
          <TripCreateForm onCancel={() => router.push('/dashboard')} />
        </div>
      </section>
    </AppShell>
  );
}
