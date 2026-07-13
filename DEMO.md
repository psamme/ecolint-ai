# Trimference demo

Trimference is a local static review for LLM application efficiency safeguards.
It reports probable cost, latency, and reliability risks with source evidence
and explicit confidence. It does not measure runtime usage or environmental
impact.

## 20-second demo

```bash
mkdir trimference-demo && cd trimference-demo
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

npx trimference scan --path .
```

The review should identify a likely repeatable uncached call, a model
right-sizing opportunity, and a missing output limit.

## Repository examples

From a source checkout:

```bash
npm ci
npm run build

node dist/cli.js scan --path examples/wasteful-ai-app --summary
node dist/cli.js scan --path examples/cleaner-ai-app
node dist/cli.js scan --path src --summary
```

The wasteful example exercises all review areas. The cleaner example should be
clean. The scanner source should also be clean: comments, quoted examples, and
regex rule definitions are not executable call sites.

## Markdown review

```bash
node dist/cli.js scan \
  --path examples/wasteful-ai-app \
  --markdown \
  --output trimference-report.md
```

The report front-loads severity counts, safeguard areas, and top actions. Each
finding has a clickable location and evidence row; verbose fix recipes are
collapsed.

## Adopt with a baseline

Record current debt once:

```bash
node dist/cli.js scan \
  --path . \
  --write-baseline trimference-baseline.json
```

Then report or gate only on new findings:

```bash
node dist/cli.js scan \
  --path . \
  --baseline trimference-baseline.json \
  --fail-on high
```

## GitHub pull requests

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
          baseline: "trimference-baseline.json"
          fail-on: "high"
          comment: "true"
```

The Action writes the report before enforcing the threshold, and it updates one
stable PR comment instead of posting duplicates.
