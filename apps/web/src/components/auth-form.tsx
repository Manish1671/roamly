'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';
import { loginBodySchema, registerBodySchema } from '@roamly/shared';
import { useAuth } from '@/hooks/use-auth';

type RegisterForm = z.infer<typeof registerBodySchema>;
type LoginForm = z.infer<typeof loginBodySchema>;

export function RegisterForm() {
  const router = useRouter();
  const { register: registerUser } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<RegisterForm>({
    resolver: zodResolver(registerBodySchema),
    defaultValues: { email: '', password: '', displayName: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await registerUser.mutateAsync(values);
      router.push('/dashboard');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Registration failed');
    }
  });

  return (
    <AuthCard
      title="Create your Roamly account"
      subtitle="Coordinate group travel with clarity."
      onSubmit={onSubmit}
      formError={formError}
      isSubmitting={registerUser.isPending}
      submitLabel="Create account"
      footer={
        <p>
          Already have an account?{' '}
          <Link className="font-medium text-roamly-teal hover:underline" href="/login">
            Sign in
          </Link>
        </p>
      }
    >
      <Field label="Display name" error={form.formState.errors.displayName?.message}>
        <input className={inputClass} {...form.register('displayName')} autoComplete="name" />
      </Field>
      <Field label="Email" error={form.formState.errors.email?.message}>
        <input className={inputClass} type="email" {...form.register('email')} autoComplete="email" />
      </Field>
      <Field label="Password" error={form.formState.errors.password?.message}>
        <input
          className={inputClass}
          type="password"
          {...form.register('password')}
          autoComplete="new-password"
        />
      </Field>
    </AuthCard>
  );
}

export function LoginForm() {
  const router = useRouter();
  const { login } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginBodySchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setFormError(null);
    try {
      await login.mutateAsync(values);
      router.push('/dashboard');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Sign in failed');
    }
  });

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to continue planning together."
      onSubmit={onSubmit}
      formError={formError}
      isSubmitting={login.isPending}
      submitLabel="Sign in"
      footer={
        <p>
          New to Roamly?{' '}
          <Link className="font-medium text-roamly-teal hover:underline" href="/register">
            Create an account
          </Link>
        </p>
      }
    >
      <Field label="Email" error={form.formState.errors.email?.message}>
        <input className={inputClass} type="email" {...form.register('email')} autoComplete="email" />
      </Field>
      <Field label="Password" error={form.formState.errors.password?.message}>
        <input
          className={inputClass}
          type="password"
          {...form.register('password')}
          autoComplete="current-password"
        />
      </Field>
    </AuthCard>
  );
}

function AuthCard(props: {
  title: string;
  subtitle: string;
  onSubmit: (e: React.FormEvent) => void;
  formError: string | null;
  isSubmitting: boolean;
  submitLabel: string;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-roamly-stone bg-white/90 p-8 shadow-soft">
      <h1 className="text-2xl font-semibold text-roamly-navy">{props.title}</h1>
      <p className="mt-2 text-sm text-roamly-navy/70">{props.subtitle}</p>
      <form className="mt-8 space-y-5" onSubmit={props.onSubmit}>
        {props.children}
        {props.formError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {props.formError}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={props.isSubmitting}
          className="w-full rounded-lg bg-roamly-navy px-4 py-2.5 text-sm font-medium text-white shadow-soft transition hover:bg-roamly-navy/90 disabled:opacity-60"
        >
          {props.isSubmitting ? 'Please wait…' : props.submitLabel}
        </button>
      </form>
      <div className="mt-6 text-center text-sm text-roamly-navy/70">{props.footer}</div>
    </div>
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
  'w-full rounded-lg border border-roamly-stone bg-roamly-canvas/40 px-3 py-2.5 text-sm text-roamly-navy outline-none ring-roamly-teal/30 focus:border-roamly-teal focus:ring-2';
