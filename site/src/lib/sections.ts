// TIER A: pure section configuration.
//
// Lives in its own module because Astro hoists getStaticPaths above the rest of
// a page's frontmatter, so a const declared alongside it is not in scope there.
import type { PageType } from '@atlas/core';

export interface SectionConfig {
  type: PageType;
  label: string;
  blurb: string;
}

/** URL segment -> the page type it lists. */
export const SECTIONS: Record<string, SectionConfig> = {
  guides: {
    type: 'buying-guide',
    label: 'Buying guides',
    blurb: 'How to choose, what matters, and what does not.',
  },
  reviews: {
    type: 'review',
    label: 'Reviews',
    blurb: 'Individual products assessed against the criteria in our guides.',
  },
  comparisons: {
    type: 'comparison',
    label: 'Comparisons',
    blurb: 'Head-to-head, for when the shortlist is already down to a few.',
  },
};

/** Section path for a page type, used by breadcrumbs. */
export function sectionPathFor(type: PageType): string {
  const entry = Object.entries(SECTIONS).find(([, config]) => config.type === type);
  return entry ? `/${entry[0]}` : '/';
}

/** Section label for a page type, used by breadcrumbs. */
export function sectionLabelFor(type: PageType): string {
  const entry = Object.entries(SECTIONS).find(([, config]) => config.type === type);
  return entry ? entry[1].label : 'Articles';
}
