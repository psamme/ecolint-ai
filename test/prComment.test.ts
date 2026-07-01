import { describe, it, expect } from "vitest";
import {
  ECOLINT_COMMENT_MARKER,
  MAX_COMMENT_LENGTH,
  buildCommentBody,
} from "../src/prComment.js";

describe("buildCommentBody", () => {
  it("prepends the stable marker so the comment can be found and updated", () => {
    const body = buildCommentBody("# EcoLint AI Report\n\nAll clear.");
    expect(body.startsWith(`${ECOLINT_COMMENT_MARKER}\n`)).toBe(true);
    expect(body).toContain("All clear.");
  });

  it("leaves short reports untouched (no truncation note)", () => {
    const body = buildCommentBody("short report");
    expect(body).not.toContain("truncated");
    expect(body).toBe(`${ECOLINT_COMMENT_MARKER}\nshort report\n`);
  });

  it("truncates long reports and points to the job summary", () => {
    const long = Array.from({ length: 12000 }, (_, i) => `line ${i}`).join("\n");
    expect(long.length).toBeGreaterThan(MAX_COMMENT_LENGTH);

    const body = buildCommentBody(long);
    expect(body.length).toBeLessThanOrEqual(MAX_COMMENT_LENGTH + 400);
    expect(body).toContain("truncated");
    expect(body).toContain("job summary");
    // Keeps the front-loaded content (summary/top findings live at the top).
    expect(body).toContain("line 0");
  });

  it("truncates on a line boundary so Markdown lines are never split", () => {
    const long = Array.from({ length: 5000 }, (_, i) => `line ${i}`).join("\n");
    const body = buildCommentBody(long, { maxLength: 100 });
    const reportPortion = body.slice(
      `${ECOLINT_COMMENT_MARKER}\n`.length,
      body.indexOf("\n\n---"),
    );
    // Every retained line is a whole "line N" entry, not a partial fragment.
    for (const line of reportPortion.split("\n")) {
      expect(line).toMatch(/^line \d+$/);
    }
  });
});
