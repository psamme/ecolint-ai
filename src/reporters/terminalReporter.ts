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
/** Default cap on detailed findings shown in the terminal. 0 means show all. */
export const DEFAULT_MAX_FINDINGS = 10;

export type TerminalReportOptions = {
  /** Max detailed findings to show. Defaults to 10; 0 shows all. */
  maxFindings?: number;
  /** Show only the high-level summary (no detailed findings). */
  summary?: boolean;
};

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

/**
 * Build the ordered list of findings to render as detailed blocks, applying the
 * per-file cap on the noisy `no-token-limit` rule. Also reports, per file, how
 * many `no-token-limit` findings were left out so the caller can note them.
 */
function collectDisplayable(findings: Finding[]): {
  displayable: Finding[];
  noTokenExtraByFile: Map<string, number>;
} {
  const totalNoToken = new Map<string, number>();
  for (const f of findings) {
    if (f.ruleId === "no-token-limit") {
      totalNoToken.set(f.filePath, (totalNoToken.get(f.filePath) ?? 0) + 1);
    }
  }

  const shownNoToken = new Map<string, number>();
  const displayable: Finding[] = [];
  for (const f of findings) {
    if (f.ruleId === "no-token-limit") {
      const shown = shownNoToken.get(f.filePath) ?? 0;
      if (shown >= NO_TOKEN_LIMIT_PER_FILE) continue;
      shownNoToken.set(f.filePath, shown + 1);
    }
    displayable.push(f);
  }

  const noTokenExtraByFile = new Map<string, number>();
  for (const [file, total] of totalNoToken) {
    const extra = total - NO_TOKEN_LIMIT_PER_FILE;
    if (extra > 0) noTokenExtraByFile.set(file, extra);
  }
  return { displayable, noTokenExtraByFile };
}

/** Render a full scan result as a colorized terminal report. */
export function renderTerminalReport(
  result: ScanResult,
  options: TerminalReportOptions = {},
): string {
  const { summary, findings } = result;
  const summaryOnly = options.summary === true;
  const maxFindings = options.maxFindings ?? DEFAULT_MAX_FINDINGS;
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

  // In summary mode, stop before the detailed findings.
  if (summaryOnly) {
    out.push("");
    out.push(pc.dim("─".repeat(40)));
    out.push(pc.dim(`Note:\n${IMPACT_DISCLAIMER}`));
    return out.join("\n");
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

  // Determine what to show: cap noisy no-token-limit output per file, then apply
  // the overall --max-findings cap on the number of detailed findings.
  const { displayable, noTokenExtraByFile } = collectDisplayable(findings);
  const cap = maxFindings > 0 ? maxFindings : displayable.length;
  const shown = displayable.slice(0, cap);
  const hiddenByCap = displayable.length - shown.length;
  const shownNoTokenFiles = new Set<string>();

  // Detailed findings, grouped by severity.
  for (const severity of SEVERITY_ORDER) {
    const group = shown.filter((f) => f.severity === severity);
    if (group.length === 0) continue;
    out.push("");
    out.push(pc.bold(SEVERITY_LABEL[severity]));
    out.push(pc.dim("────────────────"));

    for (const f of group) {
      if (f.ruleId === "no-token-limit") shownNoTokenFiles.add(f.filePath);
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

  // Note per-file no-token-limit findings that were collapsed.
  for (const file of shownNoTokenFiles) {
    const extra = noTokenExtraByFile.get(file);
    if (extra && extra > 0) {
      out.push("");
      out.push(
        pc.dim(`  ...plus ${extra} more no-token-limit findings in this file.`),
      );
    }
  }

  // Note detailed findings hidden by the --max-findings cap.
  if (hiddenByCap > 0) {
    out.push("");
    out.push(
      pc.dim(
        `...plus ${hiddenByCap} more findings. ` +
          `Use --markdown, --json, or --max-findings 0 to see all.`,
      ),
    );
  }

  out.push("");
  out.push(pc.dim("─".repeat(40)));
  out.push(pc.dim(`Note:\n${IMPACT_DISCLAIMER}`));

  return out.join("\n");
}
