import type { Finding, Rule, SourceFile } from "../types.js";
import { makeImpact } from "../impact.js";
import { createFinding, dedupeFindings, findMatches } from "./helpers.js";

/**
 * Variable names / patterns that suggest large or unbounded context is being
 * passed into a model call.
 */
const CONTEXT_PATTERNS: Array<string | RegExp> = [
  "fullConversation",
  "fullHistory",
  "conversationHistory",
  "entireDocument",
  "entireFile",
  "rawTranscript",
  "allMessages",
  "allDocs",
  "fullText",
  "documentText",
  /messages\s*:\s*history/i,
  /messages\s*:\s*conversation/i,
  /content\s*:\s*full\b/i,
  /content\s*:\s*fullText/i,
  /messages\s*:\s*user\.messages/i,
  /messages\s*:\s*thread\.messages/i,
  /content\s*:\s*document\b/i,
];

const FIX_RECIPE = [
  "Set a maximum conversation length.",
  "Summarize older messages before sending them to the model.",
  "Use retrieval to include only relevant document chunks.",
  "Add tests that fail when prompt size exceeds your limit.",
];

export const hugeContextRule: Rule = {
  id: "huge-context",
  title: "Potential oversized prompt or context",
  severity: "medium",
  wasteCategory: "token-bloat",
  description:
    "Flags variables and message fields whose names imply large or unbounded context being sent to a model.",
  recommendation:
    "Summarize long histories, chunk documents, retrieve only relevant context, and set explicit context limits.",
  fixRecipe: FIX_RECIPE,
  scan(file: SourceFile): Finding[] {
    const findings: Finding[] = [];

    for (const match of findMatches(file.content, CONTEXT_PATTERNS)) {
      findings.push(
        createFinding({
          ruleId: this.id,
          title: this.title,
          severity: this.severity,
          wasteCategory: this.wasteCategory,
          file,
          index: match.index,
          message: "This code may send large or unbounded context to the model.",
          recommendation: this.recommendation,
          fixRecipe: this.fixRecipe,
          impact: makeImpact({
            computeWaste: "high",
            carbonImpact: "medium",
            waterImpact: "medium",
            costImpact: "high",
            confidence: "medium",
            score: 75,
            explanation:
              "Oversized prompts increase token processing and can amplify cost and infrastructure usage.",
          }),
        }),
      );
    }

    return dedupeFindings(findings);
  },
};
