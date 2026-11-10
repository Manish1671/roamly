import { ROAMLY_APP_NAME } from '@roamly/shared';

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-roamly-stone/80 bg-roamly-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <BrandMark />
          <p className="text-sm text-roamly-navy/60">Foundation preview · M2</p>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-10 sm:px-6">
        {children}
      </main>
      <footer className="border-t border-roamly-stone/80 py-6 text-center text-sm text-roamly-navy/50">
        © {new Date().getFullYear()} {ROAMLY_APP_NAME}. Plan together, travel smarter.
      </footer>
    </div>
  );
}

function BrandMark() {
  return (
    <div className="flex items-center gap-3">
      <span
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-roamly-navy text-lg font-semibold text-white shadow-soft"
        aria-hidden
      >
        R
      </span>
      <div>
        <p className="text-lg font-semibold tracking-tight text-roamly-navy">{ROAMLY_APP_NAME}</p>
        <p className="text-xs text-roamly-teal">Group travel intelligence</p>
      </div>
    </div>
  );
}
