import type { Rule } from "../types.js";
import { noLlmCacheRule } from "./noLlmCache.js";
import { hugeContextRule } from "./hugeContext.js";
import { expensiveModelSimpleTaskRule } from "./expensiveModelSimpleTask.js";
import { repeatedEmbeddingsRule } from "./repeatedEmbeddings.js";
import { imageGenerationLoopRule } from "./imageGenerationLoop.js";
import { frequentCronRule } from "./frequentCron.js";
import { noTokenLimitRule } from "./noTokenLimit.js";
import { sequentialLlmCallsRule } from "./sequentialLlmCalls.js";

export const rules: Rule[] = [
  noLlmCacheRule,
  hugeContextRule,
  expensiveModelSimpleTaskRule,
  repeatedEmbeddingsRule,
  imageGenerationLoopRule,
  frequentCronRule,
  noTokenLimitRule,
  sequentialLlmCallsRule,
];

export {
  noLlmCacheRule,
  hugeContextRule,
  expensiveModelSimpleTaskRule,
  repeatedEmbeddingsRule,
  imageGenerationLoopRule,
  frequentCronRule,
  noTokenLimitRule,
  sequentialLlmCallsRule,
};
