# Accuracy benchmark

Trimference is a heuristic review tool. This benchmark is intentionally modest and
reproducible; it does not claim real-world precision from curated examples.

## Launch acceptance checks

```bash
npm run verify
```

The command requires:

1. TypeScript compilation succeeds.
2. All positive and negative rule fixtures pass.
3. The scanner's own `src/` directory produces zero findings.
4. The cleaner example produces zero findings.

The intentionally wasteful example must continue to exercise every safeguard
category. Its exact finding count is not treated as an accuracy metric.

## What the fixtures cover

- Executable calls versus comments, strings, and regex definitions
- Cached and uncached calls
- Bounded and unbounded context/output
- Persisted and repeated embeddings
- Image generation inside and outside loops
- AI and non-AI scheduled work
- Budgeted and unbudgeted agent loops
- Rate-limited and unprotected public routes
- Common JavaScript/TypeScript and selected Python call shapes

## Next benchmark milestone

Before describing Trimference as low-noise or publishing a precision percentage,
build an anonymized corpus of representative repositories and label every call
site manually. Report per-rule precision and recall, corpus selection, scanner
version, and all exclusions.
