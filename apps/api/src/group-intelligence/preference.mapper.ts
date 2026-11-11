import type { MemberPreference } from '@prisma/client';
import type { MyPreferenceView, PreferenceDateRange } from '@roamly/shared';
import { Prisma } from '@prisma/client';

export function toPreferenceView(row: MemberPreference): MyPreferenceView {
  const availability = parseAvailability(row.availabilityJson);
  return {
    tripId: row.tripId,
    userId: row.userId,
    status: row.status,
    budgetMin: row.budgetMin?.toFixed(2) ?? null,
    budgetMax: row.budgetMax?.toFixed(2) ?? null,
    budgetCurrency: row.budgetCurrency,
    budgetMaxIsHard: row.budgetMaxIsHard,
    availability,
    interests: row.interests as MyPreferenceView['interests'],
    travelStyle: (row.travelStyle as MyPreferenceView['travelStyle']) ?? null,
    climatePreference: (row.climatePreference as MyPreferenceView['climatePreference']) ?? null,
    destinationTypes: row.destinationTypes as MyPreferenceView['destinationTypes'],
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function parseAvailability(json: unknown): PreferenceDateRange[] {
  if (!Array.isArray(json)) return [];
  const ranges: PreferenceDateRange[] = [];
  for (const item of json) {
    if (
      item &&
      typeof item === 'object' &&
      'startDate' in item &&
      'endDate' in item &&
      typeof item.startDate === 'string' &&
      typeof item.endDate === 'string'
    ) {
      ranges.push({ startDate: item.startDate, endDate: item.endDate });
    }
  }
  return ranges;
}

export function availabilityToJson(ranges: PreferenceDateRange[]): Prisma.InputJsonValue {
  return ranges as unknown as Prisma.InputJsonValue;
}
