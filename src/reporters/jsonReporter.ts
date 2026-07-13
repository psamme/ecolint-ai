import { IMPACT_DISCLAIMER } from "../impact.js";
import type { ScanResult } from "../types.js";

/** Render a scan result as a stable, colorless JSON string. */
export function renderJsonReport(result: ScanResult): string {
  const { summary, findings } = result;
  const payload = {
    schemaVersion: 2,
    summary: {
      filesScanned: summary.filesScanned,
      durationMs: summary.durationMs,
      totalFindings: summary.totalFindings,
      high: summary.high,
      medium: summary.medium,
      low: summary.low,
      priorityPoints: summary.priorityPoints,
      baselineSuppressed: summary.baselineSuppressed,
      ruleErrors: summary.ruleErrors,
      findingsByCategory: summary.findingsByCategory,
      topCategory: summary.topCategory,
      suggestedFirstPass: summary.suggestedFirstPass,
    },
    disclaimer: IMPACT_DISCLAIMER,
    findings: findings.map(({ impact, ...finding }) => ({
      ...finding,
      operationalImpact: {
        computeRisk: impact.computeWaste,
        costRisk: impact.costImpact,
        confidence: impact.confidence,
        explanation: impact.explanation,
      },
    })),
  };
  return JSON.stringify(payload, null, 2);
}
