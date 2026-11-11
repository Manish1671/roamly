'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  preferenceClimateOptions,
  preferenceDestinationTypes,
  preferenceInterests,
  preferenceTravelStyles,
  type UpsertMyPreferenceBody,
} from '@roamly/shared';
import { AppShell } from '@/components/app-shell';
import { useAuth } from '@/hooks/use-auth';
import { groupIntelligenceApi, GroupIntelligenceApiError } from '@/lib/group-intelligence-api';
import { tripsApi } from '@/lib/trips-api';

export default function TripPreferencesPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<UpsertMyPreferenceBody>({
    budgetMin: '',
    budgetMax: '',
    budgetCurrency: 'INR',
    budgetMaxIsHard: false,
    availability: [{ startDate: '', endDate: '' }],
    interests: [],
    travelStyle: 'BALANCED',
    climatePreference: 'NO_STRONG_PREFERENCE',
    destinationTypes: [],
    status: 'DRAFT',
  });

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

  useEffect(() => {
    const mine = prefQuery.data?.myPreference;
    if (!mine) return;
    setForm({
      status: mine.status,
      budgetMin: mine.budgetMin ?? '',
      budgetMax: mine.budgetMax ?? '',
      budgetCurrency: mine.budgetCurrency ?? 'INR',
      budgetMaxIsHard: mine.budgetMaxIsHard,
      availability: mine.availability.length ? mine.availability : [{ startDate: '', endDate: '' }],
      interests: mine.interests,
      travelStyle: mine.travelStyle ?? 'BALANCED',
      climatePreference: mine.climatePreference ?? 'NO_STRONG_PREFERENCE',
      destinationTypes: mine.destinationTypes,
    });
  }, [prefQuery.data?.myPreference]);

  const saveMutation = useMutation({
    mutationFn: (body: UpsertMyPreferenceBody) => groupIntelligenceApi.saveMyPreferences(tripId, body),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['trips', tripId, 'preferences'] });
    },
    onError: (err) => {
      setError(err instanceof GroupIntelligenceApiError ? err.message : 'Could not save preferences');
    },
  });

  const canEdit = tripQuery.data && tripQuery.data.myRole !== 'VIEWER';

  if (isLoading || tripQuery.isLoading || prefQuery.isLoading) {
    return (
      <AppShell>
        <p className="py-20 text-center text-roamly-navy/60">Loading preferences…</p>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <span className="mb-2 block">
        <Link href={`/trips/${tripId}`} className="text-sm text-roamly-teal hover:underline">
          ← Back to trip
        </Link>
      </span>
      <h1 className="font-display text-2xl text-roamly-navy">Group preferences</h1>
      <p className="mt-1 text-sm text-roamly-navy/70">
        Your inputs stay private to you. The group only sees completion status.
      </p>

      {prefQuery.data && (
        <div className="mt-6 rounded-xl border border-roamly-sand bg-white p-4 text-sm">
          <p className="font-medium text-roamly-navy">Group completion</p>
          <p className="mt-1 text-roamly-navy/70">
            {prefQuery.data.status.completedCount} of {prefQuery.data.status.totalMembers} members complete
            {prefQuery.data.status.notStartedCount > 0 &&
              ` · ${prefQuery.data.status.notStartedCount} not started`}
          </p>
          <ul className="mt-3 space-y-1">
            {prefQuery.data.status.members.map((m) => (
              <li key={m.userId} className="flex justify-between text-roamly-navy/80">
                <span>{m.displayName}</span>
                <span>{m.status.replace('_', ' ')}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!canEdit ? (
        <p className="mt-8 text-roamly-navy/70">Viewers can observe recommendations but cannot submit preferences.</p>
      ) : (
        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            saveMutation.mutate({ ...form, status: 'COMPLETE' });
          }}
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block text-sm">
              Min budget / person
              <input
                className="mt-1 w-full rounded-lg border border-roamly-sand px-3 py-2"
                value={form.budgetMin ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, budgetMin: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              Max budget / person
              <input
                className="mt-1 w-full rounded-lg border border-roamly-sand px-3 py-2"
                value={form.budgetMax ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, budgetMax: e.target.value }))}
              />
            </label>
            <label className="block text-sm">
              Currency
              <input
                className="mt-1 w-full rounded-lg border border-roamly-sand px-3 py-2"
                value={form.budgetCurrency ?? 'INR'}
                onChange={(e) => setForm((f) => ({ ...f, budgetCurrency: e.target.value }))}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.budgetMaxIsHard ?? false}
              onChange={(e) => setForm((f) => ({ ...f, budgetMaxIsHard: e.target.checked }))}
            />
            Treat maximum budget as a hard constraint
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              Availability start
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-roamly-sand px-3 py-2"
                value={form.availability?.[0]?.startDate ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    availability: [
                      { startDate: e.target.value, endDate: f.availability?.[0]?.endDate ?? '' },
                    ],
                  }))
                }
              />
            </label>
            <label className="block text-sm">
              Availability end
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-roamly-sand px-3 py-2"
                value={form.availability?.[0]?.endDate ?? ''}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    availability: [
                      { startDate: f.availability?.[0]?.startDate ?? '', endDate: e.target.value },
                    ],
                  }))
                }
              />
            </label>
          </div>

          <fieldset>
            <legend className="text-sm font-medium">Interests</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {preferenceInterests.map((item) => {
                const active = form.interests?.includes(item);
                return (
                  <button
                    type="button"
                    key={item}
                    className={`rounded-full px-3 py-1 text-xs ${active ? 'bg-roamly-teal text-white' : 'bg-roamly-sand text-roamly-navy'}`}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        interests: active
                          ? (f.interests ?? []).filter((i) => i !== item)
                          : [...(f.interests ?? []), item],
                      }))
                    }
                  >
                    {item.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </fieldset>

          <label className="block text-sm">
            Travel style
            <select
              className="mt-1 w-full rounded-lg border border-roamly-sand px-3 py-2"
              value={form.travelStyle ?? ''}
              onChange={(e) =>
                setForm((f) => ({ ...f, travelStyle: e.target.value as UpsertMyPreferenceBody['travelStyle'] }))
              }
            >
              {preferenceTravelStyles.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>

          <label className="block text-sm">
            Climate preference
            <select
              className="mt-1 w-full rounded-lg border border-roamly-sand px-3 py-2"
              value={form.climatePreference ?? ''}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  climatePreference: e.target.value as UpsertMyPreferenceBody['climatePreference'],
                }))
              }
            >
              {preferenceClimateOptions.map((c) => (
                <option key={c} value={c}>
                  {c.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="text-sm font-medium">Destination types</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {preferenceDestinationTypes.map((item) => {
                const active = form.destinationTypes?.includes(item);
                return (
                  <button
                    type="button"
                    key={item}
                    className={`rounded-full px-3 py-1 text-xs ${active ? 'bg-roamly-navy text-white' : 'bg-roamly-sand text-roamly-navy'}`}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        destinationTypes: active
                          ? (f.destinationTypes ?? []).filter((i) => i !== item)
                          : [...(f.destinationTypes ?? []), item],
                      }))
                    }
                  >
                    {item.replace(/_/g, ' ')}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-lg border border-roamly-sand px-4 py-2 text-sm"
              onClick={() => saveMutation.mutate({ ...form, status: 'DRAFT' })}
            >
              Save draft
            </button>
            <button
              type="submit"
              className="rounded-lg bg-roamly-teal px-4 py-2 text-sm font-medium text-white"
              disabled={saveMutation.isPending}
            >
              Save &amp; mark complete
            </button>
            <Link
              href={`/trips/${tripId}/recommendations`}
              className="rounded-lg border border-roamly-teal px-4 py-2 text-sm text-roamly-teal"
            >
              View recommendations →
            </Link>
          </div>
        </form>
      )}
    </AppShell>
  );
}
