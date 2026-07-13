# Contributing

Thanks for helping make Trimference more accurate and useful.

## The most useful contributions

- Minimal false-positive or false-negative fixtures
- Provider/framework call patterns from real applications
- Report usability improvements
- Documentation corrections

Accuracy matters more than rule count. A new rule should have a narrow claim,
clear confidence, positive and negative fixtures, and a practical remediation.

## Development

```bash
npm ci
npm run build
npm test
```

Run the examples as a smoke test:

```bash
node dist/cli.js scan --path examples/wasteful-ai-app --summary
node dist/cli.js scan --path examples/cleaner-ai-app
node dist/cli.js scan --path src --summary
```

The implementation source should not flag its own pattern definitions as
executable AI calls.

## Pull requests

Please include:

1. A short explanation of the behavior change.
2. Tests covering a true positive and a nearby negative case.
3. Updated documentation when output or configuration changes.

Do not add precise cost or environmental claims without a reproducible,
reviewable methodology and clearly stated inputs.
