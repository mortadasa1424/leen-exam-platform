---
name: ingest-questions
description: Import real exam questions, primarily from Microsoft Word (.docx) source files, into an existing exam module's data/ (created earlier by /create-exam). Use when the user runs /ingest-questions, or asks to import/ingest real questions, a question bank, or a Word doc of exam questions into this repo's exam platform. Prioritizes source fidelity over speed; never invents, corrects, infers, reorders, omits, or rewrites question content. Does not scaffold a new exam (that's /create-exam) and does not run the full platform audit (that's /validate-exam).
---

# ingest-questions

Imports real questions from source files (primarily `.docx`) into one
`src/exams/<exam-id>/data/<section>/<test-key>.json` at a time, for an exam
module already scaffolded by `/create-exam`. This is the step between
scaffolding a new exam and running `/validate-exam`'s full platform audit.

**Source fidelity outranks speed.** When the source is ambiguous, stop and
ask — never silently invent, correct, infer, reorder, omit, or rewrite
question content, an answer, a category, or a passage boundary.

## Before doing anything

1. Read `docs/PLATFORM.md`, `../create-exam/references/exam-module-contract.md`,
   `references/question-schema.md`, and `references/docx-ingestion.md` (the
   last two are this Skill's own references). If anything in a reference
   file looks stale against the live code (`src/exams/gat/questions.js`,
   `src/components/QuestionCard.jsx`), **trust the live code** and mention
   the discrepancy to the user.
2. Run `git status`. If it's not clean, tell the user what's pending before
   writing anything (don't stash/discard it yourself).
3. Confirm the target `src/exams/<exam-id>/` exists (it should — this Skill
   doesn't scaffold exams, `/create-exam` does). If it doesn't, stop and
   suggest `/create-exam` first.
4. Read the target exam's `exam.config.js`, `categories.js` (if present),
   and the specific `data/<section>/<test-key>.json` file(s) you're about
   to touch, plus any existing `passages-*.json` for that section. You need
   to know, before Phase A even starts: does this exam have category
   performance enabled? Is the target test file already populated (not just
   `[]`)? What test keys/section ids actually exist in `exam.config.js`?

## Step 1 — Collect inputs

Ask for whatever the user didn't already supply:

- **Target exam ID** — must match an existing `src/exams/<exam-id>/`.
- **Target section id** and **target test key** — must match entries in
  that exam's `exam.config.js` (`sections[].id`, `sections[].tests[].key`).
  If the user names something that doesn't exist, say so; don't guess the
  closest match.
- **One or more `.docx` source files** — ask for the actual file path(s).
  Tracked source fixtures live under `tests-source/<exam-id>/<section>/`
  (GAT's are under `tests-source/gat/`) — don't assume every future exam's
  sources belong under `tests-source/gat/` too; ask where they live if the
  user hasn't said.
- **Whether category-based performance is enabled** for this exam — you can
  read this yourself from `exam.config.js`'s `performance.byCategory`
  rather than asking, but confirm your reading with the user if the file is
  ambiguous (e.g. the key is entirely absent).
- **Any source-specific instructions** — e.g. "the red-and-struck-through
  section is excluded," "ignore the difficulty labels," "Test 2's answer
  key is in a separate spreadsheet." Ask explicitly; do not assume none
  exist just because the last source you ingested had none, and do not
  assume THIS source follows the same markings/conventions as a source you
  or anyone else ingested previously (see `docx-ingestion.md`'s "Editorial
  markings" section).
- **An optional separate answer-key file**, if the source doesn't have one
  embedded (real GAT sources embed theirs as a table near the end of the
  same document — check for that first before asking for a separate file).

If required information is missing, ask — don't invent a plausible-sounding
value (a guessed section id, an assumed test key, a fabricated category)
and move on.

## Step 2 — Check for existing data before anything else

Read the target `data/<section>/<test-key>.json`. If it's not `[]`
(already has real questions):

**Stop. Do not overwrite or merge silently.** Show the user exactly what's
currently there (question count, a couple of sample questions) and ask
explicitly whether this is:
- a fresh re-ingestion meant to replace it entirely,
- an append/merge into the existing set, or
- a mistake (wrong test key).

Only proceed once the user has explicitly told you which. The same applies
to any `passages-*.json` file you'd be writing into, and to any
`public/questions/<exam-id>/...` asset path that already has files in it.

## Phase A — Inspect / Plan

Do this fully, for every source file, before writing anything to
`src/exams/` or `public/`.

1. Run `scripts/docx-inspect.ps1 -DocxPath <file>` for each source
   document. It unzips the `.docx` (zero dependencies — `.docx` is already
   a ZIP; see `references/docx-ingestion.md`) and extracts `document.xml`,
   the rels file, every OMML block (numbered, in order), the image
   reading-order sequence, and a structural summary (paragraph/table/OMML/
   image counts, distinct paragraph-style names, distinct colors,
   strikethrough/highlight/comments presence) into a temp folder. Read its
   `summary.txt` first.
2. Read the extracted `document.xml` directly (`Grep`/`Read`, not a mental
   re-derivation) to identify:
   - **Question boundaries** — check `w:pStyle` names first (real GAT
     sources use custom styles like `Question`, `AnswerChoices`, `Lesson`,
     `Diff` — see `docx-ingestion.md`); fall back to positional/textual
     heuristics only if no useful custom styles exist, and say so.
   - **Answer-key structure** — check inside the same document first (GAT's
     sources embed a `"... Answer Key"` heading followed by a table of
     `Question | Answer` pairs near the end) before assuming a separate
     file is needed.
   - **Media** — cross-reference `media-order.txt` (reading order) against
     which images are actually used in body content vs. leftover/header art
     (`docx-extract-media.ps1` also reports this when you get to Phase B).
   - **OMML/math** — read `omml-blocks.txt`; plan the OMML→LaTeX conversion
     per `docx-ingestion.md`'s element table.
   - **Tables** — distinguish the answer-key table from any in-question
     table; check whether an in-question table actually fits the
     `compareTable` (2-column comparison) shape or needs to be reported as
     a platform limitation.
   - **Passages** — detect reading-comprehension groupings and which
     questions share a passage; do not assume passage boundaries purely
     from heading text if the source groups them another way (e.g.
     sequential numbering with no heading).
   - **Categories/editorial markings** — read the "CATEGORIES" and
     "SOURCE-SPECIFIC MARKINGS" guidance below and in `docx-ingestion.md`
     before concluding what any color/strikethrough/heading means for
     *this* source.
3. Determine the **expected final question count** (source count minus any
   questions you and the user have explicitly agreed to exclude).
4. **Present an ingestion summary to the user before Phase B**, including:
   question count found vs. expected to import, category taxonomy status,
   any ambiguous/flagged items (a suspected source error, an unclear
   editorial marking, a table that doesn't fit the schema, a math
   expression you're unsure how to convert), and exactly what files will be
   written/overwritten. Get explicit approval before large or
   overwrite-risk writes — a first ingestion into an empty `[]` file for a
   brand-new test doesn't need the same level of ceremony as replacing an
   already-populated one, but always report the plan either way.

## Phase B — Import

Only after Phase A's ambiguities are resolved with the user.

1. **Extract required media** with `scripts/docx-extract-media.ps1`,
   writing into `public/questions/<exam-id>/<section-id>/<test-key-or-n>/`
   (see `references/question-schema.md`'s "Asset path convention" — every
   exam, GAT included, gets its own exam-id segment; never write into
   another exam's `public/questions/<other-id>/...` path). Use descriptive filenames
   (`q06-triangles-abc-dbc.png`, not `image7.png`). Never overwrite an
   existing asset file without `-Force` and explicit user confirmation.
2. **Generate the question JSON** per `references/question-schema.md` —
   exact field shapes per `kind`, `options`, `compareTable`, provenance
   (`sourceRef`, `sourceQuestionNumber`, `reviewStatus`). Preserve source
   order. Do not add `id`/`section`/`testKey`/`order`/`mathLayout` (see
   that reference for why).
3. **Generate/update passage data** if the section has RC-style questions —
   store each shared passage once, reference it by `passageId`.
4. **Apply category mapping** if `performance.byCategory` is `true`:
   - Use categories explicitly present in the source.
   - Map specific→general using the target exam's `categories.js`
     (`SPECIFIC_TO_GENERAL`).
   - **Never invent a mapping silently.** A specific category with no
     existing mapping entry is reported to the user; add the entry only
     after they confirm which general category it belongs to.
   - If `performance.byCategory` is `false`, don't require/invent category
     fields at all — leave `specificCategory: ""` and omit `generalCategory`
     if the source has nothing meaningful there.
5. **Set `correctAnswer` from the explicit answer key**, never by solving
   the question yourself. Cross-check:
   - every imported question has a matching answer-key entry,
   - every answer-key entry maps to exactly one question,
   - answer labels are valid for that question's actual option set.
   If the answer key conflicts with something that looks like an inline
   marking in the question body (bold, underline, a "Correct" style that
   turns out to actually mark something), **the explicit answer key wins**
   — set `correctAnswer` from it and report the conflict; do not silently
   trust the inline marking instead.
   If there is genuinely no explicit answer key anywhere (not embedded, not
   supplied separately), **do not solve the questions to fabricate one** —
   report this to the user and ask how they want to proceed.
6. Write only to the target exam/section/test's files. Never touch GAT's
   data (unless GAT is genuinely the target exam), another section/test in
   the same exam, platform core (`src/App.jsx`, `src/components/`,
   `src/lib/`, `src/styles/`), or another exam's files.

## Validation after ingestion

Run `scripts/validate-ingestion.mjs` (see
`references/validation-checklist.md` for the full list of what it checks
and the manual checks it can't automate) from the project root:

```
node .claude/skills/ingest-questions/scripts/validate-ingestion.mjs \
  --file src/exams/<exam-id>/data/<section>/<test-key>.json \
  --passages src/exams/<exam-id>/data/<section>/passages-<n>.json \
  --exam-config src/exams/<exam-id>/exam.config.js \
  --assets-dir public/questions/<exam-id>/<section>/<test-key>
```

It mechanically checks option/label consistency, `correctAnswer` validity,
duplicate questions, missing `sourceRef`, real KaTeX-parseability of every
math string (using the project's already-installed `katex` package — no
new dependency), leftover raw OMML/XML, image-file existence, passage-
reference resolution, answer-key coverage (if `--answer-key` is given), and
category-mapping validity (skipped entirely if `performance.byCategory` is
false). Fix root causes and rerun rather than hand-patching around
individual failures. Then do the manual checks in
`validation-checklist.md` (source-fidelity spot-checks, `git status`/`git
diff --stat` scoped to confirm nothing unintended changed, confirming every
Phase A ambiguity was actually resolved before being written as
`reviewStatus: "final"`).

This is **not** a substitute for `/validate-exam`'s eventual full-platform
audit — it only checks what this specific ingestion touched.

## Platform limitations — report, don't patch

If the source needs something the current schema/renderer genuinely can't
represent (a table shape beyond `compareTable`'s 2-column comparison, a
passage direction/RTL need that `PassagePane`/`QuestionText`'s hardcoded
`dir="ltr"` doesn't support, more option letters than `QuestionCard.jsx`'s
`LETTERS` list covers, a difficulty-level field with no home in the current
schema), **stop and report it** rather than editing platform core
(`src/components/QuestionCard.jsx`, `src/lib/`, the exam-module contract)
to accommodate one source. That's a platform-level decision outside this
Skill's scope — the user decides whether it's worth a platform change.

## Safety rules

- Never overwrite an existing populated test file without the explicit
  approval described in "Step 2" above.
- Never touch GAT's datasets when ingesting for a different exam; never
  touch another section/test in the target exam; never touch platform core,
  CSS, scoring logic, or components.
- Never write into another exam's `public/questions/<other-id>/` path.
- Never fabricate questions, options, answers, categories, passages, or
  source content — including "fixing" a suspected source typo/error
  without flagging it, or filling an ambiguous gap with a plausible guess.
- Never solve a question to invent a missing answer key.
- Never install npm dependencies (this Skill's scripts use only Node/
  PowerShell builtins plus the `katex` package already in
  `node_modules`) without explicit user approval.
- Never commit or push. Never run destructive git commands.

## Step — Report

At the end of Phase B (or at the end of Phase A, if the user asked only for
an inspection/plan), report:

1. Exam/section/test targeted, and the exact file list created/modified.
2. Source file(s) ingested, and the extraction method used per file
   (custom-style detection vs. positional heuristic).
3. Question count: found in source, excluded (and why, per source-specific
   instruction), and finally imported.
4. Answer-key strategy used (embedded table / separate file) and the
   cross-check result (coverage, conflicts if any).
5. Media: files extracted, target paths, any detected unused/duplicate
   media left uncopied.
6. Math/OMML: how many expressions converted, any that needed manual
   judgment calls, any that failed KaTeX validation and how they were
   fixed.
7. Tables: how many `compareTable`s produced; any table reported as a
   platform limitation instead.
8. Passages: how many passages created/reused, and their question
   groupings.
9. Categories: mapping status (all mapped / some flagged unmapped and how
   resolved), or "not applicable — performance.byCategory is false."
10. Any source-specific editorial marking encountered and how it was
    interpreted (with the user's confirmation noted).
11. Any item still flagged for manual review (`reviewStatus` other than
    `"final"`), and why.
12. Validation script result (pass/fail, error/warning counts) and the
    manual-check results.
13. Current `git status`.
14. Next recommended step: `/validate-exam` (once it exists) or manual QA
    in the running app.

Do not commit or push. Do not run destructive git commands.

## Reference

- `references/question-schema.md` — the raw question JSON schema per
  `kind`, `options`, `compareTable`, passages, categories, provenance
  fields, and the asset path convention.
- `references/docx-ingestion.md` — OpenXML package structure, question/
  section boundary detection, answer-key location, OMML→LaTeX conversion,
  tables, images, and editorial-marking caution.
- `references/validation-checklist.md` — what `validate-ingestion.mjs`
  checks mechanically, and the manual checks it can't automate.
- `scripts/docx-inspect.ps1` — Phase A: deterministic `.docx` structure
  extraction (zero dependencies).
- `scripts/docx-extract-media.ps1` — Phase B: deterministic media
  extraction with overwrite protection and unused-media detection.
- `scripts/validate-ingestion.mjs` — post-ingestion mechanical validation
  (uses the project's already-installed `katex` package; run from the
  project root).
