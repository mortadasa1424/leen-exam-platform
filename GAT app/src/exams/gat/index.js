// The GAT exam module — the object src/exams/active.js re-exports. See
// docs/PLATFORM.md for the exam-module contract every exam must implement.
import config from "./exam.config.js";
import { testMeta, passages, getTestQuestions, getQuestionsByIds, rehydrateQuestions } from "./questions.js";

export default {
  config,
  testMeta,
  passages,
  getTestQuestions,
  getQuestionsByIds,
  rehydrateQuestions,
};
