# cleaner-ai-app (example)

This example shows the same kinds of features as `wasteful-ai-app`, but written
with EcoLint AI's recommendations applied.

Scan it:

```bash
node dist/cli.js scan --path examples/cleaner-ai-app
```

## What's different

- **Caching:** requests check `getCached` / a `Map` cache before calling the model.
- **Bounded context:** only the last few messages are sent, not full history.
- **Right-sized models:** `gpt-4o-mini` (small tier) for simple tasks.
- **Token limits:** `max_tokens` is set on model calls.
- **Embedding reuse:** `embedIfMissing` checks a `vectorStore` before embedding.

You should see **far fewer findings** here than in `wasteful-ai-app`. Because
EcoLint AI is heuristic, a small number of low-severity findings may still
appear — that is expected and reflects the tool being directional, not exact.
