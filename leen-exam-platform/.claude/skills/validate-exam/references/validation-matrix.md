# Validation matrix (as implemented in this repo)

This documents what actually checks what, so `/validate-exam` doesn't
duplicate logic across scripts or re-explain the platform contract that
`docs/PLATFORM.md` and `create-exam/references/exam-module-contract.md`
already own. **If this file and the live code disagree, trust the live
code** — re-read `src/exams/gat/*.js`, `src/App.jsx`, and
`src/components/*.jsx`.

## Why this Skill doesn't `import` an exam's `questions.js`/`index.js`

Confirmed against this repo's Node version: `questions.js` does bare
`import x from "./data/foo.json"`, which Vite (this project's build tool)
handles transparently but plain Node's ESM loader does not — it throws
`ERR_IMPORT_ASSERTION_MISSING` without an import attribute `questions.js`
doesn't have. `exam.config.js` and `categories.js` have no JSON imports and
import cleanly under plain Node (this is exactly what
`ingest-questions/scripts/validate-ingestion.mjs` already relies on for
`--exam-config`).

So `scripts/validate-exam-module.mjs`:
- **Does** dynamically `import()` `exam.config.js` (and sibling exams'
  `exam.config.js`, for the storagePrefix-collision check).
- **Does not** import `questions.js`/`index.js`. Instead it statically
  parses `questions.js`'s source text (regex over its `import`/
  `buildTestQuestions(...)` calls and its `` id: `<PREFIX>-${...}` ``
  template) to recover the testKey → data-file mapping and id prefix, then
  reads the raw `data/*.json` files directly with `fs`. If a `questions.js`
  has genuinely diverged from the documented pattern, the script reports a
  warning and skips the checks that depend on it rather than guessing.

This also means those checks reflect the *actual current data files*, not
a build artifact or a possibly-stale import cache.

## Level → who checks it

| Level | What | How |
|---|---|---|
| 1. Module/config contract | required files, field presence/types, id/section/test-key uniqueness, icon validity, locale validity, timer, categories↔performance consistency, marketing/leadCapture shape, storagePrefix uniqueness across exams | `scripts/validate-exam-module.mjs` |
| 2. Question data (per test file) | kind/option/answerLabel/correctAnswer shape, duplicate questions, OMML leftovers, KaTeX parseability, per-file image existence, passage resolution (single file), category-mapping validity | `ingest-questions/scripts/validate-ingestion.mjs`, run once per `data/<section>/<test-key>.json` — see "Invoking validate-ingestion.mjs for every test" below |
| 3. Cross-test/cross-section | cross-test id-collision (by construction, via id-template + testKey uniqueness), passage-id collisions across passage files, orphan passage references, unconfigured data files, foreign-exam asset-path leaks, dataset-per-configured-test presence, expected-count mismatches | `scripts/validate-exam-module.mjs` |
| 4. Assets | marketing asset (promoVideo/footerBanner) existence, per-question image existence (also covered per-file by Level 2), orphan question-asset scan under `public/questions/<exam-id>/` | `scripts/validate-exam-module.mjs` (exam-wide) + `validate-ingestion.mjs --assets-dir` (per test dir, if you want the narrower per-test orphan check too) |
| 5. Localization/RTL | `locale.language`/`direction` validity and pairing sanity (static) | `scripts/validate-exam-module.mjs` (static half) — the *rendered* half (does the UI actually flip, do generic strings resolve) is Level 9, manual/best-effort, see below |
| 6. Optional features/conditional UI | config-level consistency only (e.g. `performance.byCategory` vs `categories` presence, `leadCapture.enabled` vs webhook wiring) | `scripts/validate-exam-module.mjs` — the *rendered* half (button present/absent, no empty placeholder) is Level 9 |
| 7. Storage/persistence | storagePrefix uniqueness, id-prefix-matches-exam-id (catches a copied `questions.js` template that still hardcodes `GAT-`) | `scripts/validate-exam-module.mjs` |
| 8. Build | `npm run build` | run directly, not scripted (see SKILL.md) |
| 9. Runtime/browser | actual rendering, RTL flip, category UI presence/absence, console errors | **No browser automation is installed in this repo** (no Playwright/Puppeteer in `package.json`, confirmed by inspection) — best-effort/manual only, see SKILL.md's Level 9 section. Do not install one without explicit approval. |
| 10. Deployment readiness | synthesis of the above | assembled by the agent into the final report, not a script |

## Invoking `validate-ingestion.mjs` for every test

`/validate-exam` is exam-wide; `validate-ingestion.mjs` is per-test-file.
Run it once per configured test (the exam-module check above tells you the
exact list of `testKey → data file` pairs), from the project root:

```
node ../ingest-questions/scripts/validate-ingestion.mjs \
  --file src/exams/<exam-id>/data/<section>/<test-file>.json \
  --exam-config src/exams/<exam-id>/exam.config.js \
  [--passages src/exams/<exam-id>/data/<section>/passages-<n>.json ...] \
  [--assets-dir public/questions/<exam-id>/<section>/<test-n>] \
  --json
```

(Path is relative to `.claude/skills/validate-exam/scripts/`; from the
project root it's `.claude/skills/ingest-questions/scripts/validate-ingestion.mjs`.)

Aggregate every invocation's `errors`/`warnings` into the final report's
Level 2 section — a `validate-ingestion.mjs` error is always a BLOCKER, a
warning is always a WARNING (see SKILL.md's severity model for the mapping
of every check to a severity).

## Field-by-field contract reference

Don't re-derive the contract here — it's already documented, in more
detail than this Skill needs to repeat, in:
- `docs/PLATFORM.md` — the narrative architecture doc.
- `.claude/skills/create-exam/references/exam-module-contract.md` —
  field-by-field `exam.config.js`/`questions.js`/`index.js`/`categories.js`
  shapes, plus "Known platform limitations" (promoVideo not null-checked,
  finite icon registry, `index.html`'s static pre-hydration values) — check
  that section before reporting something as a BLOCKER that's actually a
  known, already-documented platform gap.
- `.claude/skills/ingest-questions/references/question-schema.md` — the raw
  question JSON schema, `compareTable`, passages, categories, asset-path
  convention.

If any of those look stale against the live code, trust the live code and
say so in the report — don't silently trust a stale reference doc, and
don't rewrite the doc yourself as part of a validation run (that's a
separate, explicit edit the user should ask for).

## Known platform limitations that are NOT this exam's bug

Copied from `exam-module-contract.md` so a validation run doesn't
misclassify these as exam-specific blockers:

1. `promoVideo` is required but `PopupAd.jsx` renders `<video src={promoVideo}>`
   with no null guard — moot as long as `promoVideo` is actually set (which
   Level 1 already checks), not a separate runtime bug to flag per exam.
2. `SECTION_ICONS` is a finite, curated registry (~15 icons) with a graceful
   `LayoutGrid` fallback for an unknown key — report an unrecognized icon
   key as a WARNING (cosmetic fallback), never a BLOCKER.
3. `index.html`'s static `<title>`/description/theme-color only reflect
   GAT until `App.jsx` runs and overwrites them from the active exam's
   `config.meta` — this only matters pre-hydration/for crawlers, and is a
   platform-wide gap, not something a single exam's validation can fix.

## Severity model — check → severity mapping

See SKILL.md's "Severity model" section for the authoritative list; this
table exists only to point each specific check at its category so the
final report classification is consistent run over run.

| Check | Severity |
|---|---|
| Missing required file/field, invalid enum value (locale, kind) | BLOCKER |
| Build failure | BLOCKER |
| Empty test dataset (0 questions) for a configured test | BLOCKER |
| Duplicate id/test-key/section-id/passage-id | BLOCKER |
| `correctAnswer` not in `answerLabels`, option/label mismatch | BLOCKER |
| Missing referenced image/marketing asset file | BLOCKER |
| Asset path not namespaced to this exam, or leaking another exam's path | BLOCKER |
| `leadCapture.enabled` but webhook global var not wired in `lead-config.js` | BLOCKER |
| `foreign-id-prefix` (questions.js still generates another exam's id prefix) | BLOCKER |
| Unknown section icon (falls back gracefully) | WARNING |
| Orphan/unreferenced asset file | WARNING |
| `storagePrefix`/marketing-copy naming-convention deviation | WARNING |
| Unusual but not-necessarily-wrong locale pairing | WARNING |
| Manual visual QA still required | WARNING (always present in the report until a human confirms it) |
| Question/section/test counts, feature flags, locale | INFO |
