import type { Finding, Rule, SourceFile } from "../types.js";
import { makeImpact } from "../impact.js";
import {
  createFinding,
  dedupeFindings,
  findCodeMatchesInFile,
  hasNearbyCode,
} from "./helpers.js";

const EMBEDDING_PATTERNS: Array<string | RegExp> = [
  /embeddings\.create/i,
  /createEmbedding/i,
  /\bembedMany\s*\(/i,
  /\bembed\s*\(/i,
];

const LOOP_TERMS: Array<string | RegExp> = [
  /for\s*\(/i,
  /for\s+await/i,
  /while\s*\(/i,
  /\.map\s*\(/i,
  /forEach\s*\(/i,
];

const PERSISTENCE_TERMS: Array<string | RegExp> = [
  "vectorStore",
  "pinecone",
  "weaviate",
  "qdrant",
  "chroma",
  "supabase",
  "pgvector",
  "db.",
  "database",
  "insert",
  "upsert",
  "cache",
  "exists",
  "findUnique",
  "findFirst",
];

const FIX_RECIPE = [
  "Hash the source text or document ID.",
  "Check whether an embedding already exists before generating a new one.",
  "Persist embeddings in a vector store or database.",
  "Re-embed only when the source content changes.",
];

export const repeatedEmbeddingsRule: Rule = {
  id: "repeated-embeddings",
  title: "Embeddings may be regenerated repeatedly",
  severity: "high",
  wasteCategory: "redundant-embedding",
  description:
    "Flags embedding calls near loops that have no obvious persistence, reuse, or existence check.",
  recommendation:
    "Persist embeddings for unchanged text and check for existing vectors before generating new ones.",
  fixRecipe: FIX_RECIPE,
  scan(file: SourceFile): Finding[] {
    const findings: Finding[] = [];

    for (const match of findCodeMatchesInFile(file, EMBEDDING_PATTERNS)) {
      const inLoop = hasNearbyCode(file, match.index, LOOP_TERMS, 20);
      const persisted = hasNearbyCode(file, match.index, PERSISTENCE_TERMS, 20);

      // If embeddings are persisted / reused nearby, there's no waste to flag.
      if (persisted) continue;

      // Highest concern is embeddings inside a loop; a lone uncached call is a
      // lower-confidence nudge.
      findings.push(
        createFinding({
          ruleId: this.id,
          title: this.title,
          severity: this.severity,
          wasteCategory: this.wasteCategory,
          file,
          index: match.index,
          message:
            "Embeddings appear to be generated repeatedly without obvious persistence or reuse.",
          recommendation: this.recommendation,
          fixRecipe: this.fixRecipe,
          impact: makeImpact({
            computeWaste: "high",
            carbonImpact: "medium",
            waterImpact: "medium",
            costImpact: "medium",
            confidence: inLoop ? "medium" : "low",
            score: inLoop ? 80 : 60,
            explanation:
              "Re-embedding unchanged content creates avoidable repeated compute.",
          }),
        }),
      );
    }

    return dedupeFindings(findings);
  },
};
