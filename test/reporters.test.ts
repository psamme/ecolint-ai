import { describe, expect, it } from "vitest";
import { suggestedFirstPass } from "../src/impact.js";
import { renderJsonReport } from "../src/reporters/jsonReporter.js";
import { renderMarkdownReport } from "../src/reporters/markdownReporter.js";
import { renderTerminalReport } from "../src/reporters/terminalReporter.js";
import { renderSarifReport } from "../src/reporters/sarifReporter.js";
import { scan } from "../src/scanner.js";
import type { Finding, ScanResult, WasteCategory } from "../src/types.js";

const EXAMPLE_PATH = "examples/wasteful-ai-app";
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;

function terminal(result: ScanResult, options = {}): string {
  return renderTerminalReport(result, options).replace(ANSI, "");
}

function makeFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    ruleId: "no-token-limit",
    title: "No obvious output token limit",
    severity: "low",
    wasteCategory: "unbounded-generation",
    filePath: "lib/a.ts",
    line: 1,
    snippet: "await client.responses.create({ input });",
    message: "msg",
    recommendation: "rec",
    fixRecipe: ["one", "two", "three", "four"],
    impact: {
      computeWaste: "medium",
      carbonImpact: "low",
      waterImpact: "low",
      costImpact: "medium",
      confidence: "medium",
      score: 45,
      explanation: "why",
    },
    ...overrides,
  };
}

function makeResult(findings: Finding[]): ScanResult {
  const byCategory: Partial<Record<WasteCategory, number>> = {};
  for (const finding of findings) {
    byCategory[finding.wasteCategory] =
      (byCategory[finding.wasteCategory] ?? 0) + 1;
  }
  return {
    summary: {
      filesScanned: 1,
      durationMs: 1,
      totalFindings: findings.length,
      high: findings.filter((finding) => finding.severity === "high").length,
      medium: findings.filter((finding) => finding.severity === "medium").length,
      low: findings.filter((finding) => finding.severity === "low").length,
      averageImpactScore: 50,
      overallImpactScore: findings.length * 4,
      priorityPoints: findings.length,
      baselineSuppressed: 0,
      ruleErrors: [],
      topFindings: findings.slice(0, 3),
      findingsByRule: {},
      findingsByFile: {},
      findingsByCategory: byCategory,
      topCategory: null,
      suggestedFirstPass: suggestedFirstPass(findings),
    },
    findings,
  };
}

describe("reporters", () => {
  it("terminal report is compact, evidence-first, and avoids impact measurement", async () => {
    const text = terminal(await scan({ path: EXAMPLE_PATH }));
    expect(text).toContain("efficiency review");
    expect(text).toMatch(/\d+ high · \d+ medium · \d+ low/);
    expect(text).toContain("Safeguards to review");
    expect(text).toContain("Issue:");
    expect(text).toContain("Fix:");
    expect(text).not.toContain("waste score");
    expect(text).not.toContain("carbon high");
  });

  it("markdown uses clickable evidence rows and collapsed details", async () => {
    const result = await scan({ path: EXAMPLE_PATH });
    const markdown = renderMarkdownReport(result);
    expect(markdown).toContain("# Trimference Efficiency Review");
    expect(markdown).toContain("| High | Medium | Low | Baseline hidden |");
    expect(markdown).toContain("## Safeguards to review");
    expect(markdown).toContain("<details>");
    expect(markdown).toContain("#L");
    expect(markdown).not.toContain("carbon high");
  });

  it("JSON exposes a versioned automation schema", async () => {
    const parsed = JSON.parse(renderJsonReport(await scan({ path: EXAMPLE_PATH }))) as {
      schemaVersion: number;
      summary: { priorityPoints: number; baselineSuppressed: number };
      disclaimer: string;
      findings: Array<{
        impact?: unknown;
        operationalImpact: { computeRisk: string; costRisk: string; confidence: string };
      }>;
    };
    expect(parsed.schemaVersion).toBe(2);
    expect(parsed.summary.priorityPoints).toBeGreaterThan(0);
    expect(parsed.summary.baselineSuppressed).toBe(0);
    expect(parsed.disclaimer).toMatch(/not measured usage/);
    expect(parsed.findings.length).toBeGreaterThan(0);
    expect(parsed.findings[0]!.impact).toBeUndefined();
    expect(parsed.findings[0]!.operationalImpact.confidence).toBeTruthy();
  });

  it("SARIF maps findings to code-scanning locations", async () => {
    const parsed = JSON.parse(renderSarifReport(await scan({ path: EXAMPLE_PATH }))) as {
      version: string;
      runs: Array<{ results: Array<{ ruleId: string; locations: unknown[] }> }>;
    };
    expect(parsed.version).toBe("2.1.0");
    expect(parsed.runs[0]!.results.length).toBeGreaterThan(0);
    expect(parsed.runs[0]!.results[0]!.ruleId).toBeTruthy();
    expect(parsed.runs[0]!.results[0]!.locations).toHaveLength(1);
  });

  it("renders a clean empty result", () => {
    const text = terminal(makeResult([]));
    expect(text).toContain("No obvious AI efficiency safeguards are missing");
  });

  it("shows suggested first-pass actions in all report formats", async () => {
    const result = await scan({ path: EXAMPLE_PATH });
    expect(terminal(result)).toContain("Suggested first pass:");
    expect(renderMarkdownReport(result)).toContain("## Suggested first pass");
    const json = JSON.parse(renderJsonReport(result)) as {
      summary: { suggestedFirstPass: string[] };
    };
    expect(json.summary.suggestedFirstPass.length).toBeGreaterThan(0);
  });

  it("caps terminal details at 8 by default", async () => {
    const result = await scan({ path: EXAMPLE_PATH });
    const text = terminal(result);
    expect((text.match(/\[(HIGH|MEDIUM|LOW) · \w+ CONFIDENCE\]/g) ?? []).length).toBe(8);
    expect(text).toContain("Use --markdown, --json, or --max-findings 0");
  });

  it("supports all, custom, and summary-only terminal detail modes", async () => {
    const result = await scan({ path: EXAMPLE_PATH });
    const all = terminal(result, { maxFindings: 0 });
    const three = terminal(result, { maxFindings: 3 });
    const summary = terminal(result, { summary: true });
    const count = (text: string): number =>
      (text.match(/\[(HIGH|MEDIUM|LOW) · \w+ CONFIDENCE\]/g) ?? []).length;
    expect(count(all)).toBe(result.findings.length);
    expect(count(three)).toBe(3);
    expect(count(summary)).toBe(0);
  });

  it("keeps complete recipes in collapsed Markdown details", () => {
    const markdown = renderMarkdownReport(makeResult([makeFinding()]));
    expect(markdown).toContain("4. four");
  });

  it("shows baseline suppression in clean reports", () => {
    const result = makeResult([]);
    result.summary.baselineSuppressed = 3;
    expect(terminal(result)).toContain("3 baseline finding(s) hidden");
    expect(renderMarkdownReport(result)).toContain("3 accepted baseline finding(s)");
  });
});
