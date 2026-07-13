# wasteful-ai-app (example)

This is an **intentionally wasteful** AI app used to demonstrate Trimference.
None of this code is meant to be copied — it exists to trip the rules.

Scan it:

```bash
npm run scan:example
# or
node dist/cli.js scan --path examples/wasteful-ai-app
```

## What Trimference should flag here

| File | Pattern | Rule |
|---|---|---|
| `app/api/generate/route.ts` | Uncached LLM call | `no-llm-cache` |
| `app/api/generate/route.ts` | `messages: user.messages` (full history) | `huge-context` |
| `app/api/generate/route.ts` | No `max_tokens` on the call | `no-token-limit` |
| `app/api/generate/route.ts` | Two model calls in one flow | `sequential-llm-calls` |
| `app/api/generate/route.ts` | Public route calling a model with no rate limit | `missing-rate-limit` |
| `lib/agent.ts` | `while (true)` agent loop with no step/time/token/cost budget | `agent-loop-without-budget` |
| `lib/classify.ts` | `gpt-4o` used for sentiment classification | `expensive-model-simple-task` |
| `lib/embed.ts` | Embeddings generated in a loop, no persistence | `repeated-embeddings` |
| `lib/image.ts` | Image generation inside a retry loop | `image-generation-loop` |
| `lib/cron.ts` | `* * * * *` cron + 5s `setInterval` | `frequent-cron` |

These are **directional** heuristic findings, not measured emissions.
