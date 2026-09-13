---
name: validate-exam
description: Run the final pre-deployment audit of one exam module (src/exams/<exam-id>/) on this repo's reusable exam platform — config/contract, question data, cross-test/cross-section consistency, assets, localization, optional-feature wiring, storage safety, build, and (best-effort) runtime checks. Use when the user runs /validate-exam, or asks whether an exam is complete/ready/safe to deploy, after /create-exam and /ingest-questions. Read-only by default; never fixes content, never touches another exam or platform core, never commits/pushes/deploys.
---

# validate-exam

The final step of the exam pipeline:

```
/create-exam → /ingest-questions → /validate-exam → manual visual QA → commit/push → deploy
```

Answers one question: **is this exam complete, internally consistent,
buildable, and ready for manual QA/deployment?** It validates the selected
exam only — it never modifies another exam, GAT (unless GAT is the actual
target), or platform core, and it is read-only by default.

## Before doing anything

1. Read `docs/PLATFORM.md` and `references/validation-matrix.md` (this
   Skill's own reference — it explains *why* this Skill parses
   `questions.js`'s source instead of importing it, and which script/tool
   covers which validation level). If either looks stale against live code,
   trust the live code and say so.
2. Run `git status`. Report anything pending before starting — don't
   stash/discard it. A validation run should not need to change tracked
   files at all (see "Temporary activation" below for the one narrow
   exception, which must always be reverted).
3. Confirm `src/exams/<exam-id>/` exists. **Never validate a different exam
   by assumption** — if the user's exam-id is ambiguous, misspelled, or
   doesn't exist, stop and ask; don't guess the closest match.

## Input

**Required**: target exam ID. If missing, ask — don't default to whichever
exam is currently active (selected by that environment's `VITE_EXAM_ID` —
see `docs/PLATFORM.md`'s "Exam registry" section; that may not be the one
the user means).

**Optional** (ask, or use sensible defaults noted below):
- Whether to temporarily activate the exam for runtime/UI checks (default:
  ask before doing this — see "Temporary activation").
- Whether to run the full build (`npm run build`) — default yes, it's cheap
  and Level 8 is part of "ready to deploy."
- Whether to attempt runtime/browser checks (Level 9) — default: report
  that no browser automation is installed in this repo (confirmed: no
  Playwright/Puppeteer/etc. in `package.json`) and offer manual-QA guidance
  instead, rather than silently skipping the level. Never install a new
  browser/testing framework without explicit approval.
- Expected per-test question counts, if the user has them — used to turn
  "dataset shorter than expected" into a precise BLOCKER instead of just
  reporting a count.

## Safety

- Read-only by default. The only script this Skill runs
  (`scripts/validate-exam-module.mjs`) never writes anything — it imports
  `exam.config.js` (and sibling exams' `exam.config.js`, read-only) and
  reads files with `fs`. The one narrow, optional exception is a small
  targeted edit to `docs/exams/<EXAM-ID>.md`'s validation status fields (see
  "Optional: update the exam documentation file" below) — never a required
  part of validation, and never anything beyond that one file's status
  fields.
- Never modify: another exam's files, GAT's files (unless GAT is the actual
  target), `src/exams/active.js`, `src/exams/registry.js`, `src/App.jsx`,
  anything under `src/components/`, `src/lib/`, `src/styles/`, `src/i18n/`,
  `src/config/brand.js`, or CSS/dependencies — unless the user explicitly
  asks for one of those as a separate, distinct request (that's out of
  scope for a validation run). Runtime/UI validation of a non-active exam
  never requires editing either of the first two files — see "Temporary
  activation" below.
- Never set, unset, or otherwise touch `VITE_EXAM_ID` on any actual
  deployment (e.g. a Netlify site's environment variables) — only ever pass
  it as a one-off env var to a local command (see "Temporary activation").
- Never silently "fix" exam content (a bad answer key, a malformed question,
  a missing asset) — report it. This Skill audits; `/ingest-questions`
  authors.
- Never auto-delete orphan assets. Report them as warnings.
- Never commit, push, or deploy. Never install npm dependencies without
  explicit approval.

### Temporary activation (only if the user asks for runtime/UI validation)

Most of this Skill's checks (Levels 1–4, 7) work by reading
`src/exams/<exam-id>/exam.config.js` and its `data/` files directly — they
**do not require the exam to be active** (see
`references/validation-matrix.md` for why `questions.js`/`index.js` aren't
imported either). Only genuine in-browser rendering (Level 9) needs the
exam to actually be the one selected by `VITE_EXAM_ID`.

Since exam selection is a `VITE_EXAM_ID` build-time env var (see
`docs/PLATFORM.md`'s "Exam registry" section), not a line in a tracked
file, validating a non-active exam's runtime behavior needs **no file
edits and nothing to revert** — pass the variable to the one-off command
instead:

```
VITE_EXAM_ID=<exam-id> npm run dev        # bash
$env:VITE_EXAM_ID="<exam-id>"; npm run dev   # PowerShell
```

Confirm first that `<exam-id>` is actually registered in
`src/exams/registry.js` — if it isn't (e.g. `/create-exam` was run but
registration was skipped), the dev server will start but the app will
throw immediately on load with "Unknown VITE_EXAM_ID"; report that as a
registration gap, not a runtime bug in the exam itself, and stop rather
than trying to work around it.

Because this never touches a tracked file, there is nothing to restore and
no `git status`/`git diff` check needed afterward for this step specifically
— the one thing to still never do is set `VITE_EXAM_ID` on an actual
deployment (Netlify) to "activate" the exam for this check; the env var
only needs to exist for the local command's process, not persisted
anywhere.

## Validation levels

See `references/validation-matrix.md` for the full level → check → tool
mapping and the field-by-field contract this all derives from. Summary of
what runs where:

1. **Module/config contract** — required files, field presence/types,
   section/test-key/id uniqueness, icon validity, locale validity, timer,
   `performance.byCategory` ↔ `categories` consistency, marketing/
   leadCapture shape, storagePrefix uniqueness across all exams. Run:
   ```
   node .claude/skills/validate-exam/scripts/validate-exam-module.mjs --exam-id <exam-id> [--expected-counts key=n,key2=n2] --json
   ```
2. **Question data** — reuse `ingest-questions/scripts/validate-ingestion.mjs`,
   invoked once per configured test file (see validation-matrix.md for the
   exact invocation and how to get the testKey→file list). Do not
   re-implement option/answer/KaTeX/OMML checks here.
3. **Cross-test/cross-section consistency** — cross-test id collisions,
   passage-id collisions across passage files, orphan passage references,
   unconfigured data files, foreign-exam asset-path leaks, every configured
   test resolving to a real (non-empty, or explicitly reported) dataset.
   Covered by the same `validate-exam-module.mjs` run as Level 1.
4. **Assets** — marketing asset existence, per-question image existence
   exam-wide, orphan question-asset scan. Same script run as Level 1/3.
5. **Localization/RTL** — static config validity is checked by the script;
   the actual rendered behavior (does `dir="rtl"` really take effect, do
   generic UI strings resolve, does question-content direction stay
   independent of platform direction per `docs/PLATFORM.md`) is Level 9.
6. **Optional features/conditional UI** — config-level consistency (e.g.
   `performance.byCategory: false` ⇒ no `categories` key at all) is checked
   by the script; whether the Performance-by-Skill button/weakest-category
   UI actually appears or is actually absent at runtime is Level 9.
7. **Storage/persistence safety** — storagePrefix uniqueness, and a check
   that this exam's own `questions.js` generates ids with *this* exam's
   prefix rather than a copy-pasted `GAT-` (or another exam's) prefix. Same
   script run.
8. **Build** — `npm run build` from the `GAT app/` directory. Record
   success/failure and any new warnings; don't fail solely on a
   pre-existing baseline warning unless it's clearly a regression.
9. **Runtime/browser** — best-effort only; see below.
10. **Deployment readiness** — synthesized by you into the final report,
    not a separate check.

### Level 9 — runtime/browser checks (best-effort)

This repo has **no browser automation installed** (`package.json` has no
Playwright/Puppeteer/testing-library — confirmed by inspection, not
assumed). Do not install one without explicit user approval — that's a
dependency change, out of this Skill's default scope.

Default behavior: report Level 9 as "not run — no browser tooling
available" and list, as a checklist for the user's own manual QA pass, the
concrete flow to click through (Home → section → test selection → timer
toggle → start → answer questions → navigator → mark for review → submit →
Results → category performance if enabled → Review → Practice Mistakes →
promo → Lead Form → dark/light → mobile viewport), plus the specific
things to look for given this exam's config (e.g. "confirm the page is
RTL and Arabic-labeled" for an `ar`/`rtl` exam, or "confirm no
Performance-by-Skill button appears" for `byCategory: false`). This is not
a failure — it's an honest "still needs a human," which is exactly what
the final report's status field should say.

If the user has separately set up browser tooling (or explicitly approves
installing one for this run), you may use it — start the dev server with
`VITE_EXAM_ID=<exam-id>` set (see "Temporary activation"), exercise the flow
above, and watch the console for new errors.

## Severity model

- **BLOCKER** — build failure; missing/empty dataset for a configured test;
  invalid `correctAnswer`/option shape; missing referenced image or
  marketing asset; broken passage reference; duplicate id/test-key/
  section-id/passage-id; malformed required config field; asset path not
  scoped to this exam (or leaking another exam's); `leadCapture.enabled`
  with no working webhook wiring; a localization/runtime failure that makes
  the exam actually unusable.
- **WARNING** — orphan/unreferenced asset; known/pre-existing build
  warning; a config value that deviates from a naming *convention* without
  breaking anything (e.g. `storagePrefix` not matching `leen_<id>`);
  unknown section icon (graceful fallback exists); untested optional path;
  manual visual QA still required (this one is essentially always present
  until a human has actually clicked through the app).
- **INFO** — counts, section/test summary, feature flags, locale, what was
  and wasn't checked.

Don't inflate every finding to BLOCKER — a build that succeeds with one
pre-existing bundle-size warning is not a failed build.

## Report

Produce a concise, operational report with these sections: exam identity;
overall status (`READY FOR MANUAL QA` or `NOT READY — BLOCKERS FOUND`);
config summary; locale/direction; sections/tests; total question count;
per-test question counts; category-performance enabled/disabled; question
validation results (aggregated from every `validate-ingestion.mjs` run);
asset validation results; passage validation results; math validation
results; storage/persistence validation; marketing/lead validation; build
result; runtime/browser result (or "not run — manual QA required, see
checklist"); blockers; warnings; current `git status`; and the exact
recommended next step.

### Machine-readable output

Also write a `validation-report.json` (a temporary artifact — do not place
it under `src/exams/<exam-id>/` or otherwise treat it as exam data; a
scratch location or the project root is fine, and don't commit it unless
the user explicitly asks) shaped like:

```json
{
  "examId": "...",
  "timestamp": "...",
  "status": "READY_FOR_MANUAL_QA | NOT_READY",
  "blockers": [ /* merged from validate-exam-module.mjs + every validate-ingestion.mjs run */ ],
  "warnings": [ /* same */ ],
  "stats": { /* validate-exam-module.mjs's stats object: sections, testKeys, testCounts, totalQuestions, storagePrefix, locale, performanceByCategory, leadCaptureEnabled, marketing */ },
  "build": { "ran": true, "ok": true, "warnings": [] },
  "runtime": { "ran": false, "reason": "no browser tooling installed", "manualChecklist": [ "..." ] }
}
```

Assemble this yourself from the scripts' own `--json` output plus the
build/runtime results — the scripts don't write this combined file
themselves.

### Optional: update the exam documentation file

If `docs/exams/<EXAM-ID>.md` already exists (see `docs/PLATFORM.md`'s "Exam
documentation convention"), you may, after this run, make a small targeted
edit updating its validation status/date and question-count fields to match
this run's results. Never rewrite the whole file, never touch any other
section, and skip this silently if the file doesn't exist or if it would
complicate an otherwise-clean read-only run — this is a best-effort
convenience, not a required output of validation.

## Scripts

- `scripts/validate-exam-module.mjs` — this Skill's own deterministic
  helper: exam-module/config contract (Level 1), cross-test/cross-section
  consistency (Level 3), assets (Level 4), and storage/id-prefix safety
  (Level 7). See its file header and `references/validation-matrix.md` for
  why it statically parses `questions.js` instead of importing it, and run
  it with `--exam-id <id> [--expected-counts k=n,...] --json`.
- Reuse `.claude/skills/ingest-questions/scripts/validate-ingestion.mjs` for
  Level 2 (per-test question-data checks) — do not duplicate its option/
  answer/KaTeX/OMML/category logic in a new script.

Only add a new script here if a genuinely new deterministic check would
materially improve reliability and doesn't already belong in one of the
two above.

## Critical principles

- Read-only by default; Level 9's temporary activation (only if asked) is a
  one-off `VITE_EXAM_ID=<exam-id>` env var passed to the dev-server command,
  never a file edit — so there is no file to revert or diff to check.
- Never silently fix exam content, never auto-edit platform core, never
  auto-delete assets, never auto-deploy, never commit, never push, never
  install dependencies without explicit approval.
- Reuse `validate-ingestion.mjs` for question-level checks rather than
  duplicating its logic.
- Validate actual repository behavior (by reading real files/config), not
  assumptions carried over from a reference doc or a prior run.
- Don't invent config values to make a check pass — a missing/invalid field
  is a finding to report, not something to fill in.

## Report — final step

After running the levels above, report to the user using the "Report"
section's structure, plus:
- Exact command(s) run for reproducibility, including any `VITE_EXAM_ID`
  value used for Level 9.
- Confirmation that no tracked file (`src/exams/active.js`,
  `src/exams/registry.js`, or otherwise) was left changed — Level 9's
  temporary activation is env-var-only, so there should be nothing to
  restore — other than `docs/exams/<EXAM-ID>.md`'s status fields, if that
  optional update was made; state plainly whether it was.
- Current `git status`.
- The exact recommended next step (usually: fix BLOCKERs and re-run;
  or, if clean, "run manual visual QA using the Level 9 checklist, then
  commit/push/deploy" — never suggest deploying yourself).

Do not commit, push, or deploy. Do not run destructive git commands.
