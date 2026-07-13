import type { Finding, Rule, SourceFile } from "../types.js";
import { makeImpact } from "../impact.js";
import {
  LLM_CALL_PATTERNS,
  createFinding,
  dedupeFindings,
  findCodeMatchesInFile,
  hasNearby,
  hasNearbyCode,
  isTestFile,
} from "./helpers.js";

const CACHE_TERMS: Array<string | RegExp> = [
  "cache",
  "cached",
  "redis",
  "kv",
  "upstash",
  "unstable_cache",
  "memoize",
  "dedupe",
  "lru",
  "Map(",
  "getCached",
  "setCached",
];

const FIX_RECIPE = [
  "Create a cache key from model, system prompt, user prompt, and relevant parameters.",
  "Check Redis, KV, or an in-memory cache before calling the provider.",
  "Store successful deterministic responses with a sensible TTL.",
  "Skip caching for highly personalized, sensitive, or rapidly changing outputs.",
];

const REUSE_SIGNALS: Array<string | RegExp> = [
  /classif/i,
  /extract/i,
  /categor/i,
  /tag/i,
  /template/i,
  /deterministic/i,
];

export const noLlmCacheRule: Rule = {
  id: "no-llm-cache",
  title: "LLM call without obvious caching",
  severity: "medium",
  wasteCategory: "repeated-inference",
  description:
    "Flags likely LLM calls that have no nearby caching, deduping, or memoization terms.",
  recommendation:
    "Add request-level or semantic caching for repeated prompts, deterministic tasks, and expensive generations.",
  fixRecipe: FIX_RECIPE,
  scan(file: SourceFile): Finding[] {
    const findings: Finding[] = [];
    const testFile = isTestFile(file.path);

    for (const match of findCodeMatchesInFile(file, LLM_CALL_PATTERNS)) {
      if (hasNearbyCode(file, match.index, CACHE_TERMS, 20)) continue;
      const likelyReusable = hasNearby(file, match.index, REUSE_SIGNALS, 12);

      findings.push(
        createFinding({
          ruleId: this.id,
          title: this.title,
          // Downgrade noisy hits in test files instead of over-reporting.
          severity: testFile ? "low" : likelyReusable ? "high" : "medium",
          wasteCategory: this.wasteCategory,
          file,
          index: match.index,
          message:
            "This LLM call does not appear to use caching. Repeated prompts may trigger avoidable model inference.",
          recommendation: this.recommendation,
          fixRecipe: this.fixRecipe,
          impact: makeImpact({
            computeWaste: "high",
            carbonImpact: "medium",
            waterImpact: "medium",
            costImpact: "high",
            confidence: testFile || !likelyReusable ? "low" : "medium",
            score: testFile ? 30 : likelyReusable ? 80 : 55,
            explanation:
              "Repeated uncached model calls can create avoidable token processing and infrastructure demand.",
          }),
        }),
      );
    }

    return dedupeFindings(findings);
  },
};
