/**
 * Helpers for posting the EcoLint AI report as a pull-request comment.
 *
 * The GitHub Action embeds an inline copy of this logic inside an
 * `actions/github-script` step (it cannot import from the published package at
 * action runtime). This module keeps the same rules in one testable place and
 * documents the contract the action relies on.
 */

/**
 * Stable marker placed at the top of the comment body so the action can find
 * and update its own comment instead of posting duplicates. Do not change this
 * without a migration — existing comments are matched by this exact string.
 */
export const ECOLINT_COMMENT_MARKER = "<!-- ecolint-ai-report -->";

/**
 * GitHub rejects issue/PR comments longer than 65536 characters. Leave headroom
 * for the marker and the truncation note.
 */
export const MAX_COMMENT_LENGTH = 60000;

export type CommentBodyOptions = {
  /** Max length of the rendered report before truncation. Defaults to {@link MAX_COMMENT_LENGTH}. */
  maxLength?: number;
};

/**
 * Build the PR comment body from a Markdown report.
 *
 * - Prepends {@link ECOLINT_COMMENT_MARKER} so the comment can be found/updated.
 * - Truncates on a line boundary if the report is too long for a PR comment,
 *   appending a note that points readers to the full report in the job summary.
 *   The Markdown report is front-loaded (summary, impact score, category
 *   breakdown, top fixes), so truncation keeps the most useful content.
 */
export function buildCommentBody(
  report: string,
  options: CommentBodyOptions = {},
): string {
  const maxLength = options.maxLength ?? MAX_COMMENT_LENGTH;
  const trimmed = report.trimEnd();

  if (trimmed.length <= maxLength) {
    return `${ECOLINT_COMMENT_MARKER}\n${trimmed}\n`;
  }

  // Cut at the last newline before the limit so we never split a Markdown line.
  const slice = trimmed.slice(0, maxLength);
  const lastNewline = slice.lastIndexOf("\n");
  const body = (lastNewline > 0 ? slice.slice(0, lastNewline) : slice).trimEnd();

  const note =
    "> ⚠️ This report was truncated to fit a PR comment. " +
    "See the full EcoLint AI report in the workflow **job summary**.";

  return `${ECOLINT_COMMENT_MARKER}\n${body}\n\n---\n\n${note}\n`;
}
