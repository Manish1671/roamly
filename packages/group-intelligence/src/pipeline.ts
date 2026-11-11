import { DEFAULT_ENGINE_CONFIG } from './config.js';
import { evaluateHardConstraints } from './constraints.js';
import { memberLabelFromMap } from './member-labels.js';
import { aggregateGroupScore, scoreMemberDestination } from './scoring.js';
import type {
  EngineConfig,
  MemberPreferenceInput,
  NormalizedDestination,
  RankedDestination,
  RecommendationEngineResult,
  TripContextInput,
} from './types.js';

export interface RunRecommendationInput {
  trip: TripContextInput;
  members: MemberPreferenceInput[];
  destinations: NormalizedDestination[];
  /** Trip member display names keyed by user id — used in user-facing rejection copy only. */
  memberDisplayNames?: Record<string, string>;
  config?: EngineConfig;
}

export function runRecommendationPipeline(input: RunRecommendationInput): RecommendationEngineResult {
  const config = input.config ?? DEFAULT_ENGINE_CONFIG;
  const participating = input.members.filter((m) => m.completionStatus === 'COMPLETE');

  if (participating.length === 0) {
    return emptyResult(input, config, 'No members with complete preferences');
  }

  const memberLabel = memberLabelFromMap(input.memberDisplayNames);
  const rejected = input.destinations
    .map((d) => ({ destinationId: d.id, reasons: evaluateHardConstraints(d, participating, memberLabel) }))
    .filter((r) => r.reasons.length > 0);

  const feasible = input.destinations.filter(
    (d) => !rejected.some((r) => r.destinationId === d.id),
  );

  if (feasible.length === 0) {
    return {
      ...baseResult(input, config),
      rejected,
      ranked: [],
      warnings: [],
      infeasible: true,
      infeasibleReason: 'No destinations satisfy hard constraints for this group',
    };
  }

  const ranked: RankedDestination[] = feasible.map((destination) => {
    const memberScores = participating.map((member) => {
      const scored = scoreMemberDestination(member, destination, config);
      return {
        memberId: member.memberId,
        totalScore: scored.total,
        breakdown: scored.breakdown,
        notes: scored.notes,
      };
    });
    const totals = memberScores.map((m) => m.totalScore);
    const group = aggregateGroupScore(totals, config);
    const avgBreakdown = averageBreakdown(memberScores.map((m) => m.breakdown));

    const explanations = buildExplanations(destination, memberScores, group);

    return {
      destinationId: destination.id,
      groupScore: group.groupScore,
      averageMemberScore: group.average,
      lowestMemberScore: group.minimum,
      memberScores,
      breakdown: avgBreakdown,
      explanations,
    };
  });

  ranked.sort((a, b) => {
    if (b.groupScore !== a.groupScore) return b.groupScore - a.groupScore;
    if (b.lowestMemberScore !== a.lowestMemberScore) return b.lowestMemberScore - a.lowestMemberScore;
    return a.destinationId.localeCompare(b.destinationId);
  });

  const warnings: string[] = [];
  const weakest = ranked[0]?.memberScores.reduce(
    (min, m) => (m.totalScore < min.totalScore ? m : min),
    ranked[0].memberScores[0],
  );
  if (weakest && weakest.totalScore < 55) {
    const who = memberLabel(weakest.memberId);
    warnings.push(`Lowest member compatibility (${who}) may need discussion`);
  }

  return {
    ...baseResult(input, config),
    rejected,
    ranked,
    warnings,
    infeasible: false,
  };
}

function averageBreakdown(
  breakdowns: { budget: number; interests: number; travelStyle: number; climate: number; destinationType: number }[],
) {
  const n = breakdowns.length || 1;
  return {
    budget: Math.round(breakdowns.reduce((s, b) => s + b.budget, 0) / n),
    interests: Math.round(breakdowns.reduce((s, b) => s + b.interests, 0) / n),
    travelStyle: Math.round(breakdowns.reduce((s, b) => s + b.travelStyle, 0) / n),
    climate: Math.round(breakdowns.reduce((s, b) => s + b.climate, 0) / n),
    destinationType: Math.round(breakdowns.reduce((s, b) => s + b.destinationType, 0) / n),
  };
}

function buildExplanations(
  destination: NormalizedDestination,
  memberScores: RankedDestination['memberScores'],
  group: { groupScore: number; minimum: number },
): string[] {
  const lines = [
    `Indicative per-person budget estimate ₹${destination.budgetPerPerson.minPerPerson}–${destination.budgetPerPerson.maxPerPerson} (${destination.budgetPerPerson.currency}) — not live pricing.`,
    `Group fit score ${group.groupScore} balances average compatibility with the lowest member (${group.minimum}).`,
  ];
  const low = [...memberScores].sort((a, b) => a.totalScore - b.totalScore)[0];
  if (low) {
    lines.push(`Weakest match: scored ${low.totalScore}/100 for one member.`);
  }
  return lines;
}

function baseResult(input: RunRecommendationInput, config: EngineConfig): RecommendationEngineResult {
  const catalogVersion = input.destinations[0]?.catalogVersion ?? 'unknown';
  return {
    algorithmVersion: config.algorithmVersion,
    catalogVersion,
    generatedAt: new Date(0).toISOString(),
    tripId: input.trip.tripId,
    preferenceSnapshot: {
      members: input.members,
      trip: input.trip,
    },
    rejected: [],
    ranked: [],
    warnings: [],
    infeasible: false,
  };
}

function emptyResult(
  input: RunRecommendationInput,
  config: EngineConfig,
  reason: string,
): RecommendationEngineResult {
  return {
    ...baseResult(input, config),
    infeasible: true,
    infeasibleReason: reason,
  };
}
