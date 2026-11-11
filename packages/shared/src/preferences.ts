import { z } from 'zod';

export const preferenceInterests = [
  'ADVENTURE',
  'NATURE',
  'BEACHES',
  'CULTURE_HERITAGE',
  'FOOD',
  'SHOPPING',
  'NIGHTLIFE',
  'RELAXATION',
  'WILDLIFE',
  'PHOTOGRAPHY',
  'TREKKING',
  'SPIRITUAL',
] as const;

export const preferenceTravelStyles = [
  'BUDGET',
  'BALANCED',
  'COMFORT',
  'LUXURY',
  'SLOW_TRAVEL',
  'ADVENTURE_FOCUSED',
] as const;

export const preferenceClimateOptions = [
  'COOL',
  'MODERATE',
  'WARM',
  'NO_STRONG_PREFERENCE',
] as const;

export const preferenceDestinationTypes = [
  'MOUNTAINS',
  'BEACHES',
  'CITIES',
  'COUNTRYSIDE',
  'HISTORICAL',
  'NATURE_RETREATS',
] as const;

export const preferenceStatuses = ['DRAFT', 'COMPLETE'] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

const availabilityRangeSchema = z
  .object({
    startDate: isoDate,
    endDate: isoDate,
  })
  .refine((d) => d.endDate >= d.startDate, {
    message: 'End date cannot be before start date',
    path: ['endDate'],
  });

const currencyCode = z
  .string()
  .trim()
  .length(3, 'Currency must be a 3-letter ISO 4217 code')
  .transform((v) => v.toUpperCase());

export const upsertMyPreferenceBodySchema = z
  .object({
    status: z.enum(preferenceStatuses).optional(),
    budgetMin: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
    budgetMax: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().nullable(),
    budgetCurrency: currencyCode.optional().nullable(),
    budgetMaxIsHard: z.boolean().optional(),
    availability: z.array(availabilityRangeSchema).max(12).optional(),
    interests: z.array(z.enum(preferenceInterests)).max(12).optional(),
    travelStyle: z.enum(preferenceTravelStyles).optional().nullable(),
    climatePreference: z.enum(preferenceClimateOptions).optional().nullable(),
    destinationTypes: z.array(z.enum(preferenceDestinationTypes)).max(6).optional(),
  })
  .refine(
    (data) => {
      const hasMin = Boolean(data.budgetMin);
      const hasMax = Boolean(data.budgetMax);
      const hasCur = Boolean(data.budgetCurrency);
      if (!hasMin && !hasMax && !hasCur) return true;
      return hasMin && hasMax && hasCur;
    },
    { message: 'Budget min, max, and currency must be provided together', path: ['budgetCurrency'] },
  );

export type UpsertMyPreferenceBody = z.infer<typeof upsertMyPreferenceBodySchema>;

export interface PreferenceDateRange {
  startDate: string;
  endDate: string;
}

export interface MyPreferenceView {
  tripId: string;
  userId: string;
  status: (typeof preferenceStatuses)[number];
  budgetMin: string | null;
  budgetMax: string | null;
  budgetCurrency: string | null;
  budgetMaxIsHard: boolean;
  availability: PreferenceDateRange[];
  interests: (typeof preferenceInterests)[number][];
  travelStyle: (typeof preferenceTravelStyles)[number] | null;
  climatePreference: (typeof preferenceClimateOptions)[number] | null;
  destinationTypes: (typeof preferenceDestinationTypes)[number][];
  updatedAt: string;
}

export interface MemberPreferenceStatusItem {
  userId: string;
  displayName: string;
  role: string;
  status: 'NOT_STARTED' | 'DRAFT' | 'COMPLETE';
}

export interface TripPreferenceStatusView {
  totalMembers: number;
  completedCount: number;
  draftCount: number;
  notStartedCount: number;
  members: MemberPreferenceStatusItem[];
}

export interface TripPreferencesOverview {
  myPreference: MyPreferenceView | null;
  status: TripPreferenceStatusView;
}

export interface DestinationSummary {
  id: string;
  slug: string;
  name: string;
  countryCode: string;
  region: string;
  description: string;
  destinationTypes: string[];
  interestTags: string[];
  climateProfile: string;
  budgetMin: string;
  budgetMax: string;
  budgetCurrency: string;
  budgetIsEstimate: true;
  catalogVersion: string;
  provenance: string;
}

export interface RecommendationSnapshotSummary {
  id: string;
  tripId: string;
  algorithmVersion: string;
  catalogVersion: string;
  createdAt: string;
  createdById: string | null;
  infeasible: boolean;
  topDestinationId: string | null;
}

export interface RecommendationSnapshotDetail extends RecommendationSnapshotSummary {
  result: unknown;
}
