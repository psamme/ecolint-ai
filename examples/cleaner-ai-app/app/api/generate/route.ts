import OpenAI from "openai";
import { getCached, setCached } from "../../../lib/cachedGenerate";

const openai = new OpenAI();

// A tiny per-user rate limit stands in for Upstash/Redis in this example.
const hits = new Map<string, number>();
function rateLimit(userId: string, max = 20): boolean {
  const count = (hits.get(userId) ?? 0) + 1;
  hits.set(userId, count);
  return count <= max;
}

// CLEANER: rate-limits per user, caches by a stable key, sends only the last
// few messages, uses a smaller model for a simple task, and caps output tokens.
export async function POST(req: Request) {
  const { user } = await req.json();

  // Reject abusive callers before doing any model work.
  if (!rateLimit(user.id)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

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
