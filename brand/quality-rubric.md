# Content Quality Rubric

Five dimensions, scored 1–5. The composite is the mean. Minimum shippable
composite: **3.5** (`policy/rules.yml → content.min_quality_score`).

Scored by an evaluator model against this rubric with periodic human
spot-checks (spec §3). Re-anchor quarterly against human scoring — an
unanchored LLM rubric drifts toward scoring everything a 4 (plan §13).

<!-- TODO(setup): replace the calibration section with three articles YOU
     scored by hand in the chosen niche (plan §2.4). Anchored examples are
     what keep the evaluator honest; these placeholders only fix the format. -->

## 1. Factual verifiability

- **1:** Contains claims with no traceable source; specs may be invented.
- **3:** Most claims sourced; a knowledgeable reader finds one or two
  unsupported assertions.
- **5:** Every specification, price band, and comparative claim maps to an
  entry in the Sources section; primary sources dominate.

## 2. Intent coverage

- **1:** Answers a different question than the query asks.
- **3:** Answers the main question; misses obvious follow-ups a reader would
  have next.
- **5:** Fully resolves the query and its immediate follow-ups; a reader does
  not need a second search.

## 3. Structural completeness

- **1:** Obvious gaps — missing categories, no criteria, no comparisons.
- **3:** Covers the expected structure; one section a knowledgeable reader
  would notice is thin.
- **5:** No gap a knowledgeable reader would notice; scope boundaries are
  stated explicitly.

## 4. Information originality

- **1:** Pure synthesis of the current top 10 results; adds nothing.
- **3:** Some independent organization or analysis (original comparison
  criteria, decision framework).
- **5:** Contains information or analysis not present in the top 10 results —
  original measurements, aggregated data, a genuinely novel framing.

## 5. Readability and scannability

- **1:** Walls of text; heading hierarchy broken; key facts buried.
- **3:** Scannable structure; some sections overlong; key facts findable.
- **5:** Correct heading hierarchy, front-loaded answers, tables where tables
  beat prose, no filler.

## Calibration examples

| Article | Dim 1 | Dim 2 | Dim 3 | Dim 4 | Dim 5 | Composite | Notes |
|---|---|---|---|---|---|---|---|
| (calibration article A — human-scored) | – | – | – | – | – | – | TODO(setup) |
| (calibration article B — human-scored) | – | – | – | – | – | – | TODO(setup) |
| (calibration article C — human-scored) | – | – | – | – | – | – | TODO(setup) |
