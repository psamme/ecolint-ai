import { IMPACT_DISCLAIMER, impactLine } from "../impact.js";
import { WASTE_CATEGORY_LABEL } from "../types.js";
import type { Finding, ScanResult, Severity } from "../types.js";
import { categoryBreakdown, topFixOpportunities } from "./impactTracker.js";

const SEVERITY_TITLE: Record<Severity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function escapeCell(text: string): string {
  return text.replace(/\|/g, "\\|");
}

function findingsTable(findings: Finding[]): string {
  const header =
    "| Severity | Waste category | File | Rule | Score | Impact |\n|---|---|---|---|---:|---|";
  const rows = findings.map((f) => {
    const loc = `\`${f.filePath}:${f.line}\``;
    return `| ${SEVERITY_TITLE[f.severity]} | ${
      WASTE_CATEGORY_LABEL[f.wasteCategory]
    } | ${loc} | ${f.ruleId} | ${f.impact.score} | ${escapeCell(
      impactLine(f.impact),
    )} |`;
  });
  return [header, ...rows].join("\n");
}

function findingDetail(f: Finding): string {
  const out: string[] = [];
  out.push(`### ${SEVERITY_TITLE[f.severity]} · ${f.title}`);
  out.push("");
  out.push(`- **Rule:** \`${f.ruleId}\``);
  out.push(`- **Waste category:** ${WASTE_CATEGORY_LABEL[f.wasteCategory]}`);
  out.push(`- **Location:** \`${f.filePath}:${f.line}\``);
  out.push(
    `- **Impact:** ${impactLine(f.impact)} · confidence ${f.impact.confidence}`,
  );
  out.push(`- **Score:** ${f.impact.score}/100`);
  out.push("");
  out.push(`**Message:** ${f.message}`);
  out.push("");
  out.push(`**Why this matters:** ${f.impact.explanation}`);
  out.push("");
  out.push(`**Recommendation:** ${f.recommendation}`);
  out.push("");
  out.push("**Fix recipe:**");
  out.push("");
  f.fixRecipe.forEach((step, i) => out.push(`${i + 1}. ${step}`));
  return out.join("\n");
}

/** Render a scan result as GitHub-friendly markdown. */
export function renderMarkdownReport(result: ScanResult): string {
  const { summary, findings } = result;
  const out: string[] = [];

  out.push("# EcoLint AI Report");
  out.push("");

  if (findings.length === 0) {
    out.push(
      `EcoLint AI scanned **${summary.filesScanned} files** and found **no obvious AI compute-waste patterns**.`,
    );
    out.push("");
    out.push("> EcoLint AI uses static heuristics and may miss issues.");
    out.push("");
    out.push(`> ${IMPACT_DISCLAIMER}`);
    return out.join("\n");
  }

  out.push(
    `EcoLint AI scanned **${summary.filesScanned} files** and found **${summary.totalFindings} potential AI compute-waste issues**.`,
  );
  out.push("");

  // AI Waste Impact Tracker
  out.push("## AI Waste Impact Tracker");
  out.push("");
  out.push(
    `Estimated avoidable compute waste score: **${summary.overallImpactScore}/100**`,
  );
  out.push("");
  out.push(`- **Total findings:** ${summary.totalFindings}`);
  out.push(`- **High impact:** ${summary.high}`);
  out.push(`- **Medium impact:** ${summary.medium}`);
  out.push(`- **Low impact:** ${summary.low}`);
  out.push("");
  out.push(`> ${IMPACT_DISCLAIMER}`);
  out.push("");

  // Findings by Waste Category
  out.push("## Findings by Waste Category");
  out.push("");
  out.push("| Waste category | Findings |");
  out.push("|---|---:|");
  for (const b of categoryBreakdown(result)) {
    out.push(`| ${b.label} | ${b.count} |`);
  }
  out.push("");

  // Top Fix Opportunities
  out.push("## Top Fix Opportunities");
  out.push("");
  topFixOpportunities(result).forEach((o, i) => {
    out.push(`${i + 1}. ${o.label} — ${o.score}/100`);
  });
  out.push("");

  // Suggested first pass
  const firstPass = summary.suggestedFirstPass;
  if (firstPass.length > 0) {
    out.push("## Suggested first pass");
    out.push("");
    firstPass.forEach((action, i) => {
      out.push(`${i + 1}. ${action}`);
    });
    out.push("");
  }

  // Detailed Findings
  out.push("## Detailed Findings");
  out.push("");
  out.push(findingsTable(findings));
  out.push("");
  for (const f of findings) {
    out.push(findingDetail(f));
    out.push("");
  }

  return out.join("\n");
}
