import { describe, it, expect } from "vitest";
import { ecoLLM } from "../src/ecoLLM.js";

describe("ecoLLM", () => {
  it("recommends a small tier for small classification tasks", () => {
    const rec = ecoLLM({ taskType: "classification", inputSize: "small" });
    expect(rec.recommendedModelTier).toBe("small");
    expect(rec.shouldCache).toBe(true);
    expect(rec.notes.length).toBeGreaterThan(0);
  });

  it("keeps extraction on a small or medium tier", () => {
    const small = ecoLLM({ taskType: "extraction", inputSize: "small" });
    const large = ecoLLM({ taskType: "extraction", inputSize: "large" });
    expect(small.recommendedModelTier).toBe("small");
    expect(large.recommendedModelTier).toBe("medium");
  });

  it("recommends the large tier for reasoning with large input", () => {
    const rec = ecoLLM({ taskType: "reasoning", inputSize: "large" });
    expect(rec.recommendedModelTier).toBe("large");
  });

  it("recommends caching/persistence for embeddings", () => {
    const rec = ecoLLM({ taskType: "embedding", inputSize: "medium" });
    expect(rec.shouldCache).toBe(true);
    expect(rec.recommendedModelTier).toBe("small");
    expect(rec.notes.some((n) => /persist|existing vector/i.test(n))).toBe(true);
  });

  it("ecoMode prefers a smaller tier and enables caching", () => {
    const normal = ecoLLM({ taskType: "generation", inputSize: "medium" });
    const eco = ecoLLM({ taskType: "generation", inputSize: "medium", ecoMode: true });
    expect(eco.shouldCache).toBe(true);
    // generation defaults to "medium"; eco mode should downshift to "small".
    expect(eco.recommendedModelTier).toBe("small");
    expect(normal.recommendedModelTier).toBe("medium");
  });

  it("returns a sensible max token recommendation", () => {
    const rec = ecoLLM({ taskType: "classification", inputSize: "small" });
    expect(rec.maxTokenRecommendation).toBeGreaterThan(0);
  });

  it("suggests concrete provider models when a provider is given", () => {
    const rec = ecoLLM({
      provider: "openai",
      taskType: "classification",
      inputSize: "small",
      ecoMode: true,
    });
    expect(rec.recommendedModelTier).toBe("small");
    expect(rec.suggestedModels).toEqual(["gpt-4o-mini", "gpt-4.1-mini"]);
  });

  it("omits suggestedModels when no provider is given", () => {
    const rec = ecoLLM({ taskType: "classification", inputSize: "small" });
    expect(rec.suggestedModels).toBeUndefined();
  });

  it("suggests anthropic models for the recommended tier", () => {
    const rec = ecoLLM({
      provider: "anthropic",
      taskType: "reasoning",
      inputSize: "large",
    });
    expect(rec.recommendedModelTier).toBe("large");
    expect(rec.suggestedModels).toEqual(["claude-opus"]);
  });
});
