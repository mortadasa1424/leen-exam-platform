# Question schema (as implemented in this repo)

This documents the *actual* raw question JSON schema, derived from reading
`src/exams/gat/questions.js`, `src/components/QuestionCard.jsx`,
`src/lib/scoring.js`, and the real GAT datasets under
`src/exams/gat/data/`. Treat this as an implementation-level companion to
`../create-exam/references/exam-module-contract.md` — if the two disagree, or
if live code has moved on, **trust the live code**: re-read
`src/exams/gat/questions.js` and `src/components/QuestionCard.jsx`.

## Where a field comes from: raw file vs. computed at load time

`questions.js`'s `buildTestQuestions(testKey, base)` takes each raw object
from `data/<section>/<test>.json` and spreads it, then overwrites/adds:

```js
{
  ...q,                          // everything from the raw file, as-is
  id: `GAT-${testKey.toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
  section: meta.section,         // from exam.config.js, not the raw file
  testKey,
  order: i + 1,
  generalCategory: specificToGeneral[q.specificCategory] ?? q.generalCategory ?? null,
  mathLayout: meta.mathRendering,
}
```

**Don't write `id`, `section`, `testKey`, `order`, or `mathLayout` into a new
raw data file.** They're computed from the array position and
`exam.config.js` at load time; a raw file that hardcodes them gets silently
overwritten (harmless), so it's not a correctness bug, just noise — but new
ingestion shouldn't add it. (Real GAT data is inconsistent here as a
historical artifact, not a pattern to copy: Verbal's raw JSON keeps a
leftover `id` field like `"V1-041"` per question, Quantitative's doesn't —
both work identically at runtime since the field is overwritten either
way.)

**`generalCategory` is the one field with two valid raw-data conventions**,
both live in real GAT data today:
- **Mapped** (GAT Quantitative): raw file sets `specificCategory` (the exact
  lesson name, e.g. `"Shaded Areas"`), and `categories.js`'s
  `SPECIFIC_TO_GENERAL` maps it to a general category. Use this when the
  source has a fine-grained lesson/topic taxonomy that rolls up into a
  smaller set of general categories.
- **Direct** (GAT Verbal): raw file sets `generalCategory` directly (e.g.
  `"Analogy"`) and leaves `specificCategory: ""`. Use this when the source's
  categories already are the general categories (no finer taxonomy to roll
  up) — e.g. Verbal's four question types have no sub-lessons.

Pick whichever matches the *actual* source taxonomy — don't force a
mapped-style taxonomy onto a source that only has coarse categories, or
vice versa. If `performance.byCategory` is `false` for the target exam, ok
to leave both `specificCategory: ""` and no `generalCategory` — see
`config.categories?.specificToGeneral?.[...] ?? q.generalCategory ?? null`,
which never throws either way.

## Fields common to every question, regardless of `kind`

| Field | Type | Notes |
|---|---|---|
| `specificCategory` | string | `""` allowed. Only meaningful if category performance is enabled; harmless otherwise. |
| `generalCategory` | string \| omitted | Only set directly when the source has no finer taxonomy to map (see above). |
| `kind` | `"text" \| "image" \| "text-en" \| "svg"` | Picks which `QuestionCard.jsx` renderer runs. |
| `options` | array | See "Options" below. |
| `answerLabels` | array of strings | The option labels in display order, e.g. `["A","B","C","D"]`. Must exactly match `options[].label` in the same order. |
| `correctAnswer` | string | One of `answerLabels`. Scoring (`src/lib/scoring.js`) checks `q.options[selectedIndex]?.label === q.correctAnswer` — so this must be an exact label match, not an index. |
| `sourceRef` | string | Provenance, e.g. `"quantitative-1.docx#Q3"` or `"verbal-1.docx#Q45"`. Not read by any component; free-form but keep consistent within an exam. Always populate this for a real ingestion — it's what lets someone trace a question back to its source file/number later. |
| `sourceQuestionNumber` | number | Optional but recommended, especially when the source has excluded/skipped questions that create gaps between the source's original numbering and this test's final sequential order (see GAT Verbal, which uses this; GAT Quantitative doesn't, because it has no exclusions). |
| `reviewStatus` | string | Free-form provenance, e.g. `"final"`. Not read by any component. Use `"needs-review"` (or similar) for anything flagged during ingestion rather than silently marking it `"final"`. |

## `options`

Two option shapes, both valid, chosen per-question based on whether the
option content is prose or a mathematical expression:

```json
{ "label": "A", "text": "Grinder: Coffee" }
{ "label": "A", "tex": "{x}^{11}" }
```

- `label`: a single letter. `QuestionCard.jsx` supports up to 9
  (`A`–`I`, see `LETTERS` in `QuestionCard.jsx`) but every real GAT test
  uses exactly 4. Don't assume 4 is a hard platform limit, but don't
  fabricate a 5th distractor either — use exactly as many options as the
  source has.
- `text` options render as plain text (LTR/RTL auto-detected from content
  via `isArabicText`).
- `tex` options render through KaTeX (see `docx-ingestion.md` for
  OMML→LaTeX conversion). Never put raw LaTeX commands inside a `text`
  field or prose inside a `tex` field — `QuestionCard.jsx` picks its
  rendering path (and RTL/LTR direction, and long-option sizing) based on
  which key is present.

## `kind: "text"` — math/mixed-content prompt (no image)

Used for GAT Quantitative questions with no diagram. `prompt` is an ordered
array of segments:

```json
"prompt": [
  { "type": "text", "text": "Simplify: " },
  { "type": "tex", "text": "(-x{)}^{11}" }
]
```

- `type: "text"` — plain prose, rendered as-is.
- `type: "tex"` — inline KaTeX.
- `type: "block"` — a display-mode (centered, own-line) KaTeX block. Not
  used in current real data but supported by `Prompt`/`QuestionCard.jsx`
  (switches the whole prompt to a `"stacked"` layout automatically — no
  `layout` field needs to be set manually; it's inferred from whether any
  segment is `type: "block"`).
- `image`: `null`.
- `compareTable`: `null`, or a comparison-table object (see below) for
  "Quantity A vs Quantity B" style questions.

## `kind: "image"` — prompt + a diagram/chart image

Same `prompt` array shape as `"text"`, plus:

```json
"image": "/questions/gat/quantitative/test-1/q01-shaded-circle-sectors.png"
```

- `image` is an absolute site path (leading `/`), resolved against
  `public/`. The actual file lives at
  `public/questions/gat/quantitative/test-1/q01-shaded-circle-sectors.png`
  for this GAT example — see "Asset path convention" below. Every exam,
  GAT included, is namespaced under its own exam-id segment.
- `compareTable` may also be set on an `"image"`-kind question (GAT does
  this for image-backed comparison questions).
- Filenames are descriptive slugs (`q01-shaded-circle-sectors.png`, not
  `q01.png`) — keep doing this; it makes orphan/duplicate detection and
  human review far easier than opaque numbering.

## `kind: "text-en"` — plain-English prompt (GAT Verbal)

```json
{
  "kind": "text-en",
  "questionText": "Wax: Candle",
  "options": [...],
  "passageId": "verbal-1-passage-01",
  "highlightedWord": "hasty"
}
```

- `questionText`: plain string, rendered LTR always (`QuestionText`
  hardcodes `dir="ltr"` — this is a platform assumption that English-kind
  verbal questions are always LTR content; if a future exam needs an
  RTL `text-en`-equivalent, that's a platform gap to report, not something
  to patch by injecting `dir` into the string).
- `passageId`: **only** for reading-comprehension questions that share a
  passage. Omit entirely for non-RC verbal questions (Analogy, Sentence
  Completion, Contextual Error in GAT's taxonomy) — don't set it to `null`,
  just don't include the key (matches real data).
- `highlightedWord`: optional, supported by `QuestionCard.jsx`
  (`highlightSentence`) but **not used by any real GAT question today**.
  Only set it if the source explicitly marks a specific word/phrase for
  emphasis (e.g. a "contextual error" question circling one word) — don't
  invent emphasis that isn't in the source.

## `kind: "svg"` — inline vector figure

Supported by `QuestionCard.jsx`'s `SvgFigure` (raw `q.svg` string injected
via `dangerouslySetInnerHTML`) but **used by zero real questions in any
current dataset**. Prefer `kind: "image"` (a rasterized PNG, the exercised
path) for any diagram — that's what every real GAT image question uses,
including charts and geometric figures.

Only produce `kind: "svg"` content if the user explicitly asks for a vector
figure and accepts the tradeoff. If you do, the `svg` string must be
sanitized/trusted content you generated deterministically (e.g. from Word
shape/drawing data) — never pass through any source-controlled markup
without inspecting it, since it renders unescaped.

## `compareTable` — "Quantity A vs Quantity B" comparison tables

```json
"compareTable": {
  "columns": ["A", "B"],
  "rows": [
    [
      { "segments": [{ "type": "text", "text": "Area of triangle " }, { "type": "tex", "text": "ABC" }] },
      { "segments": [{ "type": "text", "text": "Area of triangle " }, { "type": "tex", "text": "DBC" }] }
    ]
  ]
}
```

- `columns`: header labels (GAT always uses `["A", "B"]`).
- `rows`: array of rows; each row is an array of cells, one per column.
- Each cell has a `segments` array — same `{type: "text"|"tex", text}`
  shape as `prompt` segments (no `"block"` inside a cell). This is
  deliberate: `CompareCell` renders segments as separate inline DOM nodes,
  not one collapsed KaTeX string, so mixed prose+math wraps correctly in a
  narrow table cell. Don't collapse a cell's content into a single `tex`
  string even if it would render "close enough" — follow the segment shape.
- The table always keeps left-to-right column order regardless of platform
  direction (`CompareTable` hardcodes `dir="ltr"` on the wrapper) — don't
  reorder columns to "fix" RTL.

If the source has a genuinely different table shape (more than 2 columns of
comparison, footnotes inside cells, merged cells, etc.), **stop and report
it** rather than forcing it into this shape — see "Tables" in `SKILL.md`.

## Passages (`data/<section>/passages-<n>.json`)

```json
{ "id": "verbal-1-passage-01", "title": "Alternative medicine", "passageText": "..." }
```

- `id`: referenced by questions via `passageId`. Must be unique across the
  whole exam (passages from all tests are merged into one flat
  `{ [id]: passage }` map in `questions.js` — see
  `Object.fromEntries([...p1, ...p2, ...p3].map(p => [p.id, p]))`). A
  collision between two different tests' passage IDs would silently make
  one shadow the other — namespace IDs per test (GAT's convention:
  `<section>-<test-number>-passage-<NN>`).
- `title`: optional short heading shown above the passage
  (`q-passage-topic`). Omit if the source has no natural title rather than
  inventing one.
- `passageText`: the full passage. `sanitizePassageText` in
  `QuestionCard.jsx` normalizes line-ending variants and collapses runs of
  blank lines to exactly one — so it's safe to preserve the source's actual
  paragraph breaks as `\n\n` without hand-collapsing them yourself.
- A passage shared by multiple questions is stored **once**; every question
  that uses it just references the same `passageId`. Never duplicate the
  passage text per question.
- `QuestionCard.jsx` renders the passage pane with `dir="ltr"` always
  (same platform assumption as `QuestionText` — English-content passages).
  An RTL passage is a platform gap, not something to route around.

## Categories (`categories.js`, only when `performance.byCategory: true`)

```js
export const GENERAL_CATEGORIES = { "<section-id>": ["<general category>", ...] };   // documentation only
export const SPECIFIC_TO_GENERAL = { "<specific lesson name>": "<general category>" }; // actually consumed
```

- `GENERAL_CATEGORIES` is not read by any component as of this writing
  (confirm with a grep before relying on that) — keep it in sync with
  `SPECIFIC_TO_GENERAL`'s values anyway, for future readers.
- `SPECIFIC_TO_GENERAL` keys are exact lesson/category names as they appear
  in the source (case- and punctuation-sensitive — GAT has both
  `"Ratios & Percentages"` and `"Percentages & Ratios"` as separate keys
  mapping to the same general category, because the source used both
  spellings across tests). **Never silently rename a source category to
  match an existing key** — add the source's actual spelling as a new key
  mapping to the same general category, and mention the near-duplicate to
  the user.
- Adding a new specific category to an *existing* general category (e.g. a
  new Quantitative Test 3 lesson name not seen before) is fine and expected
  during ingestion. Inventing a new *general* category, or remapping an
  existing specific category to a different general category, is a
  taxonomy decision — ask the user first, don't decide it silently while
  ingesting.

## Asset path convention

Every exam's question images — GAT included — live under its own exam-id
segment, so no two exams can ever collide:

```
public/questions/<exam-id>/<section-id>/<test-key-or-number>/<descriptive-slug>.png
```

GAT's images used to live at `public/questions/<section-id>/test-<n>/...`
(no exam-id segment) as a historical artifact of predating the multi-exam
refactor; they were migrated to `public/questions/gat/<section-id>/test-<n>/...`
so the convention above is now exceptionless. When ingesting into GAT itself
(rare — GAT is already fully populated) or any other exam scaffolded by
`/create-exam`, always include the exam-id segment. Never write into
another exam's `public/questions/<other-id>/...` path.

## What `id`/`order`/uniqueness actually depend on

Since `id` is `GAT-<TESTKEY>-<index+1>`, uniqueness and ordering fall
straight out of "one flat array per test file, in source order, no
duplicated entries." There is no separate ID-assignment step to get wrong —
get the array order right (source order, exclusions already removed) and
IDs are correct by construction. This is why `sourceRef`/
`sourceQuestionNumber` matter: they're the only remaining link back to the
original source numbering once positional IDs are assigned.
