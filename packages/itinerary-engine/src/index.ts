export const ITINERARY_ENGINE_VERSION = '0.0.0';

/** Clamp a 0–100 suitability score (placeholder for M4+ scoring). */
export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}
