import type { Finding, Rule, RuleContext, SourceFile } from "../types.js";
import { makeImpact } from "../impact.js";
import { detectProvider, suggestSmallerModels } from "../models.js";
import {
  createFinding,
  dedupeFindings,
  findMatches,
  getNearbyText,
  hasNearby,
} from "./helpers.js";

const LARGE_MODEL_PATTERNS: Array<string | RegExp> = [
  /gpt-4(\.1|o)?/i,
  "opus",
  "claude-3-opus",
  "claude-opus",
  "sonnet",
];

/**
 * Downsized siblings of large models (e.g. gpt-4o-mini) are the *right* choice
 * for simple tasks, so we must not flag them. Because a pattern like `gpt-4o`
 * is a prefix of `gpt-4o-mini`, we inspect the full model slug at the match.
 */
const DOWNSIZED_VARIANT = /-(mini|nano|small|lite|micro|flash|instant)/i;

/** The full model slug starting at a match, e.g. "gpt-4.1" or "claude-3-opus". */
function modelSlugAt(content: string, index: number): string {
  return content.slice(index).match(/^[\w.-]+/)?.[0] ?? "";
}

function isDownsizedVariant(content: string, index: number): boolean {
  return DOWNSIZED_VARIANT.test(modelSlugAt(content, index));
}

const SIMPLE_TASK_LABELS: Array<[RegExp, string]> = [
  [/classif|categor|sentiment|label|tag/i, "classification"],
  [/extract/i, "extraction"],
  [/rout/i, "routing"],
  [/moderat/i, "moderation"],
  [/boolean|yes\/no|true\/false/i, "a yes/no decision"],
];

/** Name the kind of simple task hinted at near a model call, if any. */
function describeTask(nearby: string): string {
  for (const [re, label] of SIMPLE_TASK_LABELS) {
    if (re.test(nearby)) return label;
  }
  return "a simple task";
}

const SIMPLE_TASK_TERMS: Array<string | RegExp> = [
  "classify",
  "classification",
  "sentiment",
  "tag",
  "label",
  "extract",
  "extraction",
  "route",
  "routing",
  "moderate",
  "moderation",
  "boolean",
  "yes/no",
  "true/false",
  "category",
  "categorize",
];

const FIX_RECIPE = [
  "Classify the task type: routing, tagging, extraction, moderation, or reasoning.",
  "Use a smaller model for simple structured tasks.",
  "Cache deterministic results.",
  "Add evaluation examples to verify quality remains acceptable.",
];

export const expensiveModelSimpleTaskRule: Rule = {
  id: "expensive-model-simple-task",
  title: "Large model used for a simple task",
  severity: "medium",
  wasteCategory: "model-overkill",
  description:
    "Flags top-tier model names that appear near simple classification, extraction, or routing language.",
  recommendation:
    "Consider a smaller model, rules-based logic, batching, or caching for simple structured tasks.",
  fixRecipe: FIX_RECIPE,
  scan(file: SourceFile, context?: RuleContext): Finding[] {
    const findings: Finding[] = [];

    for (const match of findMatches(file.content, LARGE_MODEL_PATTERNS)) {
      // Don't flag already right-sized models like gpt-4o-mini.
      if (isDownsizedVariant(file.content, match.index)) continue;
      // Only flag when a simple-task word appears within ~30 lines.
      if (!hasNearby(file, match.index, SIMPLE_TASK_TERMS, 30)) continue;

      const model = modelSlugAt(file.content, match.index);
      const nearby = getNearbyText(file, match.index, 30);
      const task = describeTask(nearby);

      // Prefer the provider detected from the model slug; fall back to config.
      const detected = detectProvider(model);
      const provider = detected !== "unknown" ? detected : context?.provider ?? "unknown";
      const suggestions = suggestSmallerModels(provider);

      const message =
        `Detected model: ${model}. Task appears simple: ${task}. ` +
        (suggestions.length > 0
          ? `Consider a smaller model tier such as ${suggestions.join(" or ")} if quality is acceptable.`
          : `Consider a smaller model tier if quality is acceptable.`);

      findings.push(
        createFinding({
          ruleId: this.id,
          title: this.title,
          severity: this.severity,
          wasteCategory: this.wasteCategory,
          file,
          index: match.index,
          message,
          recommendation: this.recommendation,
          fixRecipe: this.fixRecipe,
          impact: makeImpact({
            computeWaste: "medium",
            carbonImpact: "medium",
            waterImpact: "medium",
            costImpact: "high",
            confidence: "low",
            score: 65,
            explanation:
              "Simple tasks often do not need the most capable model tier, so downsizing can reduce cost and compute demand.",
          }),
        }),
      );
    }

    return dedupeFindings(findings);
  },
};
