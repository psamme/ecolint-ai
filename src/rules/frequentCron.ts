import type { Finding, Rule, SourceFile } from "../types.js";
import { makeImpact } from "../impact.js";
import { createFinding, dedupeFindings, findMatches } from "./helpers.js";

/**
 * Very frequent cron expressions and short setInterval delays.
 * Matches whole-line-ish cron patterns and setInterval with <= 60s delays.
 */
const FREQUENT_PATTERNS: Array<string | RegExp> = [
  /\*\s+\*\s+\*\s+\*\s+\*/, // "* * * * *"
  /\*\/[1-5]\s+\*\s+\*\s+\*\s+\*/, // "*/1..*/5 * * * *"
  /setInterval\s*\([^,]*,\s*(1000|5000|60000)\s*\)/i,
];

const FIX_RECIPE = [
  "Replace fixed polling with event-driven triggers when possible.",
  "Add exponential backoff when no work is found.",
  "Batch small jobs into less frequent runs.",
  "Lower the schedule frequency if the job is not time-sensitive.",
];

export const frequentCronRule: Rule = {
  id: "frequent-cron",
  title: "Very frequent scheduled job",
  severity: "medium",
  wasteCategory: "background-compute-drift",
  description:
    "Flags cron expressions and setInterval delays that run very frequently.",
  recommendation:
    "Consider event-driven triggers, backoff, batching, or a lower frequency schedule.",
  fixRecipe: FIX_RECIPE,
  scan(file: SourceFile): Finding[] {
    const findings: Finding[] = [];

    for (const match of findMatches(file.content, FREQUENT_PATTERNS)) {
      findings.push(
        createFinding({
          ruleId: this.id,
          title: this.title,
          severity: this.severity,
          wasteCategory: this.wasteCategory,
          file,
          index: match.index,
          message:
            "This scheduled job may run very frequently, even when there is no useful work to do.",
          recommendation: this.recommendation,
          fixRecipe: this.fixRecipe,
          impact: makeImpact({
            computeWaste: "medium",
            carbonImpact: "low",
            waterImpact: "low",
            costImpact: "medium",
            confidence: "high",
            score: 55,
            explanation:
              "Frequent background jobs can create steady avoidable compute usage over time.",
          }),
        }),
      );
    }

    return dedupeFindings(findings);
  },
};
