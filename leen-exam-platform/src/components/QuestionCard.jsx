import { useMemo } from "react";
import katex from "katex";
import activeExam from "../exams/active.js";
import { t } from "../i18n/index.js";

const { passages } = activeExam;

const LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H", "I"];

// ---- KaTeX rendering (Quantitative / mixed Arabic content) ----
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

function Tex({ tex, block = false, className = "" }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(normalizeTex(tex), {
        throwOnError: false,
        displayMode: block,
        strict: "ignore",
        trust: false,
      });
    } catch {
      return String(tex || "");
    }
  }, [tex, block]);
  const Tag = block ? "div" : "span";
  return <Tag className={className} dir="ltr" dangerouslySetInnerHTML={{ __html: html }} />;
}

function InlineSeg({ tex }) {
  return <span className="iso"><Tex tex={tex} /></span>;
}

function Segment({ s, i }) {
  if (s.type === "block") return <span key={i} className="iso block-inline"><Tex tex={s.text} block /></span>;
  if (s.type === "tex") return <InlineSeg key={i} tex={s.text} />;
  return <span key={i}>{s.text}</span>;
}

// Renders a mixed-language / mixed-math prompt (Quantitative default).
// Direction is detected from the actual content, not hardcoded: real
// Quantitative questions are English (LTR), while placeholder mock content
// elsewhere is still Arabic (RTL) until it's replaced with real imports —
// both are live in the app at once, so this can't be a fixed value.
function promptDir(segs) {
  const plain = segs.filter((s) => s.type === "text").map((s) => s.text).join(" ");
  return isArabicText(plain) ? "rtl" : "ltr";
}

function Prompt({ q }) {
  const segs = q.prompt || [];
  const hasBlock = segs.some((s) => s.type === "block");
  const layout = q.layout || (hasBlock ? "stacked" : "inline");
  const dir = promptDir(segs);
  if (layout === "stacked") {
    const lead = [], blocks = [];
    let seen = false;
    segs.forEach((s) => { if (s.type === "block") { seen = true; blocks.push(s); } else if (!seen) lead.push(s); else blocks.push(s); });
    return (
      <div className="q-prompt q-stacked" dir={dir}>
        {lead.length > 0 && <div className="q-lead">{lead.map((s, i) => <Segment key={i} s={s} i={i} />)}</div>}
        {blocks.map((s, i) => s.type === "block"
          ? <div className="q-block" key={i}><Tex tex={s.text} block /></div>
          : s.type === "tex" ? <div className="q-lead" key={i}><InlineSeg tex={s.text} /></div>
          : <div className="q-lead" key={i}>{s.text}</div>)}
      </div>
    );
  }
  return <div className="q-prompt" dir={dir}>{segs.map((s, i) => <Segment key={i} s={s} i={i} />)}</div>;
}

// ---- English / passage-based prompt (Verbal default) ----
function highlightSentence(text, word) {
  if (!word) return text;
  const re = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i");
  return String(text || "").split(re).map((p, i) => re.test(p) ? <mark key={i} className="q-hl">{p}</mark> : <span key={i}>{p}</span>);
}
function sanitizePassageText(text) {
  return String(text || "")
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n+/g, "\n\n")
    .trim();
}

function PassagePane({ passage }) {
  return (
    <div className="q-passage" dir="ltr">
      <div className="q-passage-t">{t("passage.readingPassage")}</div>
      {passage.title && <div className="q-passage-topic">{passage.title}</div>}
      <div className="q-passage-b">{sanitizePassageText(passage.passageText)}</div>
    </div>
  );
}

function QuestionText({ q }) {
  return (
    <div className="q-text" dir="ltr">
      {q.highlightedWord ? highlightSentence(q.questionText, q.highlightedWord) : q.questionText}
    </div>
  );
}

// Verbal prompt with no passage (Analogy / Sentence Completion / Contextual
// Error) — unchanged single-column rendering.
function EnglishPrompt({ q }) {
  return (
    <div className="q-en">
      <QuestionText q={q} />
    </div>
  );
}

// ---- image / diagram question ----
function ImageFigure({ q }) {
  return (
    <div className="q-figure">
      {q.prompt?.length > 0 && <Prompt q={q} />}
      <div className="q-image-wrap">
        <img className="q-diagram-img" src={q.image} alt="" loading="lazy" />
      </div>
    </div>
  );
}

// ---- inline vector diagram question ----
// q.svg comes from the static, source-controlled question datasets — never
// from user input — so raw injection here is safe. Do not wire this to any
// user- or network-supplied string without sanitizing it first.
function SvgFigure({ q }) {
  return (
    <div className="q-figure">
      {q.prompt?.length > 0 && <Prompt q={q} />}
      <div className="q-svg" dangerouslySetInnerHTML={{ __html: q.svg }} />
    </div>
  );
}

// ---- "Compare: A vs B" quantity table (Quantitative comparison questions) ----
// Cells render as inline text/tex segments (not one collapsed KaTeX string):
// a cell that's mostly prose with one small embedded equation needs the prose
// portion to be real, wrappable DOM text, or it overflows a narrow table cell.
function CompareCell({ cell }) {
  const segments = cell?.segments || [];
  const hasMath = segments.some((s) => s.type === "tex");
  return (
    <td dir={hasMath ? "ltr" : undefined}>
      {segments.map((s, i) => (s.type === "tex" ? <InlineSeg key={i} tex={s.text} /> : <span key={i}>{s.text}</span>))}
    </td>
  );
}

function CompareTable({ table }) {
  if (!table || !table.rows?.length) return null;
  // The page is RTL, but comparison tables must preserve the source
  // document's left-to-right column order (A left, B right) — an RTL
  // <table> would otherwise visually mirror the DOM column order.
  return (
    <div className="q-compare-table-wrap" dir="ltr">
      <table className="q-compare-table">
        <thead>
          <tr>{table.columns.map((c, i) => <th key={i}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((row, ri) => (
            <tr key={ri}>{row.map((cell, ci) => <CompareCell key={ci} cell={cell} />)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---- option rendering ----
function looksLikeMath(text) {
  return typeof text === "string" && (/\\(frac|sqrt|log|sin|cos|tan|begin|le|ge|times|div|pm|text)/.test(text) || /[{}_^]/.test(text));
}
function optionText(opt) { return opt?.text ?? opt?.tex ?? ""; }
function isArabicText(text) { return /[؀-ۿ]/.test(String(text || "")); }

function plainOptionLength(text = "") {
  return String(text ?? "")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}_^\\;]/g, "")
    .replace(/\s+/g, " ")
    .trim().length;
}
function optionSizeClass(opt) {
  const text = optionText(opt);
  const raw = opt?.tex || text;
  const rawStr = String(raw || "");
  const mathy = Boolean(opt?.tex || looksLikeMath(text));
  const len = plainOptionLength(raw);
  if (mathy) {
    const hasFractionOrRoot = /\\frac|\\sqrt/.test(rawStr);
    const hasEquationOrInequality = /=|\\le|\\ge|<|>/.test(rawStr);
    const commaCount = (rawStr.match(/,/g) || []).length;
    const signCount = (rawStr.match(/[+\-=]/g) || []).length;
    const hasManyTerms = commaCount >= 3 || (commaCount + signCount) >= 4;
    if (len >= 34 || (hasEquationOrInequality && len >= 28) || (hasManyTerms && len >= 24)) return "opt-xlong";
    if (len >= 24 || (hasManyTerms && len >= 12) || (hasFractionOrRoot && len >= 14) || (hasEquationOrInequality && len >= 18)) return "opt-long";
    return "";
  }
  if (len >= 50) return "opt-xlong";
  if (len >= 34) return "opt-long";
  return "";
}
const OPT_SIZE_RANK = { "": 0, "opt-long": 1, "opt-xlong": 2 };
function groupOptionSizeClass(options = []) {
  const rank = options.reduce((m, o) => Math.max(m, OPT_SIZE_RANK[optionSizeClass(o)] ?? 0), 0);
  return rank >= 2 ? "opt-xlong" : rank === 1 ? "opt-long" : "";
}

function OptionRow({ opt, index, state, disabled, onPick, sizeOverride = null }) {
  const rawText = optionText(opt);
  const mathy = Boolean(opt.tex || looksLikeMath(rawText));
  const dir = mathy ? "ltr" : isArabicText(rawText) ? "rtl" : "ltr";
  const sizeClass = sizeOverride != null ? sizeOverride : optionSizeClass(opt);
  const cls = ["opt", sizeClass, mathy && "opt-math", state].filter(Boolean).join(" ");
  const letter = opt.label ?? LETTERS[index];
  return (
    <button className={cls} onClick={() => !disabled && onPick?.(index)} disabled={disabled} type="button" dir={dir}>
      <span className="opt-tag">{letter}</span>
      <span className={mathy ? "opt-eq" : "opt-txt"} dir={dir}>
        {mathy ? <Tex tex={opt.tex || rawText} /> : <span>{rawText}</span>}
      </span>
      <span className="opt-mark">{state === "correct" ? "✓" : state === "wrong" ? "✕" : ""}</span>
    </button>
  );
}

function OptionsList({ options, optState, revealed, onPick, sizeOverride, extraClass = "" }) {
  if (!options?.length) return null;
  const cls = ["opts", "opts-two-col", extraClass].filter(Boolean).join(" ");
  return (
    <div className={cls}>
      {options.map((opt, i) => (
        <OptionRow key={i} opt={opt} index={i} state={optState(i)} disabled={revealed}
          onPick={onPick} sizeOverride={sizeOverride} />
      ))}
    </div>
  );
}

export default function QuestionCard({
  question, selected = null, revealed = false, onPick,
  tools = null, meta = null, navigation = null,
}) {
  const q = question;
  const optState = (i) => {
    const lbl = q.options?.[i]?.label ?? LETTERS[i];
    if (!revealed) return selected === i ? "sel" : "";
    if (lbl === q.correctAnswer) return "correct";
    if (i === selected) return "wrong";
    return "";
  };
  const isMath = q.mathLayout && (q.kind === "text" || q.kind === "image");
  const mathGroupSize = isMath ? groupOptionSizeClass(q.options || []) : null;
  const passage = q.kind === "text-en" && q.passageId ? passages[q.passageId] : null;

  // Reading Comprehension questions with a passage get a dedicated
  // split-reading layout: passage in its own independently-scrollable pane,
  // question + answers in the other. Desktop shows both panes side by side;
  // mobile stacks them (CSS only — same DOM/data either way). Every other
  // question kind (including non-passage Verbal) keeps the original
  // single-column structure untouched below.
  if (passage) {
    // On mobile the split pane is full-width, so a 2x2 answer grid reads
    // fine as long as every option is short — reuse the same content-length
    // classification already used to size math options, rather than a
    // fixed/hardcoded per-question rule. Any option long enough to need
    // smaller text (opt-long/opt-xlong) falls back to the single-column
    // list so its text never gets crushed. Desktop split-view is untouched
    // by this — the narrow desktop pane always stays single column.
    const rcCompact = groupOptionSizeClass(q.options || []) === "";
    return (
      <div className="card q-split-card">
        {meta}
        {tools && <div className="card-tools">{tools}</div>}
        <div className="q-split">
          <PassagePane passage={passage} />
          <div className="q-split-question">
            <QuestionText q={q} />
            <OptionsList options={q.options} optState={optState} revealed={revealed} onPick={onPick}
              sizeOverride={null} extraClass={rcCompact ? "opts-rc-compact" : ""} />
          </div>
        </div>
        {navigation}
      </div>
    );
  }

  return (
    <div className={`card ${q.mathLayout ? "math-card" : ""}`}>
      {meta}
      {tools && <div className="card-tools">{tools}</div>}

      <div className="card-body">
        {q.kind === "text" && <Prompt q={q} />}
        {q.kind === "text-en" && <EnglishPrompt q={q} />}
        {q.kind === "image" && <ImageFigure q={q} />}
        {q.kind === "svg" && <SvgFigure q={q} />}
        <CompareTable table={q.compareTable} />
      </div>

      <OptionsList options={q.options} optState={optState} revealed={revealed} onPick={onPick} sizeOverride={isMath ? mathGroupSize : null} />

      {navigation}
    </div>
  );
}
