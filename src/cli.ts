#!/usr/bin/env node
import { promises as fs } from "node:fs";
import path from "node:path";
import { Command } from "commander";
import pc from "picocolors";
import { CONFIG_FILENAME, SAMPLE_CONFIG, loadConfig } from "./config.js";
import { scan } from "./scanner.js";
import { renderTerminalReport } from "./reporters/terminalReporter.js";
import { renderJsonReport } from "./reporters/jsonReporter.js";
import { renderMarkdownReport } from "./reporters/markdownReporter.js";
import type { Provider } from "./models.js";
import type { ScanResult, Severity } from "./types.js";

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
  output?: string;
  minSeverity?: string;
  provider?: string;
};

function parseSeverity(value: string): Severity {
  const lower = value.toLowerCase();
  if (!VALID_SEVERITIES.includes(lower as Severity)) {
    throw new Error(
      `Invalid --min-severity "${value}". Expected one of: ${VALID_SEVERITIES.join(", ")}.`,
    );
  }
  return lower as Severity;
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

type Format = "terminal" | "json" | "markdown";

function renderFor(format: Format, result: ScanResult): string {
  switch (format) {
    case "json":
      return renderJsonReport(result);
    case "markdown":
      return renderMarkdownReport(result);
    case "terminal":
      return renderTerminalReport(result);
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

  const result = await scan({
    path: targetPath,
    minSeverity,
    provider,
    ignoredRules: config.ignoredRules,
    ignoredPaths: config.ignoredPaths,
  });

  if (result.summary.filesScanned === 0) {
    console.error(
      pc.yellow(
        `No scannable files found under "${targetPath}". Supported: .ts, .tsx, .js, .jsx, .mjs, .cjs, .py`,
      ),
    );
    // Not an error exit — just nothing to do.
    return;
  }

  const format: Format = options.json
    ? "json"
    : options.markdown
      ? "markdown"
      : "terminal";

  // When writing to a file, default to markdown unless json is explicitly set.
  if (options.output) {
    const fileFormat: Format = options.json ? "json" : "markdown";
    const content = renderFor(fileFormat, result);
    await fs.writeFile(options.output, content, "utf8");
    console.log(
      pc.green(
        `EcoLint AI: wrote ${fileFormat} report to ${options.output} ` +
          `(${result.summary.totalFindings} findings, score ${result.summary.overallImpactScore}/100).`,
      ),
    );
    return;
  }

  console.log(renderFor(format, result));
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
    .name("ecolint-ai")
    .description("ESLint for wasteful AI compute. Scan for avoidable AI compute waste.")
    .version("0.1.0");

  program
    .command("scan")
    .description("Scan a codebase for avoidable AI compute waste")
    .option("-p, --path <path>", "Path to scan", ".")
    .option("--json", "Output findings as JSON")
    .option("--markdown", "Output findings as Markdown")
    .option("-o, --output <file>", "Write the report to a file")
    .option(
      "--min-severity <level>",
      "Minimum severity to report (low | medium | high). Overrides config.",
    )
    .option(
      "--provider <name>",
      "Provider hint for model suggestions (openai | anthropic | google | mistral). Overrides config.",
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
  console.error(pc.red(`EcoLint AI error: ${message}`));
  process.exitCode = 1;
});
