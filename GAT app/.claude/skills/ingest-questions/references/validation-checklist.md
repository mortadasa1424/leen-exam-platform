# Post-ingestion validation checklist

This Skill's own ingestion-specific validation — narrower than the future
`/validate-exam`'s full-platform audit, but must still be run (via
`scripts/validate-ingestion.mjs` for anything mechanical, plus the manual
checks below) before reporting ingestion as complete.

## Run the script

```
node .claude/skills/ingest-questions/scripts/validate-ingestion.mjs \
  --file src/exams/<exam-id>/data/<section-id>/<test-key>.json \
  [--passages src/exams/<exam-id>/data/<section-id>/passages-<n>.json ...] \
  [--exam-config src/exams/<exam-id>/exam.config.js] \
  [--answer-key path/to/extracted-answer-key.json] \
  [--assets-dir public/questions/<exam-id>/<section-id>/<test-n>]
```

Run from the `GAT app/` project root (where `package.json`/`node_modules`
live — the script imports the already-installed `katex` package to
actually parse generated math strings, not a hand-rolled check).

It checks, mechanically:

- [ ] File parses as valid JSON, and is an array.
- [ ] (Warning, not a hard failure) No question object contains `id`,
      `section`, `testKey`, `order`, or `mathLayout` — these are computed at
      load time (see `question-schema.md`); a new raw file shouldn't
      hardcode them even though it's harmless if it does (real GAT Verbal
      data does this with a leftover `id` field).
- [ ] Every question has a `kind` the schema recognizes
      (`text`/`image`/`text-en`/`svg`) and the fields that `kind` requires.
- [ ] `options.length === answerLabels.length`, labels match 1:1 in order,
      and all labels are unique within the question.
- [ ] `correctAnswer` is present in `answerLabels` (exact string match).
- [ ] No two questions are exact-duplicate objects (a proxy for
      accidentally-duplicated source content).
- [ ] `sourceRef` is present and non-empty on every question (provenance is
      required for a real ingestion, even though the platform doesn't read
      it at runtime).
- [ ] Every `type: "tex"` segment (in `prompt`, `options[].tex`, or
      `compareTable` cell segments) parses through the real `katex` package
      using the same normalization `QuestionCard.jsx`'s `normalizeTex`
      applies, with `throwOnError: true`. A throw is reported with the
      offending string and question.
- [ ] No string field anywhere contains OMML/XML leftovers (`<m:`, `<w:`,
      `w:val=`) — a sign the OMML→LaTeX or table-cell conversion leaked raw
      markup through.
- [ ] Every `kind: "image"` question's `image` path resolves to an actual
      file under `public/` (path is checked as `public<value>` from the
      project root).
- [ ] Every `passageId` referenced by a `text-en` question resolves to an
      entry in the passages file(s) passed via `--passages`.
- [ ] If `--answer-key` is given (a `{ "<sourceQuestionNumber>": "<letter>" }`
      map extracted from the source's own answer key table/file): every
      question's `correctAnswer` matches the key's entry for its
      `sourceQuestionNumber` (falling back to 1-based array position if a
      question has no `sourceQuestionNumber`), every key entry maps to
      exactly one question, and any conflict is reported (never
      auto-resolved — see "ANSWER KEY" in `SKILL.md`).
- [ ] If `--exam-config` is given and that exam's `performance.byCategory`
      is `true`: every non-empty `specificCategory` either has a
      `SPECIFIC_TO_GENERAL` mapping (imported from that exam's
      `categories.js`) or the question sets `generalCategory` directly;
      any `specificCategory` with neither is reported as unmapped, not
      silently left uncategorized. If `byCategory` is `false` (or the flag
      is omitted), category checks are skipped entirely — absence of
      categories is not an error.
- [ ] If `--assets-dir` is given: every file in that directory is
      referenced by at least one question's `image` field; unreferenced
      files are reported as orphan/candidate-duplicate media (not deleted
      automatically).

The script exits non-zero and prints every failure found (it does not stop
at the first one) — fix root causes in the generated JSON/assets and rerun,
rather than hand-editing around individual failures.

## Manual checks (not mechanical — require reading the source)

- [ ] **Expected question count matches.** Compare the final array length
      to the count you determined in Phase A (source question count minus
      any deliberately-excluded questions, explained in the ingestion
      summary).
- [ ] **Question wording, option wording, and option order are verbatim**
      against the source — spot-check a sample, and specifically re-check
      any question you flagged as ambiguous during Phase A.
- [ ] **No unintended files changed.** Run `git status` (and `git diff
      --stat` for anything already-tracked, e.g. `categories.js` if you
      extended a mapping) and confirm the changed/added paths are *only*:
      the target exam's `data/<section>/<test>.json` (and
      `passages-<n>.json` if touched), the target exam's `categories.js`
      (only if a new specific-category mapping was added, and only after
      the user approved it), and new files under
      `public/questions/<exam-id>/...`. Anything else (another exam,
      `src/App.jsx`, `src/components/`, `src/lib/`, another test's data
      file) means something went wrong — stop and report before proceeding
      further, don't silently revert it yourself if you don't understand
      why it changed.
- [ ] **Category taxonomy decisions were the user's, not invented.** Any
      new `SPECIFIC_TO_GENERAL` entry, or any judgment call about which
      general category an ambiguous specific one belongs to, was either
      explicitly given by the user or explicitly confirmed by them during
      Phase A — not decided unilaterally during Phase B.
- [ ] **Every flagged ambiguity from Phase A was actually resolved** (by
      the user's explicit instruction) before being written into Phase B's
      output — nothing should reach the final JSON marked `"final"` in
      `reviewStatus` if it was still an open question in the Phase A
      summary.

## Producing a machine-readable report

`validate-ingestion.mjs --json` emits a single JSON object to stdout
instead of human-readable text:

```json
{
  "file": "...",
  "questionCount": 50,
  "errors": [ { "type": "tex-parse-error", "index": 12, "message": "..." } ],
  "warnings": [ { "type": "orphan-media", "file": "..." } ],
  "ok": false
}
```

Use this form when you want to programmatically gate Phase B completion
(e.g. refuse to report ingestion as done while `ok` is `false`), and the
human-readable form otherwise for the ingestion summary you show the user.
