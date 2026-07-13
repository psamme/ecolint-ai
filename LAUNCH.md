# Launch kit

Use this after publishing `trimference@0.3.0` and pushing the matching `v0.3.0`
GitHub tag. Replace the repository URL if the project is renamed.

## Quick brief

Trimference is an early, local static scanner for LLM application code. It finds
code shapes that deserve an efficiency review before merge: unbounded agent
loops, repeated embeddings, oversized context, missing output caps, frequent AI
jobs, uncached repeatable calls, and public AI routes without rate limits.

The useful distinction is timing: provider dashboards explain requests after
they run; Trimference reviews safeguards in source and pull requests. It requires no
provider key and does not upload source. It is deliberately positioned as a
heuristic review tool—not cost telemetry, carbon accounting, or proof of waste.

## X

> LLM cost bugs often look like unbounded agent loops, repeated embeddings,
> huge contexts, and missing output caps.
>
> I built Trimference, a static scanner that flags them before merge. No
> API key or source upload. Early beta—feedback welcome.
>
> https://github.com/psamme/trimference

Add a short terminal recording or one cropped report image; do not attach the
old full-screen screenshot.

## Hacker News

**Title:** Show HN: Trimference – a local static scanner for LLM efficiency safeguards

**Text:**

> I built Trimference, an open-source CLI that reviews JavaScript, TypeScript,
> and early Python support for LLM call patterns that can amplify cost, latency,
> or reliability risk.
>
> It currently checks ten patterns, including unbounded agent loops, repeated
> embeddings, missing output limits, oversized context, repeated image
> generation, and public AI routes without rate limits. It runs locally without
> a provider key or source upload, and supports terminal, Markdown, JSON, SARIF,
> baselines, changed-file scans, and CI thresholds.
>
> This is static heuristic analysis, not runtime cost telemetry or carbon
> accounting. The repository includes positive and negative fixtures, a
> deliberately wasteful example, a clean counterpart, and the current benchmark
> limits. I would especially value false-positive examples and missing SDK call
> shapes.
>
> Repo: https://github.com/psamme/trimference

## Reddit

Good first communities are `r/LLMDevs`, `r/LocalLLaMA`, and `r/opensource`.
Read each community's current self-promotion rules before posting and tailor the
opening rather than cross-posting identical copy.

**Title:** I made a local static scanner for missing LLM efficiency safeguards

**Body:**

> I kept seeing the same problems in LLM application code: calls inside loops,
> embeddings regenerated instead of persisted, histories passed without bounds,
> public generation routes without quotas, and agents without a step/time/token
> budget.
>
> I built Trimference to flag those shapes locally and in pull requests. It does
> not need an API key or upload source. The output includes severity, confidence,
> a source snippet, and a concrete fix recipe; CI can use baselines, changed-file
> scans, SARIF, and `--fail-on` thresholds.
>
> It is an early heuristic scanner, so I am not claiming that every finding is
> waste or that source code can reveal exact cost/emissions. I would love real
> false-positive fixtures and suggestions for SDK/framework coverage.
>
> https://github.com/psamme/trimference

## Release order

1. Run `npm run verify` and `npm pack --dry-run`.
2. Commit the release, rename the GitHub repository to `trimference`, update the
   local `origin`, and push `main`.
3. Publish the new `trimference@0.3.0` package to npm.
4. Deprecate `ecolint-ai` on npm with a rename notice; do not unpublish it.
5. Create and push the matching Git tag/release `v0.3.0`.
6. Run the public Action once in a throwaway repository.
7. Add a concise repository description, topics, and a cropped social preview.
8. Post to Hacker News first; answer technical questions directly and update the
   README when repeated questions expose unclear positioning.
9. Post tailored X and Reddit versions after the first feedback-driven fixes.
