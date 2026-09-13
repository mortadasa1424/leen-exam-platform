// The single stable import path for "which exam is this deployment" —
// everything in src/components and src/App.jsx imports the active exam from
// here, never from src/exams/<id>/ or src/exams/registry.js directly.
//
// Which exam that is comes from the VITE_EXAM_ID build-time env var (see
// docs/PLATFORM.md's "Exam registry" section), looked up in the registry:
//   - unset (local dev/build with no env configured) -> "gat", so existing
//     behavior/deployments are unaffected.
//   - set to a registered id (e.g. "saat") -> that exam.
//   - set to an id not in the registry -> throws immediately, listing the
//     valid ids, instead of silently falling back to GAT.
import registry from "./registry.js";

const DEFAULT_EXAM_ID = "gat";
const examId = import.meta.env.VITE_EXAM_ID || DEFAULT_EXAM_ID;
const exam = registry[examId];

if (!exam) {
  const validIds = Object.keys(registry).join(", ");
  throw new Error(
    `Unknown VITE_EXAM_ID "${examId}". Valid exam IDs: ${validIds}.`
  );
}

export default exam;
