import type { Finding, ScanResult, WasteCategory } from "../types.js";
import { WASTE_CATEGORY_LABEL } from "../types.js";

/** Category counts sorted high-to-low, as [label, count] pairs. */
export function categoryBreakdown(
  result: ScanResult,
): Array<{ category: WasteCategory; label: string; count: number }> {
  const entries = Object.entries(result.summary.findingsByCategory) as Array<
    [WasteCategory, number]
  >;
  return entries
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({
      category,
      label: WASTE_CATEGORY_LABEL[category],
      count,
    }));
}

/**
 * A short, human-readable "fix opportunity" line for a finding, e.g.
 * "Add caching around app/api/generate/route.ts".
 */
export function fixOpportunityLabel(f: Finding): string {
  const loc = f.filePath;
  switch (f.wasteCategory) {
    case "repeated-inference":
      return `Add caching / reduce repeated calls in ${loc}`;
    case "token-bloat":
      return `Limit prompt context in ${loc}`;
    case "model-overkill":
      return `Right-size the model in ${loc}`;
    case "redundant-embedding":
      return `Persist embeddings in ${loc}`;
    case "unbounded-generation":
      return `Set an output token limit in ${loc}`;
    case "background-compute-drift":
      return `Reduce schedule frequency in ${loc}`;
    case "multimodal-cost-explosion":
      return `Cap repeated image generation in ${loc}`;
  }
}

/**
 * Top distinct fix opportunities across all findings, highest score first.
 * Deduplicated by label so the same file+category isn't listed repeatedly.
 */
export function topFixOpportunities(
  result: ScanResult,
  limit = 3,
): Array<{ label: string; score: number }> {
  const seen = new Set<string>();
  const out: Array<{ label: string; score: number }> = [];
  for (const f of result.findings) {
    const label = fixOpportunityLabel(f);
    if (seen.has(label)) continue;
    seen.add(label);
    out.push({ label, score: f.impact.score });
    if (out.length >= limit) break;
  }
  return out;
}
