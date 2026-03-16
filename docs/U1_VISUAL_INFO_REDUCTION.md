# U1 Visual And Information Reduction

Last updated: 2026-03-17
Status: design baseline before implementation

## Goal

Turn the current system from data-stacked pages into product-expression pages.

The target is not "more visual". The target is "more obvious":

- parent sees where the child is stuck at a glance
- student sees what to do first today at a glance
- primary information beats secondary information
- charts express problem, change, and stability directly

## Why U1 Now

The current product baseline is already functionally rich:

- diagnosis
- recheck
- timeline
- followup funnel
- closure / continue-tracking page
- role-based front-stage shell
- membership state shell

What is weak now is not core capability but page expression:

- too much information
- weak hierarchy
- mixed roles
- overlong copy
- inconsistent visual semantics

So this round prioritizes page convergence over new features.

## Core Principles

### 1. One page, one center

- Parent overview: should answer whether continued tracking is worth it.
- Student home: should answer what to do first today.
- Membership page: should answer what changes between tiers.

### 2. Conclusion first, explanation second

Each card should prefer this structure:

- short title: 6-10 Chinese characters
- one-line conclusion: 12-22 Chinese characters
- optional one-line explanation
- detailed content pushed down or visually weakened

### 3. Three information levels

First-level information must be visible on first screen:

- current biggest blocker
- what to do this week
- still unstable step
- why continued tracking still matters

Second-level information can sit below first screen:

- weekly change summary
- current membership state
- latest recheck result
- recommended asset

Third-level information must sink:

- upload details
- raw filename
- tag details
- long historical explanation

### 4. One main chart per page

Do not stack many charts on one page.

Per page maximum:

- 1 main chart
- 2 small charts or status strips

### 5. Reduce information before changing skin

This round should first remove noise and reorder content.
Only after hierarchy is stable should styling details be refined.

### 6. Parent page shows value, student page shows action

- Parent page should tell why to keep going.
- Student page should tell what to do next.

## Color System

### Status colors

- red: high risk / current blocker / pending action
- orange: unstable / still needs attention
- blue: in progress / this week's focus
- green: stabilized / completed
- gray: explanatory weak information

### Usage rules

- Red should only mark the single most important risk.
- Orange is for "not stable yet".
- Blue is for current weekly action.
- Green is for already stabilized items.
- Gray is for supporting information, not decisions.

## Chart Strategy

Charts are used to reduce reading cost, not add decoration.

### Chart A: horizontal bar chart

Primary use:

- show the severity or stability of the current key issues

Good fields:

- line-trigger timing
- graph relation extraction
- proof chain
- recheck stability

Rules:

- one horizontal bar per item
- 0-100 or 1-5 scale
- red / orange / blue / green fill
- keep only 4 items, never more than 5

Placement:

- parent overview main chart
- student home compact chart

### Chart B: 4-week change bar chart

Primary use:

- show whether the student is moving over the last 4 weeks

Good fields:

- weekly main-problem severity change
- weekly recheck result change
- weekly stabilized-item count

Rules:

- 4 bars only
- latest week darker
- color progression from red to orange to blue to green when appropriate

Placement:

- parent overview lower section
- timeline summary area

### Chart C: membership comparison matrix or bars

Primary use:

- explain trial vs self-service vs coaching without long paragraphs

Rules:

- capability list on the left
- three columns on the right: trial / self-service / coaching
- use checkmarks, muted gray, and emphasis color

Placement:

- membership page main chart area

### Charts not recommended in U1

- pie chart
- radar chart
- complex line chart
- stacked multi-dimensional chart

Reason:

They increase parent understanding cost and weaken fast decision-making.

## Page Reconstruction Plan

## Parent Overview

### Page goal

Parent should understand in 5 seconds:

- where the child is currently stuck
- what to focus on this week
- which step is still unstable
- why continued tracking still matters

### First screen structure

- one top summary sentence
- first row: four first-level cards
  - current blocker
  - this week's action
  - still unstable step
  - why continue tracking
- second row: one main horizontal bar chart
- third row:
  - one-line weekly change
  - timeline entry
  - continue-tracking CTA

### Remove from first screen

- long upload details
- long parent summary paragraphs
- filename prominence
- dense tag piles

## Student Home

### Page goal

Student should understand in 3 seconds:

- what to practice first today
- what is still hardest
- whether the latest attempt improved
- what the next recheck targets

### First screen structure

- one top sentence
- first row: four first-level cards
  - do this first today
  - latest result
  - this week's focus
  - next recheck target
- second row:
  - compact current-problem bar chart
  - optional 4-week change mini chart
- third row:
  - today action card
  - one recommended asset
  - recheck / timeline entry

### Remove from first screen

- long explanatory paragraphs
- too many badges
- raw file-level metadata

## Membership Page

### Page goal

Parent should quickly understand:

- what trial covers
- what self-service adds
- what coaching adds

### Structure

- one top summary sentence
- main membership comparison chart
- three short tier cards:
  - who it is for
  - what it includes
  - what changes from previous tier
- final CTA area

### Remove

- long marketing paragraphs
- repeated copy without real difference
- over-explained benefits

## Left Navigation Reconstruction

### Grouping

Parent view:

- parent overview
- membership

Student view:

- student home
- math
- english

System / operations:

- upload
- review queue
- timeline

### Rules

- do not flat-list every entry
- do not exceed 7 directly visible entries
- secondary functions should collapse or move lower

## Copy Rules

Copy must be:

- direct
- short
- conclusion-led
- low-jargon
- Chen-teacher conversational

Example rewrite:

- bad: 当前孩子在几何辅助线意识方面存在明显提升但稳定性不足
- good: 这类题开始有感觉了，但什么时候该出线还没稳

## Suggested Implementation Order

### Stage 1

Only change structure and copy. No complex logic change.

### Stage 2

Add chart system and color system.

### Stage 3

Do local visual refinement.

## Acceptance Standard

U1 is only complete if all are true:

1. Parent overview first screen is understandable within 5 seconds.
2. Student home first screen shows the next action within 3 seconds.
3. Membership page makes tier difference obvious at a glance.
4. Each page keeps only one main chart.
5. Multi-student switching still does not leak across students.
6. `npm run build` passes.
7. `npm exec playwright test` passes.


## Code Landing Table

### Parent overview page

Target files to modify:

- `app/parent-overview/page.tsx`
- `lib/db/a5.ts`
- `components/section-card.tsx` only if shared card hierarchy needs a minimal visual token adjustment

Allowed in this round:

- reorder sections
- remove or sink first-screen modules
- shorten copy
- add lightweight state-bar or change-bar presentation based on existing snapshot fields

Forbidden in this round:

- `app/api/**`
- `lib/db/a43.ts`
- `lib/db/heartbeat.ts`
- `lib/db/recheck.ts`
- schema / membership / followup / heartbeat business logic files

### Student home page

Target files to modify:

- `app/student-home/page.tsx`
- `lib/db/a5.ts`
- `components/section-card.tsx` only if shared card structure needs a minimal adjustment

Allowed in this round:

- collapse first-screen cards to four blocks
- sink long explanation and raw detail
- add compact state-bar and optional 4-week change mini chart with existing fields

Forbidden in this round:

- `app/api/**`
- `lib/db/recheck.ts`
- `lib/db/heartbeat.ts`
- `lib/db/membership.ts`
- any data-contract or persistence-layer rewrite

### Membership page

Target files to modify:

- `app/membership/page.tsx`
- `lib/db/a5.ts`
- `components/membership-tier-actions.tsx` only for presentation alignment, not behavior change
- `components/section-card.tsx` only if needed for shared layout consistency

Allowed in this round:

- replace long text-first layout with tier-difference layout
- add capability-by-tier comparison chart or comparison table
- shorten tier copy and CTA framing

Forbidden in this round:

- `app/api/admin/memberships/[studentId]/route.ts`
- `lib/db/membership.ts`
- tier logic, activation rules, or entitlement behavior
- payment / subscription related files

### Left navigation

Target files to modify:

- `components/app-shell.tsx`
- `app/layout.tsx` only if shell grouping needs minimal wrapper support

Allowed in this round:

- regroup navigation into parent view / student view / system-operations
- reduce directly visible entries
- adjust labels and grouping headers

Forbidden in this round:

- student switching logic
- auth / session logic
- admin route behavior
- backend permission checks

### Round-wide allowed files

- `app/parent-overview/page.tsx`
- `app/student-home/page.tsx`
- `app/membership/page.tsx`
- `components/app-shell.tsx`
- `components/section-card.tsx` if needed
- `components/membership-tier-actions.tsx` for presentation only
- `lib/db/a5.ts`

### Round-wide forbidden files

- all `app/api/**`
- all schema / migration / table-definition files
- `lib/db/membership.ts`
- `lib/db/recheck.ts`
- `lib/db/heartbeat.ts`
- `lib/db/a43.ts`
- admin operation pages and managers
- any file whose change would alter backend contract, student isolation, or membership behavior

## Chart Measurement And Semantics

### Parent overview main chart

The parent overview main chart should be a four-state horizontal bar, not a fake 0-100 precision score.

Required semantics:

- red = current biggest blocker
- orange = still unstable
- blue = actively being pushed this week
- green = already stabilized

Rules:

- each row represents one key issue
- no pseudo-exact score like 73 or 84
- use ordinal state only
- keep 4 rows, at most 5
- first row should be the current biggest blocker

### Timeline summary chart

The timeline summary area should use one of these two lightweight forms:

- 4-week change bars
- stabilized-item-count columns

Rules:

- only 4 recent weeks
- latest week visually heavier
- express direction and stability, not fake precision
- reuse red / orange / blue / green semantics where possible

### Membership page main chart

The membership page main chart should be a capability-item x 3-tier comparison bar or comparison table.

Required columns:

- trial
- self-service
- coaching

Required row examples:

- continuous recheck
- weekly report
- timeline
- targeted assets
- teacher correction
- reminder / followup strength

Rules:

- the purpose is tier difference clarity
- do not use long narrative paragraphs as the main expression
- do not use pie, radar, or complex line charts

### Shared color semantics

Color semantics are fixed in U1:

- red = current biggest blocker
- orange = still unstable
- blue = in active progress this week
- green = stabilized
- gray = supporting secondary information only

## U1 Acceptance Checklist

The round is not complete unless all items below are true:

- Parent overview first screen keeps only 4 first-level blocks.
- Student home first screen keeps only 4 first-level blocks.
- Each page keeps only 1 main chart and at most 2 small charts.
- Upload detail, raw filename, and long summary are all sunk below first screen.
- Backend contract is unchanged.
- Multi-student switching remains isolated and does not leak across students.
- `npm run typecheck` passes.
- `npm run build` passes.
- `npm exec playwright test` passes.
