/**
 * A lightweight, CONFIGURABLE heuristic map of provider model tiers.
 *
 * These lists are intentionally illustrative, not authoritative — providers
 * release and rename models constantly. Trimference uses this only to make
 * suggestions more concrete ("consider gpt-4o-mini"), never to make hard claims.
 */
export type Provider = "openai" | "anthropic" | "google" | "mistral" | "unknown";

export type ModelTier = "small" | "medium" | "large";

export type ProviderModels = Record<ModelTier, string[]>;

export const MODEL_MAP: Record<Exclude<Provider, "unknown">, ProviderModels> = {
  openai: {
    small: ["gpt-4o-mini", "gpt-4.1-mini"],
    medium: ["gpt-4.1", "gpt-4o"],
    large: ["o3", "o4-mini-high"],
  },
  anthropic: {
    small: ["claude-3-5-haiku", "claude-3-haiku"],
    medium: ["claude-3-5-sonnet", "claude-sonnet"],
    large: ["claude-opus"],
  },
  google: {
    small: ["gemini-flash", "gemini-1.5-flash", "gemini-2.0-flash"],
    medium: ["gemini-pro"],
    large: ["gemini-ultra"],
  },
  mistral: {
    small: ["ministral", "mistral-small"],
    medium: ["mistral-medium"],
    large: ["mistral-large"],
  },
};

/** Guess the provider from a model slug. Returns "unknown" if unclear. */
export function detectProvider(model: string): Provider {
  const m = model.toLowerCase();
  if (/(^|[^a-z])(gpt-|o1|o3|o4|text-embedding-|dall-e|davinci)/.test(m)) {
    return "openai";
  }
  if (m.includes("claude")) return "anthropic";
  if (m.includes("gemini") || m.includes("palm")) return "google";
  if (m.includes("mistral") || m.includes("ministral")) return "mistral";
  return "unknown";
}

/** Classify a model slug into a tier using the map, or null if not found. */
export function classifyModelTier(model: string): ModelTier | null {
  const m = model.toLowerCase();
  for (const provider of Object.values(MODEL_MAP)) {
    for (const tier of ["small", "medium", "large"] as ModelTier[]) {
      if (provider[tier].some((name) => m.includes(name.toLowerCase()))) {
        return tier;
      }
    }
  }
  return null;
}

/**
 * Suggest smaller-tier example models for a provider. Falls back to a generic
 * suggestion when the provider is unknown.
 */
export function suggestSmallerModels(provider: Provider): string[] {
  if (provider === "unknown") return [];
  return MODEL_MAP[provider].small;
}
