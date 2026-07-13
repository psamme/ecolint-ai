# Trimference

**A local efficiency review for LLM application code.**

[![npm](https://img.shields.io/npm/v/trimference)](https://www.npmjs.com/package/trimference)
[![CI](https://github.com/psamme/trimference/actions/workflows/trimference.yml/badge.svg)](https://github.com/psamme/trimference/actions/workflows/trimference.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-black)](LICENSE)

Trimference scans source code for patterns that can amplify LLM cost, latency,
and reliability risk: uncached repeatable calls, unbounded context and output,
repeated embeddings, model right-sizing opportunities, unbudgeted agent loops,
and public AI routes without rate limits.

It is an early static heuristic scanner—not production telemetry or carbon
accounting. Findings are review prompts with explicit confidence, source
evidence, and fix recipes.

> **Renamed in 0.3.0:** Trimference was previously published as `ecolint-ai`.
> The former config filename, suppression prefix, and public type names remain
> available as migration aliases.

## Try it

```bash
npx trimference scan --path .
```

No provider key is required. The scanner does not upload source code or call an
AI provider. `npx` may download the package from npm on first use.

Useful variants:

```bash
npx trimference scan --path . --summary
npx trimference scan --path . --markdown --output trimference-report.md
npx trimference scan --path . --json
npx trimference scan --path . --sarif --output trimference.sarif
npx trimference scan --path . --fail-on high
```

## What the review looks like

```text
Trimference efficiency review

Scanned 6 files in 41ms.
Found 17 review item(s): 4 high · 9 medium · 4 low

Safeguards to review:
- Repeated inference: 8
- Unbounded generation: 4
- Frequent background work: 1

Top opportunities:
1. Cap repeated image generation in lib/image.ts
2. Add step, time, and token/cost budgets to agent loops.

[HIGH · MEDIUM CONFIDENCE] Agent loop without obvious budget
lib/agent.ts:8 · agent-loop-without-budget · Repeated inference
  while (true) {
Issue: This agentic flow appears to run without an obvious budget.
Fix: Add explicit max steps, timeouts, token caps, and/or cost budgets.
```

Terminal output is compact by default. Markdown reports include a summary table,
clickable locations, evidence, and collapsed fix details. JSON is available for
automation, and SARIF 2.1.0 is available for code-scanning integrations. Reports
describe operational compute and cost risk; they do not manufacture carbon or
water estimates from source code.

## Why static analysis?

Provider dashboards and runtime observability explain what already ran. Trimference
works earlier: during local development and review, before a risky call pattern
is merged. Use it alongside runtime cost and quality telemetry, not instead of
them.

## Rules

| Rule | Review area | Default severity | What it looks for |
|---|---|---|---|
| `no-llm-cache` | Repeated inference | medium; high for likely repeatable tasks | Model calls without nearby cache/dedupe logic |
| `huge-context` | Token bloat | medium | Unbounded history/document variables close to a proven model call |
| `expensive-model-simple-task` | Model right-sizing | medium | Larger model names near classification/extraction/routing work |
| `repeated-embeddings` | Redundant embedding | high | Embedding calls without persistence, especially in loops |
| `image-generation-loop` | Repeated image generation | high | Image generation close to loops or retries |
| `frequent-cron` | Frequent background work | medium | Frequent schedules in files that perform AI work |
| `no-token-limit` | Unbounded generation | low | Model calls without a nearby output cap |
| `sequential-llm-calls` | Repeated inference | medium | Multiple nearby model calls that may be one flow |
| `agent-loop-without-budget` | Repeated inference | high | Agent/tool loops without nearby step, time, token, or cost limits |
| `missing-rate-limit` | Repeated inference | medium | Public AI routes without an obvious quota or rate limit |

Rules first prove that relevant calls occur in executable code; comments,
quoted examples, regex literals, and documentation are not treated as call
sites. The scanner still uses lexical heuristics rather than full data-flow
analysis, so review findings before acting on them.

## CI and pull requests

The GitHub Action writes the Markdown review to the job summary and can update a
single PR comment:

```yaml
name: Trimference

on:
  pull_request:

permissions:
  contents: read
  pull-requests: write

jobs:
  trimference:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: psamme/trimference@v0.3.0
        with:
          path: "."
          comment: "true"
          fail-on: "high"
```

The action tag runs the matching pinned npm version. Reporting happens before
the optional threshold gate, so a failed check still leaves an actionable
summary.

### Adopt without failing on existing debt

Create a baseline once:

```bash
npx trimference scan --path . --write-baseline trimference-baseline.json
```

Then report or fail only on findings not in that baseline:

```bash
npx trimference scan --path . \
  --baseline trimference-baseline.json \
  --fail-on high
```

In the Action:

```yaml
with:
  path: "."
  baseline: "trimference-baseline.json"
  fail-on: "high"
  comment: "true"
```

Baseline fingerprints use rule, relative path, and normalized source evidence,
so unrelated line-number changes do not normally resurrect accepted findings.

For a local diff-only review, make sure the base ref exists in the checkout:

```bash
npx trimference scan --path . --changed-since origin/main --fail-on high
```

## CLI

```text
trimference scan [options]

--path <path>              Path to scan (default: .)
--summary                  Summary only
--max-findings <n>         Terminal detail limit; 0 shows all
--markdown                 Markdown to stdout
--json                     JSON to stdout
--sarif                    SARIF 2.1.0 to stdout
--output <file>            Write Markdown, JSON with --json, or SARIF with --sarif
--min-severity <level>     low | medium | high
--provider <name>          openai | anthropic | google | mistral
--baseline <file>          Hide accepted baseline findings
--write-baseline <file>    Record current findings and exit
--changed-since <git-ref>  Scan only files changed since a local Git ref
--fail-on <level>          none | low | medium | high; exits 2 on a match
```

Exit codes:

- `0`: scan completed and the configured gate passed
- `1`: invalid input, configuration, or scan failure
- `2`: findings met the `--fail-on` threshold

## Configuration and suppressions

Run `trimference init` to create `trimference.config.json`:

```json
{
  "minSeverity": "low",
  "ignoredRules": [],
  "ignoredPaths": ["examples/**", "**/*.fixture.ts"],
  "provider": "openai",
  "baseline": "trimference-baseline.json",
  "failOn": "none"
}
```

CLI flags override config. `ignoredPaths` accepts glob patterns; entries without
`*` or `?` continue to work as path substrings.

Inline suppressions are also supported:

```ts
// trimference-disable-next-line no-llm-cache -- personalized response, no safe reuse
await openai.responses.create({ model, input });

// trimference-disable no-token-limit
await runProviderManagedGeneration();
// trimference-enable no-token-limit
```

Supported directives are `trimference-disable-next-line`, `trimference-disable-line`,
and `trimference-disable` / `trimference-enable` blocks.

## Library API

```ts
import {
  scan,
  renderMarkdownReport,
  findingFingerprint,
} from "trimference";

const result = await scan({ path: ".", minSeverity: "medium" });
console.log(renderMarkdownReport(result));
console.log(result.findings.map(findingFingerprint));
```

The `trimInference` helper provides the existing local model-tier advisor;
`ecoLLM` remains as a deprecated compatibility alias. Its model names are
illustrative and manually maintained. Validate model choices with your own
quality evaluations and current provider pricing.

## Limitations

- Lexical/static heuristics cannot prove runtime behavior or request volume.
- Nearby calls may be independent; nearby safeguards may apply to a different call.
- Framework and provider coverage is strongest for common JavaScript/TypeScript SDKs.
- Python files are discoverable, but Python-specific framework coverage is still early.
- Model right-sizing must be validated against application-specific quality tests.
- Trimference does not measure exact spend, emissions, water, or infrastructure energy.

False-positive reports and small representative fixtures are especially useful.
See [BENCHMARK.md](BENCHMARK.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

## Development

```bash
npm ci
npm run build
npm test
npm run scan:example
npm run verify
```

The repository includes an intentionally wasteful example and a cleaner
counterpart under `examples/`.

## License

[MIT](LICENSE)
