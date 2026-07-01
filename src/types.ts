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
  "model-overkill": "Model overkill",
  "redundant-embedding": "Redundant embedding",
  "unbounded-generation": "Unbounded generation",
  "background-compute-drift": "Background compute drift",
  "multimodal-cost-explosion": "Multimodal cost explosion",
};

export type ImpactEstimate = {
  computeWaste: Level;
  carbonImpact: Level;
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
  totalFindings: number;
  high: number;
  medium: number;
  low: number;
  averageImpactScore: number;
  /** Overall "Estimated avoidable compute waste score" from 0 to 100. */
  overallImpactScore: number;
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
