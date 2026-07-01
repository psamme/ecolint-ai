import OpenAI from "openai";

const openai = new OpenAI();

// WASTEFUL: uses a top-tier model for a trivial sentiment classification task.
// A small model (or even rules) would likely be enough here.
export async function classifySentiment(text: string) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Classify the sentiment as positive, negative, or neutral.",
      },
      { role: "user", content: text },
    ],
  });

  // Simple classification / label extraction.
  const label = response.choices[0]?.message?.content?.trim();
  return label;
}
