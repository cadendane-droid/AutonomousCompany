// TIER A: fully working. Shared helpers for content-file checks.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { FrontmatterSchema, type Frontmatter } from '@atlas/core';
import type { CheckContext, DiffFile } from './types.js';

const CONTENT_DIR_PATTERN = /^site\/src\/content\/[^/]+\/.+\.(md|mdx)$/;

/** Changed content files that still exist post-diff (added or modified). */
export function changedContentFiles(ctx: CheckContext): DiffFile[] {
  return ctx.diff.files.filter(
    (f) => CONTENT_DIR_PATTERN.test(f.path) && f.status !== 'deleted',
  );
}

export interface ParsedContentFile {
  path: string;
  frontmatter: Frontmatter | null;
  frontmatterError: string | null;
  body: string;
  raw: string;
}

/** Read a content file from the checked-out working tree and split it. */
export function readContentFile(repoRoot: string, relPath: string): ParsedContentFile | null {
  const absolute = join(repoRoot, relPath);
  if (!existsSync(absolute)) return null;
  const raw = readFileSync(absolute, 'utf8');

  const match = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { path: relPath, frontmatter: null, frontmatterError: 'no frontmatter block', body: raw, raw };
  }
  try {
    const parsed = FrontmatterSchema.safeParse(parseYaml(match[1]!));
    if (!parsed.success) {
      return {
        path: relPath,
        frontmatter: null,
        frontmatterError: parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
        body: match[2]!,
        raw,
      };
    }
    return { path: relPath, frontmatter: parsed.data, frontmatterError: null, body: match[2]!, raw };
  } catch (err) {
    return {
      path: relPath,
      frontmatter: null,
      frontmatterError: `frontmatter YAML error: ${err instanceof Error ? err.message : err}`,
      body: match[2]!,
      raw,
    };
  }
}
