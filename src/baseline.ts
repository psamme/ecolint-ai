import { promises as fs } from "node:fs";
import type { Finding } from "./types.js";
import { findingFingerprint } from "./scanner.js";

export const BASELINE_VERSION = 1;

export type TrimferenceBaseline = {
  version: typeof BASELINE_VERSION;
  fingerprints: string[];
};

/** @deprecated Use TrimferenceBaseline. */
export type EcoLintBaseline = TrimferenceBaseline;

/** Read and validate a Trimference baseline file. */
export async function readBaseline(filePath: string): Promise<string[]> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<TrimferenceBaseline>;
  if (
    parsed.version !== BASELINE_VERSION ||
    !Array.isArray(parsed.fingerprints) ||
    !parsed.fingerprints.every((item) => typeof item === "string")
  ) {
    throw new Error(
      `Invalid baseline at ${filePath}. Expected version ${BASELINE_VERSION}.`,
    );
  }
  return parsed.fingerprints;
}

/** Write the current findings as accepted baseline debt. */
export async function writeBaseline(
  filePath: string,
  findings: Finding[],
): Promise<void> {
  const baseline: TrimferenceBaseline = {
    version: BASELINE_VERSION,
    fingerprints: [...new Set(findings.map(findingFingerprint))].sort(),
  };
  await fs.writeFile(filePath, `${JSON.stringify(baseline, null, 2)}\n`, "utf8");
}
