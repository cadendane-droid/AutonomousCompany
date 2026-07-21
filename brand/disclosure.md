# Disclosure Policy

Trust is the one asset with no rollback (spec §13). Disclosure is therefore a
hard constraint enforced by the Policy Engine, not an editorial preference.

## Affiliate disclosure

- Every monetized page renders the `AffiliateDisclosure` component **above the
  first affiliate link**, visible without interaction, not in a footer.
- Frontmatter `monetized: true` is required on any page containing affiliate
  links; the Policy Engine `disclosure` check fails a PR where affiliate links
  appear on a page not marked monetized.
- Canonical wording (component source of truth:
  `site/src/components/AffiliateDisclosure.astro`):

  > This page contains affiliate links. If you buy through them we may earn a
  > commission at no extra cost to you. Our recommendations are based on the
  > research and criteria described in each article — commissions never decide
  > rankings.

  <!-- TODO(setup): have the wording reviewed for the affiliate program's
       specific compliance requirements (PLACEHOLDER_PROGRAM) and applicable
       law (e.g. FTC endorsement guides for US audiences). -->

## AI involvement disclosure

The About page states plainly that content is produced with AI assistance
under human editorial review, and describes the fact-check process. This is a
commitment from spec §13, not decoration.

## Corrections

Errors are corrected visibly: a dated correction note on the page, not a
silent edit. The correction is also logged as a decision (kind: content).
