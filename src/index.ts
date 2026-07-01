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

export { scan, runRules, discoverFiles, sortFindings } from "./scanner.js";
export { rules } from "./rules/index.js";
export {
  ecoLLM,
  type EcoLLMInput,
  type EcoLLMRecommendation,
  type EcoLLMTaskType,
  type EcoLLMInputSize,
} from "./ecoLLM.js";

export { renderTerminalReport } from "./reporters/terminalReporter.js";
export { renderJsonReport } from "./reporters/jsonReporter.js";
export { renderMarkdownReport } from "./reporters/markdownReporter.js";

export { IMPACT_DISCLAIMER, impactLine, makeImpact } from "./impact.js";
export {
  DEFAULT_CONFIG,
  SCANNABLE_EXTENSIONS,
  CONFIG_FILENAME,
  loadConfig,
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
