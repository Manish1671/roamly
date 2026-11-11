'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/hooks/use-auth';
import { groupIntelligenceApi, GroupIntelligenceApiError } from '@/lib/group-intelligence-api';
import { tripsApi } from '@/lib/trips-api';

export default function TripPollPage() {
  const { tripId, pollId } = useParams<{ tripId: string; pollId: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/login');
  }, [isLoading, isAuthenticated, router]);

  const tripQuery = useQuery({
    queryKey: ['trips', tripId],
    queryFn: () => tripsApi.get(tripId),
    enabled: Boolean(tripId) && isAuthenticated,
  });

  const pollQuery = useQuery({
    queryKey: ['trips', tripId, 'polls', pollId],
    queryFn: () => groupIntelligenceApi.getPoll(tripId, pollId),
    enabled: Boolean(tripId) && Boolean(pollId) && isAuthenticated,
  });

  const resultsQuery = useQuery({
    queryKey: ['trips', tripId, 'polls', pollId, 'results'],
    queryFn: () => groupIntelligenceApi.getPollResults(tripId, pollId),
    enabled: Boolean(tripId) && Boolean(pollId) && isAuthenticated,
  });

  const destinationsQuery = useQuery({
    queryKey: ['destinations'],
    queryFn: () => groupIntelligenceApi.listDestinations(),
    enabled: isAuthenticated,
  });

  const destById = new Map(destinationsQuery.data?.map((d) => [d.id, d]) ?? []);

  const voteMutation = useMutation({
    mutationFn: (destinationId: string) => groupIntelligenceApi.castVote(tripId, pollId, { destinationId }),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'polls', pollId] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'polls', pollId, 'results'] });
    },
    onError: (err) => {
      setError(err instanceof GroupIntelligenceApiError ? err.message : 'Could not cast vote');
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => groupIntelligenceApi.closePoll(tripId, pollId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'polls', pollId] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'polls', pollId, 'results'] });
    },
    onError: (err) => {
      setError(err instanceof GroupIntelligenceApiError ? err.message : 'Could not close poll');
    },
  });

  const finalizeMutation = useMutation({
    mutationFn: () => groupIntelligenceApi.finalizePoll(tripId, pollId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trips', tripId] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'polls'] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'polls', pollId] });
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'decision'] });
    },
    onError: (err) => {
      setError(err instanceof GroupIntelligenceApiError ? err.message : 'Could not finalize');
    },
  });

  const poll = pollQuery.data;
  const results = resultsQuery.data;
  const canManage =
    tripQuery.data?.myRole === 'OWNER' || tripQuery.data?.myRole === 'EDITOR';
  const isOpen = poll?.status === 'OPEN';

  if (isLoading || pollQuery.isLoading) {
    return (
      <AppShell>
        <p className="py-20 text-center text-roamly-navy/60">Loading poll…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <Link href={`/trips/${tripId}/recommendations`} className="text-sm text-roamly-teal hover:underline">
        ← Recommendations
      </Link>
      <h1 className="font-display mt-4 text-2xl text-roamly-navy">Destination vote</h1>
      <p className="mt-1 text-sm text-roamly-navy/70">
        One vote per member while the poll is open. Recommendation scores do not determine the winner — your vote
        does.
      </p>
      {poll && (
        <p className="mt-2 text-xs uppercase tracking-wide text-roamly-teal">Status: {poll.status}</p>
      )}

      {results && (
        <div className="mt-4 rounded-xl border border-roamly-sand bg-white p-4 text-sm">
          <p>
            Participation: {results.votedMemberCount} / {results.eligibleMemberCount} members (
            {Math.round(results.participationRatio * 100)}% · needs {Math.round(results.minParticipationRatio * 100)}%)
          </p>
          {results.isTied && <p className="mt-2 text-amber-800">Currently tied — finalization blocked.</p>}
          {results.finalizeBlockReason && poll?.status === 'CLOSED' && (
            <p className="mt-2 text-roamly-navy/70">{results.finalizeBlockReason}</p>
          )}
        </div>
      )}

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      <ul className="mt-6 space-y-3">
        {poll?.destinationIds.map((id) => {
          const dest = destById.get(id);
          const tally = results?.tallies.find((t) => t.destinationId === id);
          const selected = poll.myVote?.destinationId === id;
          return (
            <li
              key={id}
              className={`rounded-xl border p-4 ${selected ? 'border-roamly-teal bg-roamly-teal/5' : 'border-roamly-sand bg-white'}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-medium text-roamly-navy">{dest?.name ?? id}</h2>
                  {tally && (
                    <p className="text-sm text-roamly-navy/70">
                      {tally.voteCount} vote{tally.voteCount === 1 ? '' : 's'} · {tally.votePercent}% of ballots
                    </p>
                  )}
                </div>
                {isOpen && (
                  <button
                    type="button"
                    className="rounded-lg bg-roamly-navy px-3 py-1.5 text-sm text-white"
                    onClick={() => voteMutation.mutate(id)}
                    disabled={voteMutation.isPending}
                  >
                    {selected ? 'Update vote' : 'Vote'}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {canManage && poll?.status === 'OPEN' && (
        <button
          type="button"
          className="mt-6 rounded-lg border border-roamly-sand px-4 py-2 text-sm"
          onClick={() => closeMutation.mutate()}
        >
          Close poll
        </button>
      )}

      {canManage && poll?.status === 'CLOSED' && (
        <button
          type="button"
          className="mt-4 rounded-lg bg-roamly-teal px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!results?.canFinalize || finalizeMutation.isPending}
          onClick={() => finalizeMutation.mutate()}
        >
          Finalize destination
        </button>
      )}

      {poll?.status === 'FINALIZED' && (
        <p className="mt-6 text-sm text-roamly-navy/80">
          This poll is finalized. See the trip workspace for the chosen destination.
        </p>
      )}
    </AppShell>
  );
}
