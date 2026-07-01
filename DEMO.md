# EcoLint AI — Demo

**ESLint for wasteful AI compute.**

EcoLint AI is a static analysis tool that helps developers find avoidable AI
compute waste before it ships — uncached LLM calls, oversized prompts, repeated
embeddings, overpowered models, unbounded generation, and more.

> EcoLint AI uses static heuristics and directional impact estimates. It does
> not measure exact emissions, water usage, or infrastructure-level energy
> consumption.

---

## 1. Install and build

```bash
npm install
npm run build
```

## 2. Scan the intentionally wasteful example

```bash
npm run scan:example
# equivalent to:
node dist/cli.js scan --path examples/wasteful-ai-app
```

You should see ~12 findings across all seven waste categories, an "Estimated
avoidable compute waste score", a category breakdown, and the top fix
opportunities.

## 3. Scan the cleaner example

```bash
node dist/cli.js scan --path examples/cleaner-ai-app
```

This one applies EcoLint's recommendations (caching, bounded context,
right-sized models, token limits, embedding reuse) and should scan **clean**.

## 4. Expected difference

| Example | Findings | Why |
|---|---|---|
| `examples/wasteful-ai-app` | ~12 across 7 categories | uncached calls, full history, `gpt-4o` for classification, embeddings in a loop, image gen in a retry loop, every-minute cron, no token limits, sequential calls |
| `examples/cleaner-ai-app` | 0 | caching, `.slice(-6)` context, `gpt-4o-mini`, `max_tokens`, `embedIfMissing` persistence check |

The point of the demo: the same feature set, written two ways, produces a very
different waste profile — and EcoLint catches the difference statically.

## 5. Generate a Markdown report

```bash
node dist/cli.js scan --path examples/wasteful-ai-app --markdown --output ecolint-report.md
```

Example (trimmed):

```md
# EcoLint AI Report

EcoLint AI scanned **5 files** and found **12 potential AI compute-waste issues**.

## AI Waste Impact Tracker

Estimated avoidable compute waste score: **70/100**

> EcoLint AI uses static heuristics and directional impact estimates...

## Findings by Waste Category

| Waste category | Findings |
|---|---:|
| Repeated inference | 4 |
| Background compute drift | 2 |
| ...

## Top Fix Opportunities

1. Cap repeated image generation in lib/image.ts — 90/100
2. Add caching / reduce repeated calls in app/api/generate/route.ts — 85/100
3. Add caching / reduce repeated calls in lib/classify.ts — 85/100
```

---

## Demo loop with Claude Code

EcoLint AI pairs naturally with AI-assisted coding tools like Claude Code or
Codex. Use it as a fast feedback loop:

```txt
1. Build an AI feature.
2. Run `npm run scan:example` or `ecolint-ai scan --path .`.
3. Paste the EcoLint findings back into Claude Code.
4. Ask Claude Code to fix high-impact findings without changing behavior.
5. Re-run EcoLint to verify reduced waste.
```

Because each finding ships with a **fix recipe** (a concrete remediation
checklist), the findings are easy to hand to an agent verbatim. A good prompt:

> "Here is the EcoLint AI report. Fix the high-impact findings — add caching,
> bound the context, right-size the model, and set token limits — without
> changing the feature's behavior. Then I'll re-run EcoLint to confirm."

Re-running EcoLint after the fixes should show a lower waste score and fewer
findings, giving you a measurable-feeling before/after in seconds.
