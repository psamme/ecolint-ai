import pc from "picocolors";
import { IMPACT_DISCLAIMER } from "../impact.js";
import { WASTE_CATEGORY_LABEL } from "../types.js";
import type { Finding, ScanResult, Severity } from "../types.js";
import { categoryBreakdown, topFixOpportunities } from "./impactTracker.js";

/** Default number of compact finding blocks shown in a terminal. */
export const DEFAULT_MAX_FINDINGS = 8;

export type TerminalReportOptions = {
  maxFindings?: number;
  summary?: boolean;
};

function severityTag(severity: Severity, confidence: string): string {
  const tag = `[${severity.toUpperCase()} · ${confidence.toUpperCase()} CONFIDENCE]`;
  if (severity === "high") return pc.bold(pc.red(tag));
  if (severity === "medium") return pc.bold(pc.yellow(tag));
  return pc.bold(pc.cyan(tag));
}

function renderFinding(finding: Finding): string {
  const out = [
    `${severityTag(finding.severity, finding.impact.confidence)} ${pc.bold(finding.title)}`,
    `${finding.filePath}:${finding.line} · ${finding.ruleId} · ${WASTE_CATEGORY_LABEL[finding.wasteCategory]}`,
  ];
  if (finding.snippet) out.push(pc.dim(`  ${finding.snippet}`));
  out.push(`Issue: ${finding.message}`);
  out.push(`Fix: ${finding.recommendation}`);
  return out.join("\n");
}

/** Render a compact, evidence-first terminal review. */
export function renderTerminalReport(
  result: ScanResult,
  options: TerminalReportOptions = {},
): string {
  const { summary, findings } = result;
  const out: string[] = [pc.bold(pc.green("Trimference efficiency review")), ""];
  out.push(
    `Scanned ${pc.bold(String(summary.filesScanned))} files in ${summary.durationMs}ms.`,
  );
  if (summary.ruleErrors.length > 0) {
    out.push(pc.red(`${summary.ruleErrors.length} rule execution error(s); results may be incomplete.`));
  }

  if (findings.length === 0) {
    out.push("No obvious AI efficiency safeguards are missing.");
    if (summary.baselineSuppressed > 0) {
      out.push(pc.dim(`${summary.baselineSuppressed} baseline finding(s) hidden.`));
    }
    out.push("", pc.dim(`Note: ${IMPACT_DISCLAIMER}`));
    return out.join("\n");
  }

  out.push(
    `Found ${pc.bold(String(summary.totalFindings))} review item(s): ` +
      `${pc.red(`${summary.high} high`)} · ` +
      `${pc.yellow(`${summary.medium} medium`)} · ` +
      `${pc.cyan(`${summary.low} low`)}`,
  );
  if (summary.baselineSuppressed > 0) {
    out.push(pc.dim(`${summary.baselineSuppressed} accepted baseline finding(s) hidden.`));
  }

  const breakdown = categoryBreakdown(result);
  if (breakdown.length > 0) {
    out.push("", pc.bold("Safeguards to review:"));
    for (const item of breakdown) out.push(`- ${item.label}: ${item.count}`);
  }

  const opportunities = topFixOpportunities(result);
  if (opportunities.length > 0) {
    out.push("", pc.bold("Top opportunities:"));
    opportunities.forEach((item, index) => out.push(`${index + 1}. ${item.label}`));
  }

  if (summary.suggestedFirstPass.length > 0) {
    out.push("", pc.bold("Suggested first pass:"));
    summary.suggestedFirstPass.forEach((action, index) => {
      out.push(`${index + 1}. ${action}`);
    });
  }

  if (!options.summary) {
    const max = options.maxFindings ?? DEFAULT_MAX_FINDINGS;
    const shown = max === 0 ? findings : findings.slice(0, max);
    out.push("", pc.bold("Prioritized findings:"));
    for (const finding of shown) out.push("", renderFinding(finding));
    const hidden = findings.length - shown.length;
    if (hidden > 0) {
      out.push(
        "",
        pc.dim(
          `...plus ${hidden} more. Use --markdown, --json, or --max-findings 0 to see all.`,
        ),
      );
    }
  }

  out.push("", pc.dim(`Note: ${IMPACT_DISCLAIMER}`));
  return out.join("\n");
}
