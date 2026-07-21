// TIER A: fully working. Law 4 — affiliate disclosure on monetized pages.
//
// The article layout renders AffiliateDisclosure whenever frontmatter says
// monetized: true (and the layout/component are protected paths). So the
// deterministic invariant to enforce here is: any content file that uses
// affiliate links MUST declare monetized: true.
import type { PolicyCheck } from '../types.js';
import { changedContentFiles, readContentFile } from '../content.js';

const AFFILIATE_MARKERS = [/<AffiliateLink[\s>]/, /affiliate_url:/i, /\bsubid=/i];

export const disclosure: PolicyCheck = {
  name: 'disclosure',
  kind: 'deterministic',
  async run(ctx) {
    const files = changedContentFiles(ctx);
    if (files.length === 0) {
      return { status: 'not-applicable', message: 'no content files changed' };
    }

    const problems: string[] = [];
    for (const file of files) {
      const parsed = readContentFile(ctx.repoRoot, file.path);
      if (!parsed) continue; // frontmatter check reports missing files
      const usesAffiliate = AFFILIATE_MARKERS.some((marker) => marker.test(parsed.body));
      const monetized = parsed.frontmatter?.monetized === true;
      if (usesAffiliate && !monetized) {
        problems.push(
          `${file.path}: contains affiliate links but frontmatter monetized is not true — ` +
            `the AffiliateDisclosure component would not render`,
        );
      }
    }

    return problems.length > 0
      ? { status: 'fail', message: problems.join('; '), details: { problems } }
      : { status: 'pass', message: 'monetized pages correctly declared' };
  },
};
