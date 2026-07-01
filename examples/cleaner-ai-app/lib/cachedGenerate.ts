import OpenAI from "openai";

const openai = new OpenAI();

// A tiny in-memory cache stands in for Redis/KV in this example.
const cache = new Map<string, string>();

export async function getCached(key: string): Promise<string | undefined> {
  return cache.get(key);
}

export async function setCached(key: string, value: string): Promise<void> {
  cache.set(key, value);
}

// CLEANER: checks the cache first, caps output tokens, and uses a small model
// for a simple extraction task.
export async function extractTitle(text: string): Promise<string> {
  const key = `title:${text}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 32,
    messages: [
      { role: "system", content: "Extract a short title." },
      { role: "user", content: text },
    ],
  });

  const title = response.choices[0]?.message?.content?.trim() ?? "";
  cache.set(key, title);
  return title;
}

// CLEANER: persists embeddings and checks for an existing vector before
// re-embedding unchanged text.
export async function embedIfMissing(
  id: string,
  text: string,
  vectorStore: Map<string, number[]>,
): Promise<number[]> {
  const existing = vectorStore.get(id);
  if (existing) return existing;

  const result = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  const vector = result.data[0]!.embedding;
  vectorStore.set(id, vector); // upsert into the vector store
  return vector;
}
