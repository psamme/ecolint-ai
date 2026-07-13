import type { Finding, ImpactEstimate, Level, Severity } from "./types.js";

/**
 * Trimference produces DIRECTIONAL impact estimates, not measured emissions.
 * These helpers keep impact wording and math in one place.
 */

/** Plain-English "first pass" action per rule, for the review-summary section. */
const RULE_ACTION: Record<string, string> = {
  "no-llm-cache": "Add caching around repeated model calls.",
  "repeated-embeddings": "Persist embeddings instead of regenerating unchanged text.",
  "huge-context": "Limit prompt context with summarization or retrieval.",
  "image-generation-loop": "Cap and cache repeated image generation.",
  "no-token-limit": "Add output token limits to model calls.",
  "frequent-cron":
    "Reduce frequent background polling with backoff or event-driven triggers.",
  "expensive-model-simple-task":
    "Use smaller model tiers for simple classification or extraction tasks.",
  "sequential-llm-calls": "Combine, cache, or parallelize multi-call LLM flows.",
  "agent-loop-without-budget":
    "Add step, time, and token/cost budgets to agent loops.",
  "missing-rate-limit": "Add rate limits or quotas to public AI routes.",
};

/**
 * A human-review-style "Suggested first pass": 2–4 plain-English actions
 * derived from the highest-impact findings, deduplicated and impact-ordered.
 * Expects findings already sorted by severity then impact score.
 */
export function suggestedFirstPass(findings: Finding[], limit = 4): string[] {
  const seen = new Set<string>();
  const actions: string[] = [];
  for (const f of findings) {
    const action = RULE_ACTION[f.ruleId];
    if (!action || seen.has(action)) continue;
    seen.add(action);
    actions.push(action);
    if (actions.length >= limit) break;
  }
  return actions;
}

const LEVEL_WEIGHT: Record<Level, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

export const SEVERITY_WEIGHT: Record<Severity, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

/** Clamp a raw score into the documented 1..100 range. */
export function clampScore(score: number): number {
  return Math.max(1, Math.min(100, Math.round(score)));
}

/** Build an ImpactEstimate, clamping the score defensively. */
export function makeImpact(estimate: ImpactEstimate): ImpactEstimate {
  return { ...estimate, score: clampScore(estimate.score) };
}

/**
 * @deprecated Carbon and water levels are not measurements and are omitted
 * from current reports. Use operationalImpactLine instead.
 */
export function impactLine(impact: ImpactEstimate): string {
  return [
    `compute ${impact.computeWaste}`,
    `carbon ${impact.carbonImpact}`,
    `water ${impact.waterImpact}`,
    `cost ${impact.costImpact}`,
  ].join(" · ");
}

/** Human-facing operational signal; deliberately excludes carbon/water claims. */
export function operationalImpactLine(impact: ImpactEstimate): string {
  return [
    `compute risk ${impact.computeWaste}`,
    `cost risk ${impact.costImpact}`,
    `confidence ${impact.confidence}`,
  ].join(" · ");
}

export function levelWeight(level: Level): number {
  return LEVEL_WEIGHT[level];
}

export const IMPACT_DISCLAIMER =
  "Trimference uses static heuristics. Findings are review prompts, not measured " +
  "usage, cost, emissions, water consumption, or infrastructure energy.";
