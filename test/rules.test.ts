import { describe, it, expect } from "vitest";
import type { Finding, SourceFile } from "../src/types.js";
import { noLlmCacheRule } from "../src/rules/noLlmCache.js";
import { hugeContextRule } from "../src/rules/hugeContext.js";
import { expensiveModelSimpleTaskRule } from "../src/rules/expensiveModelSimpleTask.js";
import { repeatedEmbeddingsRule } from "../src/rules/repeatedEmbeddings.js";
import { imageGenerationLoopRule } from "../src/rules/imageGenerationLoop.js";
import { frequentCronRule } from "../src/rules/frequentCron.js";
import { noTokenLimitRule } from "../src/rules/noTokenLimit.js";
import { sequentialLlmCallsRule } from "../src/rules/sequentialLlmCalls.js";

function file(content: string, p = "sample.ts"): SourceFile {
  return { path: p, content, lines: content.split(/\r?\n/) };
}

function ids(findings: Finding[]): string[] {
  return findings.map((f) => f.ruleId);
}

describe("no-llm-cache", () => {
  it("flags an uncached LLM call", () => {
    const f = noLlmCacheRule.scan(
      file(`const r = await openai.chat.completions.create({ model: "gpt-4o" });`),
    );
    expect(f.length).toBe(1);
    expect(f[0]!.severity).toBe("high");
    expect(f[0]!.impact.score).toBe(85);
  });

  it("does not flag when caching terms are nearby", () => {
    const src = `
      const cached = await redis.get(key);
      if (cached) return cached;
      const r = await openai.chat.completions.create({ model: "gpt-4o" });
      await redis.set(key, r);
    `;
    expect(noLlmCacheRule.scan(file(src))).toHaveLength(0);
  });

  it("downgrades severity in test files", () => {
    const f = noLlmCacheRule.scan(
      file(`await openai.chat.completions.create({});`, "foo.test.ts"),
    );
    expect(f[0]!.severity).toBe("low");
  });
});

describe("huge-context", () => {
  it("flags full conversation history passed to messages", () => {
    const f = hugeContextRule.scan(
      file(`await client.messages.create({ messages: conversationHistory });`),
    );
    expect(f.length).toBeGreaterThan(0);
    expect(f[0]!.ruleId).toBe("huge-context");
  });

  it("flags messages: user.messages", () => {
    const f = hugeContextRule.scan(file(`{ messages: user.messages }`));
    expect(f.length).toBe(1);
  });
});

describe("expensive-model-simple-task", () => {
  it("flags a large model near a classification task", () => {
    const src = `
      // classify sentiment of the message
      const r = await openai.chat.completions.create({ model: "gpt-4o" });
    `;
    const f = expensiveModelSimpleTaskRule.scan(file(src));
    expect(f.length).toBeGreaterThan(0);
    expect(f[0]!.impact.score).toBe(65);
  });

  it("does not flag a large model with no simple-task words", () => {
    const src = `const r = await openai.chat.completions.create({ model: "gpt-4o" });`;
    expect(expensiveModelSimpleTaskRule.scan(file(src))).toHaveLength(0);
  });

  it("does not flag already right-sized models like gpt-4o-mini", () => {
    const src = `
      // classify sentiment of the message
      const r = await openai.chat.completions.create({ model: "gpt-4o-mini" });
    `;
    expect(expensiveModelSimpleTaskRule.scan(file(src))).toHaveLength(0);
  });

  it("names the detected model and suggests smaller models for a known provider", () => {
    const src = `
      // classify sentiment
      const r = await openai.chat.completions.create({ model: "gpt-4o" });
    `;
    const [finding] = expensiveModelSimpleTaskRule.scan(file(src));
    expect(finding!.message).toContain("Detected model: gpt-4o");
    expect(finding!.message).toContain("classification");
    expect(finding!.message).toContain("gpt-4o-mini");
  });

  it("uses the configured provider fallback when the model provider is unclear", () => {
    // "sonnet" alone doesn't reveal the provider from the slug; config supplies it.
    const src = `
      // classify sentiment
      const model = "sonnet";
      await client.messages.create({ model });
    `;
    const [finding] = expensiveModelSimpleTaskRule.scan(file(src), {
      provider: "anthropic",
    });
    expect(finding!.message).toContain("claude-3-5-haiku");
  });
});

describe("repeated-embeddings", () => {
  it("flags embeddings created inside a loop without persistence", () => {
    const src = `
      for (const doc of docs) {
        const v = await openai.embeddings.create({ input: doc });
      }
    `;
    const f = repeatedEmbeddingsRule.scan(file(src));
    expect(f.length).toBe(1);
    expect(f[0]!.impact.score).toBe(80);
  });

  it("does not flag embeddings with a persistence check nearby", () => {
    const src = `
      for (const doc of docs) {
        const existing = await vectorStore.findFirst(doc.id);
        if (!existing) await openai.embeddings.create({ input: doc.text });
      }
    `;
    expect(repeatedEmbeddingsRule.scan(file(src))).toHaveLength(0);
  });
});

describe("image-generation-loop", () => {
  it("flags image generation inside a retry loop", () => {
    const src = `
      let attempt = 0;
      while (attempt < 3) {
        const img = await openai.images.generate({ prompt });
      }
    `;
    const f = imageGenerationLoopRule.scan(file(src));
    expect(f.length).toBe(1);
    expect(f[0]!.impact.score).toBe(90);
  });

  it("does not flag a single image generation with no loop/retry", () => {
    const src = `const img = await openai.images.generate({ prompt });`;
    expect(imageGenerationLoopRule.scan(file(src))).toHaveLength(0);
  });
});

describe("frequent-cron", () => {
  it("flags an every-minute cron expression", () => {
    const f = frequentCronRule.scan(file(`export const schedule = "* * * * *";`));
    expect(f.length).toBe(1);
    expect(f[0]!.ruleId).toBe("frequent-cron");
  });

  it("flags a short setInterval", () => {
    const f = frequentCronRule.scan(file(`setInterval(check, 5000);`));
    expect(f.length).toBe(1);
  });
});

describe("no-token-limit", () => {
  it("flags an LLM call with no token limit", () => {
    const f = noTokenLimitRule.scan(
      file(`await openai.chat.completions.create({ model: "gpt-4o" });`),
    );
    expect(f.length).toBe(1);
    expect(f[0]!.impact.score).toBe(45);
  });

  it("does not flag when max_tokens is present", () => {
    const src = `await openai.chat.completions.create({ model: "gpt-4o", max_tokens: 100 });`;
    expect(noTokenLimitRule.scan(file(src))).toHaveLength(0);
  });

  it("does not flag files without any LLM call", () => {
    expect(noTokenLimitRule.scan(file(`const x = 1;`))).toHaveLength(0);
  });

  it("reports at most one finding per file", () => {
    const src = `
      await openai.chat.completions.create({ model: "gpt-4o" });
      await anthropic.messages.create({ model: "claude-opus" });
    `;
    expect(noTokenLimitRule.scan(file(src))).toHaveLength(1);
  });
});

describe("sequential-llm-calls", () => {
  it("flags two LLM calls in the same flow", () => {
    const src = `
      const a = await openai.chat.completions.create({});
      const b = await openai.chat.completions.create({});
    `;
    const f = sequentialLlmCallsRule.scan(file(src));
    expect(f.length).toBe(1);
    expect(f[0]!.impact.score).toBe(70);
  });

  it("does not flag a single LLM call", () => {
    const src = `const a = await openai.chat.completions.create({});`;
    expect(sequentialLlmCallsRule.scan(file(src))).toHaveLength(0);
  });
});

const ALL_RULES = [
  noLlmCacheRule,
  hugeContextRule,
  expensiveModelSimpleTaskRule,
  repeatedEmbeddingsRule,
  imageGenerationLoopRule,
  frequentCronRule,
  noTokenLimitRule,
  sequentialLlmCallsRule,
];

describe("rule wiring", () => {
  it("all rules expose the expected shape", () => {
    for (const rule of ALL_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.title).toBeTruthy();
      expect(rule.wasteCategory).toBeTruthy();
      expect(rule.fixRecipe.length).toBeGreaterThan(0);
      expect(typeof rule.scan).toBe("function");
    }
  });

  it("findings carry stable rule ids", () => {
    const src = `for (const d of docs) { await openai.embeddings.create({ input: d }); }`;
    expect(ids(repeatedEmbeddingsRule.scan(file(src)))).toContain(
      "repeated-embeddings",
    );
  });

  it("every finding has a waste category and a non-empty fix recipe", () => {
    const samples: Array<[(typeof ALL_RULES)[number], string]> = [
      [noLlmCacheRule, `await openai.chat.completions.create({ model: "gpt-4o" });`],
      [hugeContextRule, `{ messages: conversationHistory }`],
      [
        expensiveModelSimpleTaskRule,
        `// classify sentiment\nawait openai.chat.completions.create({ model: "gpt-4o" });`,
      ],
      [
        repeatedEmbeddingsRule,
        `for (const d of docs) { await openai.embeddings.create({ input: d }); }`,
      ],
      [
        imageGenerationLoopRule,
        `while (n < 3) { await openai.images.generate({ prompt }); }`,
      ],
      [frequentCronRule, `const schedule = "* * * * *";`],
      [noTokenLimitRule, `await openai.chat.completions.create({ model: "gpt-4o" });`],
      [
        sequentialLlmCallsRule,
        `await openai.chat.completions.create({});\nawait openai.chat.completions.create({});`,
      ],
    ];

    for (const [rule, src] of samples) {
      const findings = rule.scan(file(src));
      expect(findings.length).toBeGreaterThan(0);
      for (const f of findings) {
        expect(f.wasteCategory).toBeTruthy();
        expect(Array.isArray(f.fixRecipe)).toBe(true);
        expect(f.fixRecipe.length).toBeGreaterThan(0);
        expect(f.fixRecipe.every((s) => s.trim().length > 0)).toBe(true);
      }
    }
  });

  it("maps rules to the expected waste categories", () => {
    expect(noLlmCacheRule.wasteCategory).toBe("repeated-inference");
    expect(hugeContextRule.wasteCategory).toBe("token-bloat");
    expect(expensiveModelSimpleTaskRule.wasteCategory).toBe("model-overkill");
    expect(repeatedEmbeddingsRule.wasteCategory).toBe("redundant-embedding");
    expect(imageGenerationLoopRule.wasteCategory).toBe("multimodal-cost-explosion");
    expect(frequentCronRule.wasteCategory).toBe("background-compute-drift");
    expect(noTokenLimitRule.wasteCategory).toBe("unbounded-generation");
    expect(sequentialLlmCallsRule.wasteCategory).toBe("repeated-inference");
  });
});
