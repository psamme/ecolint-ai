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
  const lineStarts = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") lineStarts.push(i + 1);
  }
  const fastLocation = (index: number): { line: number; column: number } => {
    let low = 0;
    let high = lineStarts.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lineStarts[mid]! <= index) low = mid + 1;
      else high = mid - 1;
    }
    const start = lineStarts[Math.max(0, high)]!;
    return { line: high + 1, column: index - start + 1 };
  };
  for (const needle of needles) {
    const regex =
      typeof needle === "string"
        ? new RegExp(escapeRegExp(needle), "gi")
        : ensureGlobal(needle);
    let match: RegExpExecArray | null;
    regex.lastIndex = 0;
    while ((match = regex.exec(content)) !== null) {
      const { line, column } = fastLocation(match.index);
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
 * Return a same-length view of source with comments, quoted strings, template
 * literals, and regex literals replaced by spaces. Newlines are preserved, so
 * indexes and line numbers still map back to the original source.
 *
 * This is intentionally a small lexer rather than a parser. Rules use it only
 * to prove that a call/identifier occurs in executable code; they can still
 * inspect the original source around that proven call for model names and
 * prompt text.
 */
export function codeOnly(content: string): string {
  const out = [...content];
  type State = "code" | "line-comment" | "block-comment" | "single" | "double" | "template" | "regex";
  let state: State = "code";
  let escaped = false;
  let inRegexClass = false;

  const mask = (i: number): void => {
    if (out[i] !== "\n" && out[i] !== "\r") out[i] = " ";
  };
  const previousSignificant = (i: number): string => {
    for (let j = i - 1; j >= 0; j--) {
      if (!/\s/.test(content[j]!)) return content[j]!;
    }
    return "";
  };
  const startsRegex = (i: number): boolean => {
    const prev = previousSignificant(i);
    return prev === "" || "=(:,![{;?".includes(prev);
  };

  for (let i = 0; i < content.length; i++) {
    const c = content[i]!;
    const next = content[i + 1] ?? "";

    if (state === "code") {
      if (c === "#" && (i === 0 || /\s/.test(content[i - 1]!))) {
        mask(i);
        state = "line-comment";
      } else if (c === "/" && next === "/") {
        mask(i);
        mask(i + 1);
        state = "line-comment";
        i++;
      } else if (c === "/" && next === "*") {
        mask(i);
        mask(i + 1);
        state = "block-comment";
        i++;
      } else if (c === "'") {
        mask(i);
        state = "single";
        escaped = false;
      } else if (c === '"') {
        mask(i);
        state = "double";
        escaped = false;
      } else if (c === "`") {
        mask(i);
        state = "template";
        escaped = false;
      } else if (c === "/" && startsRegex(i)) {
        mask(i);
        state = "regex";
        escaped = false;
        inRegexClass = false;
      }
      continue;
    }

    mask(i);
    if (state === "line-comment") {
      if (c === "\n") state = "code";
      continue;
    }
    if (state === "block-comment") {
      if (c === "*" && next === "/") {
        mask(i + 1);
        state = "code";
        i++;
      }
      continue;
    }
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === "\\") {
      escaped = true;
      continue;
    }
    if (state === "single" && c === "'") state = "code";
    else if (state === "double" && c === '"') state = "code";
    else if (state === "template" && c === "`") state = "code";
    else if (state === "regex") {
      if (c === "[") inRegexClass = true;
      else if (c === "]") inRegexClass = false;
      else if (c === "/" && !inRegexClass) {
        while (/[a-z]/i.test(content[i + 1] ?? "")) {
          i++;
          mask(i);
        }
        state = "code";
      }
    }
  }
  return out.join("");
}

/** Find matches that occur in executable code, excluding comments/literals. */
export function findCodeMatches(
  content: string,
  needles: Array<string | RegExp>,
): MatchLocation[] {
  return findMatches(codeOnly(content), needles).map((match) => ({
    ...match,
    matchText: content.slice(match.index, match.index + match.matchText.length),
  }));
}

const CODE_ONLY_CACHE = new WeakMap<SourceFile, string>();

function executableCode(file: SourceFile): string {
  const cached = CODE_ONLY_CACHE.get(file);
  if (cached !== undefined) return cached;
  const masked = codeOnly(file.content);
  CODE_ONLY_CACHE.set(file, masked);
  return masked;
}

/** Cached executable-code matching for rule scans. */
export function findCodeMatchesInFile(
  file: SourceFile,
  needles: Array<string | RegExp>,
): MatchLocation[] {
  return findMatches(executableCode(file), needles).map((match) => ({
    ...match,
    matchText: file.content.slice(
      match.index,
      match.index + match.matchText.length,
    ),
  }));
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

/** Like hasNearby, but ignores terms that occur only in comments/literals. */
export function hasNearbyCode(
  file: SourceFile,
  index: number,
  needles: Array<string | RegExp>,
  windowLines = 20,
): boolean {
  const masked = executableCode(file);
  const executable: SourceFile = {
    ...file,
    content: masked,
    lines: masked.split(/\r?\n/),
  };
  return hasNearby(executable, index, needles, windowLines);
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
 *   // trimference-disable-next-line [ruleId ...]   -> suppress findings on the next line
 *   // trimference-disable-line     [ruleId ...]    -> suppress findings on this line
 *   // trimference-disable          [ruleId ...]    -> start suppression block
 *   // trimference-enable           [ruleId ...]    -> end suppression block
 * With no rule ids listed, the directive applies to all rules.
 */
const DIRECTIVE_RE =
  /(?:trimference|ecolint)-(disable-next-line|disable-line|disable|enable)\b([^\n]*)/i;

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

/** Remove findings suppressed by inline Trimference directives. */
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
  /\bchat\.complete\s*\(/i,
  /\bgenerateContent\s*\(/i,
  /\bmodels\.generate_content\s*\(/i,
  /\binvoke_model\s*\(/i,
  /\b(?:llm|chat_model)\.(?:invoke|ainvoke|stream|astream)\s*\(/i,
];

function escapeRegExp(literal: string): string {
  return literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function ensureGlobal(regex: RegExp): RegExp {
  const flags = regex.flags.includes("g") ? regex.flags : regex.flags + "g";
  return new RegExp(regex.source, flags);
}
