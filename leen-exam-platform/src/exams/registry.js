// The exam registry — every exam module this build of the platform knows
// about, keyed by exam id. src/exams/active.js is the only file that reads
// this map; no other file (component, App.jsx, another exam) should import
// from here directly. See docs/PLATFORM.md's "Exam registry" section.
//
// Static imports on purpose, not dynamic import(): the whole app (starting
// with App.jsx's top-level `const { ... } = activeExam`) consumes the active
// exam module synchronously, so a lazy/async registry would force every
// consumer to handle a Promise for no benefit — this platform selects one
// exam per build (VITE_EXAM_ID), it doesn't switch exams at runtime.
import gat from "./gat/index.js";

const registry = {
  gat,
  // Add a future exam here once its src/exams/<id>/index.js exists:
  // saat,
  // step,
};

export default registry;
