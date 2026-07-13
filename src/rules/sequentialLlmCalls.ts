import type { Finding, Rule, SourceFile } from "../types.js";
import { makeImpact } from "../impact.js";
import {
  LLM_CALL_PATTERNS,
  createFinding,
  findCodeMatchesInFile,
} from "./helpers.js";

const WINDOW_LINES = 80;

const FIX_RECIPE = [
  "Check whether the calls can be combined into one prompt.",
  "Cache intermediate outputs.",
  "Parallelize independent calls.",
  "Replace simple follow-up calls with rules or smaller models.",
];

export const sequentialLlmCallsRule: Rule = {
  id: "sequential-llm-calls",
  title: "Nearby LLM calls may multiply work",
  severity: "medium",
  wasteCategory: "repeated-inference",
  description:
    "Flags files where two or more likely LLM calls appear within a close range of each other.",
  recommendation:
    "Consider combining prompts, batching, parallelizing independent calls, or caching intermediate results.",
  fixRecipe: FIX_RECIPE,
  scan(file: SourceFile): Finding[] {
    const calls = findCodeMatchesInFile(file, LLM_CALL_PATTERNS);
    if (calls.length < 2) return [];

    // Report once per cluster of >= 2 calls within WINDOW_LINES, anchored on
    // the second call in the cluster.
    const findings: Finding[] = [];
    let clusterStartLine = calls[0]!.line;
    let clusterCount = 1;
    let reported = false;

    for (let i = 1; i < calls.length; i++) {
      const call = calls[i]!;
      if (call.line - clusterStartLine <= WINDOW_LINES) {
        clusterCount++;
        if (clusterCount === 2 && !reported) {
          findings.push(buildFinding(file, call.index));
          reported = true;
        }
      } else {
        // Start a new cluster.
        clusterStartLine = call.line;
        clusterCount = 1;
        reported = false;
      }
    }

    return findings;
  },
};

function buildFinding(file: SourceFile, index: number): Finding {
  return createFinding({
    ruleId: sequentialLlmCallsRule.id,
    title: sequentialLlmCallsRule.title,
    severity: sequentialLlmCallsRule.severity,
    wasteCategory: sequentialLlmCallsRule.wasteCategory,
    file,
    index,
    message:
      "Multiple LLM calls appear close together. Verify whether they run in the same execution flow.",
    recommendation: sequentialLlmCallsRule.recommendation,
    fixRecipe: sequentialLlmCallsRule.fixRecipe,
    impact: makeImpact({
      computeWaste: "medium",
      carbonImpact: "medium",
      waterImpact: "medium",
      costImpact: "high",
      confidence: "low",
      score: 70,
      explanation:
        "Multi-call chains can multiply token usage and latency if not carefully designed.",
    }),
  });
}
