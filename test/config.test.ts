import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig } from "../src/config.js";
import { scan } from "../src/scanner.js";

const execFileAsync = promisify(execFile);
const repoRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)), "..");

const WASTEFUL = `
  const a = await openai.chat.completions.create({ model: "gpt-4o", messages: user.messages });
`;

async function makeProject(config?: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ecolint-cfg-"));
  await fs.mkdir(path.join(dir, "lib"), { recursive: true });
  await fs.writeFile(path.join(dir, "lib", "a.ts"), WASTEFUL);
  await fs.writeFile(path.join(dir, "lib", "vendor-thing.ts"), WASTEFUL);
  if (config) {
    await fs.writeFile(path.join(dir, "ecolint.config.json"), config);
  }
  return dir;
}

describe("config loading", () => {
  const dirs: string[] = [];
  afterAll(async () => {
    await Promise.all(dirs.map((d) => fs.rm(d, { recursive: true, force: true })));
  });

  it("returns an empty object when no config file exists", async () => {
    const dir = await makeProject();
    dirs.push(dir);
    expect(await loadConfig(dir)).toEqual({});
  });

  it("loads and parses a config file", async () => {
    const dir = await makeProject(
      JSON.stringify({
        minSeverity: "high",
        ignoredRules: ["no-token-limit"],
        provider: "openai",
      }),
    );
    dirs.push(dir);
    const config = await loadConfig(dir);
    expect(config.minSeverity).toBe("high");
    expect(config.ignoredRules).toEqual(["no-token-limit"]);
    expect(config.provider).toBe("openai");
  });

  it("throws a clear error on invalid config", async () => {
    const dir = await makeProject(JSON.stringify({ minSeverity: "nonsense" }));
    dirs.push(dir);
    await expect(loadConfig(dir)).rejects.toThrow(/minSeverity/);
  });

  it("ignoredRules removes those rules from scan output", async () => {
    const dir = await makeProject();
    dirs.push(dir);
    const withRule = await scan({ path: dir });
    const withoutRule = await scan({ path: dir, ignoredRules: ["no-llm-cache"] });
    expect(withRule.findings.some((f) => f.ruleId === "no-llm-cache")).toBe(true);
    expect(withoutRule.findings.some((f) => f.ruleId === "no-llm-cache")).toBe(false);
  });

  it("ignoredPaths skips matching files", async () => {
    const dir = await makeProject();
    dirs.push(dir);
    const all = await scan({ path: dir });
    const filtered = await scan({ path: dir, ignoredPaths: ["vendor-thing"] });
    expect(all.summary.filesScanned).toBe(2);
    expect(filtered.summary.filesScanned).toBe(1);
    expect(filtered.findings.every((f) => !f.filePath.includes("vendor-thing"))).toBe(
      true,
    );
  });
});

describe("CLI flags override config", () => {
  const dirs: string[] = [];
  afterAll(async () => {
    await Promise.all(dirs.map((d) => fs.rm(d, { recursive: true, force: true })));
  });

  async function runCli(cwd: string, args: string[]): Promise<string> {
    const { stdout } = await execFileAsync(
      "npx",
      ["tsx", path.join(repoRoot, "src", "cli.ts"), ...args],
      { cwd },
    );
    return stdout;
  }

  it("--min-severity low overrides a config that sets high", async () => {
    // Config would suppress low/medium findings; the flag should re-enable them.
    const dir = await makeProject(JSON.stringify({ minSeverity: "high" }));
    dirs.push(dir);

    const configured = await runCli(dir, ["scan", "--path", ".", "--json"]);
    const overridden = await runCli(dir, [
      "scan",
      "--path",
      ".",
      "--json",
      "--min-severity",
      "low",
    ]);

    const configuredFindings = JSON.parse(configured).findings.length as number;
    const overriddenFindings = JSON.parse(overridden).findings.length as number;
    expect(overriddenFindings).toBeGreaterThan(configuredFindings);
  }, 30000);
});
