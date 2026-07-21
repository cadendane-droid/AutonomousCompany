// TIER A: fully working.
//
// Frontmatter valid and complete (plan §5.3) + required Sources section
// (rules.yml content.require_sources_section) for every changed content file.
import type { PolicyCheck } from '../types.js';
import { changedContentFiles, readContentFile } from '../content.js';

export const frontmatter: PolicyCheck = {
  name: 'frontmatter',
  kind: 'deterministic',
  async run(ctx) {
    const files = changedContentFiles(ctx);
    if (files.length === 0) {
      return { status: 'not-applicable', message: 'no content files changed' };
    }

    const problems: string[] = [];
    for (const file of files) {
      const parsed = readContentFile(ctx.repoRoot, file.path);
      if (!parsed) {
        problems.push(`${file.path}: file missing from working tree`);
        continue;
      }
      if (!parsed.frontmatter) {
        problems.push(`${file.path}: ${parsed.frontmatterError}`);
      } else {
        // rules.yml require_frontmatter_fields — tenant lives in the atlas block.
        for (const field of ctx.rules.content.require_frontmatter_fields) {
          const fm = parsed.frontmatter as unknown as Record<string, unknown>;
          const value = field === 'tenant' ? parsed.frontmatter.atlas.tenant : fm[field];
          if (value === undefined || value === null || value === '') {
            problems.push(`${file.path}: missing required frontmatter field "${field}"`);
          }
        }
      }
      if (ctx.rules.content.require_sources_section && !/^##\s+Sources\b/m.test(parsed.body)) {
        problems.push(`${file.path}: missing required "## Sources" section`);
      }
    }

    return problems.length > 0
      ? { status: 'fail', message: problems.join('; '), details: { problems } }
      : { status: 'pass', message: `${files.length} content file(s) valid` };
  },
};
