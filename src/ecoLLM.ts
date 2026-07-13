import { MODEL_MAP, type Provider } from "./models.js";

export type EcoLLMTaskType =
  | "classification"
  | "extraction"
  | "generation"
  | "reasoning"
  | "embedding";

export type EcoLLMInputSize = "small" | "medium" | "large";

export type EcoLLMInput = {
  taskType: EcoLLMTaskType;
  inputSize: EcoLLMInputSize;
  latencySensitive?: boolean;
  trimMode?: boolean;
  /** @deprecated Use trimMode. */
  ecoMode?: boolean;
  provider?: Provider;
};

export type EcoLLMRecommendation = {
  recommendedModelTier: "small" | "medium" | "large";
  shouldCache: boolean;
  maxTokenRecommendation: number;
  notes: string[];
  /** Example model names for the recommended tier, when a provider is given. */
  suggestedModels?: string[];
};

export type TrimInferenceTaskType = EcoLLMTaskType;
export type TrimInferenceInputSize = EcoLLMInputSize;
export type TrimInferenceInput = EcoLLMInput;
export type TrimInferenceRecommendation = EcoLLMRecommendation;

type Tier = "small" | "medium" | "large";

const TIER_ORDER: Tier[] = ["small", "medium", "large"];

function downshift(tier: Tier): Tier {
  const i = TIER_ORDER.indexOf(tier);
  return TIER_ORDER[Math.max(0, i - 1)]!;
}

/**
 * A local, offline advisor. It makes NO network calls and holds no provider
 * secrets — it just maps a task shape to a directional recommendation.
 * @deprecated Use trimInference.
 */
export function ecoLLM(input: EcoLLMInput): EcoLLMRecommendation {
  const {
    taskType,
    inputSize,
    latencySensitive = false,
    ecoMode = false,
    trimMode = ecoMode,
    provider = "unknown",
  } = input;
  const notes: string[] = [];

  let tier: Tier;
  let shouldCache = false;
  let maxTokenRecommendation: number;

  switch (taskType) {
    case "classification":
    case "extraction": {
      // Structured tasks rarely need a top-tier model.
      tier = inputSize === "large" ? "medium" : "small";
      shouldCache = true;
      maxTokenRecommendation = 256;
      notes.push(
        `${taskType} is usually well served by a small or medium model tier.`,
      );
      notes.push(
        "Cache results for repeated or deterministic inputs to avoid re-running inference.",
      );
      break;
    }
    case "reasoning": {
      // Reasoning scales with input; large input warrants the large tier.
      tier = inputSize === "large" ? "large" : "medium";
      shouldCache = false;
      maxTokenRecommendation = inputSize === "large" ? 2048 : 1024;
      notes.push(
        "Reasoning tasks benefit from more capable tiers, especially with large inputs.",
      );
      notes.push(
        "Break multi-step reasoning into cacheable sub-steps where possible.",
      );
      break;
    }
    case "generation": {
      tier = "medium";
      shouldCache = true;
      maxTokenRecommendation = 1024;
      notes.push(
        "Set an output token cap that matches the expected response length.",
      );
      notes.push("Cache deterministic or templated generations.");
      break;
    }
    case "embedding": {
      tier = "small";
      shouldCache = true;
      maxTokenRecommendation = 0; // embeddings do not produce output tokens
      notes.push(
        "Embeddings should be persisted; check for an existing vector before re-embedding unchanged text.",
      );
      notes.push("Batch embedding requests to reduce per-call overhead.");
      break;
    }
    default: {
      // Exhaustiveness guard.
      const _never: never = taskType;
      throw new Error(`Unknown task type: ${String(_never)}`);
    }
  }

  if (latencySensitive) {
    const before = tier;
    tier = downshift(tier);
    if (tier !== before) {
      notes.push(
        "Latency-sensitive: preferring a smaller/faster tier to reduce response time.",
      );
    } else {
      notes.push("Latency-sensitive: consider streaming and a tight token cap.");
    }
  }

  if (trimMode) {
    const before = tier;
    tier = downshift(tier);
    shouldCache = true;
    if (tier !== before) {
      notes.push(
        "Trim mode: chose a smaller model tier to reduce compute and cost.",
      );
    } else {
      notes.push(
        "Trim mode: already at the smallest sensible tier; caching is enabled.",
      );
    }
  }

  let suggestedModels: string[] | undefined;
  if (provider !== "unknown") {
    suggestedModels = MODEL_MAP[provider][tier];
    notes.push(
      `${provider} models at the ${tier} tier include: ${suggestedModels.join(", ")} (examples, verify quality).`,
    );
  }

  return {
    recommendedModelTier: tier,
    shouldCache,
    maxTokenRecommendation,
    notes,
    ...(suggestedModels ? { suggestedModels } : {}),
  };
}

/** Preferred Trimference name for the local model-tier advisor. */
export function trimInference(
  input: TrimInferenceInput,
): TrimInferenceRecommendation {
  return ecoLLM(input);
}
