import type { TripSummary } from '@roamly/shared';

export type TripBucket = 'upcoming' | 'ongoing' | 'past' | 'archived';

export function bucketTrips(trips: TripSummary[], today = new Date()): Record<TripBucket, TripSummary[]> {
  const day = today.toISOString().slice(0, 10);
  const buckets: Record<TripBucket, TripSummary[]> = {
    upcoming: [],
    ongoing: [],
    past: [],
    archived: [],
  };

  for (const trip of trips) {
    if (trip.archivedAt) {
      buckets.archived.push(trip);
      continue;
    }
    if (day < trip.startDate) {
      buckets.upcoming.push(trip);
    } else if (day > trip.endDate) {
      buckets.past.push(trip);
    } else {
      buckets.ongoing.push(trip);
    }
  }

  return buckets;
}
