import { IMPACT_DISCLAIMER } from "../impact.js";
import type { ScanResult } from "../types.js";

/** Render a scan result as a stable, colorless JSON string. */
export function renderJsonReport(result: ScanResult): string {
  const { summary, findings } = result;
  const payload = {
    summary: {
      filesScanned: summary.filesScanned,
      totalFindings: summary.totalFindings,
      high: summary.high,
      medium: summary.medium,
      low: summary.low,
      averageImpactScore: summary.averageImpactScore,
      overallImpactScore: summary.overallImpactScore,
      findingsByCategory: summary.findingsByCategory,
      topCategory: summary.topCategory,
      suggestedFirstPass: summary.suggestedFirstPass,
    },
    disclaimer: IMPACT_DISCLAIMER,
    findings,
  };
  return JSON.stringify(payload, null, 2);
}
