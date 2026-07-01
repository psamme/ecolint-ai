import pc from "picocolors";
import { IMPACT_DISCLAIMER, impactLine } from "../impact.js";
import { WASTE_CATEGORY_LABEL } from "../types.js";
import type { Finding, ScanResult, Severity } from "../types.js";
import { categoryBreakdown, topFixOpportunities } from "./impactTracker.js";

const SEVERITY_ORDER: Severity[] = ["high", "medium", "low"];

const SEVERITY_LABEL: Record<Severity, string> = {
  high: "High impact",
  medium: "Medium impact",
  low: "Low impact",
};

/** How many fix-recipe bullets the terminal shows before deferring to md/JSON. */
const TERMINAL_RECIPE_LIMIT = 3;
/** How many findings of the same noisy rule to show per file in the terminal. */
const NO_TOKEN_LIMIT_PER_FILE = 2;

function colorSeverityTag(severity: Severity): string {
  const tag = `[${severity.toUpperCase()}]`;
  switch (severity) {
    case "high":
      return pc.bold(pc.red(tag));
    case "medium":
      return pc.bold(pc.yellow(tag));
    case "low":
      return pc.bold(pc.cyan(tag));
  }
}

function scoreColor(score: number): (s: string) => string {
  if (score >= 75) return pc.red;
  if (score >= 50) return pc.yellow;
  return pc.green;
}

type FileContext = {
  total: number;
  ruleCount: number;
  otherCategories: string[];
};

function renderFinding(f: Finding, ctx: FileContext): string {
  const out: string[] = [];

  // When a file has multiple findings of this same rule, say so in the title.
  const title =
    ctx.ruleCount > 1 ? `${f.title} (${ctx.ruleCount} in this file)` : f.title;
  out.push(`${colorSeverityTag(f.severity)} ${pc.bold(title)}`);
  out.push(`${pc.dim("File:")} ${f.filePath}:${f.line}`);

  // Lightweight related-finding awareness.
  if (ctx.otherCategories.length > 0) {
    out.push(
      `${pc.dim("Also flagged in this file:")} ${ctx.otherCategories.join(", ")}`,
    );
  } else if (ctx.total > 1) {
    out.push(`${pc.dim("Related findings in this file:")} ${ctx.total}`);
  }

  out.push(`${pc.dim("Rule:")} ${f.ruleId}`);
  out.push(`${pc.dim("Waste category:")} ${WASTE_CATEGORY_LABEL[f.wasteCategory]}`);
  out.push(
    `${pc.dim("Impact:")} ${impactLine(f.impact)} · confidence ${f.impact.confidence}`,
  );
  out.push(`${pc.dim("Score:")} ${scoreColor(f.impact.score)(`${f.impact.score}/100`)}`);
  out.push("");
  out.push(`${pc.dim("Issue:")} ${f.message}`);
  out.push("");
  out.push(`${pc.dim("Why it matters:")} ${f.impact.explanation}`);
  out.push("");
  out.push(`${pc.dim("Recommendation:")} ${f.recommendation}`);
  out.push("");
  out.push(pc.dim("Fix recipe:"));
  const shown = f.fixRecipe.slice(0, TERMINAL_RECIPE_LIMIT);
  shown.forEach((step, i) => out.push(`  ${i + 1}. ${step}`));
  const remaining = f.fixRecipe.length - shown.length;
  if (remaining > 0) {
    out.push(pc.dim(`  ...plus ${remaining} more in markdown/JSON output.`));
  }
  return out.join("\n");
}

/** Render a full scan result as a colorized terminal report. */
export function renderTerminalReport(result: ScanResult): string {
  const { summary, findings } = result;
  const out: string[] = [];

  out.push(pc.bold(pc.green("EcoLint AI")));
  out.push("");
  out.push(`Scanned ${pc.bold(String(summary.filesScanned))} files.`);

  if (findings.length === 0) {
    out.push("No obvious AI compute waste patterns found.");
    out.push("");
    out.push(pc.dim("Note: EcoLint AI uses static heuristics and may miss issues."));
    return out.join("\n");
  }

  out.push(
    `Found ${pc.bold(String(summary.totalFindings))} potential AI compute-waste issues.`,
  );
  out.push("");
  out.push(
    `Estimated avoidable compute waste score: ${scoreColor(
      summary.overallImpactScore,
    )(pc.bold(`${summary.overallImpactScore}/100`))}`,
  );

  // Findings by waste category
  const breakdown = categoryBreakdown(result);
  if (breakdown.length > 0) {
    out.push("");
    out.push(pc.bold("Findings by waste category:"));
    for (const b of breakdown) {
      out.push(`- ${b.label}: ${b.count}`);
    }
  }

  // Top fix opportunities
  const opportunities = topFixOpportunities(result);
  if (opportunities.length > 0) {
    out.push("");
    out.push(pc.bold("Top fix opportunities:"));
    opportunities.forEach((o, i) => {
      out.push(`${i + 1}. ${o.label} — ${o.score}/100`);
    });
  }

  // Suggested first pass — a human-review-style action list.
  const firstPass = summary.suggestedFirstPass;
  if (firstPass.length > 0) {
    out.push("");
    out.push(pc.bold("Suggested first pass:"));
    firstPass.forEach((action, i) => {
      out.push(`${i + 1}. ${action}`);
    });
  }

  // Precompute per-file context for related-finding awareness.
  const fileTotals = new Map<string, number>();
  const ruleCounts = new Map<string, number>();
  const fileCategoryLabels = new Map<string, string[]>();
  for (const f of findings) {
    fileTotals.set(f.filePath, (fileTotals.get(f.filePath) ?? 0) + 1);
    const rk = `${f.filePath}::${f.ruleId}`;
    ruleCounts.set(rk, (ruleCounts.get(rk) ?? 0) + 1);
    const labels = fileCategoryLabels.get(f.filePath) ?? [];
    const label = WASTE_CATEGORY_LABEL[f.wasteCategory];
    if (!labels.includes(label)) labels.push(label);
    fileCategoryLabels.set(f.filePath, labels);
  }

  // Detailed findings, grouped by severity. Cap noisy no-token-limit output.
  const shownNoTokenPerFile = new Map<string, number>();
  const notedNoTokenFiles = new Set<string>();

  for (const severity of SEVERITY_ORDER) {
    const group = findings.filter((f) => f.severity === severity);
    if (group.length === 0) continue;
    out.push("");
    out.push(pc.bold(SEVERITY_LABEL[severity]));
    out.push(pc.dim("────────────────"));

    for (const f of group) {
      if (f.ruleId === "no-token-limit") {
        const shown = shownNoTokenPerFile.get(f.filePath) ?? 0;
        if (shown >= NO_TOKEN_LIMIT_PER_FILE) {
          if (!notedNoTokenFiles.has(f.filePath)) {
            const total = ruleCounts.get(`${f.filePath}::no-token-limit`) ?? 0;
            const extra = total - NO_TOKEN_LIMIT_PER_FILE;
            out.push("");
            out.push(
              pc.dim(
                `  ...plus ${extra} more no-token-limit findings in this file.`,
              ),
            );
            notedNoTokenFiles.add(f.filePath);
          }
          continue;
        }
        shownNoTokenPerFile.set(f.filePath, shown + 1);
      }

      const label = WASTE_CATEGORY_LABEL[f.wasteCategory];
      const ctx: FileContext = {
        total: fileTotals.get(f.filePath) ?? 1,
        ruleCount: ruleCounts.get(`${f.filePath}::${f.ruleId}`) ?? 1,
        otherCategories: (fileCategoryLabels.get(f.filePath) ?? []).filter(
          (l) => l !== label,
        ),
      };
      out.push("");
      out.push(renderFinding(f, ctx));
    }
  }

  out.push("");
  out.push(pc.dim("─".repeat(40)));
  out.push(pc.dim(`Note:\n${IMPACT_DISCLAIMER}`));

  return out.join("\n");
}
