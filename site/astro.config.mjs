import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// TODO(setup): replace with the real domain once chosen. This is the single
// source of truth for the site origin — canonical URLs, sitemap, and JSON-LD
// all derive from it. See OPEN-QUESTIONS.md §1.
const SITE_URL = process.env.SITE_BASE_URL ?? 'https://example-tenant.com';

// Static output: server rendering adds latency, complexity, and CWV risk for
// no benefit on a content site (plan §3.2).
export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'never',
  integrations: [sitemap()],
  build: {
    format: 'file',
  },
});
