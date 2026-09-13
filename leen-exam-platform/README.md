# Leen GAT Practice App

> This app is the first exam built on a reusable exam platform — the
> quiz/results/review engine is generic, and GAT is a config + dataset on top
> of it. See [docs/PLATFORM.md](docs/PLATFORM.md) for that architecture and
> how to add another exam. This document stays focused on GAT specifically.

A free practice app for the GAT exam: Quantitative and Verbal sections, each
with three fixed-form tests. Built as a single-page React app — no backend of
its own, aside from a Google Apps Script webhook that captures leads before a
test starts.

## Tech stack

- **React 18** + **Vite 5** (`@vitejs/plugin-react`)
- Plain CSS (`src/styles/app.css`), no CSS framework
- [KaTeX](https://katex.org/) for math rendering
- [lucide-react](https://lucide.dev/) for icons, `react-icons` for the
  WhatsApp glyph
- No router — screens are plain state in `App.jsx` (`home | select | lead |
  quiz | results | report | review`), not URL routes
- No backend — lead capture posts to a Google Apps Script Web App that writes
  to a Google Sheet (see [Google Sheets lead integration](#google-sheets-lead-integration))

## Install & run

```bash
npm install
npm run dev       # local dev server (Vite)
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
```

Requires Node.js (any version compatible with Vite 5 / modern npm).

## Project structure

```
leen-exam-platform/
├── index.html                # entry HTML; loads /lead-config.js then main.jsx
├── src/
│   ├── main.jsx               # React root
│   ├── App.jsx                # screen state machine, attempt/resume/lead flow (generic)
│   ├── components/            # one file per screen/UI piece (Home, Quiz, Results, ...) — generic
│   ├── config/brand.js        # Leen company logo/name — shared across every exam, not GAT-specific
│   ├── exams/                 # exam modules — see docs/PLATFORM.md
│   │   ├── active.js           # which exam is live (currently GAT)
│   │   └── gat/                # GAT's config, category map, question loader, and datasets
│   ├── lib/                   # scoring, sound cues, localStorage helpers (generic)
│   └── styles/app.css         # all app styling (generic)
├── public/                    # static assets served as-is (images, flags, question images)
├── tests-source/              # original .docx source documents for the six datasets (reference only)
├── docs/PLATFORM.md           # reusable-platform architecture guide
└── netlify.toml, public/_headers, public/_redirects   # Netlify deploy config
```

## Question datasets (production data — do not edit content)

The six approved datasets live in:

- `src/exams/gat/data/quant/test-1.json`, `test-2.json`, `test-3.json`
- `src/exams/gat/data/verbal/test-1.json`, `test-2.json`, `test-3.json` (+
  matching `passages-1/2/3.json` for Reading Comprehension passages)

`src/exams/gat/categories.js` documents the question shape and the
`specificCategory -> generalCategory` mapping used for the Performance
report. `src/exams/gat/questions.js` normalizes the raw JSON into
fixed-order test sets at load time (namespacing ids, attaching
`generalCategory`/`mathLayout`, etc.) — **this is where question content is
loaded and shaped, never edit question text/answers/categories directly in
code.**

Question images referenced by these datasets live under
`public/questions/quantitative/test-N/...` — paths in the JSON are absolute
(`/questions/...`) and resolved against `public/` at build time. The original
`.docx` source documents used to author the datasets are kept in
`tests-source/` for reference; they are not read by the app at runtime.

Treat all six datasets as read-only content. If you must move them, keep
their content byte-for-byte identical and update the imports in
`src/exams/gat/questions.js`.

## Marketing configuration

All marketing/promo values are centralized in the `marketing` block of
`src/exams/gat/exam.config.js`:

- `courseUrl` — the GAT course link (built from a base URL + UTM tags in the
  same file)
- `whatsappNumber` / `whatsappUrl` — international format, no `+` or spaces
- `promoVideo` / `footerBanner` — paths to the popup ad video and footer
  banner image (`footerBanner: null` disables that placement and falls back
  to a plain text footer)
- `copy` — UI strings that name the exam/course (footer aria-labels, alt
  text, help-link text), kept alongside the links they go with
- the exam's `timer.minutes` field (also in `exam.config.js`) is the single
  overall timer length used by every timed test (60 minutes)

To swap a promo asset, drop the new file in `public/assets/marketing/` and
point the relevant `marketing` key at it — no other code changes needed. See
[docs/PLATFORM.md](docs/PLATFORM.md) for how this fits into the wider
exam-config schema.

## Google Sheets lead integration

Before starting a test, a student fills a short lead form (`LeadForm.jsx`):
name (optional), phone, grade level. On submit, the frontend POSTs
form-encoded data to the URL in `window.LEEN_GAT_GOOGLE_SHEETS_WEBHOOK_URL`,
set in `public/lead-config.js`.

- The request uses `mode: "no-cors"`, so the response is opaque — the
  frontend cannot verify the row was actually written, only that the
  request didn't throw. If you need real delivery confirmation, that
  requires changing the endpoint to a CORS-enabled response.
- The receiving Apps Script project's source lives in
  `../google-apps-script/Code.gs` (outside this app, since it's deployed by
  pasting into the Apps Script editor, not built by this repo). It validates
  `phone` and `grade_level` (must be one of the four allowed labels) before
  writing a row.
- This is a public POST endpoint by design (that's how Apps Script Web Apps
  work) — anyone with the URL can POST to it. There's no secret to protect;
  the Apps Script side validates shape, not identity. If spam becomes a
  problem, add rate-limiting/anti-abuse logic in `Code.gs` (e.g. a shared
  request token, or Google's reCAPTCHA), not in the frontend.

## Timer & attempt persistence

Everything is stored client-side in `localStorage`/`sessionStorage`
(`src/lib/storage.js`), scoped under `leen_gat_*` keys:

- **Timer**: student-toggled per attempt (default off). When on, a single
  60-minute deadline (`Date.now() + minutes * 60000`) is stored once and
  never reset — remaining time is always recomputed as `deadline - now()`,
  so refreshing or leaving the tab can't grant extra time.
- **Active attempt**: question ids, in-progress answers/marks, and the
  deadline are saved on every change, so an interrupted attempt can be
  resumed (`Resume` / `Start Over` prompt shown on next load).
- **One-time flags**: lead-form completion and the theme choice persist
  across sessions (`localStorage`); the "shown once per browser session"
  promo popup uses `sessionStorage` so it re-appears on the next visit.

No attempt data is sent anywhere — it only leaves the browser via the lead
form webhook above.

## Environment / configuration requirements

There are no `.env` files or build-time secrets. The only external
configuration is:

- `public/lead-config.js` — the Google Sheets webhook URL (see above)
- `src/exams/gat/exam.config.js` — course link, WhatsApp number, promo assets

Both are plain static values checked into the repo; there is nothing here
that a build step injects. If a per-environment (staging vs. production)
webhook URL is ever needed, swap `public/lead-config.js` at deploy time
rather than hardcoding a second value in source.

## Deployment

Configured for Netlify (`netlify.toml`): `npm run build`, publish `dist/`,
SPA fallback to `index.html`. `public/_headers` and `public/_redirects`
duplicate the same rules for platforms that read those files instead of
`netlify.toml` — keep both in sync if you change caching/redirect behavior.

## Maintenance notes

- No test suite or linter is currently configured. `npm run build` is the
  main correctness check before deploying.
- The bundled JS is ~615 KB (~170 KB gzipped), mostly KaTeX + the app code.
  Vite will warn about the chunk size on build; this is expected and not a
  regression unless it grows significantly further.
- Known dependency note: `vite`'s bundled `esbuild` has a moderate
  dev-server-only advisory (arbitrary requests to the dev server can read
  its response) — it does not affect the production build. Fixing it
  requires a Vite 8 major upgrade; left alone intentionally for this
  release. Re-evaluate before the next major version bump.
- `COURSE_URL_BASE` in `src/exams/gat/exam.config.js` is still marked `TODO`
  pending the final GAT course URL from Leen — update it there, not at the
  call sites. `WHATSAPP_NUMBER` is already the confirmed, live number.
