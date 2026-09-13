// Scoring: correct | incorrect | unanswered, plus a generic category-breakdown
// reducer used for the "performance by general category" report.

export function scoreAttempt({ questions, answers }) {
  const rows = questions.map((q, i) => {
    const sel = answers[i];
    let status;
    if (sel == null) status = "unanswered";
    else status = q.options[sel]?.label === q.correctAnswer ? "correct" : "incorrect";
    return { q, i, status, selected: sel };
  });
  const correct = rows.filter((r) => r.status === "correct").length;
  const incorrect = rows.filter((r) => r.status === "incorrect").length;
  const unanswered = rows.filter((r) => r.status === "unanswered").length;
  const pct = rows.length > 0 ? Math.round((correct / rows.length) * 100) : 0;
  return { rows, correct, incorrect, unanswered, pct, total: rows.length };
}

// Generic diagnostic breakdown by a key function (e.g. q.generalCategory).
export function diagnose(rows, keyFn, labelFn) {
  const groups = {};
  rows.forEach((r) => {
    const k = keyFn(r.q);
    if (k == null) return;
    (groups[k] ||= { correct: 0, incorrect: 0, unanswered: 0, total: 0 });
    groups[k][r.status]++; groups[k].total++;
  });
  return Object.entries(groups).map(([k, g]) => {
    const pct = g.total > 0 ? Math.round((g.correct / g.total) * 100) : 0;
    // "good"|"mid"|"low" — a machine-readable tier, not display text, so the
    // UI layer can render it in the platform's active language (src/i18n).
    let tier = "low";
    if (pct >= 90) tier = "good";
    else if (pct > 0) tier = "mid";
    return { key: k, label: labelFn ? labelFn(k) : k, pct, tier, ...g };
  }).sort((a, b) => b.pct - a.pct);
}

// The lowest-scoring general category, used to call out the weakest area.
export function weakestCategory(diagnosed = []) {
  if (!diagnosed.length) return null;
  return diagnosed.reduce((worst, g) => (g.pct < worst.pct ? g : worst), diagnosed[0]);
}
