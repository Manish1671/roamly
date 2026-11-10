'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { createTripBodySchema, type CreateTripBody } from '@roamly/shared';
import { tripsApi, TripsApiError } from '@/lib/trips-api';

export function TripCreateForm({ onCancel }: { onCancel?: () => void }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CreateTripBody>({
    resolver: zodResolver(createTripBodySchema),
    defaultValues: {
      name: '',
      destinationName: '',
      countryCode: '',
      startDate: '',
      endDate: '',
      budgetAmount: '',
      budgetCurrency: 'USD',
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setError(null);
    const payload: CreateTripBody = {
      ...values,
      countryCode: values.countryCode || undefined,
      budgetAmount: values.budgetAmount || undefined,
      budgetCurrency: values.budgetAmount ? values.budgetCurrency : undefined,
    };

    try {
      const trip = await tripsApi.create(payload);
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      setError(err instanceof TripsApiError ? err.message : 'Could not create trip');
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field label="Trip name" error={form.formState.errors.name?.message}>
        <input className={inputClass} {...form.register('name')} />
      </Field>
      <Field label="Destination" error={form.formState.errors.destinationName?.message}>
        <input className={inputClass} {...form.register('destinationName')} />
      </Field>
      <Field label="Country (optional)" error={form.formState.errors.countryCode?.message}>
        <input className={inputClass} maxLength={2} {...form.register('countryCode')} placeholder="US" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" error={form.formState.errors.startDate?.message}>
          <input className={inputClass} type="date" {...form.register('startDate')} />
        </Field>
        <Field label="End date" error={form.formState.errors.endDate?.message}>
          <input className={inputClass} type="date" {...form.register('endDate')} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Budget (optional)" error={form.formState.errors.budgetAmount?.message}>
          <input className={inputClass} inputMode="decimal" {...form.register('budgetAmount')} />
        </Field>
        <Field label="Currency" error={form.formState.errors.budgetCurrency?.message}>
          <input className={inputClass} maxLength={3} {...form.register('budgetCurrency')} />
        </Field>
      </div>
      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={form.formState.isSubmitting}
          className="rounded-lg bg-roamly-navy px-4 py-2.5 text-sm font-medium text-white shadow-soft disabled:opacity-60"
        >
          {form.formState.isSubmitting ? 'Creating…' : 'Create trip'}
        </button>
        {onCancel ? (
          <button type="button" onClick={onCancel} className="rounded-lg border border-roamly-stone px-4 py-2.5 text-sm">
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

function Field(props: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-roamly-navy">{props.label}</label>
      {props.children}
      {props.error ? <p className="mt-1 text-xs text-red-700">{props.error}</p> : null}
    </div>
  );
}

const inputClass =
  'w-full rounded-lg border border-roamly-stone bg-roamly-canvas/40 px-3 py-2.5 text-sm text-roamly-navy outline-none focus:border-roamly-teal focus:ring-2 focus:ring-roamly-teal/30';
