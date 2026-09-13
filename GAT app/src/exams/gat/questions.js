// Normalizes GAT's raw question banks into fixed-form test sets. GAT tests
// are always the same question set in the same order for every attempt — no
// randomization or seen-history rotation. Adapted from the original
// src/data/tests.js: same logic, now reading section metadata (mathRendering,
// category mapping) from exam.config.js instead of local constants.
import quant1Real from "./data/quant/test-1.json";
import quant2Real from "./data/quant/test-2.json";
import quant3Real from "./data/quant/test-3.json";
import verbal1Real from "./data/verbal/test-1.json";
import verbal1Passages from "./data/verbal/passages-1.json";
import verbal2Real from "./data/verbal/test-2.json";
import verbal2Passages from "./data/verbal/passages-2.json";
import verbal3Real from "./data/verbal/test-3.json";
import verbal3Passages from "./data/verbal/passages-3.json";
import config from "./exam.config.js";

const { specificToGeneral } = config.categories;

// Flat { [testKey]: { section, title, mathRendering } }, derived from
// config.sections so test metadata is never duplicated in two places.
export const testMeta = Object.fromEntries(
  config.sections.flatMap((section) =>
    section.tests.map((t) => [t.key, { section: section.id, title: t.title, mathRendering: Boolean(section.mathRendering) }])
  )
);

export const passages = Object.fromEntries(
  [...verbal1Passages, ...verbal2Passages, ...verbal3Passages].map((p) => [p.id, p])
);

// Every GAT test is namespaced with its testKey so ids stay unique across the
// six slots. Each test's own question count is used everywhere (quiz,
// scoring, review, etc.) — nothing assumes a fixed length.
// generalCategory is derived centrally from specificCategory via
// specificToGeneral (falling back to a question's own generalCategory for
// mock data, which sets it directly since it has no real specificCategory).
function buildTestQuestions(testKey, base) {
  const meta = testMeta[testKey];
  return base.map((q, i) => ({
    ...q,
    id: `GAT-${testKey.toUpperCase()}-${String(i + 1).padStart(3, "0")}`,
    section: meta.section,
    testKey,
    order: i + 1,
    generalCategory: specificToGeneral[q.specificCategory] ?? q.generalCategory ?? null,
    mathLayout: meta.mathRendering,
  }));
}

const TEST_QUESTIONS = {
  quant1: buildTestQuestions("quant1", quant1Real),
  quant2: buildTestQuestions("quant2", quant2Real),
  quant3: buildTestQuestions("quant3", quant3Real),
  verbal1: buildTestQuestions("verbal1", verbal1Real),
  verbal2: buildTestQuestions("verbal2", verbal2Real),
  verbal3: buildTestQuestions("verbal3", verbal3Real),
};

export function getTestQuestions(testKey) {
  return TEST_QUESTIONS[testKey] || [];
}

function allQuestions() {
  return Object.values(TEST_QUESTIONS).flat();
}

export function getQuestionsByIds(ids = []) {
  if (!Array.isArray(ids)) return [];
  const byId = Object.fromEntries(allQuestions().map((q) => [q.id, q]));
  return ids.map((id) => byId[id]).filter(Boolean);
}

export function rehydrateQuestions(questions = []) {
  const byId = Object.fromEntries(allQuestions().map((q) => [q.id, q]));
  return (questions || []).map((q) => byId[q?.id] || q).filter(Boolean);
}
