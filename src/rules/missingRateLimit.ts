import type { Finding, Rule, SourceFile } from "../types.js";
import { makeImpact } from "../impact.js";
import {
  LLM_CALL_PATTERNS,
  createFinding,
  findMatches,
} from "./helpers.js";

/** Patterns suggesting this file is a public request handler / API route. */
const ROUTE_INDICATORS: Array<string | RegExp> = [
  /export\s+async\s+function\s+(POST|GET|PUT|PATCH|DELETE)\b/,
  /export\s+function\s+(POST|GET|PUT|PATCH|DELETE)\b/,
  /NextResponse/,
  /Response\.json/,
];

/** File-path hints for framework route conventions. */
const ROUTE_PATH_HINTS = ["app/api", "pages/api"];

/**
 * Terms that suggest a rate limit / quota / abuse control is already present.
 * Broad on purpose — a false negative (staying quiet) is safer than noise here.
 */
const RATE_LIMIT_TERMS: Array<string | RegExp> = [
  "rateLimit",
  "ratelimit",
  "rateLimiter",
  "quota",
  "throttle",
  "upstash",
  "redis",
  "middleware",
];

const FIX_RECIPE = [
  "Identify the caller using user ID, API key, or IP.",
  "Check a rate limit before calling the model.",
  "Return a 429 response when the limit is exceeded.",
  "Log excessive usage for review.",
];

function looksLikeRoute(file: SourceFile): boolean {
  if (ROUTE_PATH_HINTS.some((hint) => file.path.includes(hint))) return true;
  return findMatches(file.content, ROUTE_INDICATORS).length > 0;
}

export const missingRateLimitRule: Rule = {
  id: "missing-rate-limit",
  title: "Public AI route without obvious rate limit",
  severity: "medium",
  wasteCategory: "repeated-inference",
  description:
    "Flags files that look like public API routes and call a model without a nearby rate limit or quota check.",
  recommendation:
    "Add per-user/IP rate limits, quotas, or abuse controls around public AI endpoints.",
  fixRecipe: FIX_RECIPE,
  scan(file: SourceFile): Finding[] {
    if (!looksLikeRoute(file)) return [];

    const llmCalls = findMatches(file.content, LLM_CALL_PATTERNS);
    if (llmCalls.length === 0) return [];

    // If any rate-limit/quota term appears in the file, assume it's covered.
    if (findMatches(file.content, RATE_LIMIT_TERMS).length > 0) return [];

    // Report once per file, anchored on the first model call.
    return [
      createFinding({
        ruleId: this.id,
        title: this.title,
        severity: this.severity,
        wasteCategory: this.wasteCategory,
        file,
        index: llmCalls[0]!.index,
        message:
          "This public AI route calls a model without an obvious rate limit or quota check.",
        recommendation: this.recommendation,
        fixRecipe: this.fixRecipe,
        impact: makeImpact({
          computeWaste: "medium",
          carbonImpact: "low",
          waterImpact: "low",
          costImpact: "high",
          confidence: "low",
          score: 68,
          explanation:
            "Public AI endpoints without rate limits can be abused into large volumes of avoidable model calls.",
        }),
      }),
    ];
  },
};
