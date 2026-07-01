import type { Finding, Rule, SourceFile } from "../types.js";
import { makeImpact } from "../impact.js";
import { createFinding, findMatches, hasNearby } from "./helpers.js";

/**
 * Strong signals that a file drives an agent / repeated tool-execution loop.
 * We keep this conservative: an explicit agent-execution term, or an infinite
 * loop that clearly sits next to model/tool/agent code.
 */
const AGENT_EXECUTION_TERMS: Array<string | RegExp> = [
  /agent\.run\s*\(/i,
  /\brunAgent\s*\(/i,
  /\bexecuteAgent\s*\(/i,
  /\bagentExecutor\b/i,
  /\bagentLoop\b/i,
  /\btoolCalls\b/i,
];

/** Infinite / open-ended loops that can drive runaway agent execution. */
const INFINITE_LOOP_TERMS: Array<string | RegExp> = [
  /while\s*\(\s*true\s*\)/i,
  /for\s*\(\s*;\s*;\s*\)/,
];

/** Terms that suggest an infinite loop is doing model/tool work (not I/O polling). */
const AGENT_CONTEXT_TERMS: Array<string | RegExp> = [
  /agent/i,
  /\btool\b/i,
  /toolCalls/i,
  "openai",
  "anthropic",
  /generateText/i,
  /messages\.create/i,
  /chat\.completions\.create/i,
];

/**
 * Budget / stopping-condition terms. If any appear in the file we assume the
 * loop is bounded and stay quiet.
 */
const BUDGET_TERMS: Array<string | RegExp> = [
  "maxSteps",
  "maxIterations",
  "maxTurns",
  "timeout",
  "AbortController",
  "signal",
  "budget",
  "costLimit",
  "tokenLimit",
  "max_tokens",
  "maxOutputTokens",
];

const FIX_RECIPE = [
  "Add a maximum number of agent/tool iterations.",
  "Add a timeout or AbortController.",
  "Add token and cost budgets where possible.",
  "Log when a run stops because it hit a budget.",
];

/** Find the first agent-loop signal in the file, or null if none. */
function firstAgentLoopSignal(file: SourceFile): number | null {
  // (a) An explicit agent-execution term is enough on its own.
  const executionMatches = findMatches(file.content, AGENT_EXECUTION_TERMS);
  // (b) An infinite loop only counts when model/tool/agent code is nearby.
  const loopMatches = findMatches(file.content, INFINITE_LOOP_TERMS).filter((m) =>
    hasNearby(file, m.index, AGENT_CONTEXT_TERMS, 15),
  );

  const candidates = [...executionMatches, ...loopMatches].sort(
    (a, b) => a.index - b.index,
  );
  return candidates.length > 0 ? candidates[0]!.index : null;
}

export const agentLoopWithoutBudgetRule: Rule = {
  id: "agent-loop-without-budget",
  title: "Agent loop without obvious budget",
  severity: "high",
  wasteCategory: "repeated-inference",
  description:
    "Flags files that appear to run an agent or repeated tool/model loop without an obvious step, token, time, or cost budget.",
  recommendation:
    "Add explicit max steps, timeouts, token caps, and/or cost budgets to prevent runaway agent loops.",
  fixRecipe: FIX_RECIPE,
  scan(file: SourceFile): Finding[] {
    const signalIndex = firstAgentLoopSignal(file);
    if (signalIndex === null) return [];

    // If any budget/limit term appears anywhere in the file, assume it's bounded.
    if (findMatches(file.content, BUDGET_TERMS).length > 0) return [];

    // Report once per file to avoid noise.
    return [
      createFinding({
        ruleId: this.id,
        title: this.title,
        severity: this.severity,
        wasteCategory: this.wasteCategory,
        file,
        index: signalIndex,
        message:
          "This agentic flow appears to run without an obvious step, token, time, or cost budget.",
        recommendation: this.recommendation,
        fixRecipe: this.fixRecipe,
        impact: makeImpact({
          computeWaste: "high",
          carbonImpact: "medium",
          waterImpact: "medium",
          costImpact: "high",
          confidence: "medium",
          score: 88,
          explanation:
            "Agent loops can multiply model/tool calls if they do not have explicit stopping budgets.",
        }),
      }),
    ];
  },
};
