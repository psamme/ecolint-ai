import OpenAI from "openai";

const openai = new OpenAI();

// WASTEFUL: generates images inside a retry loop with no cap, caching, or
// idempotency key. A single failure can trigger many expensive generations.
export async function generateThumbnails(prompts: string[]) {
  const urls: string[] = [];

  for (const prompt of prompts) {
    let attempt = 0;
    while (attempt < 5) {
      try {
        const image = await openai.images.generate({
          model: "dall-e-3",
          prompt,
          n: 1,
        });
        urls.push(image.data[0]!.url!);
        break;
      } catch {
        attempt++;
      }
    }
  }

  return urls;
}
