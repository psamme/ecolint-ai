import { describe, it, expect } from "vitest";
import { scan } from "../src/scanner.js";
import { renderTerminalReport } from "../src/reporters/terminalReporter.js";
import { renderMarkdownReport } from "../src/reporters/markdownReporter.js";
import { renderJsonReport } from "../src/reporters/jsonReporter.js";
import { suggestedFirstPass } from "../src/impact.js";
import type { Finding, ScanResult, WasteCategory } from "../src/types.js";

const EXAMPLE_PATH = "examples/wasteful-ai-app";

// picocolors emits ANSI color codes when it detects a CI environment, which
// splits styled labels (e.g. `Rule:`) from their values. Strip them so terminal
// assertions test the rendered text, not the coloring.
// eslint-disable-next-line no-control-regex
const ANSI = /\x1b\[[0-9;]*m/g;
function terminalText(result: ScanResult): string {
  return renderTerminalReport(result).replace(ANSI, "");
}

function makeFinding(overrides: Partial<Finding>): Finding {
  return {
    ruleId: "no-token-limit",
    title: "No obvious output token limit",
    severity: "low",
    wasteCategory: "unbounded-generation",
    filePath: "lib/a.ts",
    line: 1,
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
  for (const f of findings) {
    byCategory[f.wasteCategory] = (byCategory[f.wasteCategory] ?? 0) + 1;
  }
  return {
    summary: {
      filesScanned: 1,
      totalFindings: findings.length,
      high: findings.filter((f) => f.severity === "high").length,
      medium: findings.filter((f) => f.severity === "medium").length,
      low: findings.filter((f) => f.severity === "low").length,
      averageImpactScore: 50,
      overallImpactScore: 50,
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
  it("terminal report includes score, category breakdown, and disclaimer", async () => {
    const result = await scan({ path: EXAMPLE_PATH });
    const text = terminalText(result);
    expect(text).toContain("Estimated avoidable compute waste score");
    expect(text).toContain("Findings by waste category");
    expect(text).toContain("Top fix opportunities");
    expect(text).toContain("does not measure exact emissions");
  });

  it("markdown report includes tracker, category table, and top fix opportunities", async () => {
    const result = await scan({ path: EXAMPLE_PATH });
    const md = renderMarkdownReport(result);
    expect(md).toContain("# EcoLint AI Report");
    expect(md).toContain("## AI Waste Impact Tracker");
    expect(md).toContain("Estimated avoidable compute waste score");
    expect(md).toContain("## Findings by Waste Category");
    expect(md).toContain("## Top Fix Opportunities");
    expect(md).toContain("Fix recipe");
    expect(md).toContain("does not measure exact emissions");
  });

  it("json report is valid JSON and includes the category summary", async () => {
    const result = await scan({ path: EXAMPLE_PATH });
    const json = renderJsonReport(result);
    const parsed = JSON.parse(json) as {
      summary: {
        overallImpactScore: number;
        findingsByCategory: Record<string, number>;
        topCategory: string | null;
        suggestedFirstPass: string[];
      };
      disclaimer: string;
      findings: Array<{ wasteCategory: string; fixRecipe: string[] }>;
    };
    expect(typeof parsed.summary.overallImpactScore).toBe("number");
    expect(parsed.summary.findingsByCategory).toBeTruthy();
    expect(Object.keys(parsed.summary.findingsByCategory).length).toBeGreaterThan(0);
    expect(parsed.disclaimer).toMatch(/does not measure exact emissions/);
    expect(parsed.findings.every((f) => f.wasteCategory && f.fixRecipe.length > 0)).toBe(
      true,
    );
  });

  it("empty results still render a clean terminal report", () => {
    const text = terminalText(makeResult([]));
    expect(text).toContain("No obvious AI compute waste patterns found");
  });

  describe("Suggested first pass", () => {
    it("terminal output includes a Suggested first pass section", async () => {
      const result = await scan({ path: EXAMPLE_PATH });
      const text = terminalText(result);
      expect(text).toContain("Suggested first pass:");
      expect(text).toContain("Add caching around repeated model calls.");
    });

    it("markdown output includes a Suggested first pass section", async () => {
      const result = await scan({ path: EXAMPLE_PATH });
      const md = renderMarkdownReport(result);
      expect(md).toContain("## Suggested first pass");
    });

    it("json summary includes suggestedFirstPass", async () => {
      const result = await scan({ path: EXAMPLE_PATH });
      const parsed = JSON.parse(renderJsonReport(result)) as {
        summary: { suggestedFirstPass: string[] };
      };
      expect(Array.isArray(parsed.summary.suggestedFirstPass)).toBe(true);
      expect(parsed.summary.suggestedFirstPass.length).toBeGreaterThan(0);
      expect(parsed.summary.suggestedFirstPass.length).toBeLessThanOrEqual(4);
    });

    it("dedupes and prioritizes actions from the top findings", () => {
      const actions = suggestedFirstPass([
        makeFinding({ ruleId: "no-llm-cache", severity: "high" }),
        makeFinding({ ruleId: "no-llm-cache", severity: "high", line: 5 }),
        makeFinding({ ruleId: "repeated-embeddings", severity: "high", line: 9 }),
      ]);
      expect(actions).toEqual([
        "Add caching around repeated model calls.",
        "Persist embeddings instead of regenerating unchanged text.",
      ]);
    });
  });

  describe("--max-findings and --summary", () => {
    function ruleLineCount(text: string): number {
      return text
        .split("\n")
        .filter((l) => l.trim().startsWith("Rule: ")).length;
    }

    it("default terminal caps detailed findings at 10", async () => {
      const result = await scan({ path: EXAMPLE_PATH });
      expect(result.summary.totalFindings).toBeGreaterThan(10);
      const text = terminalText(result);
      expect(ruleLineCount(text)).toBe(10);
      expect(text).toContain("more findings. Use --markdown, --json, or --max-findings 0");
    });

    it("--max-findings 0 shows all detailed findings", async () => {
      const result = await scan({ path: EXAMPLE_PATH });
      const text = renderTerminalReport(result, { maxFindings: 0 }).replace(ANSI, "");
      expect(ruleLineCount(text)).toBe(result.summary.totalFindings);
      expect(text).not.toContain("more findings. Use --markdown");
    });

    it("--max-findings 3 caps detailed findings at 3", async () => {
      const result = await scan({ path: EXAMPLE_PATH });
      const text = renderTerminalReport(result, { maxFindings: 3 }).replace(ANSI, "");
      expect(ruleLineCount(text)).toBe(3);
    });

    it("--summary shows the high-level report but no detailed findings", async () => {
      const result = await scan({ path: EXAMPLE_PATH });
      const text = renderTerminalReport(result, { summary: true }).replace(ANSI, "");
      expect(text).toContain("Estimated avoidable compute waste score");
      expect(text).toContain("Findings by waste category");
      expect(text).toContain("Top fix opportunities");
      expect(text).toContain("Suggested first pass");
      expect(text).toContain("does not measure exact emissions");
      expect(ruleLineCount(text)).toBe(0);
      expect(text).not.toContain("Fix recipe:");
    });

    it("markdown and JSON stay fully detailed regardless of the terminal cap", async () => {
      const result = await scan({ path: EXAMPLE_PATH });
      const md = renderMarkdownReport(result);
      const detailBlocks = md.split("\n").filter((l) => l.startsWith("### ")).length;
      expect(detailBlocks).toBe(result.summary.totalFindings);

      const parsed = JSON.parse(renderJsonReport(result)) as {
        findings: unknown[];
      };
      expect(parsed.findings.length).toBe(result.summary.totalFindings);
    });
  });

  describe("terminal noise control", () => {
    it("caps fix recipes at 3 bullets and defers the rest to markdown/JSON", async () => {
      const result = await scan({ path: EXAMPLE_PATH });
      const text = terminalText(result);
      expect(text).toContain("...plus 1 more in markdown/JSON output.");
      // A 4th recipe step should not appear in the terminal output.
      expect(text).not.toContain(
        "Skip caching for highly personalized, sensitive, or rapidly changing outputs.",
      );
    });

    it("markdown keeps the full fix recipe", async () => {
      const result = await scan({ path: EXAMPLE_PATH });
      const md = renderMarkdownReport(result);
      expect(md).toContain(
        "Skip caching for highly personalized, sensitive, or rapidly changing outputs.",
      );
    });

    it("labels multiple same-rule findings in one file", async () => {
      const result = await scan({ path: EXAMPLE_PATH });
      const text = terminalText(result);
      // route.ts has two no-llm-cache findings.
      expect(text).toContain("(2 in this file)");
    });

    it("shows related-finding awareness for multi-finding files", async () => {
      const result = await scan({ path: EXAMPLE_PATH });
      const text = terminalText(result);
      expect(text).toContain("Also flagged in this file:");
    });

    it("caps no-token-limit at 2 per file in the terminal", () => {
      const findings = [
        makeFinding({ line: 1 }),
        makeFinding({ line: 2 }),
        makeFinding({ line: 3 }),
      ];
      const text = terminalText(makeResult(findings));
      // Only two of the three should render as detailed findings; count the
      // per-finding "Rule:" lines rather than substring-matching styled text.
      const shown = text
        .split("\n")
        .filter((line) => line.trim() === "Rule: no-token-limit").length;
      expect(shown).toBe(2);
      expect(text).toContain("...plus 1 more no-token-limit findings in this file.");
    });
  });
});
