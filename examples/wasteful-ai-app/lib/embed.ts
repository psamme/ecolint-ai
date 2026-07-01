import OpenAI from "openai";

const openai = new OpenAI();

// WASTEFUL: re-embeds every document on every call with no persistence or
// existence check. Unchanged text is embedded again and again inside a loop.
export async function indexDocuments(documents: string[]) {
  const vectors: number[][] = [];

  for (const doc of documents) {
    const result = await openai.embeddings.create({
      model: "text-embedding-3-large",
      input: doc,
    });
    vectors.push(result.data[0]!.embedding);
  }

  return vectors;
}
