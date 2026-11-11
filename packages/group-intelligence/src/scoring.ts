import type {
  ClimatePreference,
  ClimateProfile,
  CriterionBreakdown,
  DestinationType,
  EngineConfig,
  MemberPreferenceInput,
  NormalizedDestination,
  TravelStyle,
} from './types.js';

const TRAVEL_STYLE_INDEX: Record<TravelStyle, number> = {
  BUDGET: 0,
  BALANCED: 1,
  COMFORT: 2,
  LUXURY: 3,
  SLOW_TRAVEL: 2,
  ADVENTURE_FOCUSED: 1,
};

const STYLE_FOR_DESTINATION_TIER: Record<TravelStyle, number> = {
  BUDGET: 0,
  BALANCED: 1,
  COMFORT: 2,
  LUXURY: 3,
  SLOW_TRAVEL: 2,
  ADVENTURE_FOCUSED: 1,
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function missingScore(): number {
  return 40;
}

function scoreBudget(
  member: MemberPreferenceInput,
  destination: NormalizedDestination,
): { score: number; note?: string } {
  if (!member.budget) {
    return { score: missingScore(), note: 'Budget preference missing' };
  }
  const pref = member.budget;
  if (pref.currency.toUpperCase() !== destination.budgetPerPerson.currency.toUpperCase()) {
    return { score: missingScore(), note: 'Budget currency not comparable' };
  }
  const destMid =
    (destination.budgetPerPerson.minPerPerson + destination.budgetPerPerson.maxPerPerson) / 2;
  const prefMid =
    pref.minPerPerson !== null && pref.maxPerPerson !== null
      ? (pref.minPerPerson + pref.maxPerPerson) / 2
      : (pref.maxPerPerson ?? pref.minPerPerson ?? destMid);

  const spread = Math.max(destination.budgetPerPerson.maxPerPerson - destination.budgetPerPerson.minPerPerson, 1);
  const delta = Math.abs(destMid - prefMid);
  const raw = 100 - (delta / spread) * 50;
  return { score: clampScore(raw) };
}

function scoreInterests(member: MemberPreferenceInput, destination: NormalizedDestination): number {
  if (member.interests.length === 0) return missingScore();
  if (destination.interestTags.length === 0) return 30;
  const overlap = member.interests.filter((i) => destination.interestTags.includes(i));
  const ratio = overlap.length / member.interests.length;
  return clampScore(ratio * 100);
}

function scoreTravelStyle(member: MemberPreferenceInput, destination: NormalizedDestination): number {
  if (!member.travelStyle) return missingScore();
  const memberIdx = TRAVEL_STYLE_INDEX[member.travelStyle];
  let best = 0;
  for (const tag of destination.travelStyleTags) {
    const destIdx = STYLE_FOR_DESTINATION_TIER[tag];
    const diff = Math.abs(memberIdx - destIdx);
    const match = 100 - diff * 25;
    best = Math.max(best, match);
  }
  return clampScore(best);
}

function scoreClimate(member: MemberPreferenceInput, destination: NormalizedDestination): number {
  if (!member.climatePreference || member.climatePreference === 'NO_STRONG_PREFERENCE') {
    return 75;
  }
  const map: Record<ClimatePreference, ClimateProfile | 'ANY'> = {
    COOL: 'COOL',
    MODERATE: 'MODERATE',
    WARM: 'WARM',
    NO_STRONG_PREFERENCE: 'ANY',
  };
  const wanted = map[member.climatePreference];
  if (wanted === 'ANY') return 75;
  return destination.climateProfile === wanted ? 100 : 45;
}

function scoreDestinationType(member: MemberPreferenceInput, destination: NormalizedDestination): number {
  if (member.destinationTypes.length === 0) return missingScore();
  const overlap = member.destinationTypes.filter((t) =>
    destination.destinationTypes.includes(t as DestinationType),
  );
  const ratio = overlap.length / member.destinationTypes.length;
  return clampScore(ratio * 100);
}

export function scoreMemberDestination(
  member: MemberPreferenceInput,
  destination: NormalizedDestination,
  config: EngineConfig,
): { total: number; breakdown: CriterionBreakdown; notes: string[] } {
  const notes: string[] = [];
  const budget = scoreBudget(member, destination);
  if (budget.note) notes.push(budget.note);

  const breakdown: CriterionBreakdown = {
    budget: budget.score,
    interests: scoreInterests(member, destination),
    travelStyle: scoreTravelStyle(member, destination),
    climate: scoreClimate(member, destination),
    destinationType: scoreDestinationType(member, destination),
  };

  const w = config.weights;
  const total =
    breakdown.budget * w.budget +
    breakdown.interests * w.interests +
    breakdown.travelStyle * w.travelStyle +
    breakdown.climate * w.climate +
    breakdown.destinationType * w.destinationType;

  return { total: clampScore(total), breakdown, notes };
}

export function aggregateGroupScore(
  memberScores: number[],
  config: EngineConfig,
): { groupScore: number; average: number; minimum: number } {
  if (memberScores.length === 0) {
    return { groupScore: 0, average: 0, minimum: 0 };
  }
  const average = memberScores.reduce((a, b) => a + b, 0) / memberScores.length;
  const minimum = Math.min(...memberScores);
  const groupScore =
    average * config.fairness.averageWeight + minimum * config.fairness.minimumWeight;
  return {
    groupScore: clampScore(groupScore),
    average: clampScore(average),
    minimum: clampScore(minimum),
  };
}
