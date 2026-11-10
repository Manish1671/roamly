import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ROAMLY_APP_NAME } from '@roamly/shared';
import { AppProviders } from '@/components/app-providers';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: {
    default: ROAMLY_APP_NAME,
    template: `%s · ${ROAMLY_APP_NAME}`,
  },
  description:
    'Collaborative travel intelligence for groups — preferences, itineraries, and shared planning in one workspace.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
