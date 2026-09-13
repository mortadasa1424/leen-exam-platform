---
name: create-exam
description: Scaffold a new exam's complete filesystem structure for this repo's reusable exam platform — the runtime module (src/exams/<exam-id>/), source-document folders (tests-source/<exam-id>/), question-asset namespace (public/questions/<exam-id>/), and marketing-asset folder (public/assets/marketing/<exam-id>/) — without touching the generic engine (App.jsx, components/, lib/, styles) or any other exam's files. Use when the user runs /create-exam, or asks to add/create a new exam (e.g. SAAT, STEP) on top of this platform. Does not import real questions (that's /ingest-questions), registers the new exam in src/exams/registry.js, but never sets any deployment's VITE_EXAM_ID (that's a separate, explicit deploy-time decision, never automatic).
---

# create-exam

Scaffold the **complete standard filesystem structure** a new exam needs on
this repo's reusable exam platform (see `docs/PLATFORM.md`) — not just the
`src/exams/` runtime module, but every surrounding folder the platform's own
conventions expect: source-document folders under `tests-source/`, a
question-asset namespace under `public/questions/`, and a marketing-asset
folder under `public/assets/marketing/`. This Skill creates config/data/
module files, prepares those three sibling directory trees, and registers
the new exam in `src/exams/registry.js` — it never touches the generic
engine, never edits another exam's files, and never sets any deployment's
`VITE_EXAM_ID` (registering an exam makes it *available*; a deployment's own
`VITE_EXAM_ID` is what makes an exam *live*, and that's always a separate,
explicit decision for whoever owns that deployment — this Skill never makes
it, even if asked, though it can tell the user how to set it themselves for
local dev or on Netlify).

## Before doing anything

1. Read `docs/PLATFORM.md` and `references/exam-module-contract.md` (in
   this Skill folder). The reference file documents the real contract as
   last inspected; **if anything looks stale — a file path that no longer
   exists, a component that no longer matches — re-read the live source
   (`src/exams/gat/`, `src/App.jsx`, `src/components/*.jsx`) instead of
   trusting the doc.** Do not invent a different architecture.
2. Run `git status`. If it's not clean, tell the user what's pending before
   you start creating files (don't stash/discard anything yourself).
3. This Skill creates files/folders under four separate roots for the same
   `<candidate-id>` (see `references/exam-module-contract.md`'s "Full
   filesystem structure this Skill creates" for the complete picture).
   Before writing anything, check whether **any** of these already exist:
   - `src/exams/<candidate-id>/`
   - `tests-source/<candidate-id>/`
   - `public/questions/<candidate-id>/`
   - `public/assets/marketing/<candidate-id>/`

   If any of them exist, **stop and explain the collision to the user** —
   name exactly which path(s) already exist and, briefly, what's in them —
   and ask how to proceed before writing anything. Never silently overwrite
   or merge into an existing exam's files, even if only one of the four
   roots collides (e.g. `public/assets/marketing/<id>/` exists from a prior
   partial attempt but `src/exams/<id>/` doesn't).

## Step 1 — Collect exam details

Ask for (or use what the user already supplied in their invocation):

**Required**
- Exam ID/slug (lowercase, short, e.g. `saat`) — this becomes the folder
  name and `config.id`; must be unique under `src/exams/`.
- Full name and short name.
- Platform language: Arabic or English → `locale.language` (`ar`/`en`).
- Platform direction: RTL or LTR → `locale.direction` (`rtl`/`ltr`). Note
  the platform default pairing is ar+rtl or en+ltr, but ask rather than
  assume if the user's answer is ambiguous.
- Sections: at least one, each with an id, name, and its list of tests
  (`key`, `title`, `tileTitle`).
- Timer duration (minutes) and whether it defaults on or off.
- Whether category-based performance reporting is enabled
  (`performance.byCategory`).
- Marketing: **course URL, promo video filename, and footer/banner image
  filename are all required** — every exam on this platform promotes a real
  course. Ask for the actual filenames the user intends to use (e.g.
  `promo.mp4`, `course-banner.png`) — this Skill builds the config paths
  from them as `/assets/marketing/<exam-id>/<filename>` (see Step 2), it
  does not ask for a full path. If the user doesn't have final files yet,
  ask them for the filenames they intend to swap in later and note clearly
  in the final report that the files themselves are still pending — never
  write `null`/`""`, and never fabricate an empty media file to fill the
  gap.
- Runtime metadata: `meta.title`, `meta.description`, `meta.themeColor`
  (browser tab title, meta description, theme-color) — these become real
  once the exam is activated, so ask for actual values, not placeholders.

**Do NOT ask for a WhatsApp number/link.** WhatsApp is one fixed contact for
the whole platform, configured once in `src/config/brand.js`
(`WHATSAPP_NUMBER`/`WHATSAPP_URL`) — every exam uses it automatically via
`App.jsx`'s floating button and `Results.jsx`'s help link. Never add a
WhatsApp field to a new exam's `marketing` block. If a user explicitly asks
to change the platform's WhatsApp number, that's an edit to `brand.js`
itself (a platform-level change) — confirm with them explicitly before
touching it; it's out of this Skill's normal scope.

**Optional** (offer sensible empty/null defaults instead of fabricating
values — see "Defaults for optional fields" below):
- Section descriptions, icons (pick from the existing registry in
  `src/components/icons.jsx` — see the contract doc for the current list),
  per-section math rendering flag.
- Hero title/lede.
- Marketing `copy` strings (footer aria-label, alt text, help-link text,
  etc.) — sensible generic defaults can be generated from the exam's name
  if the user doesn't supply custom copy.
- Lead capture: enabled/disabled, webhook global var name, countries list,
  grade levels list.

Do not fabricate required fields. If something required is missing, ask —
don't guess a plausible-sounding value and move on.

If category-based performance is enabled, also collect (or derive from
section/test names) a first-pass category taxonomy: general categories per
section, and a specific→general mapping. It's fine for this mapping to
start small/incomplete — question ingestion later can extend it — but it
must not be fabricated wholesale; ask the user for the real skill/lesson
taxonomy if they have one, or leave `specificToGeneral` sparse rather than
inventing categories that don't correspond to anything real.

### Defaults for optional fields the user doesn't supply

- `leadCapture.enabled: false` if the user doesn't want lead capture — then
  `countries`/`gradeLevels` can be empty arrays and `webhookGlobalVar` can
  still follow the naming convention (harmless if unused).
- Section `description`/`ariaLabel`: omit if not supplied.
- Section `icon`: default to `"calculator"` for a math/quant-style section
  or `"bookOpen"` for a verbal/reading-style one if the user doesn't pick
  one, but tell them you defaulted it and that other icons exist (see the
  contract doc's registry) if the section is neither.
- `marketing.copy` sub-strings: derive plain, generic versions from the
  exam's name/short name (e.g. `helpLinkText: "Enroll in the <Name> prep
  course"`) if the user doesn't supply custom copy — but never derive
  `courseUrl`/`promoVideo`/`footerBanner` themselves this way; those are
  required inputs, not derivable copy.

## Step 2 — Scaffold the module and its surrounding filesystem structure

This Skill prepares the **complete** standard structure the platform expects
for a new exam, not just the `src/exams/` module — see
`references/exam-module-contract.md`'s "Full filesystem structure this Skill
creates" for the authoritative picture. Four roots, all keyed by the same
`<exam-id>`:

### 2a. `src/exams/<exam-id>/` — the runtime module

- `exam.config.js` — per the contract doc's shape, filled with the
  collected values. `storagePrefix: "leen_<exam-id>"`.
- `categories.js` — only if `performance.byCategory` is `true`. Otherwise
  do not create this file, and do not add a `categories` key to
  `exam.config.js` at all.
- `data/<section-id>/<test-key>.json` — one file per test, containing `[]`
  (empty placeholder array). Do not fabricate sample questions. Use the
  section's real `id` verbatim as the folder name (e.g. `data/quantitative/`)
  — do not abbreviate it; GAT's own `data/quant/` predates this convention
  and is a known inconsistency, not a pattern to copy (see the contract
  doc). If the exam has RC/passage-style sections, still only create empty
  `data/<section-id>/passages-<n>.json` files if the user specifically
  describes a passage structure; otherwise skip passages entirely.
- `questions.js` — following the GAT pattern from the contract doc,
  wired to this exam's own `config.sections`/tests and `data/` files.
- `index.js` — the fixed five-export composition shown in the contract doc.

Use `src/exams/gat/` purely as a structural reference. Never edit any file
under `src/exams/gat/` while doing this.

### 2b. `tests-source/<exam-id>/<section-id>/` — source-document folders

Create one folder per section (not per test — GAT keeps all of a section's
`.docx` files flat in one folder, e.g. `tests-source/gat/quantitative/`
holds all three tests). These start empty; the user places real `.docx`
files here later, via `/ingest-questions`. **Do not create fake/placeholder
`.docx` files.**

Since each folder is empty, drop a bare `.gitkeep` inside it so Git tracks
the directory (Git does not track empty folders — see "Empty directories
and Git" in the contract doc for this Skill's `.gitkeep` strategy in full).

Optionally add one `tests-source/<exam-id>/README.md` (not per-section) —
only if it adds real information — noting this tree is source/provenance
only and isn't read by the running app. See the contract doc for suggested
wording. Skip it if it doesn't seem useful; prefer keeping the tree clean.

### 2c. `public/questions/<exam-id>/` — question-asset namespace

Create **only** this one top-level directory (with a `.gitkeep`, since it
starts empty). Do **not** pre-create `<section-id>/<test-key>/` subfolders
under it — `/ingest-questions`'s `docx-extract-media.ps1` already creates
those on demand (`New-Item -Force`) exactly when it extracts real media, and
plenty of tests never need one at all (GAT's own `verbal` tests have zero
images and no folder). Pre-creating them here would just be clutter that
may never get used. **Do not add placeholder images.**

### 2d. `public/assets/marketing/<exam-id>/` — marketing assets

Create this directory (with a `.gitkeep`, since it starts empty). This is
namespaced per exam on purpose — a deliberate departure from GAT's own flat,
pre-refactor layout (`public/assets/marketing/vid.mp4`,
`.../gat-course-banner2.png`, no `gat/` segment) — see the contract doc for
why. **Do not copy GAT's actual promo video/banner files into it.**

Write `exam.config.js`'s `marketing.promoVideo` and `marketing.footerBanner`
as `/assets/marketing/<exam-id>/<filename>`, using the filenames collected
in Step 1 — that's the required config value even if the real files aren't
on disk yet. **Do not fabricate empty/placeholder media files** to fill the
directory. Clearly tell the user, in the final report, that the directory
was created but the real video/banner files still need to be added there
before the popup/footer will render correctly.

Do not copy GAT's webhook URL, course URL, or marketing copy into the new
exam's config, regardless of any of the above.

## Step 3 — Register, but do not activate

- `src/exams/registry.js` — **do** add this new exam here; the platform
  contract requires every exam module to be registered before it can ever
  be selected. Add one import (`import <exam-id> from "./<exam-id>/index.js";`)
  and one line inside the `registry` object (`<exam-id>,`). Nothing else in
  that file changes.
- `src/exams/active.js` — leave untouched. It contains only the
  `VITE_EXAM_ID` selection logic, not a per-exam switch, so it never needs
  editing to add or register an exam.
- **Never set/change any deployment's `VITE_EXAM_ID`** (a `.env` file, a
  Netlify site's environment variables, etc.) as part of scaffolding —
  activation is a separate, deliberate deploy-time decision for whichever
  site should serve this exam, not something this Skill does automatically.
  Registering an exam and activating it are different steps: registering
  makes it *available*; only that deployment's own `VITE_EXAM_ID` makes it
  *live*.
- Any other file under `src/exams/gat/` (or any other existing exam).
- `src/App.jsx`, anything under `src/components/`, `src/lib/`,
  `src/styles/`, `src/i18n/`, and `src/config/brand.js` — these are generic
  platform code. If building this exam seems to require a change here, stop
  and tell the user what platform limitation you hit (check
  `references/exam-module-contract.md`'s "Known platform limitations"
  section first — it may already be documented) rather than editing
  platform code unasked. In particular, never add a WhatsApp field to the
  new exam or touch `brand.js`'s `WHATSAPP_NUMBER`/`WHATSAPP_URL` unless the
  user explicitly asks to change the platform's one WhatsApp contact.
- `index.html` — its static title/meta/theme-color are only a pre-JS
  fallback (see the contract doc); this Skill sets the new exam's `meta`
  block in `exam.config.js`, which is what actually takes effect once the
  exam is active, and doesn't edit `index.html` itself.

## Step 4 — Create the exam documentation file

Create `docs/exams/<EXAM-ID>.md`, where `<EXAM-ID>` is the exam's `config.id`
**upper-cased** (e.g. `saat` → `docs/exams/SAAT.md`) — see
`docs/PLATFORM.md`'s "Exam documentation convention" for the naming rule and
required fields in full. `docs/exams/GAT.md` is a filled-out example.

Populate it **only** from what was actually collected in Step 1 / written in
Steps 2–3 — do not fabricate anything not yet known:

- Exam ID, full name, short name
- Locale / direction
- Sections / tests (ids, keys, titles)
- Timer settings (minutes, default on/off)
- Category-performance setting (`byCategory`; if `true`, note whether the
  taxonomy is a real first pass or intentionally sparse/placeholder)
- Source document location: `tests-source/<exam-id>/<section-id>/`
  (state plainly that these folders are still empty)
- Runtime asset location: `public/questions/<exam-id>/` (empty namespace,
  subfolders created on demand by `/ingest-questions`)
- Marketing asset location: `public/assets/marketing/<exam-id>/` — note the
  config paths that were set (Step 2d) and that the real video/banner files
  still need to be added there
- Lead-capture status (enabled/disabled, fields configured)
- Deployment `VITE_EXAM_ID`: `<exam-id>` — state plainly that no deployment
  has this set yet; registering the exam (Step 3) is not the same as
  activating it
- Ingestion status: **pending**
- Validation status: **pending**

If `docs/exams/<EXAM-ID>.md` already exists, stop and ask before touching it
— same as the collision check in "Before doing anything"; never silently
overwrite an existing exam doc. Skip this step entirely only if the user is
explicitly scaffolding a throwaway/test exam rather than a real one — say so
in the final report if you skip it.

## Step 5 — Validate

Without changing any deployment's active exam:

1. Confirm the new module's files parse and import cleanly — after
   registering it in `src/exams/registry.js` (Step 3), run the project's
   build with `VITE_EXAM_ID=<exam-id>` set for that one command only (e.g.
   `VITE_EXAM_ID=<exam-id> npm run build` in bash, or
   `$env:VITE_EXAM_ID="<exam-id>"; npm run build` in PowerShell) — this
   requires no file edits/reverts, since selection is an env var, not a
   line in `active.js`. A simpler alternative that avoids even that: write a
   throwaway script/entry that imports `../src/exams/<exam-id>/index.js`
   directly and checks its shape.
2. Verify:
   - `config.id` matches the folder name.
   - Every `tests[].key` is unique across the whole exam.
   - Every `sections[].id` is unique.
   - `storagePrefix` doesn't collide with any existing exam's prefix
     (grep other `exam.config.js` files under `src/exams/*/`).
   - `locale.language`/`direction` pair is one of the two supported
     combinations (or a deliberate new one the user confirmed).
   - If `performance.byCategory` is `true`, `categories.js` exists and
     `exam.config.js` references it; if `false`, confirm no `categories`
     key exists and no `categories.js` file was created.
   - The surrounding filesystem structure from Step 2 exists:
     `tests-source/<exam-id>/<section-id>/` for every section (each with a
     `.gitkeep`), `public/questions/<exam-id>/.gitkeep`, and
     `public/assets/marketing/<exam-id>/.gitkeep`.
   - `marketing.promoVideo`/`footerBanner` in `exam.config.js` point at
     `/assets/marketing/<exam-id>/<filename>` (not GAT's paths, not a bare
     filename with no directory).
3. Run `npm run build` (from the `leen-exam-platform` directory), with
   `VITE_EXAM_ID=<exam-id>` set as above, and report the result.
4. Report any validation failures plainly; don't paper over them.

## Step 6 — Report

At the end, report:
- Exam ID/name created, and the exact file list created (across all four
  scaffolding roots — `src/exams/<exam-id>/`, `tests-source/<exam-id>/`,
  `public/questions/<exam-id>/`, `public/assets/marketing/<exam-id>/` —
  plus `docs/exams/<EXAM-ID>.md` from Step 4, if created).
- Collision check result: which of the four roots were checked, and
  confirmation none pre-existed (or, if the user chose to proceed despite a
  collision, exactly what that decision was).
- Sections and tests (with keys).
- Locale/direction.
- Timer (minutes, default on/off).
- Category performance: enabled/disabled, and whether a real taxonomy was
  supplied or left sparse/placeholder.
- Filesystem structure prepared: `tests-source/<exam-id>/<section-id>/`
  folders created (one per section, each with a `.gitkeep`, awaiting real
  `.docx` files), `public/questions/<exam-id>/` namespace directory created
  (empty, subfolders left to `/ingest-questions`), and whether a
  `tests-source/<exam-id>/README.md` was added.
- Marketing configuration status: `courseUrl` value set;
  `promoVideo`/`footerBanner` config paths set to
  `/assets/marketing/<exam-id>/<filename>`; the
  `public/assets/marketing/<exam-id>/` directory was created but state
  plainly that **the real video/banner files still need to be added there**
  before the popup/footer will render correctly. Note that WhatsApp uses the
  platform-wide contact from `src/config/brand.js` and was not configured
  per exam.
- Runtime metadata (`meta.title`/`description`/`themeColor`) configured.
- Lead capture status (enabled/disabled, fields configured).
- Question ingestion status: **not done** — placeholder `[]` files only.
- Exam documentation: whether `docs/exams/<EXAM-ID>.md` was created (or, if
  skipped as a throwaway/test exam, say so explicitly).
- Validation/build result.
- Whether the exam was registered in `src/exams/registry.js` (should be
  "yes" — required by Step 3) and whether it is *active* anywhere (should
  be "no" — registering is not activating; activation is a deployment's own
  `VITE_EXAM_ID`, never changed by this Skill).
- Current `git status`.
- Next recommended command: `/ingest-questions`.

Do not commit or push. Do not run destructive git commands.

## Reference

See `references/exam-module-contract.md` for the full field-by-field
contract, the raw question JSON schema, and known platform limitations —
read it before scaffolding, and re-verify against live source if it looks
out of date.
