import type { Finding, Rule, SourceFile } from "../types.js";
import { makeImpact } from "../impact.js";
import {
  LLM_CALL_PATTERNS,
  createFinding,
  dedupeFindings,
  findMatches,
  hasNearby,
} from "./helpers.js";

const TOKEN_LIMIT_TERMS: Array<string | RegExp> = [
  "max_tokens",
  "maxTokens",
  "max_output_tokens",
  "maxOutputTokens",
  "max_completion_tokens",
];

const FIX_RECIPE = [
  "Add an explicit output token limit.",
  "Pick the limit based on the task type.",
  "Use stricter limits for classification and extraction.",
  "Add tests for runaway or unexpectedly long outputs.",
];

export const noTokenLimitRule: Rule = {
  id: "no-token-limit",
  title: "No obvious output token limit",
  severity: "low",
  wasteCategory: "unbounded-generation",
  description:
    "Flags LLM calls that have no explicit output token limit set nearby.",
  recommendation:
    "Set an output token cap appropriate for the task to reduce runaway generations.",
  fixRecipe: FIX_RECIPE,
  scan(file: SourceFile): Finding[] {
    const findings: Finding[] = [];
    const llmCalls = findMatches(file.content, LLM_CALL_PATTERNS);

    // Only flag when the file clearly contains at least one LLM call.
    if (llmCalls.length === 0) return findings;

    for (const match of llmCalls) {
      // A token limit anywhere within ~25 lines counts as covered.
      if (hasNearby(file, match.index, TOKEN_LIMIT_TERMS, 25)) continue;

      findings.push(
        createFinding({
          ruleId: this.id,
          title: this.title,
          severity: this.severity,
          wasteCategory: this.wasteCategory,
          file,
          index: match.index,
          message:
            "No explicit output token limit was detected near this model call.",
          recommendation: this.recommendation,
          fixRecipe: this.fixRecipe,
          impact: makeImpact({
            computeWaste: "medium",
            carbonImpact: "low",
            waterImpact: "low",
            costImpact: "medium",
            confidence: "medium",
            score: 45,
            explanation:
              "Output limits help prevent unnecessarily long generations and unexpected token usage.",
          }),
        }),
      );
    }

    // Keep this rule quiet: at most one finding per file.
    return dedupeFindings(findings).slice(0, 1);
  },
};
