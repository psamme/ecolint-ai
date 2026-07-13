#!/usr/bin/env node
import { promises as fs, readFileSync } from "node:fs";
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import pc from "picocolors";
import { readBaseline, writeBaseline } from "./baseline.js";
import { SEVERITY_WEIGHT } from "./impact.js";
import { CONFIG_FILENAME, SAMPLE_CONFIG, loadConfig } from "./config.js";
import { scan } from "./scanner.js";
import {
  renderTerminalReport,
  type TerminalReportOptions,
} from "./reporters/terminalReporter.js";
import { renderJsonReport } from "./reporters/jsonReporter.js";
import { renderSarifReport } from "./reporters/sarifReporter.js";
import { renderMarkdownReport } from "./reporters/markdownReporter.js";
import type { Provider } from "./models.js";
import type { ScanResult, Severity } from "./types.js";

/** Read the package version so `--version` always matches package.json. */
function readVersion(): string {
  try {
    const pkgPath = fileURLToPath(new URL("../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { version?: string };
    return pkg.version ?? "0.0.0";
  } catch {
    return "0.0.0";
  }
}

const VALID_SEVERITIES: Severity[] = ["low", "medium", "high"];
const VALID_PROVIDERS: Provider[] = [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "unknown",
];

type ScanCliOptions = {
  path: string;
  json?: boolean;
  markdown?: boolean;
  sarif?: boolean;
  output?: string;
  minSeverity?: string;
  provider?: string;
  maxFindings?: string;
  summary?: boolean;
  baseline?: string;
  writeBaseline?: string;
  failOn?: string;
  changedSince?: string;
};

const execFileAsync = promisify(execFile);

function parseMaxFindings(value: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(
      `Invalid --max-findings "${value}". Expected a non-negative integer (0 = show all).`,
    );
  }
  return n;
}

function parseSeverity(value: string): Severity {
  const lower = value.toLowerCase();
  if (!VALID_SEVERITIES.includes(lower as Severity)) {
    throw new Error(
      `Invalid --min-severity "${value}". Expected one of: ${VALID_SEVERITIES.join(", ")}.`,
    );
  }
  return lower as Severity;
}

function parseFailOn(value: string): Severity | "none" {
  if (value.toLowerCase() === "none") return "none";
  return parseSeverity(value);
}

function parseProvider(value: string): Provider {
  const lower = value.toLowerCase();
  if (!VALID_PROVIDERS.includes(lower as Provider)) {
    throw new Error(
      `Invalid --provider "${value}". Expected one of: ${VALID_PROVIDERS.join(", ")}.`,
    );
  }
  return lower as Provider;
}

type Format = "terminal" | "json" | "markdown" | "sarif";

function renderFor(
  format: Format,
  result: ScanResult,
  terminalOptions: TerminalReportOptions = {},
): string {
  switch (format) {
    case "json":
      return renderJsonReport(result);
    case "markdown":
      return renderMarkdownReport(result);
    case "sarif":
      return renderSarifReport(result);
    case "terminal":
      return renderTerminalReport(result, terminalOptions);
  }
}

async function runScan(options: ScanCliOptions): Promise<void> {
  const targetPath = options.path ?? ".";

  // Fail clearly if the path does not exist.
  const stat = await fs.stat(path.resolve(targetPath)).catch(() => null);
  if (!stat) {
    console.error(pc.red(`Error: path does not exist: ${targetPath}`));
    process.exitCode = 1;
    return;
  }

  // Load optional config; CLI flags take precedence over config values.
  const config = await loadConfig(targetPath);
  const minSeverity = options.minSeverity
    ? parseSeverity(options.minSeverity)
    : config.minSeverity ?? "low";
  const provider = options.provider
    ? parseProvider(options.provider)
    : config.provider;
  const failOn = parseFailOn(options.failOn ?? config.failOn ?? "none");
  const baselineSetting = options.writeBaseline
    ? undefined
    : options.baseline ?? config.baseline;
  const baselinePath = baselineSetting
    ? path.resolve(stat.isDirectory() ? targetPath : path.dirname(targetPath), baselineSetting)
    : undefined;
  const baselineKeys = baselinePath ? await readBaseline(baselinePath) : undefined;
  const includedPaths = options.changedSince
    ? await changedPaths(targetPath, stat.isDirectory(), options.changedSince)
    : undefined;

  const result = await scan({
    path: targetPath,
    minSeverity,
    provider,
    ignoredRules: config.ignoredRules,
    ignoredPaths: config.ignoredPaths,
    baselineKeys,
    includedPaths,
  });

  if (result.summary.filesScanned === 0) {
    console.error(
      pc.yellow(
        options.changedSince
          ? `No changed scannable files found since "${options.changedSince}" under "${targetPath}".`
          : `No scannable files found under "${targetPath}". Supported: .ts, .tsx, .js, .jsx, .mjs, .cjs, .py`,
      ),
    );
    // Not an error exit — just nothing to do.
    return;
  }

  if (options.writeBaseline) {
    const target = path.resolve(
      stat.isDirectory() ? targetPath : path.dirname(targetPath),
      options.writeBaseline,
    );
    await writeBaseline(target, result.findings);
    console.log(
      pc.green(
        `Trimference: wrote baseline to ${target} (${result.findings.length} findings).`,
      ),
    );
    return;
  }

  const format: Format = options.json
    ? "json"
    : options.sarif
      ? "sarif"
    : options.markdown
      ? "markdown"
      : "terminal";

  // When writing to a file, default to markdown unless json is explicitly set.
  // File reports (markdown/JSON) always include every finding.
  if (options.output) {
    const fileFormat: Format = options.json
      ? "json"
      : options.sarif
        ? "sarif"
        : "markdown";
    const content = renderFor(fileFormat, result);
    await fs.writeFile(options.output, content, "utf8");
    console.log(
      pc.green(
        `Trimference: wrote ${fileFormat} report to ${options.output} ` +
          `(${result.summary.totalFindings} findings).`,
      ),
    );
    setFailureExitCode(result, failOn);
    return;
  }

  const terminalOptions: TerminalReportOptions = {
    summary: options.summary,
    maxFindings: options.maxFindings
      ? parseMaxFindings(options.maxFindings)
      : undefined,
  };

  console.log(renderFor(format, result, terminalOptions));
  setFailureExitCode(result, failOn);
}

async function changedPaths(
  targetPath: string,
  targetIsDirectory: boolean,
  reference: string,
): Promise<string[]> {
  const absoluteTarget = path.resolve(targetPath);
  const gitCwd = targetIsDirectory ? absoluteTarget : path.dirname(absoluteTarget);
  try {
    const { stdout: rootOutput } = await execFileAsync(
      "git",
      ["-C", gitCwd, "rev-parse", "--show-toplevel"],
      { encoding: "utf8" },
    );
    const repoRoot = rootOutput.trim();
    const { stdout } = await execFileAsync(
      "git",
      [
        "-C",
        repoRoot,
        "diff",
        "--name-only",
        "--diff-filter=ACMR",
        `${reference}...HEAD`,
        "--",
      ],
      { encoding: "utf8" },
    );
    const targetRoot = targetIsDirectory ? absoluteTarget : path.dirname(absoluteTarget);
    return stdout
      .split(/\r?\n/)
      .filter(Boolean)
      .map((relative) => path.resolve(repoRoot, relative))
      .filter((absolute) =>
        targetIsDirectory
          ? !path.relative(targetRoot, absolute).startsWith("..")
          : absolute === absoluteTarget,
      )
      .map((absolute) => path.relative(targetRoot, absolute).split(path.sep).join("/"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not determine files changed since "${reference}". ` +
        `Ensure the Git reference is available locally. ${message}`,
    );
  }
}

function setFailureExitCode(
  result: ScanResult,
  failOn: Severity | "none",
): void {
  if (failOn === "none") return;
  if (result.findings.some((finding) =>
    SEVERITY_WEIGHT[finding.severity] >= SEVERITY_WEIGHT[failOn]
  )) {
    process.exitCode = 2;
  }
}

async function runInit(): Promise<void> {
  const target = path.resolve(CONFIG_FILENAME);
  const exists = await fs
    .stat(target)
    .then(() => true)
    .catch(() => false);
  if (exists) {
    console.error(pc.yellow(`Config already exists at ${target}. Not overwriting.`));
    return;
  }
  await fs.writeFile(target, SAMPLE_CONFIG, "utf8");
  console.log(pc.green(`Created ${target}`));
}

async function main(): Promise<void> {
  const program = new Command();

  program
    .name("trimference")
    .description("Review LLM application code for missing efficiency safeguards.")
    .version(readVersion());

  program
    .command("scan")
    .description("Review a codebase for missing AI efficiency safeguards")
    .option("-p, --path <path>", "Path to scan", ".")
    .option("--json", "Output findings as JSON")
    .option("--markdown", "Output findings as Markdown")
    .option("--sarif", "Output SARIF 2.1.0 for code scanning")
    .option("-o, --output <file>", "Write the report to a file")
    .option(
      "--min-severity <level>",
      "Minimum severity to report (low | medium | high). Overrides config.",
    )
    .option(
      "--provider <name>",
      "Provider hint for model suggestions (openai | anthropic | google | mistral). Overrides config.",
    )
    .option(
      "--max-findings <number>",
      "Max detailed findings to show in the terminal (0 = show all). Default 8.",
    )
    .option("--summary", "Show only the high-level summary (no detailed findings).")
    .option(
      "--baseline <file>",
      "Hide findings recorded in a baseline file (path is relative to --path).",
    )
    .option(
      "--write-baseline <file>",
      "Write current findings to a baseline file relative to --path, then exit.",
    )
    .option(
      "--fail-on <level>",
      "Exit 2 when findings meet this severity (none | low | medium | high).",
    )
    .option(
      "--changed-since <git-ref>",
      "Scan only files changed since a local Git reference.",
    )
    .action(async (opts: ScanCliOptions) => {
      await runScan(opts);
    });

  program
    .command("init")
    .description(`Create a sample ${CONFIG_FILENAME} config file`)
    .action(async () => {
      await runInit();
    });

  await program.parseAsync(process.argv);
}

main().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(pc.red(`Trimference error: ${message}`));
  process.exitCode = 1;
});
