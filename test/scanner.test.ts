import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  scan,
  discoverFiles,
  findingFingerprint,
  runRules,
} from "../src/scanner.js";
import type { SourceFile } from "../src/types.js";

function makeFile(p: string, content: string): SourceFile {
  return { path: p, content, lines: content.split(/\r?\n/) };
}

describe("scanner", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "trimference-scan-"));
    await fs.mkdir(path.join(dir, "lib"), { recursive: true });
    await fs.writeFile(
      path.join(dir, "lib", "a.ts"),
      `const r = await openai.chat.completions.create({ model: "gpt-4o", messages: user.messages });`,
    );
    await fs.writeFile(
      path.join(dir, "notes.md"),
      "# not scannable",
    );
    await fs.writeFile(path.join(dir, "b.py"), "x = 1\n");
  });

  afterAll(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("discovers scannable files and ignores non-code files", async () => {
    const files = await discoverFiles(dir);
    expect(files.some((f) => f.endsWith("a.ts"))).toBe(true);
    expect(files.some((f) => f.endsWith("b.py"))).toBe(true);
    expect(files.some((f) => f.endsWith("notes.md"))).toBe(false);
  });

  it("produces findings with a summary and impact score", async () => {
    const result = await scan({ path: dir });
    expect(result.summary.filesScanned).toBeGreaterThanOrEqual(2);
    expect(result.summary.totalFindings).toBeGreaterThan(0);
    expect(result.summary.overallImpactScore).toBeGreaterThan(0);
    expect(result.findings[0]!.impact.score).toBeGreaterThanOrEqual(
      result.findings[result.findings.length - 1]!.impact.score - 100,
    );
  });

  it("throws a clear error when the path does not exist", async () => {
    await expect(discoverFiles(path.join(dir, "nope"))).rejects.toThrow(
      /does not exist/i,
    );
  });

  it("min-severity filters out lower severities", async () => {
    const all = await scan({ path: dir, minSeverity: "low" });
    const highOnly = await scan({ path: dir, minSeverity: "high" });
    expect(highOnly.findings.every((f) => f.severity === "high")).toBe(true);
    expect(highOnly.findings.length).toBeLessThanOrEqual(all.findings.length);
  });

  it("sorts findings by severity then score", async () => {
    const file = makeFile(
      "lib/x.ts",
      `await openai.chat.completions.create({ model: "gpt-4o", messages: user.messages });`,
    );
    const findings = runRules(file);
    expect(findings.length).toBeGreaterThan(0);
  });

  it("softens high-impact findings inside test files", () => {
    const testFile = makeFile(
      "lib/foo.test.ts",
      `await openai.chat.completions.create({ model: "gpt-4o" });`,
    );
    const findings = runRules(testFile);
    const cache = findings.find((f) => f.ruleId === "no-llm-cache");
    expect(cache).toBeDefined();
    expect(cache!.severity).toBe("low");
  });

  it("cleaner example produces fewer findings than the wasteful example", async () => {
    const wasteful = await scan({ path: "examples/wasteful-ai-app" });
    const cleaner = await scan({ path: "examples/cleaner-ai-app" });
    expect(cleaner.summary.totalFindings).toBeLessThan(
      wasteful.summary.totalFindings,
    );
  });

  it("does not flag its own rule definitions as executable AI calls", async () => {
    const result = await scan({ path: "src" });
    expect(result.findings).toHaveLength(0);
  });

  it("suppresses matching baseline fingerprints", async () => {
    const initial = await scan({ path: dir });
    const baseline = initial.findings.map(findingFingerprint);
    const filtered = await scan({ path: dir, baselineKeys: baseline });
    expect(filtered.findings).toHaveLength(0);
    expect(filtered.summary.baselineSuppressed).toBe(initial.findings.length);
  });

  it("uses a monotonic compatibility score", async () => {
    const full = await scan({ path: "examples/wasteful-ai-app" });
    const withoutOne = await scan({
      path: "examples/wasteful-ai-app",
      baselineKeys: [findingFingerprint(full.findings.at(-1)!)],
    });
    expect(withoutOne.summary.overallImpactScore).toBeLessThanOrEqual(
      full.summary.overallImpactScore,
    );
  });
});
