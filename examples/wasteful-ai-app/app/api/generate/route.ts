import OpenAI from "openai";

const openai = new OpenAI();

// WASTEFUL: no caching around this LLM call, full conversation history sent in,
// no output token limit, and two sequential model calls in one request flow.
export async function POST(req: Request) {
  const { user } = await req.json();

  // Sends the entire conversation history with no summarization or trimming.
  const draft = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: user.messages,
  });

  const content = draft.choices[0]?.message?.content ?? "";

  // A second, sequential call in the same flow — could be combined/batched.
  const polished = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Polish the following text." },
      { role: "user", content: content },
    ],
  });

  return Response.json({ text: polished.choices[0]?.message?.content });
}
