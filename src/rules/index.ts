import type { Rule } from "../types.js";
import { noLlmCacheRule } from "./noLlmCache.js";
import { hugeContextRule } from "./hugeContext.js";
import { expensiveModelSimpleTaskRule } from "./expensiveModelSimpleTask.js";
import { repeatedEmbeddingsRule } from "./repeatedEmbeddings.js";
import { imageGenerationLoopRule } from "./imageGenerationLoop.js";
import { frequentCronRule } from "./frequentCron.js";
import { noTokenLimitRule } from "./noTokenLimit.js";
import { sequentialLlmCallsRule } from "./sequentialLlmCalls.js";
import { agentLoopWithoutBudgetRule } from "./agentLoopWithoutBudget.js";
import { missingRateLimitRule } from "./missingRateLimit.js";

export const rules: Rule[] = [
  noLlmCacheRule,
  hugeContextRule,
  expensiveModelSimpleTaskRule,
  repeatedEmbeddingsRule,
  imageGenerationLoopRule,
  frequentCronRule,
  noTokenLimitRule,
  sequentialLlmCallsRule,
  agentLoopWithoutBudgetRule,
  missingRateLimitRule,
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
  agentLoopWithoutBudgetRule,
  missingRateLimitRule,
};
