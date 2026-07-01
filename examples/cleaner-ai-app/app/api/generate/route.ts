import OpenAI from "openai";
import { getCached, setCached } from "../../../lib/cachedGenerate";

const openai = new OpenAI();

// CLEANER: caches by a stable key, sends only the last few messages, uses a
// smaller model for a simple task, and caps output tokens.
export async function POST(req: Request) {
  const { user } = await req.json();

  const cacheKey = JSON.stringify(user.recentMessages);
  const cached = await getCached(cacheKey);
  if (cached) {
    return Response.json({ text: cached });
  }

  // Only the last few messages are sent — bounded context.
  const recent = user.recentMessages.slice(-6);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 512,
    messages: recent,
  });

  const text = response.choices[0]?.message?.content ?? "";
  await setCached(cacheKey, text);

  return Response.json({ text });
}
