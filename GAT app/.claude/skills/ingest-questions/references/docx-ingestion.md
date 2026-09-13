# DOCX ingestion — OpenXML structure and extraction approach

A `.docx` is a ZIP package. Never treat it as plain text and never rely on
converting it to `.txt`/pasting visually-copied content — that loses
structure (which run is math vs. prose, which paragraph is a category
label, which image belongs to which question, table cell boundaries,
formatting used as an editorial marker) that this Skill's fidelity
requirement depends on.

This reference documents both **what's generically true of any `.docx`**
(the OpenXML package shape) and **patterns observed in this repo's actual
source files** (`tests-source/quantitative/*.docx`,
`tests-source/verbal/*.docx`) as illustrations — not universal rules. A
different source file may use none of these custom styles/markers; when it
doesn't, fall back to structural heuristics (paragraph order, blank-line
grouping, explicit "A)"/"B)" option prefixes) and say so in the ingestion
summary rather than silently assuming GAT's exact conventions apply.

## Package layout that matters

```
mydoc.docx  (ZIP)
├── word/document.xml            the actual content: paragraphs, runs, tables, OMML, drawing refs
├── word/_rels/document.xml.rels maps r:id -> target part (images, headers, etc.)
├── word/media/image#.*          embedded images, referenced by rId via the rels file
├── word/comments.xml            Word comments, if any (may not exist)
├── word/styles.xml              style definitions (names -> formatting) — usually not needed,
│                                 since w:pStyle w:val="X" in document.xml already gives you the
│                                 style *name*, which is what matters semantically
└── word/numbering.xml           numbered/bulleted list definitions, if the source uses Word's
                                  auto-numbering instead of typed "A)"/"1)" text
```

Ignore `word/theme/`, `word/fontTable.xml`, `word/settings.xml`,
`word/webSettings.xml`, `customXml/`, `docProps/` — layout/metadata noise,
never content.

## Deterministic extraction (script, not reasoning)

Use `scripts/docx-inspect.ps1` (Phase A) to unzip a `.docx` with zero new
dependencies — it uses .NET's built-in `System.IO.Compression.ZipFile`,
which opens a `.docx` directly (no rename needed). It:

1. Lists every ZIP entry with its size (sanity check: are there really
   `word/media/*` files? how many?).
2. Extracts `word/document.xml`, `word/_rels/document.xml.rels`, and
   `word/comments.xml` (if present) to a working folder as readable text
   files, so you (Claude) can `Grep`/`Read` them directly instead of
   re-deriving XML parsing logic ad hoc every time.
3. Extracts every `<m:oMath>...</m:oMath>` block found in document order
   into a separate numbered file, so OMML→LaTeX conversion (semantic work)
   has a clean, ordered list of exactly what needs converting.
4. Prints structural counts: paragraphs, tables, OMML nodes, drawings,
   distinct `w:pStyle` names in use, distinct `w:color` values in use, and
   whether `w:strike`/`w:highlight` appear anywhere — this is your signal
   for "does this source use custom paragraph styles for boundaries?" and
   "does this source use color/strikethrough as an editorial marker?"
   before you go interpret what they mean.

Use `scripts/docx-extract-media.ps1` (Phase B) to copy `word/media/*` out
to a target asset directory, refusing to overwrite existing files unless
`-Force` is passed, and printing an `rId -> original filename` map from the
rels file alongside the document-order sequence in which each `rId` is
referenced (via `r:embed="rIdN"` occurrences in `document.xml`) — this is
what lets you correlate "the 3rd image that appears in reading order" to
"the file Word happened to call `image7.png`" deterministically, without
guessing from filenames.

## Question/section boundary detection

**Check `w:pStyle` names first.** Both real GAT source files use custom
Word paragraph styles that map directly onto ingestion-relevant structure:

- Quantitative source (`quantitative-*.docx`): `Diff` (a
  `"Difficulty level: M"`-style paragraph immediately before a question —
  **the platform has no difficulty field today; this is source data with
  no home in the current schema. Report it, don't drop it silently or
  invent a field for it without asking**), `Lesson` (a
  `"Lesson: Shaded Areas"`-style paragraph — this is exactly
  `specificCategory`), `Question` (the actual prompt paragraph),
  `Heading1` (test-level heading, not per-question).
- Verbal source (`verbal-*.docx`): `Question` (prompt), `AnswerChoices`
  (one paragraph per option, e.g. `"A) Grinder: Coffee"`), `Heading1`
  (section headings like "Analogy", "Sentence Completion" — these are
  category boundaries, not question boundaries), `Correct` (appeared in the
  sampled file only as an empty section-break paragraph, **not** as a
  per-question correctness marker — don't assume a style literally named
  "Correct" marks the right answer; verify what it actually contains before
  trusting its name).

If a source file has no custom `w:pStyle` names beyond Word defaults
(`Normal`, `ListParagraph`, etc.), fall back to positional/textual
heuristics: paragraphs starting with `A)`/`B)`/`1)`/`a.` etc. are options;
the paragraph(s) between the end of one option block and the start of the
next question's stem are that next question's prompt; a short bolded/larger
paragraph with no option-prefix pattern preceding a run of questions is
likely a category/section heading. State explicitly in the ingestion
summary which detection method you used and why.

## Answer key location

Check for an explicit answer key **inside the same document** before
assuming a separate file is needed — both real GAT sources have one
embedded as a table near the end (e.g. `"Practice Test 1 – Answer Key"`
heading immediately followed by a `<w:tbl>` with repeating
`Question | Answer` column pairs, packed several pairs wide to fit more
rows per page). Extract this table's cells in reading order (row-major,
then column-pair-major) to build a `{ questionNumber: letter }` map.

If the answer key is a separate file (per the Skill's INPUTS — the user may
supply one), parse whatever structure it actually has (a table, a plain
numbered list, a CSV) — don't assume it matches the in-document table shape.

Cross-reference the answer key against extracted questions by
**`sourceQuestionNumber` / original document order**, not by the final
post-exclusion array index — a question excluded partway through (see
"Editorial markings" below) shifts every subsequent answer-key row's
correspondence to the *final* array but not to the *original* numbering.
Get this cross-reference right before writing `correctAnswer` on any
question — see the "ANSWER KEY" rules in `SKILL.md`.

## OMML → LaTeX conversion

Office Math (`<m:oMath>`) has its own XML vocabulary, distinct from Word's
text runs. Extracted OMML blocks look like this (real example from
`quantitative-1.docx`, a fraction):

```xml
<m:f>
  <m:fPr>...</m:fPr>
  <m:num><m:r><m:t>1</m:t></m:r></m:num>
  <m:den><m:r><m:t>(</m:t></m:r><m:r><m:t>x</m:t></m:r><m:r><m:t>)</m:t></m:r></m:den>
</m:f>
```

Common OMML element → LaTeX mapping (extend as new elements are seen; do
not guess an unfamiliar element's meaning — inspect its children and, if
still unclear, report it rather than emitting a fabricated conversion):

| OMML element | Meaning | LaTeX |
|---|---|---|
| `<m:f><m:num>N</m:num><m:den>D</m:den></m:f>` | fraction | `\frac{N}{D}` |
| `<m:rad><m:deg>n</m:deg><m:e>X</m:e></m:rad>` | root (deg empty = square root) | `\sqrt[n]{X}` or `\sqrt{X}` |
| `<m:sSup><m:e>B</m:e><m:sup>E</m:sup></m:sSup>` | superscript/exponent | `{B}^{E}` |
| `<m:sSub><m:e>B</m:e><m:sub>S</m:sub></m:sSub>` | subscript | `{B}_{S}` |
| `<m:sSubSup>` | both | `{B}_{S}^{E}` |
| `<m:d>...</m:d>` (delimiter) | parentheses/brackets wrapper | wrap contents in `(...)`/`[...]` per its `m:begChr`/`m:endChr` |
| `<m:nary>` (e.g. sum/integral) | n-ary operator | `\sum`/`\int` etc. per its `m:chr` |
| plain `<m:r><m:t>text</m:t></m:r>` | literal run | pass through, escaping LaTeX special chars in *prose* runs only |

**Always run the result through the platform's actual normalization
expectations before finalizing**, since `QuestionCard.jsx`'s `normalizeTex`
(the function KaTeX rendering actually goes through at runtime) has its own
quirks you must match or avoid triggering unexpectedly:

- `\frac12` (no braces) gets auto-braced to `\frac{1}{2}` — but don't rely
  on this; emit properly-braced `\frac{1}{2}` yourself so the source LaTeX
  is unambiguous on inspection, not dependent on the runtime patch.
- Bare `circ`, `theta`, `pi`, `times` (without a leading backslash) get
  auto-escaped to `\circ`, `\theta`, `\pi`, `\times` — again, don't rely on
  this crutch; always emit the correct backslash yourself.
  `normalizeTex` exists for legacy/mock data leniency, not as a target to
  write new output against.
  Do **not** "improve" the platform by removing `normalizeTex` calls or
  logic — that's out of scope; just don't lean on it for new ingestion.
- `\text or` / `\textor` get rewritten to `\;\text{or}\;` — if a question
  genuinely has an "or" between two math expressions (e.g. compound
  inequality answer choices), emit `\;\text{or}\;` directly.
- A bare `;` between math tokens gets auto-escaped to `\;`. Emit `\;`
  yourself for a genuine spacing separator.

**Validate every generated `tex`/`text`-with-`type:"tex"` string actually
parses** — `scripts/validate-ingestion.mjs` calls the real installed
`katex` package (`katex.renderToString(..., { throwOnError: true })`,
after the same normalization) on every math string; a string that throws
is either malformed LaTeX or leftover raw OMML/XML that leaked through
(look for `<m:`, `w:val`, or unescaped `\` sequences KaTeX doesn't
recognize) — fix the conversion, don't suppress the error.

**Do not convert ordinary prose to LaTeX.** A run like `<w:t>the area
of</w:t>` outside any `<m:oMath>` block is a `type: "text"` prompt segment,
not `type: "tex"`. Only content that was inside Word's Office Math object
(or a source-marked equation image with no OMML available) becomes `tex`.

## Tables (non-answer-key)

A source table inside a *question* (not the answer-key table) most likely
maps to `compareTable` (see `question-schema.md`) if it's a 2-column
"Quantity A / Quantity B" comparison — this is the only table shape the
current schema explicitly supports for in-question rendering. Extract each
`<w:tc>` (table cell)'s runs into the `segments` array shape
(`{type:"text"|"tex", text}`), splitting on `<m:oMath>` boundaries the same
way you would for a prompt.

**If the source table has a different shape** (more than 2 data columns
that aren't an answer-key grid, merged cells via `w:gridSpan`/`w:vMerge`,
nested tables, a data table meant to be shown as an image rather than
structured data), **stop and report the limitation** per the "TABLES" rule
in `SKILL.md` — do not flatten it into `compareTable` if it doesn't
actually fit that shape, and do not invent a new table schema in the
platform to accommodate it without the user's explicit go-ahead (that would
be a platform-core change, out of scope for this Skill).

Note that GAT's own real data already handles "a chart/table meant to be
read visually" (bar charts, pie charts, a numeric data table) by rendering
it as a **rasterized image** (`kind: "image"`, e.g.
`q30-bar-chart-clothing-sales.png`, `q32-data-table-expenses.png`) rather
than trying to reproduce the table as structured HTML/JSON — that's a
legitimate, already-exercised choice when the visual layout itself (bar
heights, pie slice proportions, a multi-column data table too wide for
`compareTable`'s 2-column shape) is part of what's being tested. Prefer
that path over inventing new structured-table JSON when the source's own
document renders it as a graphic in the first place (check whether the
source page actually contains a `<w:drawing>` for it, vs. a genuine
`<w:tbl>` you're being asked to flatten).

## Images

Each embedded image is referenced from a run via
`<w:drawing>...<a:blip r:embed="rIdN"/>...</w:drawing>`; `rIdN` resolves
through `word/_rels/document.xml.rels` to `media/imageM.ext`. The *order*
images appear in `document.xml` is their reading-order sequence — use this
(not the numeric part of `imageM.ext`, which reflects insertion order in
Word's authoring history and is **not** reliable reading order) to
correlate an image to its question.

- Extract only images actually referenced from `document.xml` body content
  — `word/media/` can contain leftover images from deleted content, headers
  (a logo in `header1.xml`/`header2.xml`), or theme art. Cross-check each
  `media/imageN.*` against whether its `rId` is actually used inside
  `document.xml`'s body (not just the rels file, which lists it
  regardless) before copying it into the exam's asset folder — an
  unreferenced media file is exactly the "unused/duplicate media" case the
  main instructions ask you to detect rather than blindly copy.
- Copy the file bytes as-is (`docx-extract-media.ps1` does a raw byte copy)
  — do not resize/recompress/crop unless the user explicitly asks. Aspect
  ratio and resolution are whatever Word embedded.
- Name the copied file descriptively (`q<NN>-<short-slug>.png`, matching
  GAT's own convention) rather than keeping Word's generic `imageN.ext` —
  the slug should describe the diagram's content (as GAT's real filenames
  do: `q06-triangles-abc-dbc.png`, `q39-number-grid.png`), which is what
  makes later orphan/duplicate review tractable for a human.
- Preserve the original file extension/format (`.png` stays `.png`,
  `.jpeg` stays `.jpeg`) — don't transcode.

## Editorial markings — inspect, never assume

Word source files can carry meaning in color, strikethrough, highlighting,
comments, or explicit note text, but **none of these have a fixed universal
meaning across sources**. The concrete example already found in this
repo's own `verbal-1.docx`: the entire "The Odd One Out" section heading
and its questions are styled `<w:color w:val="EE0000"/>` (red) **combined
with** `<w:strike/>` (strikethrough) — the combination is what signaled "cut
this section," not the color alone. Other red text elsewhere in the same
document (54 occurrences of that same red, per a raw scan) is NOT
strikethrough and does NOT mean "excluded" — it's most likely just
emphasis/heading color in the visual design.

Before treating any color/highlight/strikethrough as meaningful:
1. Find every paragraph/run using it (`docx-inspect.ps1`'s distinct-`w:color`
   list is the starting point).
2. Read enough surrounding context to see if it's structural (an excluded
   section, a flagged-for-review item) or purely cosmetic (a heading's
   brand color, a highlight for visual emphasis in a chart legend).
3. If genuinely ambiguous, ask the user rather than guessing — this
   directly feeds "which questions get imported at all," the highest-stakes
   kind of silent mistake this Skill can make.
4. Whatever you conclude, record it as a **source-specific** note in the
   ingestion summary (e.g. "this source strikes through+reddens excluded
   questions; N such questions found and excluded") — never write it into
   `SKILL.md` or any reference file as if it were a universal rule for all
   future sources.

`word/comments.xml` (if present) holds actual Word comment text, keyed by
`w:id` referenced from `<w:commentReference>` anchors in `document.xml` —
extract and read these the same cautious way; a comment might say "verify
this answer" (→ flag for review) or be unrelated editorial chatter.
