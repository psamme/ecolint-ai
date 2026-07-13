import { afterAll, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { readBaseline, writeBaseline } from "../src/baseline.js";
import { findingFingerprint } from "../src/scanner.js";
import type { Finding } from "../src/types.js";

const files: string[] = [];

afterAll(async () => {
  await Promise.all(files.map((file) => fs.rm(file, { force: true })));
});

function finding(): Finding {
  return {
    ruleId: "no-token-limit",
    title: "Missing token limit",
    severity: "low",
    wasteCategory: "unbounded-generation",
    filePath: "src/a.ts",
    line: 12,
    snippet: "await client.responses.create({ input });",
    message: "message",
    recommendation: "fix",
    fixRecipe: ["fix"],
    impact: {
      computeWaste: "medium",
      carbonImpact: "low",
      waterImpact: "low",
      costImpact: "medium",
      confidence: "medium",
      score: 45,
      explanation: "why",
    },
  };
}

describe("baseline", () => {
  it("round-trips stable finding fingerprints", async () => {
    const target = path.join(os.tmpdir(), `trimference-baseline-${Date.now()}.json`);
    files.push(target);
    await writeBaseline(target, [finding(), finding()]);
    expect(await readBaseline(target)).toEqual([findingFingerprint(finding())]);
  });

  it("rejects unsupported baseline shapes", async () => {
    const target = path.join(os.tmpdir(), `trimference-baseline-bad-${Date.now()}.json`);
    files.push(target);
    await fs.writeFile(target, JSON.stringify({ version: 99, fingerprints: [] }));
    await expect(readBaseline(target)).rejects.toThrow(/Invalid baseline/);
  });
});
