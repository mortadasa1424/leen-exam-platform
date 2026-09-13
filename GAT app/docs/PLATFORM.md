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
    active.js            <- the ONE file that says which exam is live
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
    marketing: {
      courseUrl, whatsappNumber, whatsappUrl, promoVideo, footerBanner,
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
folder by name. That file is the single switch:

```js
// src/exams/active.js
export { default } from "./gat/index.js";
```

## How GAT is registered

`src/exams/gat/index.js` composes `exam.config.js` + `questions.js` +
`categories.js` into the module above, and `src/exams/active.js` re-exports
it. That's the whole registration — there's no separate exam registry/router.

## Adding a future exam manually

1. Create `src/exams/<id>/` with `exam.config.js`, `categories.js` (if the
   exam has category-based reporting), `questions.js`, `index.js`, and a
   `data/` folder for its question JSON — copy GAT's files as a starting
   template; the shape of `questions.js` (normalize raw JSON -> namespaced
   IDs -> attach `generalCategory`/`mathLayout`) rarely needs to change.
2. Fill in `exam.config.js`: sections (with their tests, and `mathRendering`
   per section if the exam has math-style questions), timer minutes,
   marketing links/copy, lead capture fields, and — if the exam has a real
   category taxonomy — category mapping plus `performance: { byCategory: true }`.
   If not, set `performance: { byCategory: false }` (or omit it) and skip
   `categories` entirely; see "Category-based performance reporting" below.
3. Drop the exam's question datasets under `src/exams/<id>/data/`, in
   whatever shape `questions.js` expects (see the question schema notes at
   the top of `src/exams/gat/questions.js`).
4. Point brand-only assets (course promo video/banner, question images) under
   `public/` — a new exam should use its own `public/questions/<id>/...` and
   `public/assets/marketing/...` paths so they don't collide with GAT's.
5. Change the one line in `src/exams/active.js` to point at the new exam's
   `index.js`.
6. Update `index.html`'s `<title>`/meta description/`theme-color` by hand —
   these are static HTML with no build-time templating today, so they're not
   part of the exam-config system. (Noted as a possible follow-up, not done
   as part of this refactor to avoid unrelated scope.)

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

- **Questions**: `src/exams/<id>/data/`. Treat as read-only content —
  `questions.js` is the only place that shapes it (namespacing IDs,
  attaching `generalCategory`/`mathLayout`).
- **Assets**: `public/` — images/SVGs referenced by question JSON, brand
  logos (`public/assets/brand/`, shared across exams), and each exam's own
  marketing assets (`public/assets/marketing/`, promo video/banner).
- **Categories**: `src/exams/<id>/categories.js` — `general` is a
  documentation-only list of category names per section; `specificToGeneral`
  is the mapping actually used at question-build time
  (`specificCategory -> generalCategory`) to drive the Performance Report.
- **Timer**: `exam.config.js`'s `timer.minutes` (the single overall-test
  deadline length) and `timer.defaultOn` (whether the timer toggle starts on
  or off on the Section Select screen). There's no per-question timer
  concept in the platform today.
- **Marketing**: `exam.config.js`'s `marketing` block — URLs, promo assets,
  and the `copy` sub-object for any UI string that names the exam/course
  (footer aria-labels, alt text, help-link text). Company branding (Leen
  logo/name) is separate, in `src/config/brand.js`, since it doesn't change
  per exam.

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
- Don't fork `src/i18n/en.js`/`ar.js` per exam — they're shared platform
  dictionaries. An exam only sets `locale.language` to pick one; if a string
  is genuinely wrong for one exam, that's a sign it's exam-specific copy that
  belongs in that exam's own `exam.config.js`, not a platform string.
