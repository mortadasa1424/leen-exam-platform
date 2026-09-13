// Minimal platform-UI translation helper — no i18n library. Picks the
// dictionary for the active exam's configured language once at module load
// (this platform ships one exam per deployment, not a runtime language
// switcher), and falls back to English for any missing key so a future
// exam's partial translation never renders blank/undefined text.
import activeExam from "../exams/active.js";
import en from "./en.js";
import ar from "./ar.js";

const DICTS = { en, ar };

export const locale = activeExam.config.locale || { language: "en", direction: "ltr" };

const dict = DICTS[locale.language] || en;

function lookup(source, path) {
  return path.split(".").reduce((node, key) => (node == null ? node : node[key]), source);
}

// t("quiz.questionOf", { current: 1, total: 40 }) -> "Question 1 of 40"
export function t(key, vars) {
  let str = lookup(dict, key);
  if (str == null) str = lookup(en, key);
  if (str == null) return key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) str = str.split(`{${k}}`).join(v);
  }
  return str;
}
