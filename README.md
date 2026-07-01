# EcoLint AI

**ESLint for wasteful AI compute.**

![status: v1](https://img.shields.io/badge/status-v1-brightgreen)
![type: static analysis](https://img.shields.io/badge/type-static%20analysis-blue)
![node: >=18](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)
![language: TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![tests: vitest](https://img.shields.io/badge/tests-vitest-6E9F18?logo=vitest&logoColor=white)
![license: MIT](https://img.shields.io/badge/license-MIT-black)

EcoLint AI is a static analysis tool that helps developers find avoidable AI
compute waste before it ships. It scans AI app codebases for patterns like
uncached LLM calls, oversized prompts, repeated embeddings, overpowered model
usage, and unbounded generation, then provides **waste categories**,
**directional impact estimates**, and **concrete fix recipes**.

> **EcoLint AI uses static heuristics and directional impact estimates. It does
> not measure exact emissions, water usage, or infrastructure-level energy
> consumption.**

> **Trying it right now?** See [DEMO.md](DEMO.md) for a 2-minute walkthrough.

---

## Example output

Running EcoLint AI on the intentionally wasteful example app:

```bash
npm run scan:example
```

![EcoLint AI example output](assets/ecolint-demo.png)

---

## What it does

EcoLint AI answers one question a developer has right before shipping an AI
feature:

> "Before I ship this AI feature, am I doing anything obviously wasteful?"

And it responds with a prioritized code-review report:

- files and line numbers for each issue
- waste categories like repeated inference, token bloat, and model overkill
- directional compute / carbon / water / cost impact estimates
- top fix opportunities
- concrete fix recipes for each finding

---

## Why it exists

Shipping AI features is easy; shipping them *efficiently* is not. Uncached
calls, full-history prompts, and top-tier models used for trivial tasks are easy
to introduce and hard to notice in review. They quietly turn into higher API bills, slower responses, and unnecessary compute demand.

EcoLint AI is a **prevention layer for AI code review**. It prioritizes wasteful
AI code patterns and estimates their potential impact directionally, so you can
fix the expensive ones first.

---

## How EcoLint AI is different

Most AI sustainability tools focus on estimating impact *after* usage happens.
Browser extensions can estimate the impact of chatbot conversations, and runtime
libraries can estimate emissions from workloads or API calls.

EcoLint AI works earlier. It scans source code before deployment and flags
patterns that may create avoidable AI compute waste, such as uncached LLM calls,
oversized prompts, repeated embeddings, overpowered models for simple tasks, and
repeated image generation.

EcoLint AI is not a replacement for runtime emissions trackers. It is a
prevention layer for AI code review. It complements tools like runtime emissions
trackers, LLM impact calculators, and carbon accounting libraries (for example,
CodeCarbon and EcoLogits).

---

## What EcoLint AI does not do

- Does **not** measure exact emissions.
- Does **not** claim exact water usage.
- Does **not** call AI providers or any network service.
- Does **not** require API keys.
- Does **not** automatically rewrite your code (it gives fix recipes).
- Does **not** replace runtime impact trackers.

---

## Installation

```bash
npm install
npm run build
```

Then run the built CLI:

```bash
node dist/cli.js scan --path examples/wasteful-ai-app
```

Or use the dev script (no build step, via `tsx`):

```bash
npm run dev -- scan --path examples/wasteful-ai-app
```

---

## CLI usage

```bash
ecolint-ai scan                                  # scan the current directory
ecolint-ai scan --path .                         # scan a specific path
ecolint-ai scan --path ./examples/wasteful-ai-app
ecolint-ai scan --json                           # JSON to stdout
ecolint-ai scan --markdown                       # Markdown to stdout
ecolint-ai scan --output ecolint-report.md       # write a report file
ecolint-ai scan --min-severity medium            # only medium + high
ecolint-ai init                                   # create a sample config
```

| Flag | Description |
|---|---|
| `--path <path>` | Path to scan (default `.`) |
| `--json` | Emit findings as JSON to stdout |
| `--markdown` | Emit a Markdown report to stdout |
| `--output <file>` | Write the report to a file (Markdown by default, JSON if `--json`) |
| `--min-severity <low\|medium\|high>` | Minimum severity to report (overrides config; default `low`) |
| `--provider <name>` | Provider hint for model suggestions (overrides config) |

---

## Report Formats

Terminal (default), Markdown (`--markdown`), and JSON (`--json`) reporters are
all supported. The JSON shape:

```json
{
  "summary": {
    "filesScanned": 5,
    "totalFindings": 12,
    "high": 5,
    "medium": 5,
    "low": 2,
    "averageImpactScore": 70,
    "overallImpactScore": 70,
    "findingsByCategory": { "repeated-inference": 4, "token-bloat": 1 },
    "topCategory": "repeated-inference"
  },
  "disclaimer": "EcoLint AI uses static heuristics and directional impact estimates...",
  "findings": []
}
```

---

## Rules and waste categories

Every finding is tagged with a **waste category** and comes with a fix recipe.

| Rule | Waste category | Severity | What it flags |
|---|---|---|---|
| `no-llm-cache` | Repeated inference | high | LLM calls with no nearby caching |
| `huge-context` | Token bloat | medium | Full history / documents sent as context |
| `expensive-model-simple-task` | Model overkill | medium | Top-tier model near a simple task |
| `repeated-embeddings` | Redundant embedding | high | Embeddings in loops without persistence |
| `image-generation-loop` | Multimodal cost explosion | high | Image generation in loops/retries |
| `frequent-cron` | Background compute drift | medium | Very frequent cron / `setInterval` |
| `no-token-limit` | Unbounded generation | low | LLM calls with no output token cap |
| `sequential-llm-calls` | Repeated inference | medium | Multiple LLM calls in one flow |

Waste categories:

```ts
type WasteCategory =
  | "repeated-inference"
  | "token-bloat"
  | "model-overkill"
  | "redundant-embedding"
  | "unbounded-generation"
  | "background-compute-drift"
  | "multimodal-cost-explosion";
```

Rules use simple, transparent regex/static heuristics — no AST parsing in v1 —
so results are directional and may include false positives or misses.

---

## AI Waste Impact Tracker

Every report includes an **AI Waste Impact Tracker** with:

1. Total files scanned
2. Total findings
3. High / medium / low counts
4. Estimated avoidable compute waste score
5. Findings by waste category
6. Top waste category
7. Top 3 fix opportunities
8. The static-heuristics disclaimer

Each finding carries an impact estimate:

```ts
type ImpactEstimate = {
  computeWaste: "low" | "medium" | "high";
  carbonImpact: "low" | "medium" | "high";
  waterImpact: "low" | "medium" | "high";
  costImpact: "low" | "medium" | "high";
  confidence: "low" | "medium" | "high";
  score: number; // 1..100
  explanation: string;
};
```

These are **directional priority signals** to help you decide what to fix first
— not measured footprints.

---

## Honesty and disclaimer

The compute / carbon / water / cost levels are **relative priority signals**,
not measured quantities. EcoLint AI uses static heuristics to identify patterns
that may increase unnecessary compute demand — it deliberately does not claim to
measure exact emissions or water use, or to save a specific amount of either.

---

## `ecoLLM` helper

EcoLint AI also ships a tiny, **offline** advisor. It makes no network calls and
holds no API keys — it just maps a task shape to a directional recommendation.

```ts
import { ecoLLM } from "ecolint-ai";

const recommendation = ecoLLM({
  provider: "openai",
  taskType: "classification",
  inputSize: "small",
  ecoMode: true,
});

// {
//   recommendedModelTier: "small",
//   shouldCache: true,
//   maxTokenRecommendation: 256,
//   suggestedModels: ["gpt-4o-mini", "gpt-4.1-mini"],
//   notes: [ ... ]
// }
```

```ts
type EcoLLMInput = {
  taskType: "classification" | "extraction" | "generation" | "reasoning" | "embedding";
  inputSize: "small" | "medium" | "large";
  latencySensitive?: boolean;
  ecoMode?: boolean;
  provider?: "openai" | "anthropic" | "google" | "mistral" | "unknown";
};

type EcoLLMRecommendation = {
  recommendedModelTier: "small" | "medium" | "large";
  shouldCache: boolean;
  maxTokenRecommendation: number;
  notes: string[];
  suggestedModels?: string[]; // present when a provider is given
};
```

- Classification / extraction usually recommend a small or medium tier.
- Reasoning with large input recommends the large tier.
- Embedding always recommends caching / persistence.
- `ecoMode: true` prefers smaller tiers and enables caching.
- Passing `provider` adds concrete `suggestedModels` for the recommended tier.

The provider model tiers are a **configurable heuristic** (see
[`src/models.ts`](src/models.ts)); the specific model names are illustrative
examples, not authoritative — verify quality for your use case.

---

## GitHub Action

### Use inside this repo before publishing

Because the package isn't on npm yet, the included workflow at
[`.github/workflows/ecolint-local.yml`](.github/workflows/ecolint-local.yml)
runs EcoLint from the repo's own source and writes the report into the GitHub
Actions **job summary**. It does:

```bash
npm ci
npm run build
node dist/cli.js scan --path examples/wasteful-ai-app --markdown --output ecolint-report.md
cat ecolint-report.md >> "$GITHUB_STEP_SUMMARY"
```

No npm publish and no PR-comment bot required — the report shows up in the
Actions run summary and as an uploaded artifact.

### Use as a published GitHub Action

Once `ecolint-ai` is published to npm, the [`action.yml`](action.yml) composite
action can be consumed directly from another repo:

```yaml
name: EcoLint AI

on:
  pull_request:
  push:

jobs:
  ecolint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run EcoLint AI
        uses: your-username/ecolint-ai@v1
        with:
          path: "."
          min-severity: "low"
```

Inputs: `path` (default `.`), `min-severity` (default `low`), `format` (default
`markdown`). The action runs `npx ecolint-ai scan ...`, which requires the
package to be published. A PR-comment bot is on the roadmap.

---

## Configuration

Configuration is optional — the CLI works with zero config. If an
`ecolint.config.json` file exists in the scanned path (or the current
directory), EcoLint loads it. **CLI flags always override config values.**

```json
{
  "minSeverity": "low",
  "ignoredRules": [],
  "ignoredPaths": [],
  "provider": "openai"
}
```

| Key | Meaning |
|---|---|
| `minSeverity` | Minimum severity to report (`low` \| `medium` \| `high`) |
| `ignoredRules` | Rule IDs to skip (e.g. `["no-token-limit"]`) |
| `ignoredPaths` | Path substrings to skip (e.g. `["examples/", "vendor/"]`) |
| `provider` | Provider hint for model suggestions |

Generate a starter file with:

```bash
ecolint-ai init   # writes ecolint.config.json
```

---

## Examples

Two example apps are included:

- [`examples/wasteful-ai-app`](examples/wasteful-ai-app) — intentionally wasteful
  code that trips most rules across every waste category.
- [`examples/cleaner-ai-app`](examples/cleaner-ai-app) — the same features with
  caching, bounded context, right-sized models, token limits, and embedding
  reuse. It should scan clean (or nearly clean).

```bash
npm run scan:example
node dist/cli.js scan --path examples/cleaner-ai-app
```

---

## Development

```bash
npm install        # install dependencies
npm run build      # compile TypeScript to dist/
npm test           # run the vitest suite
npm run dev -- scan --path examples/wasteful-ai-app   # run without building
npm run scan:example                                  # scan the wasteful example
```

Project layout:

```txt
src/
  cli.ts            # commander CLI (scan, init)
  index.ts          # public API
  scanner.ts        # file discovery + rule runner + summary
  types.ts          # Finding, ImpactEstimate, WasteCategory, ...
  impact.ts         # impact helpers + disclaimer text
  ecoLLM.ts         # offline model-tier advisor
  config.ts         # extensions, ignores, defaults
  rules/            # one file per rule + shared helpers
  reporters/        # terminal, json, markdown, impact tracker
examples/           # wasteful + cleaner sample apps
test/               # vitest tests
action.yml          # GitHub Action
```

---

## Project Summary

**Project-card (one sentence):**

> EcoLint AI is a TypeScript CLI and GitHub Action — "ESLint for wasteful AI
> compute" — that statically scans AI app codebases for avoidable compute-waste
> patterns and reports waste categories, directional impact estimates, and fix
> recipes.

---

## Roadmap

- AST-based detection (fewer false positives than regex)
- VS Code extension
- PR comments from the GitHub Action
- Carbon-aware scheduling integration
- Cloud bill import for prioritization
- Configurable rules and thresholds
- Provider-specific model maps
- Water-stress-aware region recommendations

EcoLint AI stays a static prevention layer — it will not add runtime telemetry,
real emissions math, or exact water/carbon accounting.

---

## License

MIT — see [LICENSE](LICENSE).
