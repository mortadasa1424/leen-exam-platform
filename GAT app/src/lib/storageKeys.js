// Namespaces localStorage/sessionStorage keys under the active exam's
// storagePrefix, so App.jsx and ErrorBoundary.jsx (which can't share React
// state — it renders above App in main.jsx) derive the same key from one
// place instead of two hand-typed literals.
import activeExam from "../exams/active.js";

export function storageKey(name) {
  return `${activeExam.config.storagePrefix}_${name}`;
}
