'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { TripInvitationView, TripSummary } from '@roamly/shared';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/hooks/use-auth';
import { bucketTrips } from '@/lib/trip-buckets';
import { tripsApi } from '@/lib/trips-api';

export default function DashboardPage() {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  const tripsQuery = useQuery({
    queryKey: ['trips'],
    queryFn: () => tripsApi.list(),
    enabled: isAuthenticated,
  });

  const invitesQuery = useQuery({
    queryKey: ['invitations', 'mine'],
    queryFn: () => tripsApi.listMyInvitations(),
    enabled: isAuthenticated,
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) => tripsApi.acceptInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['invitations', 'mine'] });
    },
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) => tripsApi.declineInvitation(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations', 'mine'] }),
  });

  const buckets = useMemo(
    () => bucketTrips(tripsQuery.data?.trips ?? []),
    [tripsQuery.data?.trips],
  );

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
      <section className="space-y-8 py-4">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-roamly-navy">Hello, {user.displayName}</h1>
            <p className="mt-1 text-roamly-navy/70">Your trips and pending invitations</p>
          </div>
          <Link
            href="/trips/new"
            className="rounded-lg bg-roamly-navy px-4 py-2.5 text-sm font-medium text-white shadow-soft hover:bg-roamly-navy/90"
          >
            Create trip
          </Link>
        </header>

        <InvitationsPanel
          invitations={invitesQuery.data?.invitations ?? []}
          loading={invitesQuery.isLoading}
          onAccept={(id) => acceptMutation.mutateAsync(id)}
          onDecline={(id) => declineMutation.mutateAsync(id)}
        />

        {tripsQuery.isLoading ? (
          <p className="text-sm text-roamly-navy/60">Loading trips…</p>
        ) : tripsQuery.isError ? (
          <p className="text-sm text-red-700">Could not load trips.</p>
        ) : tripsQuery.data?.trips.length === 0 ? (
          <EmptyTrips />
        ) : (
          <div className="space-y-8">
            <TripSection title="Ongoing" trips={buckets.ongoing} />
            <TripSection title="Upcoming" trips={buckets.upcoming} />
            <TripSection title="Past" trips={buckets.past} />
            <TripSection title="Archived" trips={buckets.archived} />
          </div>
        )}
      </section>
    </AppShell>
  );
}

function TripSection({ title, trips }: { title: string; trips: TripSummary[] }) {
  if (trips.length === 0) return null;
  return (
    <div>
      <h2 className="mb-3 text-lg font-semibold text-roamly-navy">{title}</h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {trips.map((trip) => (
          <li key={trip.id}>
            <Link
              href={`/trips/${trip.id}`}
              className="block rounded-2xl border border-roamly-stone bg-white/85 p-4 shadow-soft transition hover:border-roamly-teal/40"
            >
              <p className="font-semibold text-roamly-navy">{trip.name}</p>
              <p className="text-sm text-roamly-navy/70">{trip.destinationName}</p>
              <p className="mt-2 text-xs text-roamly-navy/50">
                {trip.startDate} → {trip.endDate} · {trip.myRole}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function InvitationsPanel({
  invitations,
  loading,
  onAccept,
  onDecline,
}: {
  invitations: TripInvitationView[];
  loading: boolean;
  onAccept: (id: string) => Promise<unknown>;
  onDecline: (id: string) => Promise<unknown>;
}) {
  const pending = invitations.filter((i) => i.status === 'PENDING');
  if (loading) return null;
  if (pending.length === 0) return null;

  return (
    <Panel title="Pending invitations" className="border-roamly-teal/30 bg-roamly-teal/5">
      <ul className="space-y-3">
        {pending.map((invite) => (
          <li key={invite.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/80 p-3">
            <div>
              <p className="font-medium text-roamly-navy">{invite.tripName}</p>
              <p className="text-xs text-roamly-navy/60">
                From {invite.invitedByDisplayName} · role {invite.intendedRole}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-roamly-navy px-3 py-1.5 text-xs font-medium text-white"
                onClick={() => onAccept(invite.id)}
              >
                Accept
              </button>
              <button
                type="button"
                className="rounded-lg border border-roamly-stone px-3 py-1.5 text-xs font-medium"
                onClick={() => onDecline(invite.id)}
              >
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function EmptyTrips() {
  return (
    <div className="rounded-2xl border border-dashed border-roamly-stone bg-white/60 p-10 text-center">
      <p className="text-roamly-navy/70">No trips yet.</p>
      <Link href="/trips/new" className="mt-3 inline-block text-sm font-medium text-roamly-teal hover:underline">
        Create your first trip
      </Link>
    </div>
  );
}

function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${className ?? ''}`}>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-roamly-navy/70">{title}</h2>
      {children}
    </div>
  );
}
