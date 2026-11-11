import type { RecommendationEngineResult } from '@roamly/group-intelligence';

const UUID_IN_TEXT =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;

/** Replace legacy rejection messages that still embed raw user ids (older snapshots). */
export function presentRecommendationResult(
  result: RecommendationEngineResult,
  memberDisplayNames: Record<string, string>,
): RecommendationEngineResult {
  const label = (id: string) => memberDisplayNames[id]?.trim() || 'A trip member';

  const rejected = result.rejected.map((entry) => ({
    ...entry,
    reasons: entry.reasons.map((reason) => humanizeLegacyReason(reason, label)),
  }));

  const warnings = result.warnings.map((w) => w.replace(UUID_IN_TEXT, (id) => label(id)));

  return { ...result, rejected, warnings };
}

function humanizeLegacyReason(
  reason: string,
  label: (memberId: string) => string,
): string {
  let next = reason.replace(UUID_IN_TEXT, (id) => label(id));

  next = next.replace(
    /exceeds hard maximum for member ([^.;]+)/gi,
    "hard per-person maximum is below this destination's indicative minimum ($1)",
  );
  next = next.replace(
    /Indicative minimum budget at ([^]+?) exceeds hard maximum for member ([^.;]+)/gi,
    "$2's hard per-person maximum is below $1's indicative minimum per-person estimate",
  );
  next = next.replace(/Member ([^ ]+) has no budget preference recorded/gi, '$1 has no per-person budget preference recorded');

  if (/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i.test(next)) {
    next = next.replace(UUID_IN_TEXT, 'a trip member');
  }

  return next;
}
