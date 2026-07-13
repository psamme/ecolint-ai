# Changelog

All notable changes are documented here.

## 0.3.0 - Unreleased

### Renamed

- The project, npm package, CLI, Action, config, suppression directives, and
  reports are now **Trimference**. The former config filename, inline directive
  prefix, public type names, and PR marker remain available as migration aliases.

### Added

- Evidence-first terminal and Markdown efficiency reviews
- Finding confidence and severity counts in summaries
- Baseline creation and suppression
- `--fail-on` CI thresholds with exit code 2
- Changed-file scanning with `--changed-since`
- SARIF 2.1.0 output for code-scanning integrations
- Glob-aware ignored paths
- Observable rule execution errors

### Changed

- Human reports no longer present carbon/water levels or a repository waste score
- JSON schema v2 reports operational risk instead of carbon/water estimates
- Repository priority scoring is monotonic for API compatibility
- Call-site rules ignore comments, quoted examples, and regex definitions
- Context and scheduled-work findings now require nearby/proven AI work
- GitHub Action uses a matching pinned npm version
- README positioning now leads with cost, latency, reliability, and review

### Fixed

- Fixing low-severity findings can no longer increase the compatibility score
- Trimference's own rule definitions no longer appear as executable model calls

## 0.2.1 - 2026-07-01

- Added GitHub PR comment mode and expanded launch documentation.
