import { describe, it, expect } from "vitest";
import { applyInlineDisables } from "../src/rules/helpers.js";
import { runRules } from "../src/scanner.js";
import type { Finding, SourceFile } from "../src/types.js";

function file(content: string, p = "sample.ts"): SourceFile {
  return { path: p, content, lines: content.split(/\r?\n/) };
}

function finding(ruleId: string, line: number): Finding {
  return {
    ruleId,
    title: ruleId,
    severity: "high",
    wasteCategory: "repeated-inference",
    filePath: "sample.ts",
    line,
    message: "m",
    recommendation: "r",
    fixRecipe: ["one"],
    impact: {
      computeWaste: "high",
      carbonImpact: "medium",
      waterImpact: "medium",
      costImpact: "high",
      confidence: "medium",
      score: 80,
      explanation: "why",
    },
  };
}

describe("applyInlineDisables", () => {
  it("disable-next-line suppresses only the named rule on the following line", () => {
    const src = [
      "// ecolint-disable-next-line no-llm-cache",
      "const a = 1;", // line 2 -> no-llm-cache suppressed
      "const b = 2;", // line 3 -> nothing suppressed
    ].join("\n");
    const findings = [
      finding("no-llm-cache", 2),
      finding("no-token-limit", 2), // different rule, not suppressed
      finding("no-llm-cache", 3), // different line, not suppressed
    ];
    const kept = applyInlineDisables(file(src), findings);
    expect(kept.map((f) => `${f.ruleId}:${f.line}`)).toEqual([
      "no-token-limit:2",
      "no-llm-cache:3",
    ]);
  });

  it("disable-next-line with no rule id suppresses all rules on the next line", () => {
    const src = ["// ecolint-disable-next-line", "call();"].join("\n");
    const kept = applyInlineDisables(file(src), [
      finding("no-llm-cache", 2),
      finding("huge-context", 2),
    ]);
    expect(kept).toHaveLength(0);
  });

  it("disable-line suppresses findings on the same line", () => {
    const src = "const a = call(); // ecolint-disable-line no-llm-cache";
    const kept = applyInlineDisables(file(src), [finding("no-llm-cache", 1)]);
    expect(kept).toHaveLength(0);
  });

  it("disable/enable blocks suppress a named rule across a range", () => {
    const src = [
      "// ecolint-disable no-llm-cache", // line 1
      "a();", // 2 suppressed
      "b();", // 3 suppressed
      "// ecolint-enable no-llm-cache", // line 4
      "c();", // 5 not suppressed
    ].join("\n");
    const findings = [
      finding("no-llm-cache", 2),
      finding("no-llm-cache", 3),
      finding("no-token-limit", 3), // other rule stays
      finding("no-llm-cache", 5),
    ];
    const kept = applyInlineDisables(file(src), findings);
    expect(kept.map((f) => `${f.ruleId}:${f.line}`)).toEqual([
      "no-token-limit:3",
      "no-llm-cache:5",
    ]);
  });

  it("returns findings unchanged when there are no directives", () => {
    const findings = [finding("no-llm-cache", 1)];
    expect(applyInlineDisables(file("const a = 1;"), findings)).toBe(findings);
  });
});

describe("inline disables end-to-end via runRules", () => {
  it("suppresses a real finding on the next line", () => {
    const src = [
      "const a = { messages: conversationHistory };", // huge-context fires
      "// ecolint-disable-next-line huge-context",
      "const b = { messages: fullConversation };", // suppressed
    ].join("\n");
    const findings = runRules(file(src));
    const hc = findings.filter((f) => f.ruleId === "huge-context");
    expect(hc).toHaveLength(1);
    expect(hc[0]!.line).toBe(1);
  });
});
