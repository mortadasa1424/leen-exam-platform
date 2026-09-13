# Reusable Exam Platform

This app was built as a single-exam GAT practice app and then refactored into
a reusable platform: the quiz/results/review engine is generic, and GAT is
its first "exam module." This doc explains that split so a future exam
(SAAT, STEP, ...) can be added without touching the engine. For GAT's own
product details (question format, marketing config, lead capture), see the
main [README.md](../README.md) — that document is left as-is as the
GAT-specific reference.

## Architecture

```
src/
  App.jsx              screen state machine — generic
  components/          Home, SectionSelect, Quiz, QuestionCard, Results,
                        Review, PerformanceReport, NavOverlay, LeadForm,
                        PopupAd, ErrorBoundary — all generic
  lib/                  scoring, sound, storage, storageKeys — all generic
  styles/app.css        all styling — generic, exam-agnostic
  config/
    brand.js            Leen company identity (logo, name) — constant across
                         every exam product; NOT per-exam
  exams/
    active.js            <- the ONE stable import path components use;
                             selects an exam from registry.js via VITE_EXAM_ID
    registry.js           <- every exam module this build knows about
    gat/
      exam.config.js      GAT's definition (sections, tests, timer,
                           marketing, lead capture, categories)
      categories.js       GAT's category mapping (general <- specific)
      questions.js         loads/normalizes GAT's question JSON
      index.js              composes the above into one "exam module"
      data/
        quant/*.json        GAT's question banks (read-only content)
        verbal/*.json + passages-*.json
```

**Core vs. exam config**: `App.jsx`, everything in `components/`, and
everything in `lib/` contain zero exam-specific logic or copy — they only
read from the active exam module. All of GAT's specifics (section names,
test titles, timer length, course link, WhatsApp number, promo assets, lead
form fields, category mapping, the six question datasets) live under
`src/exams/gat/`.

## The exam-module contract

Every `src/exams/<id>/index.js` must default-export an object shaped like
this (see `src/exams/gat/index.js` for the reference implementation):

```js
{
  config: {
    id, name, shortName, description,
    storagePrefix,        // localStorage/sessionStorage key prefix
    sections: [
      {
        id, name, description, icon, ariaLabel?,
        mathRendering,     // true = KaTeX/math-card rendering capability
        tests: [{ key, title, tileTitle }],
      },
    ],
    timer: { minutes, defaultOn },
    categories: { general, specificToGeneral },   // omit entirely if performance.byCategory is false
    performance: { byCategory },               // whether category-based reporting UI exists at all
    branding: { heroTitle, heroLede },        // exam-specific Home copy
    locale: { language, direction },           // platform UI language — "en"/"ltr" or "ar"/"rtl"
    meta: { title, description, themeColor }, // per-exam browser tab title/meta description/theme-color
    marketing: {
      // courseUrl, promoVideo, footerBanner are REQUIRED — every exam has a
      // course to promote. WhatsApp is NOT part of this block: it's one
      // fixed company contact for the whole platform (src/config/brand.js),
      // not configured per exam.
      courseUrl, promoVideo, footerBanner,
      copy: { footerAriaLabel, footerBannerAlt, footerBannerAriaLabel,
              courseFooterText, helpLinkText, popupAriaLabel },
    },
    leadCapture: { enabled, webhookGlobalVar, countries, gradeLevels },
  },
  testMeta,                 // flat { [testKey]: {section, title, mathRendering} }
  getTestQuestions(testKey),
  getQuestionsByIds(ids),
  rehydrateQuestions(questions),
  passages,                 // { [passageId]: passage } — only used if the
                             // exam has passage-based (RC-style) questions
}
```

Components import this via `src/exams/active.js` — never a specific exam
folder, and never `src/exams/registry.js`, by name.

## Exam registry

`src/exams/active.js` is a **build-time selector**, not a manual switch: it
reads `import.meta.env.VITE_EXAM_ID` (a Vite build-time env var — see
[Vite's env docs](https://vitejs.dev/guide/env-and-mode.html)), looks that id
up in `src/exams/registry.js`, and exports whichever exam module it finds.
`registry.js` is a plain object mapping every exam id this build knows about
to its module, via ordinary static imports:

```js
// src/exams/registry.js
import gat from "./gat/index.js";

const registry = {
  gat,
  // saat,
  // step,
};

export default registry;
```

```js
// src/exams/active.js (selection logic; see the file for the full version)
import registry from "./registry.js";

const examId = import.meta.env.VITE_EXAM_ID || "gat";
const exam = registry[examId];

if (!exam) {
  throw new Error(`Unknown VITE_EXAM_ID "${examId}". Valid exam IDs: ${Object.keys(registry).join(", ")}.`);
}

export default exam;
```

**Static imports, not dynamic `import()`.** Every consumer (starting with
`App.jsx`'s top-level `const { ... } = activeExam`) reads the active exam
module synchronously at import time. This platform selects one exam per
*build*, it never switches exams at runtime in a running browser tab, so
there is nothing to gain from lazy-loading exam modules and doing so would
force every consumer to handle a Promise for no benefit. If a future exam's
dataset gets large enough that bundle size becomes a real problem, that's a
deliberate follow-up (e.g. per-exam build entries), not something to
retrofit into this selector casually.

**Behavior:**
- **`VITE_EXAM_ID` unset** (plain local `npm run dev`/`npm run build`, or any
  deployment that hasn't set the variable) → defaults to `"gat"`. Existing
  behavior/deployments are unaffected by this change.
- **`VITE_EXAM_ID` set to a registered id** (e.g. `gat`, or a future `saat`/
  `step` once registered) → that exam is active for the build.
- **`VITE_EXAM_ID` set to an id *not* in `registry.js`** → `active.js` throws
  immediately, with an error message listing the valid ids. It never
  silently falls back to GAT — a typo in the env var must fail loudly, not
  quietly ship the wrong exam.

Because Vite is a client-side bundler, `npm run build` itself still succeeds
even for an invalid id (bundling doesn't execute application code) — the
thrown error fires the moment the built app actually loads in a browser
(dev server or the built `dist/` output), which is where "clear failure"
surfaces for a Vite SPA. There is no secret involved: `VITE_`-prefixed
variables are always inlined into the public client bundle by Vite, by
design, so never put anything sensitive in `VITE_EXAM_ID` or its neighbors.

### Local development

```
# .env.local (gitignored) or inline:
VITE_EXAM_ID=gat npm run dev      # bash/macOS/Linux
$env:VITE_EXAM_ID="gat"; npm run dev   # PowerShell
```

Omit it entirely for the same result — `gat` is the default. See
`.env.example` for the documented variable (copy it to `.env.local` to set a
default without repeating it on every command).

### Netlify deployment

Each Netlify site for this repo (one per exam) sets its own **Build & deploy
→ Environment variables**:

```
GAT site:   VITE_EXAM_ID=gat
SAAT site:  VITE_EXAM_ID=saat
STEP site:  VITE_EXAM_ID=step
```

All three sites can build from the same repo/branch — the only difference
between their deployments is this one environment variable. This doc does
not change any live Netlify site's settings; setting/updating them on
Netlify is a deploy-time operation for whoever owns that site.

### Adding a new exam to the registry

Once `src/exams/<id>/` exists (via `/create-exam`) and implements the
exam-module contract below, register it by adding one import + one line to
`src/exams/registry.js`:

```js
import gat from "./gat/index.js";
import saat from "./saat/index.js";   // new

const registry = {
  gat,
  saat,                                // new
};
```

Nothing else changes — `active.js`, `App.jsx`, and every component are
untouched. Registering an exam does **not** make it active anywhere; a
deployment only serves it once that deployment's own `VITE_EXAM_ID` is set
to its id.

## Adding a future exam

`/create-exam` (a Claude Code Skill — `.claude/skills/create-exam/`)
automates all of the steps below: it scaffolds the runtime module, the
question-asset namespace, the source-document folders, and the marketing
folder in one pass, and registers the exam. What follows is what it does,
for anyone adding an exam by hand or auditing its output.

1. Create `src/exams/<id>/` with `exam.config.js`, `categories.js` (if the
   exam has category-based reporting), `questions.js`, `index.js`, and a
   `data/<section-id>/` folder per section for its question JSON (`[]`
   placeholders until `/ingest-questions` runs) — copy GAT's files as a
   starting template; the shape of `questions.js` (normalize raw JSON ->
   namespaced IDs -> attach `generalCategory`/`mathLayout`) rarely needs to
   change. Use each section's real `id` verbatim as its `data/` folder name
   — GAT's own `data/quant/`/`data/verbal/` predate this convention and
   don't match GAT's actual section ids (`quantitative`/`verbal`); that
   mismatch is a historical artifact, not something to replicate.
2. Fill in `exam.config.js`: sections (with their tests, and `mathRendering`
   per section if the exam has math-style questions), timer minutes, `meta`
   (title/description/themeColor), marketing links/copy (`courseUrl`,
   `promoVideo`, `footerBanner` are required — every exam has a course to
   promote), lead capture fields, and — if the exam has a real category
   taxonomy — category mapping plus `performance: { byCategory: true }`.
   If not, set `performance: { byCategory: false }` (or omit it) and skip
   `categories` entirely; see "Category-based performance reporting" below.
   Do **not** add a WhatsApp field here — WhatsApp is one fixed company
   contact for the whole platform, in `src/config/brand.js`.
3. Drop the exam's question datasets under `src/exams/<id>/data/`, in
   whatever shape `questions.js` expects (see the question schema notes at
   the top of `src/exams/gat/questions.js`). Their original source `.docx`
   files live separately, under `tests-source/<id>/<section-id>/` (one
   folder per section, files flat inside it — see GAT's own
   `tests-source/gat/quantitative/`) — this tree is provenance only, never
   read by the running app.
4. Point brand-only assets under `public/`, each in its own exam-id
   namespace so nothing collides across exams: question images at
   `public/questions/<id>/<section-id>/<test-key>/...` (created on demand by
   `/ingest-questions`, not pre-built), and the course promo video/banner at
   `public/assets/marketing/<id>/...`. GAT's own promo files still sit flat
   at `public/assets/marketing/vid.mp4`/`gat-course-banner2.png` (no `gat/`
   segment) as a pre-refactor artifact — a new exam should use the namespaced
   form, not match GAT's flat layout.
5. Register it in `src/exams/registry.js` (see "Adding a new exam to the
   registry" above). Do **not** edit `src/exams/active.js` — it needs no
   per-exam changes — and do **not** change any deployment's `VITE_EXAM_ID`
   as part of this step; that's a separate, deliberate deploy-time decision
   for whichever site should start serving the new exam.
6. `index.html`'s `<title>`/meta description/`theme-color` are static HTML
   with no build-time templating, but `App.jsx` overwrites them at startup
   from the active exam's `config.meta` (title/description/themeColor), the
   same way it sets `document.documentElement.lang`/`dir` from `locale` —
   so setting `meta` in `exam.config.js` is enough; `index.html` itself only
   needs manual edits for the *default* (pre-JS) values a crawler or a
   pre-hydration flash would see.

No file in `components/`, `lib/`, or `App.jsx` should need to change for a
new exam. If one does, that's a sign of an exam assumption that leaked into
core — treat it the same way `q.section === "quantitative"` was replaced
with `q.mathLayout` during this refactor: pull the capability into config,
not a hardcoded name check.

## Platform language (locale / i18n)

`exam.config.js`'s `locale: { language, direction }` sets the *platform UI*
language/direction — Home, Section Select, Quiz chrome, Results, Review,
Performance Report, Lead Form, error/promo UI. It is set once at startup in
`App.jsx` (`document.documentElement.lang/dir`), before first paint.

This is deliberately **independent from question-content direction**.
`QuestionCard.jsx` still detects each question's own direction from its
actual text (`isArabicText`/`promptDir`) and sets `dir` explicitly on that
content, which always wins over the inherited platform direction — so an
Arabic-platform exam can contain English questions (and vice versa) without
either being forced the wrong way.

Only two languages ship today, `src/i18n/en.js` and `src/i18n/ar.js` — plain
key → string objects, no library. `src/i18n/index.js` picks the dictionary
for the active exam's `locale.language` (falling back to English for any
missing key) and exports a `t(key, vars)` helper components call directly,
e.g. `t("quiz.submitTest")` or `t("quiz.timeUpBody", { minutes: 60 })`.

**A future exam only needs to set `locale: { language: "ar", direction: "rtl" }`**
in its own `exam.config.js` to get the fully-Arabic, fully-RTL generic
platform — no component changes. To add a third language, add
`src/i18n/<lang>.js` (copy `en.js`'s keys) and register it in
`src/i18n/index.js`'s `DICTS` map.

What's *not* covered by `src/i18n/`, because it's exam content rather than
platform chrome, and already lives in each exam's own `exam.config.js`:
section/test names, hero copy, category/lesson names, and marketing copy
(course link text, promo aria-labels). An Arabic exam's author translates
those directly in its `exam.config.js`, same as any other exam-specific
value.

RTL layout itself mostly falls out of the platform's existing flexbox
layouts (`flex-direction: row` reverses visually under `dir="rtl"` with no
CSS change needed) plus a handful of properties that already use logical
values (`text-align: start`, `justify-self: start`). No RTL-specific CSS
overrides were needed for the current component set; if a future layout adds
a genuinely physical (`margin-left`/`right`, absolute `left`/`right`)
assumption, scope its RTL counterpart under `[dir="rtl"] .that-selector`
rather than rewriting the base (LTR) rule, so existing exams stay unaffected.

## Category-based performance reporting (optional per exam)

Category breakdowns aren't universal — some exams have a real skill taxonomy
(GAT's Arithmetic/Algebra/Geometry/...), others don't. `exam.config.js`'s
`performance: { byCategory: true | false }` controls whether that whole
feature exists for an exam:

- **`true` (GAT's setting)**: Results shows the "Performance by Skill"
  button; it opens `PerformanceReport.jsx` with the weakest-area callout and
  per-category cards, exactly as before this capability was added.
- **`false`**: the button is not rendered at all — not disabled, not an
  empty state, just absent — and `App.jsx` also refuses to navigate to the
  report screen even if something else tried to call `onReport`, as a second
  layer of the same guard. Results, Review, and Practice Mistakes are
  otherwise unaffected; whichever of those buttons remain just occupy the
  space the report button would have.

An exam with `byCategory: false` does **not** need to define `categories` in
its config, and its `questions.js` doesn't need to compute
`generalCategory` — `diagnose()`/`weakestCategory()` in `lib/scoring.js`
simply never get called for that exam. This is checked with
`activeExam.config.performance?.byCategory` (optional-chained), so an exam
that omits `performance` entirely is treated as `false`, not a crash.

## Where things live

- **Which exam is active**: `VITE_EXAM_ID`, a build-time env var (see "Exam
  registry" above) — never a hardcoded value in `active.js`, which contains
  only the selection logic, not a per-exam switch.
- **Questions**: `src/exams/<id>/data/`. Treat as read-only content —
  `questions.js` is the only place that shapes it (namespacing IDs,
  attaching `generalCategory`/`mathLayout`).
- **Assets**: `public/` — question images/SVGs at
  `public/questions/<id>/<section-id>/<test-key>/...` (namespaced per exam
  since `/ingest-questions`'s "Asset path convention" migrated GAT's own
  images to `public/questions/gat/...`), brand logos (`public/assets/brand/`,
  shared across exams), and each exam's own marketing assets at
  `public/assets/marketing/<id>/...` (promo video/banner) — also namespaced
  per exam, except GAT's own files, which still sit flat at
  `public/assets/marketing/` as a pre-refactor artifact predating this
  convention.
- **Categories**: `src/exams/<id>/categories.js` — `general` is a
  documentation-only list of category names per section; `specificToGeneral`
  is the mapping actually used at question-build time
  (`specificCategory -> generalCategory`) to drive the Performance Report.
- **Timer**: `exam.config.js`'s `timer.minutes` (the single overall-test
  deadline length) and `timer.defaultOn` (whether the timer toggle starts on
  or off on the Section Select screen). There's no per-question timer
  concept in the platform today.
- **Marketing**: `exam.config.js`'s `marketing` block — `courseUrl`,
  `promoVideo`, and `footerBanner` are **required** per exam (every exam has
  a course to promote), plus the `copy` sub-object for any UI string that
  names the exam/course (footer aria-labels, alt text, help-link text).
  Company branding (Leen logo/name) and the **WhatsApp contact** are
  separate, in `src/config/brand.js` (`WHATSAPP_NUMBER`/`WHATSAPP_URL`),
  since neither changes per exam — there is one WhatsApp number for the
  whole platform, not one per exam. `App.jsx`'s floating WhatsApp button and
  `Results.jsx`'s "contact WhatsApp" link both import it from there, never
  from an exam's `marketing` block.
- **Runtime metadata**: `exam.config.js`'s `meta` block (`title`,
  `description`, `themeColor`) — applied to `document.title` and the
  `<meta name="description">`/`<meta name="theme-color">` tags at startup in
  `App.jsx`, the same way `locale` sets `documentElement.lang`/`dir`. This is
  how a new exam's browser-tab title/description/theme-color take effect
  without per-exam build-time HTML templating.
- **Section icons**: `src/components/icons.jsx`'s `SECTION_ICONS` registry
  (a curated set of lucide-react icons — calculator, bookOpen, flaskConical,
  atom, languages, penTool, globe, brain, ruler, graduationCap, layers,
  fileText, scrollText, landmark, microscope) plus `getSectionIcon(iconKey)`,
  which both `Home.jsx` and `SectionSelect.jsx` call to resolve a section's
  `icon` string, falling back to a neutral `LayoutGrid` icon if the key is
  missing or unrecognized. Add new icons to this one registry (not per-exam
  code) if a future exam needs a subject icon that isn't listed yet.

## What must never be duplicated or modified when adding an exam

- Don't copy `Quiz.jsx`, `Results.jsx`, `Review.jsx`, `PerformanceReport.jsx`,
  `NavOverlay.jsx`, or any `lib/*` file for a new exam — they're generic by
  design and take everything they need as props or via the active exam
  module.
- Don't hardcode a new exam's section/test names, timer length, or marketing
  links anywhere in `components/`/`App.jsx` — they belong in that exam's
  `exam.config.js`.
- Don't reuse another exam's `storagePrefix` — each exam needs its own so
  saved attempts/theme/lead-completion flags don't collide if a browser ever
  visits two exam deployments sharing an origin.
- Don't edit an existing exam's question JSON content (text, answers, order,
  categories, passages, image paths) as part of adding a *different* exam.
- Don't add a WhatsApp number/URL field to a new exam's `marketing` block —
  WhatsApp is one fixed platform-wide contact in `src/config/brand.js`;
  changing it (a rare, deliberate business decision) means editing that one
  constant, not adding a per-exam override.
- Don't fork `src/i18n/en.js`/`ar.js` per exam — they're shared platform
  dictionaries. An exam only sets `locale.language` to pick one; if a string
  is genuinely wrong for one exam, that's a sign it's exam-specific copy that
  belongs in that exam's own `exam.config.js`, not a platform string.
