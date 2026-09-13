# GAT

The first exam built on the Leen Exam Platform — a free practice app for the
GAT exam: Quantitative and Verbal sections, each with three fixed-form tests.
This doc covers what's specific to GAT; for the generic engine and how a new
exam is added, see [../PLATFORM.md](../PLATFORM.md) and the main
[README.md](../../README.md).

## Exam identity

| Field | Value |
|---|---|
| Exam ID | `gat` |
| Full name | GAT (config `name`/`shortName` both `"GAT"`) |
| Locale / direction | English / LTR (`en` / `ltr`) |
| Deployment `VITE_EXAM_ID` | `gat` — also the default when `VITE_EXAM_ID` is unset, so any deployment with no env var configured serves GAT |
| Storage prefix | `leen_gat` (unchanged from the app's original pre-platform hardcoded keys, so existing saved attempts keep resolving) |

Config source: `src/exams/gat/exam.config.js`.

## Sections / tests

| Section | id | Math rendering | Tests |
|---|---|---|---|
| Quantitative Section | `quantitative` | yes (KaTeX) | `quant1`, `quant2`, `quant3` |
| Verbal Section | `verbal` | no | `verbal1`, `verbal2`, `verbal3` |

## Timer settings

- 60-minute single overall deadline per test (`timer.minutes: 60`), no
  per-question timers.
- Defaults **off** (`timer.defaultOn: false`) — student toggles it on
  manually on the Section Select screen.

## Category-performance setting

`performance.byCategory: true` — GAT has a real skill taxonomy, so Results
shows "Performance by Skill" (weakest-area callout + per-category cards).

**General categories** (`src/exams/gat/categories.js`):

- Quantitative: Arithmetic, Algebra, Statistics & Data Analysis, Geometry,
  Miscellaneous Topics
- Verbal: Analogy, Sentence Completion, Contextual Error, Reading
  Comprehension ("The Odd One Out" was removed from the platform entirely —
  the few Odd One Out questions in Verbal Test 1's source were excluded
  during ingestion, not imported and hidden)

**Specific → general mapping**: centralized in `SPECIFIC_TO_GENERAL` in the
same file, populated from Quantitative Test 1's real lesson names and
extended as later tests introduced new ones. A few entries are documented
judgment calls (not given explicitly in the original spec):

- "Roots" → Algebra (paired with Exponents as its inverse operation)
- "Speed - Time - Distance" → Miscellaneous Topics (a word-problem topic,
  doesn't fit Algebra/Arithmetic cleanly)
- "Sequences & Patterns" (introduced in Test 2) → Algebra (pattern/nth-term
  reasoning is algebraic, not a numeric operation or geometry topic)

## Question data

Six approved datasets (production content — do not edit directly; edit only
via `/ingest-questions` or by hand with the same care):

| File | Questions |
|---|---|
| `src/exams/gat/data/quant/test-1.json` | 50 |
| `src/exams/gat/data/quant/test-2.json` | 50 |
| `src/exams/gat/data/quant/test-3.json` | 50 |
| `src/exams/gat/data/verbal/test-1.json` (+ `passages-1.json`) | 52 |
| `src/exams/gat/data/verbal/test-2.json` (+ `passages-2.json`) | 57 |
| `src/exams/gat/data/verbal/test-3.json` (+ `passages-3.json`) | 58 |

**Total: 317 questions.**

`src/exams/gat/questions.js` normalizes the raw JSON into fixed-order test
sets at load time (namespacing ids, attaching `generalCategory`/
`mathLayout`, etc.) — this is where question content is loaded and shaped;
never edit question text/answers/categories directly in the JSON without
going through the same rigor `/ingest-questions` applies.

Note: GAT's own data folders are named `data/quant/`/`data/verbal/`, which
predate (and don't match) GAT's actual section ids
(`quantitative`/`verbal`). This is a historical artifact specific to GAT —
new exams scaffolded by `/create-exam` use the section id verbatim as the
folder name instead (see `docs/PLATFORM.md`).

## Source document location (provenance)

Original `.docx` sources used to author the six datasets, kept for reference
only — never read by the running app:

- `tests-source/gat/quantitative/quantitative-1.docx`, `-2.docx`, `-3.docx`
- `tests-source/gat/verbal/verbal-1.docx`, `-2.docx`, `-3.docx`

### GAT-specific ingestion notes

- Real GAT sources embed the answer key as a `"... Answer Key"` heading
  followed by a `Question | Answer` table near the end of the same document
  — no separate answer-key file needed.
- Question/section boundaries use custom Word paragraph styles (`Question`,
  `AnswerChoices`, `Lesson`, `Diff`), not positional heuristics.
- Verbal sections are Reading-Comprehension-heavy: passages are grouped and
  stored once per passage, referenced by `passageId` from each question.
- If a future re-ingestion targets GAT, treat every existing test JSON as
  already populated — per `/ingest-questions`'s Step 2, this requires an
  explicit replace/append/mistake decision from whoever runs it, never a
  silent overwrite.

## Runtime asset location

Question images referenced by the datasets live under
`public/questions/gat/quantitative/test-N/...` — paths in the JSON are
absolute (`/questions/...`) and resolved against `public/` at build time.
Verbal has no question images.

## Marketing asset location & config

`src/exams/gat/exam.config.js`'s `marketing` block:

- `courseUrl` — built from `COURSE_URL_BASE` (`https://leen.sa/courses/gat-qudrat`)
  + a fixed UTM query string (`utm_source=APP&utm_medium=Exam&utm_campaign=GAT26`)
  defined at the top of the same file
- `promoVideo`: `/assets/marketing/vid.mp4`
- `footerBanner`: `/assets/marketing/gat-course-banner2.png`
- `copy`: footer aria-labels, alt text, and help-link text all naming "GAT"
  explicitly

**Known implementation note**: GAT's marketing files sit flat at
`public/assets/marketing/` (no `gat/` sub-folder) — a pre-refactor artifact
from before the platform namespaced marketing assets per exam. New exams use
the namespaced form (`public/assets/marketing/<exam-id>/...`) instead; this
is not a pattern to replicate.

**Known implementation note**: `COURSE_URL_BASE` was still marked `TODO`
pending the final GAT course URL from Leen as of the platform refactor —
verify against the live file before treating it as final; update it there,
not at call sites, if it still needs one.

WhatsApp is **not** part of GAT's config — it's the one fixed
platform-wide contact in `src/config/brand.js` (`WHATSAPP_NUMBER`/
`WHATSAPP_URL`), already confirmed live at the time of the platform
refactor.

## Lead-capture status

**Enabled** (`leadCapture.enabled: true`). Before starting a test, a student
fills a short lead form (`LeadForm.jsx`): name (optional), phone, grade
level.

- `webhookGlobalVar: "LEEN_GAT_GOOGLE_SHEETS_WEBHOOK_URL"` — set at deploy
  time in `public/lead-config.js`; the frontend reads it as
  `window[webhookGlobalVar]` and POSTs form-encoded data to it.
- Countries offered: Saudi Arabia, UAE, Kuwait, Qatar, Bahrain, Oman.
- Grade levels offered: `10th Grade`, `11th Grade`, `12th Grade`, `Other` —
  the displayed label is sent to Apps Script and stored verbatim; keep in
  sync with the receiving script's allowed-values list if either changes.
- The request uses `mode: "no-cors"`, so the response is opaque — the
  frontend can't verify the row was actually written, only that the request
  didn't throw.
- The receiving Apps Script project's source lives in
  `../google-apps-script/Code.gs` (a sibling repo folder, outside
  `leen-exam-platform/`, since it's deployed by pasting into the Apps
  Script editor, not built by this repo). It validates `phone` and
  `grade_level` (must be one of the four allowed labels) before writing a
  row.
- This is a public POST endpoint by design (how Apps Script Web Apps work)
  — anyone with the URL can POST to it; there's no secret to protect. If
  spam becomes a problem, add rate-limiting/anti-abuse logic in `Code.gs`,
  not the frontend.

## GAT-specific implementation notes

- No test suite or linter is configured for the platform; `npm run build`
  is the main correctness check before deploying GAT (or any exam).
- The bundled JS is ~615 KB (~170 KB gzipped) for a GAT build, mostly KaTeX
  (used for GAT's Quantitative math rendering) + app code. Vite warns about
  chunk size on build; expected, not a regression unless it grows
  significantly further.
- There are no `.env` files or build-time secrets for GAT. The only external
  configuration is `public/lead-config.js` (webhook URL) and
  `src/exams/gat/exam.config.js` (course link, promo assets) — both plain
  static values checked into the repo. If a per-environment (staging vs.
  production) webhook URL is ever needed, swap `public/lead-config.js` at
  deploy time rather than hardcoding a second value in source.
