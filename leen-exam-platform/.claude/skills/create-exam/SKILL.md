---
name: create-exam
description: Scaffold a new exam module (src/exams/<exam-id>/) for this repo's reusable exam platform, without touching the generic engine (App.jsx, components/, lib/, styles) or any other exam's files. Use when the user runs /create-exam, or asks to add/create a new exam (e.g. SAAT, STEP) on top of this platform. Does not import real questions (that's /ingest-questions), registers the new exam in src/exams/registry.js, but never sets any deployment's VITE_EXAM_ID (that's a separate, explicit deploy-time decision, never automatic).
---

# create-exam

Scaffold a new exam module that plugs into this repo's reusable exam
platform (see `docs/PLATFORM.md`). This Skill creates config/data/module
files and registers the new exam in `src/exams/registry.js` — it never
touches the generic engine, never edits another exam's files, and never
sets any deployment's `VITE_EXAM_ID` (registering an exam makes it
*available*; a deployment's own `VITE_EXAM_ID` is what makes an exam
*live*, and that's always a separate, explicit decision for whoever owns
that deployment — this Skill never makes it, even if asked, though it can
tell the user how to set it themselves for local dev or on Netlify).

## Before doing anything

1. Read `docs/PLATFORM.md` and `references/exam-module-contract.md` (in
   this Skill folder). The reference file documents the real contract as
   last inspected; **if anything looks stale — a file path that no longer
   exists, a component that no longer matches — re-read the live source
   (`src/exams/gat/`, `src/App.jsx`, `src/components/*.jsx`) instead of
   trusting the doc.** Do not invent a different architecture.
2. Run `git status`. If it's not clean, tell the user what's pending before
   you start creating files (don't stash/discard anything yourself).
3. Check whether `src/exams/<candidate-id>/` already exists. If it does,
   **stop and ask the user to confirm** before writing anything into it —
   never silently overwrite an existing exam module.

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
- Marketing: **course URL, promo video path, and footer/banner image path
  are all required** — every exam on this platform promotes a real course.
  Do not default or fabricate these; if the user doesn't have final assets
  yet, ask them for at least a working placeholder path/URL they intend to
  swap in, and note it clearly in the final report rather than silently
  writing `null`/`""`.
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

## Step 2 — Scaffold the module

Create, under `src/exams/<exam-id>/`:

- `exam.config.js` — per the contract doc's shape, filled with the
  collected values. `storagePrefix: "leen_<exam-id>"`.
- `categories.js` — only if `performance.byCategory` is `true`. Otherwise
  do not create this file, and do not add a `categories` key to
  `exam.config.js` at all.
- `data/<section-id>/<test-key>.json` — one file per test, containing `[]`
  (empty placeholder array). Do not fabricate sample questions. If the
  exam has RC/passage-style sections, still only create empty
  `data/<section-id>/passages-<n>.json` files if the user specifically
  describes a passage structure; otherwise skip passages entirely.
- `questions.js` — following the GAT pattern from the contract doc,
  wired to this exam's own `config.sections`/tests and `data/` files.
- `index.js` — the fixed five-export composition shown in the contract doc.

Use `src/exams/gat/` purely as a structural reference. Never edit any file
under `src/exams/gat/` while doing this.

Use the marketing paths as given (paths under `public/assets/marketing/...`
and `public/questions/<exam-id>/...`) — do not copy GAT's actual asset files
(promo video, banner image) into the new exam's paths, and do not copy
GAT's webhook URL, course URL, or marketing copy into the new exam's
config. If the user hasn't actually placed the promo video/banner file on
disk yet, still write the intended path into `exam.config.js` (that's the
required config value) and tell them the file itself still needs to be
added under `public/assets/marketing/` before the popup/footer will render
correctly — don't silently substitute GAT's asset file.

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

## Step 4 — Validate

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
3. Run `npm run build` (from the `leen-exam-platform` directory), with
   `VITE_EXAM_ID=<exam-id>` set as above, and report the result.
4. Report any validation failures plainly; don't paper over them.

## Step 5 — Report

At the end, report:
- Exam ID/name created, and the exact file list created.
- Sections and tests (with keys).
- Locale/direction.
- Timer (minutes, default on/off).
- Category performance: enabled/disabled, and whether a real taxonomy was
  supplied or left sparse/placeholder.
- Marketing configuration status: `courseUrl`/`promoVideo`/`footerBanner`
  values set, and whether the actual video/banner files still need to be
  added under `public/assets/marketing/`. Note that WhatsApp uses the
  platform-wide contact from `src/config/brand.js` and was not configured
  per exam.
- Runtime metadata (`meta.title`/`description`/`themeColor`) configured.
- Lead capture status (enabled/disabled, fields configured).
- Question ingestion status: **not done** — placeholder `[]` files only.
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
