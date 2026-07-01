import OpenAI from "openai";

const openai = new OpenAI();

// WASTEFUL: an agent loop that keeps calling the model and running tools in an
// open-ended loop with no cap on how many rounds it runs or how much it spends.
// A confused run can keep going indefinitely, multiplying model and tool calls.
export async function runAgent(goal: string) {
  const messages: Array<{ role: string; content: string }> = [
    { role: "user", content: goal },
  ];

  while (true) {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as never,
    });

    const message = response.choices[0]?.message;
    const toolCalls = message?.tool_calls;
    if (!toolCalls || toolCalls.length === 0) break;

    for (const call of toolCalls) {
      const result = await executeTool(call);
      messages.push({ role: "tool", content: result });
    }
  }

  return messages;
}

async function executeTool(_call: unknown): Promise<string> {
  return "tool result";
}
