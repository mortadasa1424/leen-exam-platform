#!/usr/bin/env node
// Deterministic pre-deployment audit for one exam module, for /validate-exam.
// Read-only: never writes/deletes anything under src/ or public/.
//
// Why this doesn't `import` questions.js/index.js: those files do bare
// `import x from "./data/*.json"` (fine under Vite, which this project uses
// to build) but plain Node (v20+) requires an import attribute
// (`with { type: "json" }`) for JSON ESM imports that questions.js doesn't
// have -- confirmed by hand against this repo's Node version, dynamically
// importing src/exams/gat/index.js throws ERR_IMPORT_ASSERTION_MISSING. So
// this script only dynamically imports exam.config.js/categories.js (plain
// JS, no JSON imports, and this is exactly what validate-ingestion.mjs
// already does successfully) and otherwise statically parses questions.js's
// source text to recover its testKey -> data-file mapping and id-template,
// then reads the raw data/*.json files directly with fs. This also means
// these checks reflect the exam's *actual* data files, not whatever a
// possibly-stale in-memory module would report.
//
// Usage:
//   node validate-exam-module.mjs --exam-id <id> [--expected-counts k=n,k2=n2]
//     [--json]
//
// Run from the project root (GAT app/) so relative paths (src/, public/)
// resolve.

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join, dirname, relative } from "node:path";
import { pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = { expectedCounts: {} };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--exam-id") args.examId = argv[++i];
    else if (a === "--expected-counts") {
      for (const pair of argv[++i].split(",")) {
        const [k, v] = pair.split("=");
        if (k && v) args.expectedCounts[k.trim()] = Number(v.trim());
      }
    } else if (a === "--json") args.json = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.examId) throw new Error("--exam-id <id> is required");
  return args;
}

function blocker(list, type, message, extra = {}) {
  list.push({ severity: "BLOCKER", type, message, ...extra });
}
function warn(list, type, message, extra = {}) {
  list.push({ severity: "WARNING", type, message, ...extra });
}

async function tryImport(path) {
  return import(pathToFileURL(resolve(path)).href);
}

function readTextIfExists(path) {
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// Extracts SECTION_ICONS' keys from src/components/icons.jsx's source text
// (a plain object literal), without importing a .jsx file into Node.
function extractIconKeys(iconsJsxText) {
  const m = iconsJsxText.match(/SECTION_ICONS\s*=\s*\{([\s\S]*?)\n\}/);
  if (!m) return null;
  const keys = new Set();
  for (const line of m[1].split("\n")) {
    const km = line.match(/^\s*(\w+):/);
    if (km) keys.add(km[1]);
  }
  return keys;
}

// Statically recovers questions.js's testKey -> data-file mapping and its
// id-template prefix, by pattern-matching its source text against the
// documented pattern (create-exam/references/exam-module-contract.md's
// `questions.js` shape) rather than executing it. If the file has genuinely
// diverged from that pattern, this returns null-ish fields and the caller
// skips the checks that depend on them (with a warning), rather than
// guessing.
function parseQuestionsJs(text) {
  const importMap = {}; // varName -> relative path (from questions.js's dir)
  const importRe = /import\s+(\w+)\s+from\s+["'](\.\/data\/[^"']+\.json)["']/g;
  let im;
  while ((im = importRe.exec(text))) importMap[im[1]] = im[2];

  const testEntries = []; // { testKey, varName }
  const buildRe = /\w+:\s*buildTestQuestions\(\s*["'](\w+)["']\s*,\s*(\w+)\s*\)/g;
  let bm;
  while ((bm = buildRe.exec(text))) testEntries.push({ testKey: bm[1], varName: bm[2] });

  const idTemplateMatch = text.match(/id:\s*`([A-Za-z0-9_-]*)\$\{/);
  const idPrefix = idTemplateMatch ? idTemplateMatch[1] : null;

  return { importMap, testEntries, idPrefix };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const blockers = [];
  const warnings = [];
  const projectRoot = process.cwd();
  const examId = args.examId;
  const examDir = resolve(projectRoot, "src/exams", examId);
  const stats = { examId };

  if (!existsSync(examDir)) {
    blocker(blockers, "exam-not-found", `src/exams/${examId}/ does not exist`);
    return report(args, { examId, blockers, warnings, stats });
  }

  // ---------- required files ----------
  const configPath = join(examDir, "exam.config.js");
  const indexPath = join(examDir, "index.js");
  const questionsPath = join(examDir, "questions.js");
  const categoriesPath = join(examDir, "categories.js");

  for (const [label, p] of [["exam.config.js", configPath], ["index.js", indexPath], ["questions.js", questionsPath]]) {
    if (!existsSync(p)) blocker(blockers, "missing-required-file", `${examId}/${label} is missing`);
  }
  if (!existsSync(configPath)) return report(args, { examId, blockers, warnings, stats });

  // ---------- LEVEL 1: config / module contract ----------
  let config;
  try {
    const mod = await tryImport(configPath);
    config = mod.default;
  } catch (e) {
    blocker(blockers, "config-import-failed", `exam.config.js failed to import: ${e.message}`);
    return report(args, { examId, blockers, warnings, stats });
  }

  const req = (val, path, type = "string") => {
    if (type === "string" && (typeof val !== "string" || !val.trim())) {
      blocker(blockers, "missing-config-field", `config.${path} is required and must be a non-empty string`);
      return false;
    }
    if (type === "boolean" && typeof val !== "boolean") {
      blocker(blockers, "missing-config-field", `config.${path} is required and must be a boolean`);
      return false;
    }
    if (type === "number" && typeof val !== "number") {
      blocker(blockers, "missing-config-field", `config.${path} is required and must be a number`);
      return false;
    }
    return true;
  };

  if (config.id !== examId) blocker(blockers, "id-mismatch", `config.id ("${config.id}") does not match folder name ("${examId}")`);
  req(config.name, "name");
  req(config.shortName, "shortName");
  req(config.description, "description");
  req(config.storagePrefix, "storagePrefix");
  if (config.storagePrefix && config.storagePrefix !== `leen_${examId}`) {
    warn(warnings, "storage-prefix-convention", `config.storagePrefix "${config.storagePrefix}" doesn't follow the "leen_${examId}" convention`);
  }

  // meta
  const meta = config.meta || {};
  req(meta.title, "meta.title");
  req(meta.description, "meta.description");
  req(meta.themeColor, "meta.themeColor");
  if (meta.themeColor && !/^#[0-9a-fA-F]{3,8}$/.test(meta.themeColor)) {
    warn(warnings, "theme-color-format", `config.meta.themeColor "${meta.themeColor}" doesn't look like a hex color`);
  }

  // locale
  const locale = config.locale || {};
  if (!["en", "ar"].includes(locale.language)) {
    blocker(blockers, "invalid-locale-language", `config.locale.language "${locale.language}" must be "en" or "ar" (only src/i18n/en.js and ar.js exist)`);
  }
  if (!["ltr", "rtl"].includes(locale.direction)) {
    blocker(blockers, "invalid-locale-direction", `config.locale.direction "${locale.direction}" must be "ltr" or "rtl"`);
  }
  if ((locale.language === "ar" && locale.direction === "ltr") || (locale.language === "en" && locale.direction === "rtl")) {
    warn(warnings, "unusual-locale-pairing", `config.locale is "${locale.language}"/"${locale.direction}" -- the platform's two known pairings are en/ltr and ar/rtl; confirm this is deliberate`);
  }

  // sections / tests
  const sections = Array.isArray(config.sections) ? config.sections : null;
  const allTestKeys = new Set();
  const testKeyToSection = {};
  let iconKeys = null;
  const iconsJsxText = readTextIfExists(resolve(projectRoot, "src/components/icons.jsx"));
  if (iconsJsxText) iconKeys = extractIconKeys(iconsJsxText);

  if (!sections || sections.length === 0) {
    blocker(blockers, "no-sections", "config.sections must be a non-empty array");
  } else {
    const sectionIds = new Set();
    for (const section of sections) {
      if (!section.id) { blocker(blockers, "missing-section-id", "a section is missing its id"); continue; }
      if (sectionIds.has(section.id)) blocker(blockers, "duplicate-section-id", `section id "${section.id}" appears more than once`);
      sectionIds.add(section.id);
      req(section.name, `sections[${section.id}].name`);
      if (typeof section.mathRendering !== "boolean") {
        blocker(blockers, "missing-config-field", `sections[${section.id}].mathRendering must be a boolean`);
      }
      if (section.icon && iconKeys && !iconKeys.has(section.icon)) {
        warn(warnings, "unknown-section-icon", `sections[${section.id}].icon "${section.icon}" is not in SECTION_ICONS -- falls back to the neutral LayoutGrid icon at runtime, not a crash, but likely unintentional`);
      }
      const tests = Array.isArray(section.tests) ? section.tests : [];
      if (tests.length === 0) blocker(blockers, "no-tests-in-section", `section "${section.id}" has no tests`);
      for (const test of tests) {
        if (!test.key) { blocker(blockers, "missing-test-key", `section "${section.id}" has a test with no key`); continue; }
        req(test.title, `sections[${section.id}].tests[${test.key}].title`);
        req(test.tileTitle, `sections[${section.id}].tests[${test.key}].tileTitle`);
        if (allTestKeys.has(test.key)) blocker(blockers, "duplicate-test-key", `test key "${test.key}" appears more than once across sections`);
        allTestKeys.add(test.key);
        testKeyToSection[test.key] = section.id;
      }
    }
  }

  // timer
  const timer = config.timer || {};
  req(timer.minutes, "timer.minutes", "number");
  if (typeof timer.minutes === "number" && timer.minutes <= 0) blocker(blockers, "invalid-timer-minutes", `config.timer.minutes (${timer.minutes}) must be positive`);
  req(timer.defaultOn, "timer.defaultOn", "boolean");

  // performance / categories
  const byCategory = config.performance?.byCategory === true;
  if (config.performance && typeof config.performance.byCategory !== "undefined" && typeof config.performance.byCategory !== "boolean") {
    blocker(blockers, "invalid-performance-byCategory", "config.performance.byCategory must be a boolean when present");
  }
  if (byCategory) {
    if (!config.categories || !config.categories.general || !config.categories.specificToGeneral) {
      blocker(blockers, "missing-categories-config", "config.performance.byCategory is true but config.categories.general/specificToGeneral is missing");
    }
    if (!existsSync(categoriesPath)) blocker(blockers, "missing-categories-file", `${examId}/categories.js is missing but performance.byCategory is true`);
  } else {
    if (config.categories) blocker(blockers, "unexpected-categories-config", "config.categories is present but performance.byCategory is false/absent -- the contract requires omitting it entirely in this case");
    if (existsSync(categoriesPath)) warn(warnings, "unused-categories-file", `${examId}/categories.js exists but performance.byCategory is false -- it is never read`);
  }

  // branding
  const branding = config.branding || {};
  req(branding.heroTitle, "branding.heroTitle");
  req(branding.heroLede, "branding.heroLede");

  // marketing
  const marketing = config.marketing || {};
  req(marketing.courseUrl, "marketing.courseUrl");
  req(marketing.promoVideo, "marketing.promoVideo");
  req(marketing.footerBanner, "marketing.footerBanner");
  if (marketing.courseUrl && !/^https?:\/\//.test(marketing.courseUrl)) warn(warnings, "course-url-format", `config.marketing.courseUrl "${marketing.courseUrl}" doesn't look like a URL`);
  const copy = marketing.copy || {};
  for (const field of ["footerAriaLabel", "footerBannerAlt", "footerBannerAriaLabel", "courseFooterText", "helpLinkText", "popupAriaLabel"]) {
    req(copy[field], `marketing.copy.${field}`);
  }
  if ("whatsapp" in marketing || "whatsappNumber" in marketing || "whatsappUrl" in marketing) {
    warn(warnings, "per-exam-whatsapp-field", "config.marketing contains a WhatsApp-like field -- WhatsApp is a fixed platform-wide contact in src/config/brand.js, never per exam");
  }
  if (examId !== "gat") {
    if (marketing.promoVideo === "/assets/marketing/vid.mp4" || marketing.footerBanner === "/assets/marketing/gat-course-banner2.png") {
      warn(warnings, "reused-gat-asset-path", "config.marketing points at what looks like GAT's actual asset file path -- every exam should use its own marketing assets");
    }
  }

  // leadCapture
  const leadCapture = config.leadCapture || {};
  req(leadCapture.enabled, "leadCapture.enabled", "boolean");
  if (leadCapture.enabled === true) {
    req(leadCapture.webhookGlobalVar, "leadCapture.webhookGlobalVar");
    const leadConfigText = readTextIfExists(resolve(projectRoot, "public/lead-config.js"));
    if (leadCapture.webhookGlobalVar) {
      if (!leadConfigText) {
        blocker(blockers, "missing-lead-config-file", "leadCapture.enabled is true but public/lead-config.js does not exist -- lead submission would silently fail");
      } else if (!leadConfigText.includes(leadCapture.webhookGlobalVar)) {
        blocker(blockers, "missing-webhook-assignment", `leadCapture.webhookGlobalVar "${leadCapture.webhookGlobalVar}" is not assigned anywhere in public/lead-config.js -- lead submission would silently fail`);
      }
    }
    const countries = Array.isArray(leadCapture.countries) ? leadCapture.countries : [];
    if (countries.length === 0) warn(warnings, "no-lead-countries", "leadCapture.enabled is true but countries is empty");
    countries.forEach((c, i) => {
      for (const f of ["label", "code", "iso", "flagSrc"]) {
        if (!c[f]) blocker(blockers, "invalid-lead-country", `leadCapture.countries[${i}] is missing "${f}"`);
      }
    });
    if (!Array.isArray(leadCapture.gradeLevels) || leadCapture.gradeLevels.length === 0) {
      warn(warnings, "no-lead-grade-levels", "leadCapture.enabled is true but gradeLevels is empty");
    }
  }

  // ---------- storagePrefix uniqueness across sibling exams ----------
  const examsRoot = resolve(projectRoot, "src/exams");
  const siblingIds = readdirSync(examsRoot).filter((name) => {
    const p = join(examsRoot, name);
    return name !== examId && statSync(p).isDirectory();
  });
  for (const sibling of siblingIds) {
    const sibConfigPath = join(examsRoot, sibling, "exam.config.js");
    if (!existsSync(sibConfigPath)) continue;
    try {
      const sibMod = await tryImport(sibConfigPath);
      const sibConfig = sibMod.default;
      if (sibConfig?.storagePrefix && sibConfig.storagePrefix === config.storagePrefix) {
        blocker(blockers, "storage-prefix-collision", `config.storagePrefix "${config.storagePrefix}" collides with exam "${sibling}"`);
      }
    } catch { /* sibling's own problem, not this exam's -- ignore */ }
  }

  // ---------- LEVEL 3/4: data-driven checks (static parse of questions.js, raw fs reads) ----------
  const questionsText = readTextIfExists(questionsPath);
  const testCounts = {};
  const allImagePaths = [];
  const passageIdsSeen = new Map(); // id -> [file,...]
  const passageIdsReferenced = new Set();
  let totalQuestions = 0;

  if (questionsText) {
    const { importMap, testEntries, idPrefix } = parseQuestionsJs(questionsText);

    if (idPrefix) {
      const normalizedPrefix = idPrefix.replace(/-$/, "").toLowerCase();
      if (normalizedPrefix !== examId.toLowerCase()) {
        blocker(blockers, "foreign-id-prefix", `questions.js generates ids with prefix "${idPrefix}", which doesn't match this exam's id ("${examId}") -- looks like another exam's template (e.g. GAT's) was copied without updating the id prefix`);
      }
    } else {
      warn(warnings, "id-template-not-detected", "could not statically find questions.js's id template (\"id: `<PREFIX>-${...}`\") -- skipping the foreign-id-prefix check");
    }

    if (testEntries.length === 0) {
      warn(warnings, "questions-js-pattern-not-detected", "could not statically parse questions.js's TEST_QUESTIONS mapping (buildTestQuestions(...) calls) -- skipping data-file-driven checks (counts, cross-test id collisions, image/passage references). If questions.js has deliberately diverged from the documented pattern, this is expected; otherwise re-check it by hand.");
    }

    // passages: any imported file matching passages-N.json
    const passageFiles = Object.entries(importMap).filter(([, rel]) => /passages-\d+\.json$/.test(rel));
    for (const [, rel] of passageFiles) {
      const p = join(examDir, rel);
      if (!existsSync(p)) { blocker(blockers, "missing-passages-file", `questions.js imports "${rel}" but it does not exist`); continue; }
      try {
        const arr = JSON.parse(readFileSync(p, "utf8"));
        for (const passage of arr) {
          if (!passage.id) continue;
          if (passageIdsSeen.has(passage.id)) {
            blocker(blockers, "duplicate-passage-id", `passage id "${passage.id}" appears in both ${passageIdsSeen.get(passage.id)} and ${rel}`);
          } else {
            passageIdsSeen.set(passage.id, rel);
          }
        }
      } catch (e) {
        blocker(blockers, "invalid-passages-json", `${rel} failed to parse as JSON: ${e.message}`);
      }
    }

    const idSet = new Set();
    for (const { testKey, varName } of testEntries) {
      const rel = importMap[varName];
      if (!rel) { warn(warnings, "unresolved-test-data-import", `questions.js references variable "${varName}" for test "${testKey}" but no matching import was found`); continue; }
      const p = join(examDir, rel);
      if (!existsSync(p)) { blocker(blockers, "missing-test-data-file", `test "${testKey}" -> "${rel}" does not exist`); continue; }
      let arr;
      try {
        arr = JSON.parse(readFileSync(p, "utf8"));
      } catch (e) {
        blocker(blockers, "invalid-test-data-json", `${rel} failed to parse as JSON: ${e.message}`);
        continue;
      }
      if (!Array.isArray(arr)) { blocker(blockers, "test-data-not-array", `${rel} does not contain a JSON array`); continue; }

      testCounts[testKey] = arr.length;
      totalQuestions += arr.length;
      if (arr.length === 0) {
        blocker(blockers, "empty-test-dataset", `test "${testKey}" (${rel}) has 0 questions -- not ready for deployment`);
      }
      if (testKey in args.expectedCounts && arr.length !== args.expectedCounts[testKey]) {
        blocker(blockers, "question-count-mismatch", `test "${testKey}" has ${arr.length} questions, expected ${args.expectedCounts[testKey]}`);
      }

      arr.forEach((q, i) => {
        if (idPrefix) {
          const simulatedId = `${idPrefix}${testKey.toUpperCase()}-${String(i + 1).padStart(3, "0")}`;
          if (idSet.has(simulatedId)) blocker(blockers, "cross-test-id-collision", `computed id "${simulatedId}" would collide across tests`);
          idSet.add(simulatedId);
        }
        if (q.kind === "image" && q.image) allImagePaths.push(q.image);
        if (q.kind === "text-en" && q.passageId) passageIdsReferenced.add(q.passageId);
      });
    }

    // orphan passage references
    for (const pid of passageIdsReferenced) {
      if (!passageIdsSeen.has(pid)) blocker(blockers, "unresolved-passage-id", `passageId "${pid}" is referenced by a question but not defined in any passages file`);
    }

    // unconfigured data files (json files under data/ never imported by questions.js)
    const dataDir = join(examDir, "data");
    if (existsSync(dataDir)) {
      const referencedAbs = new Set(Object.values(importMap).map((rel) => resolve(join(examDir, rel))));
      for (const f of walk(dataDir)) {
        if (f.endsWith(".json") && !referencedAbs.has(resolve(f))) {
          warn(warnings, "unconfigured-data-file", `${relative(projectRoot, f)} exists under data/ but is not imported by questions.js`);
        }
      }
    }
  } else {
    warn(warnings, "questions-js-unreadable", "questions.js could not be read -- skipping all data-driven checks");
  }

  // ---------- image path scoping + existence ----------
  // Every exam, GAT included, namespaces its question assets under
  // /questions/<examId>/... (GAT's images were migrated off their old
  // un-namespaced /questions/quantitative|verbal/ paths -- see
  // references/question-schema.md's "Asset path convention"), so the same
  // check applies uniformly; no GAT-specific carve-out needed any more.
  for (const imagePath of allImagePaths) {
    if (!imagePath.startsWith(`/questions/${examId}/`)) {
      blocker(blockers, "asset-path-not-namespaced", `image path "${imagePath}" does not start with "/questions/${examId}/" -- every exam must namespace its asset paths`);
    }
    const resolvedImg = resolve(projectRoot, "public", imagePath.replace(/^\//, ""));
    if (!existsSync(resolvedImg)) blocker(blockers, "missing-image-file", `image path "${imagePath}" does not resolve to a file under public/`);
  }

  // ---------- marketing asset existence ----------
  for (const [field, val] of [["promoVideo", marketing.promoVideo], ["footerBanner", marketing.footerBanner]]) {
    if (!val) continue;
    const resolved = resolve(projectRoot, "public", val.replace(/^\//, ""));
    if (!existsSync(resolved)) blocker(blockers, "missing-marketing-asset", `marketing.${field} "${val}" does not resolve to a file under public/`);
  }

  // ---------- orphan question-asset scan (public/questions/<examId>/) ----------
  {
    const assetsDir = resolve(projectRoot, "public/questions", examId);
    if (existsSync(assetsDir)) {
      const referencedBasenames = new Set(allImagePaths.map((p) => p.split("/").pop()));
      for (const f of walk(assetsDir)) {
        if (!referencedBasenames.has(f.split(/[\\/]/).pop())) {
          warn(warnings, "orphan-media", `${relative(projectRoot, f)} is not referenced by any question's image field`);
        }
      }
    }
  }

  stats.sections = sections ? sections.map((s) => s.id) : [];
  stats.testKeys = [...allTestKeys];
  stats.testCounts = testCounts;
  stats.totalQuestions = totalQuestions;
  stats.storagePrefix = config.storagePrefix;
  stats.locale = locale;
  stats.performanceByCategory = byCategory;
  stats.leadCaptureEnabled = leadCapture.enabled === true;
  stats.marketing = { courseUrl: marketing.courseUrl, promoVideo: marketing.promoVideo, footerBanner: marketing.footerBanner };

  return report(args, { examId, blockers, warnings, stats });
}

function report(args, result) {
  const ok = result.blockers.length === 0;
  if (args.json) {
    console.log(JSON.stringify({ ...result, ok }, null, 2));
  } else {
    console.log(`\nvalidate-exam-module: ${result.examId}`);
    if (result.stats) console.log(JSON.stringify(result.stats, null, 2));
    if (result.blockers.length) {
      console.log(`\nBLOCKERS (${result.blockers.length}):`);
      result.blockers.forEach((b) => console.log(`  [${b.type}] ${b.message}`));
    }
    if (result.warnings.length) {
      console.log(`\nWARNINGS (${result.warnings.length}):`);
      result.warnings.forEach((w) => console.log(`  [${w.type}] ${w.message}`));
    }
    console.log(`\n${ok ? "PASS" : "FAIL"} -- ${result.blockers.length} blocker(s), ${result.warnings.length} warning(s)`);
  }
  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error("validate-exam-module.mjs failed:", e.message);
  process.exitCode = 1;
});
