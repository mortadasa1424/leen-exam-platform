#!/usr/bin/env node
// Ingestion-specific validation for /ingest-questions. Mechanical checks
// only -- see references/validation-checklist.md for the manual checks
// this does NOT (and cannot) perform. This is narrower than the future
// /validate-exam, which audits the whole platform.
//
// Zero new dependencies: uses only Node builtins plus the `katex` package
// already installed in this project's node_modules (see package.json) --
// run this from the project root (GAT app/) so that resolves.
//
// Usage:
//   node validate-ingestion.mjs --file <path> [--passages <path> ...]
//     [--exam-config <path>] [--answer-key <path>] [--assets-dir <path>]
//     [--json]

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function parseArgs(argv) {
  const args = { passages: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--file") args.file = argv[++i];
    else if (a === "--passages") args.passages.push(argv[++i]);
    else if (a === "--exam-config") args.examConfig = argv[++i];
    else if (a === "--answer-key") args.answerKey = argv[++i];
    else if (a === "--assets-dir") args.assetsDir = argv[++i];
    else if (a === "--json") args.json = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.file) throw new Error("--file <path to test JSON> is required");
  return args;
}

// Mirrors QuestionCard.jsx's normalizeTex exactly (kept in sync manually --
// if that function changes, update this copy). This is the SAME
// normalization the real renderer applies, so a string that fails here
// would also fail (or silently render wrong) in the app.
function normalizeTex(input = "") {
  let t = String(input || "");
  t = t
    .replace(/\\textor/g, "\\text{or}")
    .replace(/\\text\s*or/g, "\\text{or}")
    .replace(/\\frac\s*([0-9])([0-9])(?![0-9{])/g, "\\frac{$1}{$2}")
    .replace(/\\frac\s*\{?([0-9]+)\}?\s*\{([0-9]+)\}/g, "\\frac{$1}{$2}")
    .replace(/\\tfrac\s*([0-9])([0-9])(?![0-9{])/g, "\\tfrac{$1}{$2}")
    .replace(/\\tfrac\s*\{?([0-9]+)\}?\s*\{([0-9]+)\}/g, "\\tfrac{$1}{$2}")
    .replace(/(^|[^\\])circ\b/g, "$1\\\\circ")
    .replace(/(^|[^\\])theta\b/g, "$1\\\\theta")
    .replace(/(^|[^\\])pi\b/g, "$1\\\\pi")
    .replace(/([0-9A-Za-z}\\)])\s*;\s*(?=[A-Za-z\\])/g, "$1\\\\;")
    .replace(/(^|[^\\])times\b/g, "$1\\\\times");
  t = t.replace(/\\text\{or\}/g, "\\;\\text{or}\\;");
  return t;
}

const COMPUTED_FIELDS = ["id", "section", "testKey", "order", "mathLayout"];
const VALID_KINDS = ["text", "image", "text-en", "svg"];

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function collectTexStrings(q, path, out) {
  const pushSeg = (segs, segPath) => {
    if (!Array.isArray(segs)) return;
    segs.forEach((s, i) => {
      if (s && s.type === "tex") out.push({ text: s.text, path: `${segPath}[${i}]` });
      if (s && s.type === "block") out.push({ text: s.text, path: `${segPath}[${i}]` });
    });
  };
  pushSeg(q.prompt, `${path}.prompt`);
  (q.options || []).forEach((o, i) => {
    if (o && typeof o.tex === "string") out.push({ text: o.tex, path: `${path}.options[${i}].tex` });
  });
  const table = q.compareTable;
  if (table && Array.isArray(table.rows)) {
    table.rows.forEach((row, ri) => {
      (row || []).forEach((cell, ci) => pushSeg(cell?.segments, `${path}.compareTable.rows[${ri}][${ci}].segments`));
    });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const errors = [];
  const warnings = [];

  const filePath = resolve(args.file);
  if (!existsSync(filePath)) throw new Error(`--file not found: ${filePath}`);
  const questions = loadJson(filePath);
  if (!Array.isArray(questions)) {
    errors.push({ type: "not-an-array", message: `${args.file} does not contain a JSON array` });
    return report(args, { file: args.file, questionCount: 0, errors, warnings });
  }

  // ---- computed-field leakage ----
  // Not an error: buildTestQuestions() in questions.js always overwrites
  // these, so a raw file that includes them is harmless (real GAT verbal
  // data does this with "id"; real GAT quant data does not) -- but it's
  // worth flagging so a new ingestion doesn't do it by accident/confusion.
  questions.forEach((q, i) => {
    COMPUTED_FIELDS.forEach((f) => {
      if (Object.prototype.hasOwnProperty.call(q, f)) {
        warnings.push({ type: "computed-field-in-raw-data", index: i, field: f, message: `question[${i}] hardcodes "${f}", which questions.js overwrites at load time anyway -- harmless but usually unintentional` });
      }
    });
  });

  // ---- kind / required fields ----
  questions.forEach((q, i) => {
    if (!VALID_KINDS.includes(q.kind)) {
      errors.push({ type: "invalid-kind", index: i, message: `question[${i}].kind "${q.kind}" is not one of ${VALID_KINDS.join(", ")}` });
      return;
    }
    if (q.kind === "text" || q.kind === "image") {
      if (!Array.isArray(q.prompt)) errors.push({ type: "missing-prompt", index: i, message: `question[${i}] (${q.kind}) has no prompt array` });
      if (q.kind === "image" && !q.image) errors.push({ type: "missing-image", index: i, message: `question[${i}] is kind "image" but has no image path` });
    }
    if (q.kind === "text-en" && typeof q.questionText !== "string") {
      errors.push({ type: "missing-question-text", index: i, message: `question[${i}] (text-en) has no questionText string` });
    }
    if (q.kind === "svg" && typeof q.svg !== "string") {
      errors.push({ type: "missing-svg", index: i, message: `question[${i}] is kind "svg" but has no svg string` });
    }
  });

  // ---- options / answerLabels / correctAnswer ----
  questions.forEach((q, i) => {
    const opts = q.options || [];
    const labels = q.answerLabels || [];
    if (opts.length !== labels.length) {
      errors.push({ type: "option-label-count-mismatch", index: i, message: `question[${i}] has ${opts.length} options but ${labels.length} answerLabels` });
    } else {
      opts.forEach((o, oi) => {
        if (o.label !== labels[oi]) {
          errors.push({ type: "option-label-order-mismatch", index: i, message: `question[${i}].options[${oi}].label ("${o.label}") does not match answerLabels[${oi}] ("${labels[oi]}")` });
        }
      });
    }
    const uniqueLabels = new Set(opts.map((o) => o.label));
    if (uniqueLabels.size !== opts.length) {
      errors.push({ type: "duplicate-option-label", index: i, message: `question[${i}] has duplicate option labels` });
    }
    if (!labels.includes(q.correctAnswer)) {
      errors.push({ type: "correct-answer-not-in-labels", index: i, message: `question[${i}].correctAnswer "${q.correctAnswer}" is not in answerLabels` });
    }
    if (!q.sourceRef) {
      warnings.push({ type: "missing-source-ref", index: i, message: `question[${i}] has no sourceRef -- provenance should be populated for a real ingestion` });
    }
  });

  // ---- exact-duplicate questions ----
  const seen = new Map();
  questions.forEach((q, i) => {
    const key = JSON.stringify(q);
    if (seen.has(key)) {
      errors.push({ type: "duplicate-question", index: i, message: `question[${i}] is an exact duplicate of question[${seen.get(key)}]` });
    } else {
      seen.set(key, i);
    }
  });

  // ---- OMML/XML leftovers ----
  const stringify = (v) => JSON.stringify(v);
  questions.forEach((q, i) => {
    const s = stringify(q);
    if (/<m:|<w:|w:val=/.test(s)) {
      errors.push({ type: "raw-omml-leftover", index: i, message: `question[${i}] contains what looks like raw OMML/OpenXML markup` });
    }
  });

  // ---- katex parse check ----
  let katex;
  try {
    const req = await import("node:module").then((m) => m.createRequire(import.meta.url));
    katex = req("katex");
  } catch {
    warnings.push({ type: "katex-not-available", message: "katex package not found in node_modules -- run this script from the project root (GAT app/); math strings were NOT validated" });
  }
  if (katex) {
    questions.forEach((q, i) => {
      const texStrings = [];
      collectTexStrings(q, `question[${i}]`, texStrings);
      texStrings.forEach(({ text, path }) => {
        try {
          katex.renderToString(normalizeTex(text), { throwOnError: true, strict: "ignore" });
        } catch (e) {
          errors.push({ type: "tex-parse-error", index: i, path, message: `${path} failed to parse as LaTeX: ${e.message}`, tex: text });
        }
      });
    });
  }

  // ---- image references exist ----
  const projectRoot = process.cwd();
  questions.forEach((q, i) => {
    if (q.kind === "image" && q.image) {
      const p = join(projectRoot, "public", q.image.replace(/^\//, ""));
      if (!existsSync(p)) {
        errors.push({ type: "missing-image-file", index: i, message: `question[${i}].image "${q.image}" does not resolve to a file under public/` });
      }
    }
  });

  // ---- passages ----
  const passages = {};
  for (const p of args.passages) {
    const arr = loadJson(resolve(p));
    for (const passage of arr) {
      if (passages[passage.id]) {
        warnings.push({ type: "duplicate-passage-id", message: `passage id "${passage.id}" appears in more than one passages file` });
      }
      passages[passage.id] = passage;
    }
  }
  questions.forEach((q, i) => {
    if (q.kind === "text-en" && q.passageId && !passages[q.passageId]) {
      errors.push({ type: "unresolved-passage-id", index: i, message: `question[${i}].passageId "${q.passageId}" does not resolve to any loaded passage` });
    }
  });

  // ---- answer key cross-check ----
  if (args.answerKey) {
    const key = loadJson(resolve(args.answerKey)); // { "<sourceQuestionNumber or 1-based index>": "<letter>" }
    const usedKeys = new Set();
    questions.forEach((q, i) => {
      const keyId = q.sourceQuestionNumber != null ? String(q.sourceQuestionNumber) : String(i + 1);
      usedKeys.add(keyId);
      if (!(keyId in key)) {
        errors.push({ type: "missing-answer-key-entry", index: i, message: `question[${i}] (key "${keyId}") has no matching answer-key entry` });
      } else if (key[keyId] !== q.correctAnswer) {
        errors.push({ type: "answer-key-conflict", index: i, message: `question[${i}] correctAnswer "${q.correctAnswer}" conflicts with answer key entry "${key[keyId]}" for key "${keyId}"` });
      }
    });
    Object.keys(key).forEach((k) => {
      if (!usedKeys.has(k)) {
        warnings.push({ type: "orphan-answer-key-entry", message: `answer key entry "${k}" -> "${key[k]}" has no matching question` });
      }
    });
  }

  // ---- categories ----
  if (args.examConfig) {
    const configPath = resolve(args.examConfig);
    const configUrl = pathToFileURL(configPath).href;
    const configMod = await import(configUrl);
    const config = configMod.default;
    if (config?.performance?.byCategory) {
      const categoriesPath = join(dirname(configPath), "categories.js");
      let specificToGeneral = {};
      if (existsSync(categoriesPath)) {
        const catMod = await import(pathToFileURL(categoriesPath).href);
        specificToGeneral = catMod.SPECIFIC_TO_GENERAL || {};
      } else {
        warnings.push({ type: "missing-categories-file", message: `${config.id}'s performance.byCategory is true but categories.js was not found next to exam.config.js` });
      }
      questions.forEach((q, i) => {
        const hasSpecific = q.specificCategory && q.specificCategory.length > 0;
        const hasDirectGeneral = q.generalCategory && q.generalCategory.length > 0;
        if (hasSpecific && !(q.specificCategory in specificToGeneral) && !hasDirectGeneral) {
          errors.push({ type: "unmapped-specific-category", index: i, message: `question[${i}].specificCategory "${q.specificCategory}" has no entry in SPECIFIC_TO_GENERAL and no direct generalCategory` });
        }
        if (!hasSpecific && !hasDirectGeneral) {
          warnings.push({ type: "no-category", index: i, message: `question[${i}] has neither specificCategory nor generalCategory, but category performance is enabled for this exam` });
        }
      });
    }
  }

  // ---- orphan/unreferenced assets ----
  if (args.assetsDir) {
    const dir = resolve(args.assetsDir);
    if (existsSync(dir)) {
      const referenced = new Set(
        questions.filter((q) => q.kind === "image" && q.image).map((q) => q.image.split("/").pop())
      );
      for (const f of readdirSync(dir)) {
        if (!referenced.has(f)) {
          warnings.push({ type: "orphan-media", file: join(args.assetsDir, f), message: `${f} in ${args.assetsDir} is not referenced by any question's image field` });
        }
      }
    } else {
      warnings.push({ type: "assets-dir-not-found", message: `--assets-dir ${args.assetsDir} does not exist` });
    }
  }

  report(args, { file: args.file, questionCount: questions.length, errors, warnings });
}

function report(args, result) {
  const ok = result.errors.length === 0;
  if (args.json) {
    console.log(JSON.stringify({ ...result, ok }, null, 2));
  } else {
    console.log(`\n${args.file}: ${result.questionCount} questions`);
    if (result.errors.length) {
      console.log(`\nERRORS (${result.errors.length}):`);
      result.errors.forEach((e) => console.log(`  [${e.type}] ${e.message}`));
    }
    if (result.warnings.length) {
      console.log(`\nWARNINGS (${result.warnings.length}):`);
      result.warnings.forEach((w) => console.log(`  [${w.type}] ${w.message}`));
    }
    console.log(`\n${ok ? "PASS" : "FAIL"} -- ${result.errors.length} error(s), ${result.warnings.length} warning(s)`);
  }
  if (!ok) process.exitCode = 1;
}

main().catch((e) => {
  console.error("validate-ingestion.mjs failed:", e.message);
  process.exitCode = 1;
});
