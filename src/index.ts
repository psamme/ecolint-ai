export type {
  Finding,
  ImpactEstimate,
  Rule,
  ScanOptions,
  ScanResult,
  ScanSummary,
  Severity,
  Level,
  SourceFile,
  WasteCategory,
} from "./types.js";
export { WASTE_CATEGORY_LABEL } from "./types.js";

export {
  scan,
  runRules,
  discoverFiles,
  sortFindings,
  findingFingerprint,
} from "./scanner.js";
export {
  BASELINE_VERSION,
  readBaseline,
  writeBaseline,
  type TrimferenceBaseline,
  type EcoLintBaseline,
} from "./baseline.js";
export { rules } from "./rules/index.js";
export {
  trimInference,
  ecoLLM,
  type TrimInferenceInput,
  type TrimInferenceRecommendation,
  type TrimInferenceTaskType,
  type TrimInferenceInputSize,
  type EcoLLMInput,
  type EcoLLMRecommendation,
  type EcoLLMTaskType,
  type EcoLLMInputSize,
} from "./ecoLLM.js";

export { renderTerminalReport } from "./reporters/terminalReporter.js";
export { renderJsonReport } from "./reporters/jsonReporter.js";
export { renderSarifReport } from "./reporters/sarifReporter.js";
export { renderMarkdownReport } from "./reporters/markdownReporter.js";

export {
  TRIMFERENCE_COMMENT_MARKER,
  ECOLINT_COMMENT_MARKER,
  MAX_COMMENT_LENGTH,
  buildCommentBody,
  type CommentBodyOptions,
} from "./prComment.js";

export {
  IMPACT_DISCLAIMER,
  impactLine,
  operationalImpactLine,
  makeImpact,
} from "./impact.js";
export {
  DEFAULT_CONFIG,
  SCANNABLE_EXTENSIONS,
  CONFIG_FILENAME,
  LEGACY_CONFIG_FILENAME,
  loadConfig,
  type TrimferenceFileConfig,
  type EcoLintFileConfig,
} from "./config.js";
export {
  MODEL_MAP,
  detectProvider,
  classifyModelTier,
  suggestSmallerModels,
  type Provider,
  type ModelTier,
} from "./models.js";
export type { RuleContext } from "./types.js";
