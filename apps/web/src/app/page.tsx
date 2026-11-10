import { AppShell } from '@/components/app-shell';

const pillars = [
  {
    title: 'Align preferences',
    description: 'Capture budgets, timing, and travel style so the group decides with clarity.',
  },
  {
    title: 'Build practical plans',
    description: 'Itineraries that respect time, distance, and the realities of group travel.',
  },
  {
    title: 'Adapt together',
    description: 'Revise plans with human approval when the day does not go as expected.',
  },
];

export default function HomePage() {
  return (
    <AppShell>
      <section className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div className="space-y-6">
          <p className="inline-flex rounded-full border border-roamly-teal/30 bg-white/60 px-3 py-1 text-xs font-medium text-roamly-teal">
            Collaborative travel workspace
          </p>
          <h1 className="text-4xl font-semibold leading-tight tracking-tight text-roamly-navy sm:text-5xl">
            One calm place to plan trips your whole group can trust.
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-roamly-navy/75">
            Roamly brings preferences, destinations, itineraries, and shared costs into a single
            workspace—built for explainable decisions and practical schedules.
          </p>
          <div className="flex flex-wrap gap-3">
            <span className="rounded-lg bg-roamly-navy px-5 py-2.5 text-sm font-medium text-white shadow-soft">
              Dashboard coming in M3
            </span>
            <span className="rounded-lg border border-roamly-stone bg-white/70 px-5 py-2.5 text-sm font-medium text-roamly-navy/80">
              Documentation in /docs
            </span>
          </div>
        </div>

        <TripSnapshotCard />
      </section>

      <section className="mt-16 grid gap-4 sm:grid-cols-3">
        {pillars.map((pillar) => (
          <article
            key={pillar.title}
            className="rounded-2xl border border-roamly-stone bg-white/75 p-5 shadow-soft"
          >
            <div className="mb-3 h-1 w-10 rounded-full bg-roamly-teal" />
            <h2 className="text-lg font-semibold text-roamly-navy">{pillar.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-roamly-navy/70">{pillar.description}</p>
          </article>
        ))}
      </section>
    </AppShell>
  );
}

function TripSnapshotCard() {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-roamly-stone bg-gradient-to-br from-white via-roamly-canvas to-roamly-stone/40 p-8 shadow-soft"
      aria-hidden
    >
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-roamly-teal/15 blur-2xl" />
      <div className="space-y-4">
        <p className="text-sm font-medium uppercase tracking-widest text-roamly-navy/50">
          Trip snapshot
        </p>
        <div className="rounded-xl border border-roamly-stone bg-white/90 p-4">
          <p className="text-sm text-roamly-navy/60">Lisbon &amp; Algarve · 6 travelers</p>
          <p className="mt-2 text-2xl font-semibold text-roamly-navy">Apr 12 – Apr 19</p>
        </div>
        <ul className="space-y-3 text-sm text-roamly-navy/75">
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-roamly-teal" />
            Destination fit scores ready for group review
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-roamly-teal" />
            Day-by-day draft with travel buffers
          </li>
          <li className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-roamly-navy/30" />
            Live collaboration arrives in milestone M7
          </li>
        </ul>
      </div>
    </div>
  );
}
