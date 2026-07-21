// TIER A: fully working. Internal links must resolve (plan §5.3: "any 404").
//
// Builds the set of valid site routes from the content tree + static pages,
// then verifies every root-relative markdown link in changed content files.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { PolicyCheck } from '../types.js';
import { changedContentFiles, readContentFile } from '../content.js';

function collectRoutes(repoRoot: string): Set<string> {
  const routes = new Set<string>(['/']);
  const contentRoot = join(repoRoot, 'site/src/content');
  if (existsSync(contentRoot)) {
    for (const tenant of readdirSync(contentRoot, { withFileTypes: true })) {
      if (!tenant.isDirectory()) continue;
      const tenantDir = join(contentRoot, tenant.name);
      for (const typeDir of readdirSync(tenantDir, { withFileTypes: true })) {
        if (!typeDir.isDirectory()) continue;
        for (const file of readdirSync(join(tenantDir, typeDir.name))) {
          if (!/\.(md|mdx)$/.test(file)) continue;
          const slug = file.replace(/\.(md|mdx)$/, '');
          routes.add(`/${typeDir.name}/${slug}`);
          routes.add(`/${typeDir.name}/${slug}/`);
        }
      }
    }
  }
  const pagesRoot = join(repoRoot, 'site/src/pages');
  if (existsSync(pagesRoot)) {
    for (const file of readdirSync(pagesRoot)) {
      const name = file.replace(/\.(astro|md)$/, '');
      if (name === 'index') continue;
      if (name.startsWith('[')) continue; // dynamic routes covered by content scan
      routes.add(`/${name}`);
      routes.add(`/${name}/`);
    }
  }
  return routes;
}

export const internalLinks: PolicyCheck = {
  name: 'internal-links',
  kind: 'deterministic',
  async run(ctx) {
    const files = changedContentFiles(ctx);
    if (files.length === 0) {
      return { status: 'not-applicable', message: 'no content files changed' };
    }

    const routes = collectRoutes(ctx.repoRoot);
    const broken: string[] = [];
    for (const file of files) {
      const parsed = readContentFile(ctx.repoRoot, file.path);
      if (!parsed) continue;
      // Root-relative markdown links only — external URLs are out of scope here.
      for (const match of parsed.body.matchAll(/\[[^\]]*\]\((\/[^)#\s]*)[^)]*\)/g)) {
        const target = match[1]!;
        if (!routes.has(target) && !routes.has(`${target}/`) && !routes.has(target.replace(/\/$/, ''))) {
          broken.push(`${file.path}: link to ${target} does not resolve`);
        }
      }
    }

    return broken.length > 0
      ? { status: 'fail', message: broken.join('; '), details: { broken } }
      : { status: 'pass', message: 'all internal links resolve' };
  },
};
