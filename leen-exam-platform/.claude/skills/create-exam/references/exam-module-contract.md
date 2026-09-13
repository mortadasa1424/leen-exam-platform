# Exam-module contract (as implemented in this repo)

This documents the *actual* current contract, derived from reading
`docs/PLATFORM.md` and the reference implementation in `src/exams/gat/`.
Treat `docs/PLATFORM.md` as the authoritative narrative and this file as an
implementation-level companion. **If the two ever disagree, or if the live
code has moved on since this file was written, trust the live code** —
re-read `src/exams/gat/*.js` and `src/App.jsx`/`src/components/*.jsx` rather
than this snapshot.

## Directory shape for a new exam

```
src/exams/<exam-id>/
  exam.config.js     required — plain data, the object below
  index.js           required — composes config + questions.js into the module
  questions.js        required — loads/normalizes data/*.json into TEST_QUESTIONS
  categories.js        only if performance.byCategory === true
  data/
    <section-id>/<test-key>.json      one array per test (can be `[]` placeholder)
    <section-id>/passages-<n>.json    only for passage/RC-style sections
```

`exam-id` must be a lowercase, filesystem- and JS-identifier-safe slug
(matches `src/exams/gat` naming: short, lowercase, no spaces — e.g. `saat`,
`step`).

## `exam.config.js` shape

Reference: `src/exams/gat/exam.config.js`.

```js
export default {
  id: "<exam-id>",              // must match the folder name
  name: "<Full Name>",
  shortName: "<Short Name>",
  description: "<one-line description, used as a meta/description-style string>",

  // Prefixes every localStorage/sessionStorage key (src/lib/storageKeys.js:7-9).
  // MUST be unique per exam so two exams never collide if a browser somehow
  // hits two deployments sharing an origin. Convention: `leen_<exam-id>`.
  storagePrefix: "leen_<exam-id>",

  // Platform UI chrome language — independent of question-content direction.
  // QuestionCard.jsx detects each question's own direction from its text
  // (isArabicText/promptDir) regardless of this setting.
  locale: {
    language: "en" | "ar",
    direction: "ltr" | "rtl",
  },

  // Per-exam runtime metadata — applied to document.title and the
  // <meta name="description">/<meta name="theme-color"> tags at startup in
  // App.jsx (same mechanism as locale -> documentElement.lang/dir), since
  // index.html has no build-time per-exam templating.
  meta: {
    title: "<browser tab title>",
    description: "<meta description>",
    themeColor: "<hex color, e.g. '#100a2b'>",
  },

  sections: [
    {
      id: "<section-id>",         // e.g. "quantitative" — used as questions' `section` value
      name: "<Section Name>",     // Home entry-list label
      description: "<optional description>",
      icon: "<key from SECTION_ICONS in src/components/icons.jsx>", // see "Icons" note below
      ariaLabel: "<optional explicit aria-label>", // only needed if visible text isn't descriptive enough
      mathRendering: true | false, // enables KaTeX math-card styling for this section's questions
      tests: [
        { key: "<testKey>", title: "<Full test title>", tileTitle: "<Short tile label>" },
        // testKey must be globally unique across ALL sections in this exam
        // (it namespaces question IDs and is the lookup key everywhere).
      ],
    },
    // 1+ sections required.
  ],

  // Single overall-test timer. No per-question timer concept exists.
  timer: {
    minutes: <number>,
    defaultOn: true | false,   // whether the Section Select timer toggle starts on
  },

  // OMIT this whole key entirely if performance.byCategory is false.
  categories: {
    general: { /* documentation-only: section-id -> [category names] */ },
    specificToGeneral: { /* "<specific lesson name>": "<general category>" */ },
  },

  // Controls whether the "Performance by Skill" feature exists at all for
  // this exam (App.jsx:258, docs/PLATFORM.md "Category-based performance").
  performance: {
    byCategory: true | false,
  },

  // Home-screen hero copy (distinct from src/config/brand.js, the Leen
  // company identity, which never changes per exam).
  branding: {
    heroTitle: "<hero title>",
    heroLede: "<hero subtitle/description>",
  },

  // courseUrl, promoVideo, and footerBanner are REQUIRED — every exam on
  // this platform has a course to promote. There is no WhatsApp field here:
  // WhatsApp is one fixed company contact for the whole platform, in
  // src/config/brand.js (WHATSAPP_NUMBER/WHATSAPP_URL) — never per exam.
  marketing: {
    courseUrl: "<required url>",
    promoVideo: "<required path under /assets/marketing/...>",
    footerBanner: "<required path under /assets/marketing/...>",
    copy: {
      footerAriaLabel: "<string>",
      footerBannerAlt: "<string>",
      footerBannerAriaLabel: "<string>",
      courseFooterText: "<string>",
      helpLinkText: "<string>",
      popupAriaLabel: "<string>",
    },
  },

  leadCapture: {
    enabled: true | false,
    // Read at runtime as window[<this>] — must be set by public/lead-config.js
    // at deploy time. Convention: `LEEN_<EXAM_ID_UPPER>_GOOGLE_SHEETS_WEBHOOK_URL`.
    webhookGlobalVar: "LEEN_<EXAM_ID_UPPER>_GOOGLE_SHEETS_WEBHOOK_URL",
    countries: [
      { label: "<Country>", code: "+<dial code>", iso: "<ISO2>", flagSrc: "/assets/flags/<iso>.svg" },
    ],
    // Displayed label IS the value submitted verbatim — no internal alias.
    gradeLevels: ["<label>", ...],
  },
};
```

### Field-by-field notes / gotchas found in the live code

- **`courseUrl`, `promoVideo`, and `footerBanner` are required.** Every exam
  on this platform promotes a real course — do not invent placeholder
  values for these; ask the user for the real ones. `footerBanner` still has
  a graceful text-only fallback in the UI if genuinely not ready yet
  (`Home.jsx` — `if (!footerBanner) return <CourseFooter />`), but that's a
  UI safety net, not a reason to treat it as optional when scaffolding.
- **`promoVideo` is not null-checked before the popup mounts** — `App.jsx`
  schedules `<PopupAd>` on a timer regardless of `promoVideo`'s value, and
  `PopupAd.jsx` renders `<video src={promoVideo}>` unconditionally. Since
  `promoVideo` is required, this is normally moot — flag it to the user only
  if they insist on creating the exam without a real video file yet.
- **WhatsApp is never part of `exam.config.js`.** It's fixed platform-wide
  in `src/config/brand.js` (`WHATSAPP_NUMBER`, `WHATSAPP_URL`), imported
  directly by `App.jsx` (the floating button) and `Results.jsx` (the
  "contact WhatsApp" help link). Do not ask the user for a WhatsApp
  number/link per exam, and do not add one to a new exam's `marketing`
  block — if the user wants to change the number, that means editing
  `brand.js`, a platform-level change outside this Skill's normal scope
  (confirm explicitly before touching it).
- **`icon`** resolves through `SECTION_ICONS` / `getSectionIcon()` in
  `src/components/icons.jsx`, a curated registry of lucide-react icons
  (`calculator`, `bookOpen`, `flaskConical`, `atom`, `languages`, `penTool`,
  `globe`, `brain`, `ruler`, `graduationCap`, `layers`, `fileText`,
  `scrollText`, `landmark`, `microscope` as of this writing — grep
  `SECTION_ICONS` to confirm the current list). An unrecognized/missing key
  falls back to a neutral `LayoutGrid` icon (`getSectionIcon`'s
  `DEFAULT_SECTION_ICON`), not a crash. Pick from the existing registry;
  only propose adding a new icon to `icons.jsx` itself if the user
  explicitly wants a subject icon that truly isn't covered.
- **`categories`**: omit the entire key when `performance.byCategory` is
  `false`. Do not invent placeholder categories.
- **`meta`**: `title`/`description`/`themeColor` are applied at runtime in
  `App.jsx` from the active exam's config — set them to real values (they
  become the actual browser-tab title etc. once activated), not placeholders.

## `questions.js` shape

Reference: `src/exams/gat/questions.js`. This file is exam-specific (not
platform-core) but its *shape* rarely needs to change — copy the pattern:

```js
import config from "./exam.config.js";
// ...import each data/<section>/<test>.json...

export const testMeta = Object.fromEntries(
  config.sections.flatMap((section) =>
    section.tests.map((t) => [t.key, { section: section.id, title: t.title, mathRendering: Boolean(section.mathRendering) }])
  )
);

export const passages = { /* {} if no RC-style questions; otherwise { [passageId]: passage } */ };

function buildTestQuestions(testKey, base) {
  const meta = testMeta[testKey];
  return base.map((q, i) => ({
    ...q,
    id: `<EXAM-ID-UPPER>-${testKey.toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
    section: meta.section,
    testKey,
    order: i + 1,
    generalCategory: config.categories?.specificToGeneral?.[q.specificCategory] ?? q.generalCategory ?? null,
    mathLayout: meta.mathRendering,
  }));
}

const TEST_QUESTIONS = { /* one buildTestQuestions(...) call per test key */ };

export function getTestQuestions(testKey) { return TEST_QUESTIONS[testKey] || []; }
function allQuestions() { return Object.values(TEST_QUESTIONS).flat(); }
export function getQuestionsByIds(ids = []) { /* same as GAT */ }
export function rehydrateQuestions(questions = []) { /* same as GAT */ }
```

If `performance.byCategory` is `false`, `config.categories` won't exist —
use `config.categories?.specificToGeneral?.[...] ?? q.generalCategory ?? null`
(optional-chained, as above) so `questions.js` never throws.

### Raw question JSON schema (per array element, under `data/`)

Fields common to all kinds:
- `specificCategory` (string; `""` allowed) — only meaningful if
  `performance.byCategory` is true; still fine to leave as `""` otherwise.
- `kind`: one of `"text"` (math prompt via `prompt: [{type:"text"|"tex", text}]`,
  no image), `"image"` (adds `image: "<path>"`, optional `compareTable`),
  `"text-en"` (adds `questionText: "<string>"`, optional `passageId` for
  RC), `"svg"` (adds inline SVG figure data — see `QuestionCard.jsx:318` for
  the exact prop shape before using it).
- `options`: `[{ label: "A", text: "..." }]` or `[{ label: "A", tex: "..." }]`
  (tex options used with math `kind`s).
- `answerLabels`: array of the option labels in display order.
- `correctAnswer`: one of `answerLabels`.
- `sourceRef`, `reviewStatus`: provenance metadata copied through as-is; not
  required for a placeholder file but harmless to include.

A **placeholder** test file that satisfies the contract without fabricating
content is simply `[]` (an empty array) — `buildTestQuestions` and every
downstream consumer (`Quiz.jsx`, `Results.jsx`, `SectionSelect.jsx`) handle a
zero-question test without crashing; it just shows "0 questions" until
`/ingest-questions` populates it.

## `index.js` shape

Reference: `src/exams/gat/index.js` — always this exact five-export shape,
no exam-specific logic:

```js
import config from "./exam.config.js";
import { testMeta, passages, getTestQuestions, getQuestionsByIds, rehydrateQuestions } from "./questions.js";

export default { config, testMeta, passages, getTestQuestions, getQuestionsByIds, rehydrateQuestions };
```

## `categories.js` shape (only when `performance.byCategory: true`)

Reference: `src/exams/gat/categories.js` — two named exports:

```js
export const GENERAL_CATEGORIES = { "<section-id>": ["<general category name>", ...] };
export const SPECIFIC_TO_GENERAL = { "<specific lesson/category name from raw data>": "<general category name>" };
```

`GENERAL_CATEGORIES` is documentation-only (not read by any component today
— confirm this is still true by grepping before relying on it).
`SPECIFIC_TO_GENERAL` is the one actually consumed, by `questions.js`.

## Registration and activation

These are two separate steps — creating an exam module must do the first,
and must **never** do the second:

1. **Registration** (required — do this): add the new exam to
   `src/exams/registry.js`, a plain object mapping every exam id this build
   knows about to its module:

   ```js
   // src/exams/registry.js
   import gat from "./gat/index.js";
   import <exam-id> from "./<exam-id>/index.js";   // add

   const registry = {
     gat,
     <exam-id>,                                     // add
   };

   export default registry;
   ```

   This makes the exam *available* to be selected — it does not make it
   live anywhere.

2. **Activation** (never do this automatically, and never touch a live
   deployment's settings): `src/exams/active.js` selects the live exam from
   `import.meta.env.VITE_EXAM_ID` (a Vite build-time env var, defaulting to
   `"gat"` if unset, throwing if set to an id not in the registry — see
   `docs/PLATFORM.md`'s "Exam registry" section). It contains no per-exam
   switch to edit; there is nothing in this repo's tracked files to change
   to "activate" an exam. Making an exam live means setting `VITE_EXAM_ID`
   on a deployment (a Netlify site's environment variables — never touch
   those directly) or locally (`.env.local`, gitignored, or inline on the
   command line). Do not set this automatically as a side effect of
   scaffolding. If the user explicitly asks to make the new exam their
   *local* default, editing `.env.local` on their behalf is reasonable;
   never edit a deployment's environment variables yourself under any
   circumstance — tell the user how to set `VITE_EXAM_ID` on the relevant
   Netlify site instead.

## Static, non-config-driven files (out of scope for this Skill)

`index.html`'s `<title>`, meta description, and `theme-color` are still
plain static HTML with no *build-time* templating — but `App.jsx` overwrites
`document.title` and those two `<meta>` tags at runtime startup from the
active exam's `config.meta`, so a new exam's `meta` block is enough to make
the tab title/description/theme-color correct once it's activated. This
Skill sets `meta` in `exam.config.js`; it does not edit `index.html` itself
(its static values only matter pre-hydration/for crawlers, and stay GAT's
until GAT is no longer the fallback markup — a separate, low-priority
follow-up, not something to fix per-exam).

## Known platform limitations (do not silently fix — report them)

These are gaps in the reusable platform itself, not something a
`create-exam` invocation should patch on its own:

1. **`promoVideo` is required but still not null-checked in the UI.**
   `App.jsx` schedules `<PopupAd>` unconditionally on a timer, and
   `PopupAd.jsx` renders `<video src={promoVideo}>` with no guard. Since
   this field is now required at scaffold time, this only matters if a user
   insists on creating an exam before a real video file exists — flag it
   rather than silently letting a broken popup ship.
2. **`SECTION_ICONS` is a curated but still finite registry** (~15 icons as
   of this writing, in `src/components/icons.jsx`, with a graceful
   `LayoutGrid` fallback via `getSectionIcon()`). A new exam needing an icon
   truly outside that set has no config-only way to get one — the registry
   itself (platform code) would need a new entry. Stick to the existing
   registry unless the user explicitly asks to extend `icons.jsx`.
3. **`index.html`'s static markup still only reflects GAT** (see above) —
   its `<title>`/description/`theme-color` are only overwritten after
   `App.jsx` runs; anything reading them before that (a crawler, the very
   first paint) sees GAT's values regardless of which exam is active. Not
   fixed by this Skill; a low-priority platform follow-up if it ever matters
   (e.g. for SEO of a second exam's own deployment).

If, while running this Skill, you find the live code has since fixed one of
these (or added new ones), update this file and mention the discrepancy to
the user rather than silently trusting this snapshot.
