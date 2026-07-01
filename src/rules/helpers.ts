import type {
  Finding,
  ImpactEstimate,
  Severity,
  SourceFile,
  WasteCategory,
} from "../types.js";

export type MatchLocation = {
  index: number;
  line: number;
  column: number;
  matchText: string;
};

/** Convert a string index into a 1-based line and column. */
export function lineNumberForIndex(content: string, index: number): {
  line: number;
  column: number;
} {
  let line = 1;
  let column = 1;
  const bounded = Math.max(0, Math.min(index, content.length));
  for (let i = 0; i < bounded; i++) {
    if (content[i] === "\n") {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

/**
 * Find all matches for any of the given needles (plain strings or RegExp).
 * Plain strings are matched case-insensitively as literals.
 */
export function findMatches(
  content: string,
  needles: Array<string | RegExp>,
): MatchLocation[] {
  const results: MatchLocation[] = [];
  for (const needle of needles) {
    const regex =
      typeof needle === "string"
        ? new RegExp(escapeRegExp(needle), "gi")
        : ensureGlobal(needle);
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      const { line, column } = lineNumberForIndex(content, match.index);
      results.push({
        index: match.index,
        line,
        column,
        matchText: match[0],
      });
      if (match.index === regex.lastIndex) regex.lastIndex++;
    }
  }
  results.sort((a, b) => a.index - b.index);

  // Collapse overlapping matches so that a single call site matched by several
  // patterns (e.g. a literal and a regex) is only counted once.
  const collapsed: MatchLocation[] = [];
  let prevEnd = -1;
  for (const m of results) {
    if (m.index < prevEnd) continue;
    collapsed.push(m);
    prevEnd = m.index + m.matchText.length;
  }
  return collapsed;
}

/**
 * Return the text within `windowLines` lines before and after the line that
 * contains `index`. Used to check for nearby caching / limit / persistence terms.
 */
export function getNearbyText(
  file: SourceFile,
  index: number,
  windowLines = 20,
): string {
  const { line } = lineNumberForIndex(file.content, index);
  const start = Math.max(0, line - 1 - windowLines);
  const end = Math.min(file.lines.length, line - 1 + windowLines + 1);
  return file.lines.slice(start, end).join("\n");
}

/** Case-insensitive check for any needle appearing in text near an index. */
export function hasNearby(
  file: SourceFile,
  index: number,
  needles: Array<string | RegExp>,
  windowLines = 20,
): boolean {
  const nearby = getNearbyText(file, index, windowLines).toLowerCase();
  return needles.some((needle) => {
    if (typeof needle === "string") return nearby.includes(needle.toLowerCase());
    return ensureGlobal(needle).test(nearby);
  });
}

/** Grab a single trimmed line of source for use as a snippet. */
export function snippetForLine(file: SourceFile, line: number): string {
  const raw = file.lines[line - 1] ?? "";
  return raw.trim().slice(0, 200);
}

export function isTestFile(path: string): boolean {
  return /(^|[/\\.])(test|spec|__tests__|__mocks__)([/\\.]|$)/i.test(path);
}

export type CreateFindingArgs = {
  ruleId: string;
  title: string;
  severity: Severity;
  wasteCategory: WasteCategory;
  file: SourceFile;
  index: number;
  message: string;
  recommendation: string;
  fixRecipe: string[];
  impact: ImpactEstimate;
};

/** Build a Finding from a match index, computing line/column/snippet. */
export function createFinding(args: CreateFindingArgs): Finding {
  const { line, column } = lineNumberForIndex(args.file.content, args.index);
  return {
    ruleId: args.ruleId,
    title: args.title,
    severity: args.severity,
    wasteCategory: args.wasteCategory,
    filePath: args.file.path,
    line,
    column,
    snippet: snippetForLine(args.file, line),
    message: args.message,
    recommendation: args.recommendation,
    fixRecipe: args.fixRecipe,
    impact: args.impact,
  };
}

/** Deduplicate findings that share ruleId + filePath + line. */
export function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const out: Finding[] = [];
  for (const f of findings) {
    const key = `${f.ruleId}::${f.filePath}::${f.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/**
 * Inline ignore directives, ESLint-style. Supported in any comment:
 *   // ecolint-disable-next-line [ruleId ...]   -> suppress findings on the next line
 *   // ecolint-disable-line     [ruleId ...]    -> suppress findings on this line
 *   // ecolint-disable          [ruleId ...]    -> start suppression block
 *   // ecolint-enable           [ruleId ...]    -> end suppression block
 * With no rule ids listed, the directive applies to all rules.
 */
const DIRECTIVE_RE =
  /ecolint-(disable-next-line|disable-line|disable|enable)\b([^\n]*)/i;

function parseRuleIds(args: string): string[] {
  return args.match(/[a-z][a-z0-9-]*/gi) ?? [];
}

type SuppressionMaps = {
  /** Lines where every rule is suppressed. */
  allLines: Set<number>;
  /** Line -> specific rule ids suppressed on that line. */
  ruleLines: Map<number, Set<string>>;
};

function addRuleLine(
  maps: SuppressionMaps,
  line: number,
  ruleIds: string[],
): void {
  if (ruleIds.length === 0) {
    maps.allLines.add(line);
    return;
  }
  const set = maps.ruleLines.get(line) ?? new Set<string>();
  for (const id of ruleIds) set.add(id);
  maps.ruleLines.set(line, set);
}

/** Build per-line suppression maps by scanning the file for ignore directives. */
function collectSuppressions(file: SourceFile): SuppressionMaps {
  const maps: SuppressionMaps = { allLines: new Set(), ruleLines: new Map() };
  const totalLines = file.lines.length;

  // Block state, applied from the directive line onward until re-enabled.
  let blockAll = false;
  const blockRules = new Set<string>();

  for (let i = 0; i < totalLines; i++) {
    const lineNo = i + 1; // 1-based
    const match = DIRECTIVE_RE.exec(file.lines[i] ?? "");

    if (match) {
      const kind = match[1]!.toLowerCase();
      const ruleIds = parseRuleIds(match[2] ?? "");
      switch (kind) {
        case "disable-next-line":
          addRuleLine(maps, lineNo + 1, ruleIds);
          break;
        case "disable-line":
          addRuleLine(maps, lineNo, ruleIds);
          break;
        case "disable":
          if (ruleIds.length === 0) blockAll = true;
          else for (const id of ruleIds) blockRules.add(id);
          break;
        case "enable":
          if (ruleIds.length === 0) {
            blockAll = false;
            blockRules.clear();
          } else {
            for (const id of ruleIds) blockRules.delete(id);
          }
          break;
      }
    }

    // Apply any active block suppression to this line.
    if (blockAll) maps.allLines.add(lineNo);
    if (blockRules.size > 0) addRuleLine(maps, lineNo, [...blockRules]);
  }

  return maps;
}

/** Remove findings suppressed by inline ecolint-disable directives. */
export function applyInlineDisables(
  file: SourceFile,
  findings: Finding[],
): Finding[] {
  if (findings.length === 0) return findings;
  const { allLines, ruleLines } = collectSuppressions(file);
  if (allLines.size === 0 && ruleLines.size === 0) return findings;
  return findings.filter(
    (f) => !(allLines.has(f.line) || ruleLines.get(f.line)?.has(f.ruleId)),
  );
}

/** Shared list of patterns that strongly suggest an LLM chat/completion call. */
export const LLM_CALL_PATTERNS: Array<string | RegExp> = [
  "openai.chat.completions.create",
  "openai.responses.create",
  "client.responses.create",
  "anthropic.messages.create",
  "client.messages.create",
  /chat\.completions\.create/i,
  /\bgenerateText\s*\(/i,
  /\bstreamText\s*\(/i,
  /\bmessages\.create\s*\(/i,
  /\bresponses\.create\s*\(/i,
];

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureGlobal(regex: RegExp): RegExp {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return new RegExp(regex.source, flags);
}
