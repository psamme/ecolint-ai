# EcoLint AI — Demo

**EcoLint AI is ESLint for wasteful AI compute.**

It statically scans AI app codebases for patterns like uncached LLM calls, token
bloat, repeated embeddings, model overkill, missing token limits, and unbudgeted
agent loops — before they turn into API bills, latency, or unnecessary compute.

> EcoLint AI uses static heuristics and directional impact estimates. It does
> not measure exact emissions, water usage, or infrastructure-level energy
> consumption.

---

## 1. Quickest try (npx)

```bash
npx ecolint-ai scan --path .
```

No install, no API keys, no network calls — it just reads your source.

## 2. 20-second copy/paste demo

```bash
mkdir ecolint-demo && cd ecolint-demo
cat > bad.ts <<'EOF'
import OpenAI from "openai";

const openai = new OpenAI();

export async function classify(text: string) {
  return openai.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: `classify this: ${text}` }]
  });
}
EOF

npx ecolint-ai scan --path .
```

You'll see an uncached LLM call, a top-tier model used for classification, and a
missing output token limit — each with a fix recipe.

## 3. Scan the intentionally wasteful example

```bash
npm run scan:example
# equivalent to:
node dist/cli.js scan --path examples/wasteful-ai-app
```

Expect a dozen-plus findings across the waste categories, an "Estimated
avoidable compute waste score", a category breakdown, and top fix opportunities.

## 4. Scan the cleaner example

```bash
node dist/cli.js scan --path examples/cleaner-ai-app
```

Same features written with caching, bounded context, right-sized models, token
limits, embedding reuse, and a rate limit — it should scan **clean**.

## 5. Summary mode (high-level only)

```bash
node dist/cli.js scan --path examples/wasteful-ai-app --summary
```

Shows files scanned, total findings, the waste score, category breakdown, top
fix opportunities, and a suggested first pass — without the detailed findings.

## 6. Markdown report

```bash
node dist/cli.js scan --path examples/wasteful-ai-app --markdown --output ecolint-report.md
```

Markdown and JSON reports always include **every** finding (the terminal caps
detailed findings at 10 by default — use `--max-findings 0` to see them all).

## 7. Demo loop with Claude Code / Codex

EcoLint pairs naturally with AI-assisted coding tools:

```txt
1. Build an AI feature.
2. Run EcoLint (`npx ecolint-ai scan --path .`).
3. Paste the EcoLint findings into Claude Code / Codex.
4. Ask it to fix the high-impact findings without changing behavior.
5. Re-run EcoLint to confirm fewer findings and a lower score.
```

Because each finding ships with a **fix recipe**, findings are easy to hand to
an agent verbatim. A good prompt:

> "Here is the EcoLint AI report. Fix the high-impact findings — add caching,
> bound the context, right-size the model, set token limits, and budget the
> agent loop — without changing the feature's behavior. Then I'll re-run EcoLint."

## 8. GitHub Action + PR comments

EcoLint ships as a composite GitHub Action. Set `comment: "true"` and grant
`pull-requests: write` to have it post (and keep updating) a single report
comment on each pull request:

```yaml
permissions:
  contents: read
  pull-requests: write

jobs:
  ecolint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: psamme/ecolint-ai@v0.2.0
        with:
          path: "."
          comment: "true"
```

It uses the built-in `GITHUB_TOKEN` (no custom token), updates its own comment
instead of posting duplicates, and on non-PR events writes the report to the job
summary instead. See [README → GitHub Action](README.md#github-action).

## 9. Known limitations

- Heuristic/static analysis, not a perfect AST analyzer.
- Impact numbers are **directional estimates**, not measured values.
- May produce false positives or miss dynamic patterns (see
  [README → Managing false positives](README.md#managing-false-positives)).
- Not runtime telemetry, and not a measure of exact emissions or water usage —
  it complements runtime trackers like CodeCarbon and EcoLogits.
