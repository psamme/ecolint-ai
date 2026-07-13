import type { ScanResult, Severity } from "../types.js";
import { rules } from "../rules/index.js";

const LEVEL: Record<Severity, "error" | "warning" | "note"> = {
  high: "error",
  medium: "warning",
  low: "note",
};

/** Render SARIF 2.1.0 for GitHub code scanning and compatible tooling. */
export function renderSarifReport(result: ScanResult): string {
  const usedRuleIds = new Set(result.findings.map((finding) => finding.ruleId));
  const ruleMetadata = rules
    .filter((rule) => usedRuleIds.has(rule.id))
    .map((rule) => ({
      id: rule.id,
      name: rule.id,
      shortDescription: { text: rule.title },
      fullDescription: { text: rule.description },
      help: { text: rule.recommendation },
      defaultConfiguration: { level: LEVEL[rule.severity] },
      properties: { category: rule.wasteCategory },
    }));

  const payload = {
    version: "2.1.0",
    $schema:
      "https://json.schemastore.org/sarif-2.1.0.json",
    runs: [
      {
        tool: {
          driver: {
            name: "Trimference",
            informationUri: "https://github.com/psamme/trimference",
            rules: ruleMetadata,
          },
        },
        results: result.findings.map((finding) => ({
          ruleId: finding.ruleId,
          level: LEVEL[finding.severity],
          message: {
            text: `${finding.message} ${finding.recommendation}`,
          },
          locations: [
            {
              physicalLocation: {
                artifactLocation: { uri: finding.filePath },
                region: {
                  startLine: finding.line,
                  ...(finding.column ? { startColumn: finding.column } : {}),
                  ...(finding.snippet
                    ? { snippet: { text: finding.snippet } }
                    : {}),
                },
              },
            },
          ],
          properties: {
            confidence: finding.impact.confidence,
            safeguard: finding.wasteCategory,
          },
        })),
      },
    ],
  };
  return JSON.stringify(payload, null, 2);
}
