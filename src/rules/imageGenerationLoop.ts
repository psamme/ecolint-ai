import type { Finding, Rule, SourceFile } from "../types.js";
import { makeImpact } from "../impact.js";
import {
  createFinding,
  dedupeFindings,
  findCodeMatchesInFile,
  hasNearbyCode,
} from "./helpers.js";

const IMAGE_GEN_PATTERNS: Array<string | RegExp> = [
  /images\.generate/i,
  /generateImage/i,
  /image\.create/i,
  /replicate\.run/i,
  "stability",
  "dall-e",
  "gpt-image",
];

const LOOP_RETRY_TERMS: Array<string | RegExp> = [
  /for\s*\(/i,
  /while\s*\(/i,
  /\.map\s*\(/i,
  /forEach\s*\(/i,
  "retry",
  "attempt",
  "tries",
  "setInterval",
  "cron",
];

const FIX_RECIPE = [
  "Move image generation outside loops or retry paths when possible.",
  "Add strict per-user and per-job generation caps.",
  "Cache generated images by prompt and parameters.",
  "Require explicit user confirmation before repeated image generation.",
];

export const imageGenerationLoopRule: Rule = {
  id: "image-generation-loop",
  title: "Image generation inside loop or retry path",
  severity: "high",
  wasteCategory: "multimodal-cost-explosion",
  description:
    "Flags image generation calls that appear near loops, retry logic, or scheduled jobs.",
  recommendation:
    "Add strict caps, caching, idempotency keys, and user confirmation before repeated image generation.",
  fixRecipe: FIX_RECIPE,
  scan(file: SourceFile): Finding[] {
    const findings: Finding[] = [];
    // A single call site (e.g. `images.generate({ model: "dall-e-3" })`) can
    // match several patterns on adjacent lines; only report it once.
    let lastReportedLine = -Infinity;

    for (const match of findCodeMatchesInFile(file, IMAGE_GEN_PATTERNS)) {
      if (!hasNearbyCode(file, match.index, LOOP_RETRY_TERMS, 20)) continue;
      if (match.line - lastReportedLine <= 2) continue;
      lastReportedLine = match.line;

      findings.push(
        createFinding({
          ruleId: this.id,
          title: this.title,
          severity: this.severity,
          wasteCategory: this.wasteCategory,
          file,
          index: match.index,
          message:
            "Image generation appears inside a loop, retry path, or repeated job.",
          recommendation: this.recommendation,
          fixRecipe: this.fixRecipe,
          impact: makeImpact({
            computeWaste: "high",
            carbonImpact: "high",
            waterImpact: "medium",
            costImpact: "high",
            confidence: "medium",
            score: 90,
            explanation:
              "Repeated image generation can be compute-intensive and expensive, especially in loops or retries.",
          }),
        }),
      );
    }

    return dedupeFindings(findings);
  },
};
