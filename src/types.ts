export type Severity = "low" | "medium" | "high";
export type Level = "low" | "medium" | "high";

export type WasteCategory =
  | "repeated-inference"
  | "token-bloat"
  | "model-overkill"
  | "redundant-embedding"
  | "unbounded-generation"
  | "background-compute-drift"
  | "multimodal-cost-explosion";

/** Human-readable labels for waste categories, used in reports. */
export const WASTE_CATEGORY_LABEL: Record<WasteCategory, string> = {
  "repeated-inference": "Repeated inference",
  "token-bloat": "Token bloat",
  "model-overkill": "Model right-sizing",
  "redundant-embedding": "Redundant embedding",
  "unbounded-generation": "Unbounded generation",
  "background-compute-drift": "Frequent background work",
  "multimodal-cost-explosion": "Repeated image generation",
};

export type ImpactEstimate = {
  computeWaste: Level;
  /** @deprecated Experimental legacy field; not shown in human reports. */
  carbonImpact: Level;
  /** @deprecated Experimental legacy field; not shown in human reports. */
  waterImpact: Level;
  costImpact: Level;
  confidence: Level;
  /** Directional impact score from 1 to 100. Higher means more potential avoidable waste. */
  score: number;
  explanation: string;
};

export type Finding = {
  ruleId: string;
  title: string;
  severity: Severity;
  wasteCategory: WasteCategory;
  filePath: string;
  line: number;
  column?: number;
  snippet?: string;
  message: string;
  recommendation: string;
  /** Concrete remediation checklist. Not an automatic code patch. */
  fixRecipe: string[];
  impact: ImpactEstimate;
};

export type SourceFile = {
  path: string;
  content: string;
  lines: string[];
};

/** Optional context passed to rules, e.g. a configured provider fallback. */
export type RuleContext = {
  provider?: import("./models.js").Provider;
};

export type Rule = {
  id: string;
  title: string;
  severity: Severity;
  wasteCategory: WasteCategory;
  description: string;
  recommendation: string;
  fixRecipe: string[];
  scan: (file: SourceFile, context?: RuleContext) => Finding[];
};

export type ScanSummary = {
  filesScanned: number;
  durationMs: number;
  totalFindings: number;
  high: number;
  medium: number;
  low: number;
  averageImpactScore: number;
  /**
   * @deprecated Retained for API compatibility. This is a monotonic heuristic
   * priority index, not measured impact, and is not shown in human reports.
   */
  overallImpactScore: number;
  /** Monotonic weighted finding total: high=3, medium=2, low=1. */
  priorityPoints: number;
  /** Findings hidden because they matched a supplied baseline. */
  baselineSuppressed: number;
  /** Rule failures encountered while scanning; empty during normal operation. */
  ruleErrors: Array<{ ruleId: string; filePath: string; message: string }>;
  topFindings: Finding[];
  findingsByRule: Record<string, number>;
  findingsByFile: Record<string, number>;
  /** Counts keyed by WasteCategory, only for categories that appear. */
  findingsByCategory: Partial<Record<WasteCategory, number>>;
  /** The waste category with the most findings, or null when there are none. */
  topCategory: WasteCategory | null;
  /** Plain-English review-style actions derived from the top findings. */
  suggestedFirstPass: string[];
};

export type ScanResult = {
  summary: ScanSummary;
  findings: Finding[];
};

export type ScanOptions = {
  path: string;
  minSeverity?: Severity;
};
