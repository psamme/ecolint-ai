import { promises as fs } from "node:fs";
import path from "node:path";
import fg from "fast-glob";
import { IGNORE_GLOBS, SCANNABLE_EXTENSIONS } from "./config.js";
import { SEVERITY_WEIGHT, suggestedFirstPass } from "./impact.js";
import type { Provider } from "./models.js";
import { rules } from "./rules/index.js";
import { applyInlineDisables, dedupeFindings, isTestFile } from "./rules/helpers.js";
import type {
  Finding,
  RuleContext,
  ScanResult,
  ScanSummary,
  Severity,
  SourceFile,
  WasteCategory,
} from "./types.js";

export type ScannerOptions = {
  path: string;
  minSeverity?: Severity;
  ignoredRules?: string[];
  ignoredPaths?: string[];
  provider?: Provider;
};

/** High-impact rules whose findings should be softened inside test files. */
const HIGH_IMPACT_RULE_IDS = new Set([
  "no-llm-cache",
  "repeated-embeddings",
  "image-generation-loop",
]);

/** Discover scannable files under a directory (or a single file). */
export async function discoverFiles(rootPath: string): Promise<string[]> {
  const stat = await fs.stat(rootPath).catch(() => null);
  if (!stat) {
    throw new Error(`Path does not exist: ${rootPath}`);
  }

  if (stat.isFile()) {
    return isScannable(rootPath) ? [path.resolve(rootPath)] : [];
  }

  const extGroup = SCANNABLE_EXTENSIONS.map((e) => e.replace(/^\./, "")).join(",");
  const pattern = `**/*.{${extGroup}}`;

  const entries = await fg(pattern, {
    cwd: rootPath,
    ignore: IGNORE_GLOBS,
    absolute: true,
    dot: false,
    followSymbolicLinks: false,
  });
  return entries.sort();
}

function isScannable(filePath: string): boolean {
  return SCANNABLE_EXTENSIONS.includes(path.extname(filePath).toLowerCase());
}

async function readSourceFile(
  absPath: string,
  rootPath: string,
): Promise<SourceFile> {
  const content = await fs.readFile(absPath, "utf8");
  // Prefer paths relative to the scanned root for readable reports.
  const rel = path.relative(rootPath, absPath) || path.basename(absPath);
  return {
    path: normalizePath(rel),
    content,
    lines: content.split(/\r?\n/),
  };
}

function normalizePath(p: string): string {
  return p.split(path.sep).join("/");
}

/** Run all rules against a single in-memory source file. */
export function runRules(
  file: SourceFile,
  context?: RuleContext,
  ignoredRules?: Set<string>,
): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    if (ignoredRules?.has(rule.id)) continue;
    try {
      findings.push(...rule.scan(file, context));
    } catch {
      // A misbehaving rule should never crash the whole scan.
    }
  }
  // Soften high-impact findings inside test/spec files to keep reports credible.
  const controlled = isTestFile(file.path)
    ? findings.map(softenIfHighImpactTest)
    : findings;
  // Honor inline `// ecolint-disable...` directives before deduping.
  return dedupeFindings(applyInlineDisables(file, controlled));
}

function softenIfHighImpactTest(finding: Finding): Finding {
  if (finding.severity !== "high" || !HIGH_IMPACT_RULE_IDS.has(finding.ruleId)) {
    return finding;
  }
  return {
    ...finding,
    severity: "low",
    impact: {
      ...finding.impact,
      score: Math.min(finding.impact.score, 30),
      confidence: "low",
    },
  };
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const sev = SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity];
    if (sev !== 0) return sev;
    const score = b.impact.score - a.impact.score;
    if (score !== 0) return score;
    if (a.filePath !== b.filePath) return a.filePath < b.filePath ? -1 : 1;
    return a.line - b.line;
  });
}

function meetsMinSeverity(severity: Severity, min: Severity): boolean {
  return SEVERITY_WEIGHT[severity] >= SEVERITY_WEIGHT[min];
}

function buildSummary(
  filesScanned: number,
  findings: Finding[],
): ScanSummary {
  const high = findings.filter((f) => f.severity === "high").length;
  const medium = findings.filter((f) => f.severity === "medium").length;
  const low = findings.filter((f) => f.severity === "low").length;

  const averageImpactScore =
    findings.length === 0
      ? 0
      : Math.round(
          findings.reduce((sum, f) => sum + f.impact.score, 0) / findings.length,
        );

  const findingsByRule: Record<string, number> = {};
  const findingsByFile: Record<string, number> = {};
  const findingsByCategory: Partial<Record<WasteCategory, number>> = {};
  for (const f of findings) {
    findingsByRule[f.ruleId] = (findingsByRule[f.ruleId] ?? 0) + 1;
    findingsByFile[f.filePath] = (findingsByFile[f.filePath] ?? 0) + 1;
    findingsByCategory[f.wasteCategory] =
      (findingsByCategory[f.wasteCategory] ?? 0) + 1;
  }

  const topCategory = pickTopCategory(findingsByCategory);

  return {
    filesScanned,
    totalFindings: findings.length,
    high,
    medium,
    low,
    averageImpactScore,
    overallImpactScore: averageImpactScore,
    topFindings: findings.slice(0, 3),
    findingsByRule,
    findingsByFile,
    findingsByCategory,
    topCategory,
    suggestedFirstPass: suggestedFirstPass(findings),
  };
}

function pickTopCategory(
  counts: Partial<Record<WasteCategory, number>>,
): WasteCategory | null {
  let top: WasteCategory | null = null;
  let best = -1;
  for (const [category, count] of Object.entries(counts) as Array<
    [WasteCategory, number]
  >) {
    if (count > best) {
      best = count;
      top = category;
    }
  }
  return top;
}

/** Scan a path and return sorted findings plus a summary. */
export async function scan(options: ScannerOptions): Promise<ScanResult> {
  const rootPath = path.resolve(options.path);
  const minSeverity = options.minSeverity ?? "low";
  const ignoredRules = new Set(options.ignoredRules ?? []);
  const ignoredPaths = options.ignoredPaths ?? [];
  const context: RuleContext = { provider: options.provider };

  const files = await discoverFiles(rootPath);

  let allFindings: Finding[] = [];
  let scannedCount = 0;
  for (const absPath of files) {
    const file = await readSourceFile(absPath, rootPath);
    if (isIgnoredPath(file.path, ignoredPaths)) continue;
    scannedCount++;
    allFindings.push(...runRules(file, context, ignoredRules));
  }

  allFindings = allFindings.filter((f) =>
    meetsMinSeverity(f.severity, minSeverity),
  );
  const sorted = sortFindings(allFindings);

  return {
    summary: buildSummary(scannedCount, sorted),
    findings: sorted,
  };
}

/** Match a relative path against simple substring / glob-ish ignore entries. */
function isIgnoredPath(relPath: string, ignoredPaths: string[]): boolean {
  if (ignoredPaths.length === 0) return false;
  return ignoredPaths.some((entry) => {
    const needle = entry.replace(/\*+/g, "").replace(/^\.\//, "");
    return needle.length > 0 && relPath.includes(needle);
  });
}
