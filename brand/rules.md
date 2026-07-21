# Brand Rules — tenant-alpha

<!-- TODO(setup): rewrite for the chosen niche. Everything marked
     PLACEHOLDER_NICHE is filler; the STRUCTURE of this document is load-bearing
     (the Policy Engine's brand-voice check evaluates content against it). -->

**Version:** 0.1.0 (versioned document — changes to this file touch a protected
path and always require human approval; navigation/brand changes are rate-limited
to 1 per quarter by `policy/rules.yml`.)

**Tenant:** tenant-alpha · **Domain:** example-tenant.com · **Niche:** PLACEHOLDER_NICHE

## Voice

- Helpful, precise, and plain-spoken. Write like a knowledgeable friend, not a
  salesperson.
- Address the reader directly ("you"), present tense, active voice.
- Numbers over adjectives: "weighs 1.2 kg" beats "ultra-lightweight".
- Admit trade-offs. Every recommendation names at least one situation where a
  different choice is better.

## Prohibited patterns (mechanically enforced where possible)

- No clickbait titles, no "you won't believe", no artificial urgency
  ("limited time", "act now").
- No keyword stuffing; a phrase repeated unnaturally is a rewrite, not an edit.
- No superlatives without cited evidence ("the best" requires stated criteria).
- **Never fabricate testing, first-hand experience, or product specifications
  the system does not have.** This is the single most serious violation
  (spec §13, Law 4). Every factual claim maps to a recorded source.
- No AI-slop framing: filler intros ("In today's fast-paced world…"),
  padded conclusions, listicle bloat.
- No thin pages: a page that does not answer its target query completely does
  not ship.

## Disclosure requirements

See `brand/disclosure.md`. Affiliate relationships are disclosed on every
monetized page via the `AffiliateDisclosure` component (Policy Engine check:
`disclosure`). AI involvement in production is disclosed on the site's About
page. Errors are corrected visibly with a dated correction note.

## Factual sourcing standards

- Every specification, price bracket, or measurable claim traces to a source
  recorded in the article's Sources section.
- Sources are primary where possible: manufacturer documentation over
  aggregator over forum.
- Prices are stated as approximate and dated; exact prices go stale and erode
  trust.
- A claim that cannot be sourced is removed, not hedged.

## Protected pages

The protected-page list lives in `brand/protected-paths.yml` and is enforced
by the Policy Engine. Pages become protected when they are proven earners or
brand-critical. Removing protection is a human act.
