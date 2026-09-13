# Leen Exam Platform

A reusable React/Vite exam practice platform for creating and deploying
multiple Leen exam products from one codebase.

## Overview

The quiz/results/review engine is generic — screens, scoring, timers,
storage, and styling contain zero exam-specific logic. Each exam (GAT today;
SAAT, STEP, ... in the future) is a self-contained **exam module**: a config
object plus a question dataset. One deployment serves exactly one exam,
selected at build time via a `VITE_EXAM_ID` env var, so the same repo can
back several independent Netlify sites, each with its own live exam.

For the full architecture — the exam-module contract, the registry, locale/
RTL handling, category-performance reporting, and everything else in depth —
see **[docs/PLATFORM.md](docs/PLATFORM.md)**. This README stays high-level;
that doc is the detailed reference.

## Architecture

- **React 18** + **Vite 5** (`@vitejs/plugin-react`), plain CSS
  (`src/styles/app.css`), no CSS framework.
- No router — screens are plain state in `App.jsx` (`home | select | lead |
  quiz | results | report | review`), not URL routes.
- No shared backend — each exam optionally posts lead-capture data to its
  own webhook; there is no database or API server in this repo.
- [KaTeX](https://katex.org/) is available platform-wide for math rendering
  (opt-in per section via `mathRendering`); [lucide-react](https://lucide.dev/)
  provides section icons.
- `App.jsx`, `src/components/`, and `src/lib/` are 100% generic — they only
  ever read from the *active* exam module, never a hardcoded exam name.

## Repository structure

```
leen-exam-platform/
├── index.html                     entry HTML; loads /lead-config.js then main.jsx
├── src/
│   ├── main.jsx                    React root
│   ├── App.jsx                     screen state machine (generic)
│   ├── components/                 one file per screen/UI piece (generic)
│   ├── config/brand.js             Leen company identity — shared, not per-exam
│   ├── i18n/                       platform UI dictionaries (en, ar)
│   ├── lib/                        scoring, sound, storage helpers (generic)
│   ├── styles/app.css              all app styling (generic)
│   └── exams/
│       ├── active.js                the one stable import path components use
│       ├── registry.js              every exam module this build knows about
│       └── <exam-id>/               one exam's config + question data (e.g. gat/)
├── public/
│   ├── questions/<exam-id>/         question images, namespaced per exam
│   └── assets/marketing/<exam-id>/  promo video/banner, namespaced per exam
├── tests-source/<exam-id>/          original source docs per exam (provenance only)
├── docs/
│   ├── PLATFORM.md                  detailed architecture reference
│   └── exams/<EXAM-ID>.md           one doc per exam (GAT.md, future SAAT.md, STEP.md)
├── .claude/skills/                  create-exam, ingest-questions, validate-exam
└── netlify.toml, public/_headers, public/_redirects   Netlify deploy config
```

## Exam module concept

Every exam lives under `src/exams/<exam-id>/` and exports one object shaped
to a fixed contract: `config` (sections/tests, timer, locale, marketing,
lead capture, optional category taxonomy), `testMeta`, question accessors,
and (if applicable) `passages`. The generic engine only ever imports this
via `src/exams/active.js`. See PLATFORM.md's
["The exam-module contract"](docs/PLATFORM.md#the-exam-module-contract) for
the full field-by-field shape.

GAT is the first exam built on this platform — see
**[docs/exams/GAT.md](docs/exams/GAT.md)** for its sections, question
counts, category structure, and exam-specific notes.

## Adding a new exam

Run **`/create-exam`** (a Claude Code Skill —
`.claude/skills/create-exam/`). It scaffolds the runtime module
(`src/exams/<id>/`), the source-document folders (`tests-source/<id>/`),
the question-asset namespace (`public/questions/<id>/`), the marketing
folder (`public/assets/marketing/<id>/`), registers the exam in
`src/exams/registry.js`, and creates its `docs/exams/<EXAM-ID>.md` doc. It
never touches the generic engine, never edits another exam's files, and
never sets any deployment's `VITE_EXAM_ID` — registering an exam makes it
*available*, not *live*.

See PLATFORM.md's ["Adding a future exam"](docs/PLATFORM.md#adding-a-future-exam)
for the underlying steps if doing this by hand.

## Question ingestion workflow

Run **`/ingest-questions`** (`.claude/skills/ingest-questions/`) to import
real questions — primarily from `.docx` source files — into an exam module
already scaffolded by `/create-exam`. It prioritizes source fidelity over
speed: it never invents, corrects, infers, reorders, omits, or rewrites
question content, and stops to ask whenever a source is ambiguous.

## Validation workflow

Run **`/validate-exam`** (`.claude/skills/validate-exam/`) as the final
pre-deployment audit of one exam: config/contract, question data,
cross-test/cross-section consistency, assets, localization, optional-feature
wiring, storage safety, and the production build. It's read-only by default
and answers one question — is this exam complete, internally consistent,
buildable, and ready for manual QA/deployment?

The pipeline end to end:

```
/create-exam → /ingest-questions → /validate-exam → manual visual QA → commit/push → deploy
```

## Local development

```bash
npm install
npm run dev       # local dev server (Vite)
npm run build     # production build -> dist/
npm run preview   # serve the production build locally
```

Requires Node.js (any version compatible with Vite 5 / modern npm). No
`.env` file is required for local dev — `VITE_EXAM_ID` defaults to `gat`
when unset (see below).

## Selecting an exam with VITE_EXAM_ID

Which exam a build serves is controlled entirely by the `VITE_EXAM_ID`
build-time environment variable, looked up against `src/exams/registry.js`:

```bash
VITE_EXAM_ID=gat npm run dev              # bash/macOS/Linux
$env:VITE_EXAM_ID="gat"; npm run dev      # PowerShell
```

Omit it for the same result — `gat` is the default. An unregistered id
throws immediately at runtime, listing the valid ids, rather than silently
falling back to GAT. See PLATFORM.md's
["Exam registry"](docs/PLATFORM.md#exam-registry) for the full selection
logic and behavior table.

## Deployment model

Configured for Netlify (`netlify.toml`): `npm run build`, publish `dist/`,
SPA fallback to `index.html` (`public/_headers`/`public/_redirects`
duplicate the same rules for platforms that read those instead). One
Netlify site per exam, all building from the same repo/branch — the only
difference between sites is each one's own `VITE_EXAM_ID` environment
variable. Setting/changing a live site's `VITE_EXAM_ID` is a deliberate,
manual deploy-time decision for whoever owns that site — no Skill or build
step does this automatically.

## Claude Code Skills

| Skill | Purpose |
|---|---|
| `/create-exam` | Scaffold a new exam's complete filesystem structure and register it |
| `/ingest-questions` | Import real questions from `.docx` sources into an exam module |
| `/validate-exam` | Run the final pre-deployment audit of one exam |

Each Skill's own `SKILL.md` (under `.claude/skills/<name>/`) is the
authoritative instructions; this table is just an index.

## Source document conventions

Original source documents (primarily `.docx`) live under
`tests-source/<exam-id>/<section-id>/` — one folder per section, files flat
inside it. This tree is provenance only: it's never read by the running
app, and it exists so a question's original wording/formatting can always be
checked against what was ingested.

## Runtime asset conventions

- **Question images**: `public/questions/<exam-id>/<section-id>/<test-key>/...`,
  created on demand by `/ingest-questions` (not pre-built). Referenced from
  question JSON via absolute paths (`/questions/...`), resolved against
  `public/` at build time.
- **Marketing assets** (promo video, footer banner): `public/assets/marketing/<exam-id>/...`.
  GAT's own files are a pre-refactor exception living flat at
  `public/assets/marketing/` — see [docs/exams/GAT.md](docs/exams/GAT.md);
  every future exam uses the namespaced form.
- **Brand assets** (Leen logo, flags): `public/assets/brand/` — shared
  across every exam, not namespaced.

## Documentation links

- **[docs/PLATFORM.md](docs/PLATFORM.md)** — detailed architecture: the
  exam-module contract, the registry/selection logic, locale/RTL handling,
  category-performance reporting, and the exam-documentation convention.
- **[docs/exams/GAT.md](docs/exams/GAT.md)** — GAT's exam-specific
  documentation.
- Future exams: `docs/exams/SAAT.md`, `docs/exams/STEP.md`, ... one file per
  exam, created automatically by `/create-exam`.
