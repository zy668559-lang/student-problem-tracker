# Current Sprint

Last updated: 2026-03-16
Sprint type: design-first product refinement round

## This Round Is

This round is the U1 visual and information reduction round.

## Main Goal

Turn the current product from functional data-heavy pages into clearer product-expression pages:

- parent can understand the key issue within 5 seconds
- student can know what to do first within 3 seconds
- primary information is more obvious than secondary information
- charts directly express problem / change / stability

## Only Do In This Round

1. Restructure parent overview page information hierarchy.
2. Restructure student home page information hierarchy.
3. Regroup left navigation by role perspective.
4. Unify visual rules for cards, headings, summaries, buttons, badges, and charts.
5. Produce structure docs and visual rules first, then enter implementation.

## Page-Level Principles

- One page, one center.
- Conclusion first, explanation second.
- Only keep four first-level information blocks per page.
- Only keep one main chart per page, plus at most two small charts or status strips.
- Reduce information first, reskin second.
- Parent page should answer value; student page should answer action.

## Explicitly Forbidden In This Round

- Do not build official payment or subscription charging.
- Do not introduce worker or cron.
- Do not add new business logic.
- Do not refactor base tables at scale.
- Do not build multi-image joint diagnosis.
- Do not do a site-wide visual overhaul.
- Do not add complex animation or decorative motion.

## Done Means

- Parent overview first screen only keeps four first-level blocks:
  - current biggest blocker
  - what to do this week
  - the still-unstable step
  - why continued tracking still matters
- Student home first screen only keeps four first-level blocks:
  - do this first today
  - latest result
  - this week's focus
  - next recheck target
- Left navigation is grouped by:
  - parent view
  - student view
  - system / operations
- Each page keeps one main chart and at most two small charts.
- Charts use a unified red / orange / blue / green status system.
- Parent-facing and student-facing copy shifts to shorter Chen-teacher conversational style.
- A structure doc, visual rule doc, and Codex execution plan exist before implementation.
- After implementation, `npm run typecheck`, `npm run build`, and `npm exec playwright test` must pass.
