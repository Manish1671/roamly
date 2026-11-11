export const ALGORITHM_VERSION = 'group-intelligence-v1.0.0' as const;

export const INTERESTS = [
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
export type Interest = (typeof INTERESTS)[number];

export const TRAVEL_STYLES = [
  'BUDGET',
  'BALANCED',
  'COMFORT',
  'LUXURY',
  'SLOW_TRAVEL',
  'ADVENTURE_FOCUSED',
] as const;
export type TravelStyle = (typeof TRAVEL_STYLES)[number];

export const CLIMATE_PREFERENCES = ['COOL', 'MODERATE', 'WARM', 'NO_STRONG_PREFERENCE'] as const;
export type ClimatePreference = (typeof CLIMATE_PREFERENCES)[number];

export const DESTINATION_TYPES = [
  'MOUNTAINS',
  'BEACHES',
  'CITIES',
  'COUNTRYSIDE',
  'HISTORICAL',
  'NATURE_RETREATS',
] as const;
export type DestinationType = (typeof DESTINATION_TYPES)[number];

export const CLIMATE_PROFILES = ['COOL', 'MODERATE', 'WARM'] as const;
export type ClimateProfile = (typeof CLIMATE_PROFILES)[number];

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface MemberBudgetPreference {
  minPerPerson: number | null;
  maxPerPerson: number | null;
  currency: string;
  maxIsHardConstraint: boolean;
}

export interface MemberPreferenceInput {
  memberId: string;
  completionStatus: 'COMPLETE' | 'DRAFT' | 'INCOMPLETE';
  budget: MemberBudgetPreference | null;
  availability: DateRange[];
  interests: Interest[];
  travelStyle: TravelStyle | null;
  climatePreference: ClimatePreference | null;
  destinationTypes: DestinationType[];
}

export interface TripContextInput {
  tripId: string;
  tripDateRange: DateRange | null;
}

export interface IndicativeBudgetRange {
  minPerPerson: number;
  maxPerPerson: number;
  currency: string;
  isEstimate: true;
}

export interface NormalizedDestination {
  id: string;
  slug: string;
  name: string;
  countryCode: string;
  region: string;
  description: string;
  destinationTypes: DestinationType[];
  interestTags: Interest[];
  travelStyleTags: TravelStyle[];
  climateProfile: ClimateProfile;
  activityTags: string[];
  budgetPerPerson: IndicativeBudgetRange;
  catalogVersion: string;
  provenance: string;
}

export interface ScoringWeights {
  budget: number;
  interests: number;
  travelStyle: number;
  climate: number;
  destinationType: number;
}

export interface FairnessFormula {
  averageWeight: number;
  minimumWeight: number;
}

export interface EngineConfig {
  algorithmVersion: typeof ALGORITHM_VERSION;
  weights: ScoringWeights;
  fairness: FairnessFormula;
}

export interface HardConstraintRejection {
  destinationId: string;
  reasons: string[];
}

export interface CriterionBreakdown {
  budget: number;
  interests: number;
  travelStyle: number;
  climate: number;
  destinationType: number;
}

export interface MemberDestinationScore {
  memberId: string;
  totalScore: number;
  breakdown: CriterionBreakdown;
  notes: string[];
}

export interface RankedDestination {
  destinationId: string;
  groupScore: number;
  averageMemberScore: number;
  lowestMemberScore: number;
  memberScores: MemberDestinationScore[];
  breakdown: CriterionBreakdown;
  explanations: string[];
}

export interface RecommendationEngineResult {
  algorithmVersion: string;
  catalogVersion: string;
  generatedAt: string;
  tripId: string;
  preferenceSnapshot: {
    members: MemberPreferenceInput[];
    trip: TripContextInput;
  };
  rejected: HardConstraintRejection[];
  ranked: RankedDestination[];
  warnings: string[];
  infeasible: boolean;
  infeasibleReason?: string;
}
