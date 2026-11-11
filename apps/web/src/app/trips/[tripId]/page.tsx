'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TripMemberView, TripSummary } from '@roamly/shared';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/hooks/use-auth';
import { groupIntelligenceApi } from '@/lib/group-intelligence-api';
import { tripsApi, TripsApiError } from '@/lib/trips-api';

export default function TripWorkspacePage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'EDITOR' | 'MEMBER' | 'VIEWER'>('MEMBER');
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  const tripQuery = useQuery({
    queryKey: ['trips', tripId],
    queryFn: () => tripsApi.get(tripId),
    enabled: Boolean(tripId) && isAuthenticated,
    retry: false,
  });

  const decisionQuery = useQuery({
    queryKey: ['trips', tripId, 'decision'],
    queryFn: async () => {
      const decision = await groupIntelligenceApi.getLatestDecision(tripId);
      return decision;
    },
    enabled: Boolean(tripId) && tripQuery.isSuccess,
  });

  const membersQuery = useQuery({
    queryKey: ['trips', tripId, 'members'],
    queryFn: () => tripsApi.listMembers(tripId),
    enabled: Boolean(tripId) && tripQuery.isSuccess,
  });

  const invitesQuery = useQuery({
    queryKey: ['trips', tripId, 'invitations'],
    queryFn: () => tripsApi.listTripInvitations(tripId),
    enabled: Boolean(tripId) && tripQuery.data?.myRole === 'OWNER',
  });

  const archiveMutation = useMutation({
    mutationFn: () => tripsApi.archive(tripId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: () => tripsApi.invite(tripId, { email: inviteEmail, role: inviteRole }),
    onSuccess: () => {
      setInviteEmail('');
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'invitations'] });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (invitationId: string) => tripsApi.revokeInvitation(tripId, invitationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'invitations'] }),
  });

  if (isLoading || tripQuery.isLoading) {
    return (
      <AppShell>
        <p className="py-20 text-center text-roamly-navy/60">Loading trip…</p>
      </AppShell>
    );
  }

  if (tripQuery.isError) {
    return (
      <AppShell>
        <div className="py-16 text-center">
          <p className="text-roamly-navy/70">Trip not found or you do not have access.</p>
          <Link href="/dashboard" className="mt-4 inline-block text-sm text-roamly-teal hover:underline">
            Back to dashboard
          </Link>
        </div>
      </AppShell>
    );
  }

  const trip = tripQuery.data as TripSummary;
  const isArchived = Boolean(trip.archivedAt);
  const canEdit = !isArchived && (trip.myRole === 'OWNER' || trip.myRole === 'EDITOR');
  const isOwner = trip.myRole === 'OWNER' && !isArchived;

  return (
    <AppShell>
      <section className="space-y-8 py-4">
        <Link href="/dashboard" className="text-sm text-roamly-teal hover:underline">
          ← Dashboard
        </Link>

        <header className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-roamly-navy">{trip.name}</h1>
            {isArchived ? (
              <span className="rounded-full bg-roamly-stone px-2 py-0.5 text-xs font-medium">Archived</span>
            ) : null}
          </div>
          <p className="text-lg text-roamly-navy/75">{trip.destinationName}</p>
          {decisionQuery.data && (
            <p className="rounded-lg border border-roamly-teal/40 bg-roamly-teal/5 px-3 py-2 text-sm text-roamly-navy">
              Finalized group destination:{' '}
              <strong>{decisionQuery.data.destinationName ?? decisionQuery.data.destinationId}</strong>
            </p>
          )}
          <p className="text-sm text-roamly-navy/60">
            {trip.startDate} → {trip.endDate}
            {trip.budgetAmount ? ` · ${trip.budgetCurrency} ${trip.budgetAmount}` : ''}
          </p>
          <p className="text-xs uppercase tracking-wide text-roamly-teal">Your role: {trip.myRole}</p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href={`/trips/${tripId}/preferences`}
              className="rounded-lg border border-roamly-sand px-3 py-1.5 text-sm text-roamly-navy hover:border-roamly-teal"
            >
              Group preferences
            </Link>
            <Link
              href={`/trips/${tripId}/recommendations`}
              className="rounded-lg border border-roamly-sand px-3 py-1.5 text-sm text-roamly-navy hover:border-roamly-teal"
            >
              Recommendations
            </Link>
          </div>
        </header>

        {canEdit ? <TripEditPanel trip={trip} tripId={tripId} onUpdated={() => queryClient.invalidateQueries({ queryKey: ['trips', tripId] })} /> : null}

        {isOwner ? (
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={async () => {
                try {
                  await archiveMutation.mutateAsync();
                } catch (err) {
                  setActionError(err instanceof TripsApiError ? err.message : 'Could not archive');
                }
              }}
              className="rounded-lg border border-roamly-stone px-4 py-2 text-sm font-medium"
            >
              Archive trip
            </button>
          </div>
        ) : null}

        <MembersPanel
          members={membersQuery.data?.members ?? []}
          tripId={tripId}
          myRole={trip.myRole}
          isArchived={isArchived}
          onChanged={() => membersQuery.refetch()}
        />

        {isOwner ? (
          <div className="rounded-2xl border border-roamly-stone bg-white/90 p-5 shadow-soft">
            <h2 className="text-lg font-semibold text-roamly-navy">Invite member</h2>
            <p className="mb-4 text-sm text-roamly-navy/60">Invitations appear in the invitee&apos;s dashboard.</p>
            <div className="flex flex-wrap gap-3">
              <input
                className="min-w-[200px] flex-1 rounded-lg border border-roamly-stone px-3 py-2 text-sm"
                placeholder="Email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <select
                className="rounded-lg border border-roamly-stone px-3 py-2 text-sm"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
              >
                <option value="EDITOR">Editor</option>
                <option value="MEMBER">Member</option>
                <option value="VIEWER">Viewer</option>
              </select>
              <button
                type="button"
                className="rounded-lg bg-roamly-navy px-4 py-2 text-sm font-medium text-white"
                onClick={async () => {
                  setActionError(null);
                  try {
                    await inviteMutation.mutateAsync();
                  } catch (err) {
                    setActionError(err instanceof TripsApiError ? err.message : 'Invite failed');
                  }
                }}
              >
                Send invite
              </button>
            </div>
            {actionError ? <p className="mt-2 text-sm text-red-700">{actionError}</p> : null}

            <ul className="mt-6 space-y-2 text-sm">
              {(invitesQuery.data?.invitations ?? [])
                .filter((i) => i.status === 'PENDING')
                .map((invite) => (
                  <li key={invite.id} className="flex items-center justify-between gap-3 rounded-lg bg-roamly-canvas/50 px-3 py-2">
                    <span>
                      {invite.invitedEmail} · {invite.intendedRole}
                    </span>
                    <button
                      type="button"
                      className="text-xs text-roamly-teal hover:underline"
                      onClick={() => revokeMutation.mutate(invite.id)}
                    >
                      Revoke
                    </button>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

function TripEditPanel({
  trip,
  tripId,
  onUpdated,
}: {
  trip: TripSummary;
  tripId: string;
  onUpdated: () => void;
}) {
  const form = useForm({
    defaultValues: {
      name: trip.name,
      destinationName: trip.destinationName,
    },
  });
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="rounded-2xl border border-roamly-stone bg-white/90 p-5 shadow-soft space-y-3"
      onSubmit={form.handleSubmit(async (values) => {
        try {
          await tripsApi.update(tripId, values);
          setMessage('Saved');
          onUpdated();
        } catch (err) {
          setMessage(err instanceof TripsApiError ? err.message : 'Update failed');
        }
      })}
    >
      <h2 className="text-lg font-semibold text-roamly-navy">Trip details</h2>
      <input className="w-full rounded-lg border border-roamly-stone px-3 py-2 text-sm" {...form.register('name')} />
      <input
        className="w-full rounded-lg border border-roamly-stone px-3 py-2 text-sm"
        {...form.register('destinationName')}
      />
      <button type="submit" className="rounded-lg bg-roamly-teal px-4 py-2 text-sm font-medium text-white">
        Save changes
      </button>
      {message ? <p className="text-sm text-roamly-navy/70">{message}</p> : null}
    </form>
  );
}

function MembersPanel({
  members,
  tripId,
  myRole,
  isArchived,
  onChanged,
}: {
  members: TripMemberView[];
  tripId: string;
  myRole: TripSummary['myRole'];
  isArchived: boolean;
  onChanged: () => void;
}) {
  const isOwner = myRole === 'OWNER' && !isArchived;

  return (
    <div className="rounded-2xl border border-roamly-stone bg-white/90 p-5 shadow-soft">
      <h2 className="mb-4 text-lg font-semibold text-roamly-navy">Members</h2>
      <ul className="space-y-3">
        {members.map((member) => (
          <li key={member.userId} className="flex flex-wrap items-center justify-between gap-2 border-b border-roamly-stone/60 pb-3 last:border-0">
            <div>
              <p className="font-medium text-roamly-navy">{member.displayName}</p>
              <p className="text-xs text-roamly-navy/60">{member.email}</p>
            </div>
            {isOwner ? (
              <div className="flex items-center gap-2">
                <select
                  className="rounded border border-roamly-stone px-2 py-1 text-xs"
                  value={member.role}
                  onChange={async (e) => {
                    await tripsApi.updateMemberRole(tripId, member.userId, e.target.value);
                    onChanged();
                  }}
                >
                  <option value="OWNER">Owner</option>
                  <option value="EDITOR">Editor</option>
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                </select>
                <button
                  type="button"
                  className="text-xs text-red-700 hover:underline"
                  onClick={async () => {
                    await tripsApi.removeMember(tripId, member.userId);
                    onChanged();
                  }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <span className="text-xs font-medium text-roamly-teal">{member.role}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
