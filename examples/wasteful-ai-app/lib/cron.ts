// WASTEFUL: runs every single minute regardless of whether there is work to do,
// and also polls on a 5-second setInterval.
import OpenAI from "openai";

const openai = new OpenAI();

// Vercel / node-cron style schedule string.
export const schedule = "* * * * *"; // every minute

export function startPolling() {
  // Fires every 5 seconds, all day, even when idle.
  setInterval(async () => {
    await openai.responses.create({
      model: "gpt-4o",
      input: "Check whether there is maintenance work to do",
    });
  }, 5000);
}
