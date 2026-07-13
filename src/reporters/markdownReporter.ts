import { IMPACT_DISCLAIMER, operationalImpactLine } from "../impact.js";
import { WASTE_CATEGORY_LABEL } from "../types.js";
import type { Finding, ScanResult, Severity } from "../types.js";
import { categoryBreakdown, topFixOpportunities } from "./impactTracker.js";

const SEVERITY_TITLE: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function location(finding: Finding): string {
  const label = `${finding.filePath}:${finding.line}`;
  const repositoryUrl =
    process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY
      ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}`
      : undefined;
  const revision = process.env.GITHUB_SHA;
  const href = repositoryUrl && revision
    ? `${repositoryUrl}/blob/${revision}/${encodeURI(finding.filePath)}#L${finding.line}`
    : `./${encodeURI(finding.filePath)}#L${finding.line}`;
  return `[\`${label}\`](${href})`;
}

function findingsTable(findings: Finding[]): string {
  const rows = findings.map((finding) => {
    const evidence = finding.snippet
      ? `<code>${escapeHtml(escapeCell(finding.snippet))}</code>`
      : "—";
    return `| ${SEVERITY_TITLE[finding.severity]} | ${finding.impact.confidence} | ${
      WASTE_CATEGORY_LABEL[finding.wasteCategory]
    } | ${location(finding)} | ${evidence} |`;
  });
  return [
    "| Severity | Confidence | Safeguard | Location | Evidence |",
    "|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

function findingDetail(finding: Finding): string {
  const title = `${SEVERITY_TITLE[finding.severity]} · ${finding.title} · ${finding.filePath}:${finding.line}`;
  const out = [
    "<details>",
    `<summary>${escapeHtml(title)}</summary>`,
    "",
    `- **Rule:** \`${finding.ruleId}\``,
    `- **Safeguard:** ${WASTE_CATEGORY_LABEL[finding.wasteCategory]}`,
    `- **Location:** ${location(finding)}`,
    `- **Signal:** ${operationalImpactLine(finding.impact)}`,
  ];
  if (finding.snippet) {
    out.push("", "**Evidence:**", "", `> <code>${escapeHtml(finding.snippet)}</code>`);
  }
  out.push(
    "",
    `**Issue:** ${finding.message}`,
    "",
    `**Why review it:** ${finding.impact.explanation}`,
    "",
    `**Recommended change:** ${finding.recommendation}`,
    "",
    "**Fix recipe:**",
    "",
  );
  finding.fixRecipe.forEach((step, index) => out.push(`${index + 1}. ${step}`));
  out.push("", "</details>");
  return out.join("\n");
}

/** Render a compact GitHub-friendly efficiency review. */
export function renderMarkdownReport(result: ScanResult): string {
  const { summary, findings } = result;
  const out: string[] = ["# Trimference Efficiency Review", ""];
  if (summary.ruleErrors.length > 0) {
    out.push(
      `> ⚠️ ${summary.ruleErrors.length} rule execution error(s) occurred; this report may be incomplete.`,
      "",
    );
  }

  if (findings.length === 0) {
    out.push(
      `Scanned **${summary.filesScanned} files** in **${summary.durationMs}ms** and found **no obvious missing AI efficiency safeguards**.`,
    );
    if (summary.baselineSuppressed > 0) {
      out.push("", `${summary.baselineSuppressed} accepted baseline finding(s) were hidden.`);
    }
    out.push("", `> ${IMPACT_DISCLAIMER}`);
    return out.join("\n");
  }

  out.push(
    `Scanned **${summary.filesScanned} files** in **${summary.durationMs}ms** and found **${summary.totalFindings} review item(s)**.`,
    "",
    "| High | Medium | Low | Baseline hidden |",
    "|---:|---:|---:|---:|",
    `| ${summary.high} | ${summary.medium} | ${summary.low} | ${summary.baselineSuppressed} |`,
    "",
    `> ${IMPACT_DISCLAIMER}`,
    "",
    "## Safeguards to review",
    "",
    "| Area | Findings |",
    "|---|---:|",
  );
  for (const item of categoryBreakdown(result)) {
    out.push(`| ${item.label} | ${item.count} |`);
  }

  const opportunities = topFixOpportunities(result);
  if (opportunities.length > 0) {
    out.push("", "## Top opportunities", "");
    opportunities.forEach((item, index) => out.push(`${index + 1}. ${item.label}`));
  }

  if (summary.suggestedFirstPass.length > 0) {
    out.push("", "## Suggested first pass", "");
    summary.suggestedFirstPass.forEach((action, index) => {
      out.push(`${index + 1}. ${action}`);
    });
  }

  out.push("", "## Findings", "", findingsTable(findings), "");
  for (const finding of findings) out.push(findingDetail(finding), "");
  return out.join("\n");
}
