import { promises as fs } from "node:fs";
import path from "node:path";
import type { Severity } from "./types.js";
import type { Provider } from "./models.js";

/**
 * Optional on-disk config. The CLI works without it; when present it provides
 * defaults that CLI flags override.
 */
export type TrimferenceFileConfig = {
  minSeverity?: Severity;
  ignoredRules?: string[];
  ignoredPaths?: string[];
  provider?: Provider;
  baseline?: string;
  failOn?: Severity | "none";
};

/** @deprecated Use TrimferenceFileConfig. */
export type EcoLintFileConfig = TrimferenceFileConfig;

export const SCANNABLE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
];

export const IGNORE_GLOBS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/*.lock",
  "**/package-lock.json",
  "**/pnpm-lock.yaml",
  "**/yarn.lock",
];

export const DEFAULT_CONFIG: Required<TrimferenceFileConfig> = {
  minSeverity: "low",
  ignoredRules: [],
  ignoredPaths: [],
  provider: "unknown",
  baseline: "",
  failOn: "none",
};

export const CONFIG_FILENAME = "trimference.config.json";
export const LEGACY_CONFIG_FILENAME = "ecolint.config.json";

/** Contents written by `trimference init`. */
export const SAMPLE_CONFIG = `{
  "minSeverity": "low",
  "ignoredRules": [],
  "ignoredPaths": [],
  "provider": "openai",
  "failOn": "none"
}
`;

const VALID_SEVERITIES: Severity[] = ["low", "medium", "high"];
const VALID_PROVIDERS: Provider[] = [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "unknown",
];

/**
 * Load `trimference.config.json`, searching the scan path first and then the
 * current working directory. The former `ecolint.config.json` name is accepted
 * as a migration fallback. Returns an empty object (not defaults) when no file
 * exists, so callers can tell "unset" from "set to default".
 */
export async function loadConfig(scanPath: string): Promise<TrimferenceFileConfig> {
  const candidates = [...new Set([
    path.resolve(scanPath, CONFIG_FILENAME),
    path.resolve(scanPath, LEGACY_CONFIG_FILENAME),
    path.resolve(process.cwd(), CONFIG_FILENAME),
    path.resolve(process.cwd(), LEGACY_CONFIG_FILENAME),
  ])];

  for (const candidate of candidates) {
    const raw = await fs.readFile(candidate, "utf8").catch(() => null);
    if (raw === null) continue;
    try {
      return normalizeConfig(JSON.parse(raw) as unknown, candidate);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Invalid config at ${candidate}: ${message}`);
    }
  }
  return {};
}

function normalizeConfig(input: unknown, source: string): TrimferenceFileConfig {
  if (typeof input !== "object" || input === null) {
    throw new Error("expected a JSON object");
  }
  const obj = input as Record<string, unknown>;
  const config: TrimferenceFileConfig = {};

  if (obj.minSeverity !== undefined) {
    if (!VALID_SEVERITIES.includes(obj.minSeverity as Severity)) {
      throw new Error(`minSeverity must be one of ${VALID_SEVERITIES.join(", ")}`);
    }
    config.minSeverity = obj.minSeverity as Severity;
  }
  if (obj.ignoredRules !== undefined) {
    if (!isStringArray(obj.ignoredRules)) {
      throw new Error("ignoredRules must be an array of strings");
    }
    config.ignoredRules = obj.ignoredRules;
  }
  if (obj.ignoredPaths !== undefined) {
    if (!isStringArray(obj.ignoredPaths)) {
      throw new Error("ignoredPaths must be an array of strings");
    }
    config.ignoredPaths = obj.ignoredPaths;
  }
  if (obj.provider !== undefined) {
    if (!VALID_PROVIDERS.includes(obj.provider as Provider)) {
      throw new Error(`provider must be one of ${VALID_PROVIDERS.join(", ")}`);
    }
    config.provider = obj.provider as Provider;
  }
  if (obj.baseline !== undefined) {
    if (typeof obj.baseline !== "string") {
      throw new Error("baseline must be a string path");
    }
    config.baseline = obj.baseline;
  }
  if (obj.failOn !== undefined) {
    if (
      obj.failOn !== "none" &&
      !VALID_SEVERITIES.includes(obj.failOn as Severity)
    ) {
      throw new Error(`failOn must be none or one of ${VALID_SEVERITIES.join(", ")}`);
    }
    config.failOn = obj.failOn as Severity | "none";
  }

  void source;
  return config;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}
