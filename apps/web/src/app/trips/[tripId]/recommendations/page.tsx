'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/hooks/use-auth';
import { groupIntelligenceApi, GroupIntelligenceApiError } from '@/lib/group-intelligence-api';
import { tripsApi } from '@/lib/trips-api';

export default function TripRecommendationsPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pollNotice, setPollNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  const tripQuery = useQuery({
    queryKey: ['trips', tripId],
    queryFn: () => tripsApi.get(tripId),
    enabled: Boolean(tripId) && isAuthenticated,
  });

  const prefQuery = useQuery({
    queryKey: ['trips', tripId, 'preferences'],
    queryFn: () => groupIntelligenceApi.getPreferences(tripId),
    enabled: Boolean(tripId) && isAuthenticated,
  });

  const listQuery = useQuery({
    queryKey: ['trips', tripId, 'recommendations'],
    queryFn: () => groupIntelligenceApi.listRecommendations(tripId),
    enabled: Boolean(tripId) && isAuthenticated,
  });

  const destinationsQuery = useQuery({
    queryKey: ['destinations'],
    queryFn: () => groupIntelligenceApi.listDestinations(),
    enabled: isAuthenticated,
  });

  const detailQuery = useQuery({
    queryKey: ['trips', tripId, 'recommendations', selectedId],
    queryFn: () => groupIntelligenceApi.getRecommendation(tripId, selectedId!),
    enabled: Boolean(selectedId),
  });

  useEffect(() => {
    if (listQuery.data?.[0] && !selectedId) setSelectedId(listQuery.data[0].id);
  }, [listQuery.data, selectedId]);

  const generateMutation = useMutation({
    mutationFn: () => groupIntelligenceApi.generateRecommendations(tripId),
    onSuccess: (data) => {
      setError(null);
      setSelectedId(data.id);
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'recommendations'] });
    },
    onError: (err) => {
      setError(err instanceof GroupIntelligenceApiError ? err.message : 'Could not generate recommendations');
    },
  });

  const canGenerate = tripQuery.data && tripQuery.data.myRole !== 'VIEWER';
  const canManagePoll =
    tripQuery.data?.myRole === 'OWNER' || tripQuery.data?.myRole === 'EDITOR';
  const allComplete =
    prefQuery.data &&
    prefQuery.data.status.completedCount === prefQuery.data.status.totalMembers &&
    prefQuery.data.status.totalMembers > 0;

  const destById = new Map(destinationsQuery.data?.map((d) => [d.id, d]) ?? []);

  type RankedRow = {
    destinationId: string;
    groupScore: number;
    averageMemberScore: number;
    lowestMemberScore: number;
    explanations?: string[];
  };
  const ranked =
    (detailQuery.data?.result as { ranked?: RankedRow[] } | undefined)?.ranked ?? [];
  const rejected =
    (detailQuery.data?.result as { rejected?: Array<{ destinationId: string; reasons: string[] }> })
      ?.rejected ?? [];

  if (isLoading || tripQuery.isLoading) {
    return (
      <AppShell>
        <p className="py-20 text-center text-roamly-navy/60">Loading…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href={`/trips/${tripId}`} className="text-sm text-roamly-teal hover:underline">
        ← Back to trip
      </Link>
      <h1 className="font-display mt-4 text-2xl text-roamly-navy">Destination intelligence</h1>
      <p className="mt-1 text-sm text-roamly-navy/70">
        Deterministic scores from your group&apos;s preferences and the curated catalog. Budget figures are estimates,
        not live prices.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        {canGenerate && (
          <button
            type="button"
            disabled={!allComplete || generateMutation.isPending}
            className="rounded-lg bg-roamly-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            onClick={() => generateMutation.mutate()}
          >
            Generate new snapshot
          </button>
        )}
        <Link
          href={`/trips/${tripId}/preferences`}
          className="rounded-lg border border-roamly-sand px-4 py-2 text-sm"
        >
          Preferences
        </Link>
        {canManagePoll && selectedId && !detailQuery.data?.infeasible && (
          <button
            type="button"
            className="rounded-lg border border-roamly-teal px-4 py-2 text-sm text-roamly-teal"
            onClick={async () => {
              try {
                setPollNotice(null);
                const poll = await groupIntelligenceApi.createPoll(tripId, {
                  recommendationSnapshotId: selectedId,
                });
                window.location.href = `/trips/${tripId}/polls/${poll.id}`;
              } catch (err) {
                setPollNotice(
                  err instanceof GroupIntelligenceApiError ? err.message : 'Could not create poll',
                );
              }
            }}
          >
            Start vote from this snapshot
          </button>
        )}
      </div>
      {pollNotice && <p className="mt-2 text-sm text-red-600">{pollNotice}</p>}

      {!allComplete && (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          All participating members must complete preferences before generating recommendations (
          {prefQuery.data?.status.completedCount ?? 0}/{prefQuery.data?.status.totalMembers ?? 0} ready).
        </p>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {listQuery.data && listQuery.data.length === 0 && (
        <p className="mt-8 text-roamly-navy/60">No recommendation snapshots yet.</p>
      )}

      {listQuery.data && listQuery.data.length > 0 && (
        <label className="mt-4 block text-sm">
          Snapshot history
          <select
            className="mt-1 w-full max-w-md rounded-lg border border-roamly-sand px-3 py-2"
            value={selectedId ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {listQuery.data.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.createdAt).toLocaleString()} — {s.infeasible ? 'No match' : `Top: ${s.topDestinationId}`}
              </option>
            ))}
          </select>
        </label>
      )}

      {detailQuery.data && (
        <p className="mt-4 text-sm text-roamly-navy/70">
          Snapshot from {new Date(detailQuery.data.createdAt).toLocaleString()}. Preferences are frozen per run —
          update member budgets or dates on the preferences page, then generate again.
        </p>
      )}

      {detailQuery.data?.infeasible && (
        <p className="mt-6 rounded-lg border border-roamly-sand bg-white p-4 text-sm text-roamly-navy/80">
          No destinations satisfied all hard constraints for this snapshot. Hard max budgets are compared against each
          destination&apos;s <strong>indicative per-person minimum</strong> (not the trip-level budget field). Equal
          voting in polls does not use these scores.
        </p>
      )}

      <ul className="mt-8 space-y-4">
        {ranked.map((row) => {
          const dest = destById.get(row.destinationId);
          return (
            <li key={row.destinationId} className="rounded-xl border border-roamly-sand bg-white p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-lg text-roamly-navy">{dest?.name ?? row.destinationId}</h2>
                <span className="text-sm font-medium text-roamly-teal">Group fit {row.groupScore}</span>
              </div>
              {dest && (
                <p className="text-sm text-roamly-navy/60">
                  {dest.region}, {dest.countryCode} · Est. {dest.budgetMin}–{dest.budgetMax} {dest.budgetCurrency} /
                  person
                </p>
              )}
              <p className="mt-2 text-sm text-roamly-navy/80">
                Avg {row.averageMemberScore} · Lowest member {row.lowestMemberScore}
              </p>
              <ul className="mt-2 list-disc pl-5 text-sm text-roamly-navy/70">
                {row.explanations?.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {rejected.length > 0 && (
        <details className="mt-8 rounded-xl border border-roamly-sand bg-roamly-stone/30 p-4">
          <summary className="cursor-pointer text-sm font-medium text-roamly-navy">
            Excluded destinations ({rejected.length})
          </summary>
          <ul className="mt-3 space-y-2 text-sm text-roamly-navy/70">
            {rejected.map((r) => (
              <li key={r.destinationId}>
                <span className="font-medium">{destById.get(r.destinationId)?.name ?? r.destinationId}</span>
                <ul className="list-disc pl-5">
                  {r.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </details>
      )}
    </AppShell>
  );
}
