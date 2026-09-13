import { useState, useEffect, useCallback } from "react";
import Home from "./components/Home.jsx";
import SectionSelect from "./components/SectionSelect.jsx";
import Quiz from "./components/Quiz.jsx";
import Results from "./components/Results.jsx";
import Review from "./components/Review.jsx";
import PerformanceReport from "./components/PerformanceReport.jsx";
import LeadForm from "./components/LeadForm.jsx";
import PopupAd from "./components/PopupAd.jsx";
import activeExam from "./exams/active.js";
import { locale, t } from "./i18n/index.js";
import { Sound } from "./lib/sound.js";
import { getStr, setStr, getJSON, setJSON, remove, getSessionStr, setSessionStr } from "./lib/storage.js";
import { storageKey } from "./lib/storageKeys.js";
import { FaWhatsapp } from "react-icons/fa";
import "./styles/app.css";

const { getTestQuestions, getQuestionsByIds, testMeta: TEST_META } = activeExam;
const { minutes: DEFAULT_TEST_MINUTES } = activeExam.config.timer;
const { whatsappUrl: WHATSAPP_URL } = activeExam.config.marketing;
const { enabled: LEAD_CAPTURE_ENABLED } = activeExam.config.leadCapture;

// Platform UI language/direction — set once at startup, before first paint,
// so there's no LTR->RTL flash. Independent from question-content direction,
// which QuestionCard derives per-question from its own text.
if (typeof document !== "undefined") {
  document.documentElement.lang = locale.language;
  document.documentElement.dir = locale.direction;
}

const LS = {
  theme: storageKey("theme"),
  lead: storageKey("lead_completed"),
  active: storageKey("active_attempt_v1"),
  openAdShown: storageKey("open_ad_shown"),
};

export default function App() {
  const [screen, setScreen] = useState("home"); // home|select|lead|quiz|results|report|review
  const [pickedSection, setPickedSection] = useState(null); // quantitative | verbal
  const [session, setSession] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [reviewRes, setReviewRes] = useState(null);
  const [reportRes, setReportRes] = useState(null);
  const [pending, setPending] = useState(null);
  const [resumePrompt, setResumePrompt] = useState(null);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [homeReturnConfirm, setHomeReturnConfirm] = useState(null);
  const [practiceMistakesPrompt, setPracticeMistakesPrompt] = useState(null);
  // One shared piece of state for the promo popup — null | "open" | "finish"
  // — instead of two independent booleans, so there is exactly one place in
  // the render tree that ever mounts <PopupAd> (below) and both the
  // first-visit and post-test triggers provably go through the same
  // component/portal/CSS, not two parallel copies of it.
  const [adPopup, setAdPopup] = useState(null);

  // First visit (no saved preference) always starts Light, regardless of
  // the device/browser's prefers-color-scheme — only an explicit saved
  // "dark" value (set by the toggle below) switches this to dark.
  const [dark, setDark] = useState(() => getStr(LS.theme, "light") === "dark");
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => { Sound.setEnabled(soundOn); }, [soundOn]);
  useEffect(() => { document.body.classList.toggle("light", !dark); setStr(LS.theme, dark ? "dark" : "light"); }, [dark]);
  useEffect(() => {
    const unlock = () => { Sound.unlock(); window.removeEventListener("pointerdown", unlock); };
    window.addEventListener("pointerdown", unlock);
  }, []);

  // Promotional popup once per browser session — sessionStorage (not
  // localStorage) so it re-triggers every time the student closes and
  // reopens the browser/tab, not just on their very first-ever visit.
  // Skipped whenever there's an unfinished attempt to resume (below) — the ad's
  // overlay sits above the resume modal (z-popup > z-overlay) and would otherwise
  // hide the "continue your test?" prompt every time it's due to appear.
  //
  // Eligibility (the sessionStorage flag + active-attempt check) is decided
  // immediately, same as before — only the actual reveal is delayed 2s, so
  // the page has time to finish its first render/settle before the popup
  // shows. This matters most for iOS Chrome cold-launched from an external
  // deep link (e.g. a WhatsApp link tap), where the browser's own viewport
  // is still settling on that very first frame; the post-test popup below
  // already uses this same delayed-reveal principle at 5s.
  useEffect(() => {
    if (getSessionStr(LS.openAdShown, "") === "true") return;
    const saved = getJSON(LS.active, null);
    if (saved && Array.isArray(saved.questionIds) && saved.questionIds.length) return;
    setSessionStr(LS.openAdShown, "true");
    const t = setTimeout(() => setAdPopup("open"), 2000);
    return () => clearTimeout(t);
  }, []);

  // Resume-interrupted-attempt prompt — checked fresh on every app load (not
  // just the first visit ever), so it reliably asks again each time the
  // student re-enters the site with an unfinished test still saved.
  useEffect(() => {
    const saved = getJSON(LS.active, null);
    if (saved && Array.isArray(saved.questionIds) && saved.questionIds.length) setResumePrompt(saved);
  }, []);

  // Show the finish-ad 5s after landing on results, so the student sees their
  // score first. Keyed on `attempt` (set once per submission by finishAttempt),
  // not on the Results component's own lifecycle, so a Results re-render can't
  // re-trigger it — and the timeout is cleaned up on unmount or a new attempt.
  useEffect(() => {
    if (!attempt) return;
    const t = setTimeout(() => setAdPopup("finish"), 5000);
    return () => clearTimeout(t);
  }, [attempt]);

  const leadDone = () => getStr(LS.lead, "") === "true";

  // ---- start flow ----
  // Timer is optional (student toggles it on the start screen, default OFF).
  // When enabled, every test uses the same unified 60-minute
  // (DEFAULT_TEST_MINUTES) overall timer — never a per-question timer.
  const requestStart = (testKey, timed) => {
    const meta = TEST_META[testKey];
    const intent = { testKey, section: meta.section, timed, minutes: DEFAULT_TEST_MINUTES, testTitle: meta.title };
    if (LEAD_CAPTURE_ENABLED && !leadDone()) { setPending(intent); setScreen("lead"); return; }
    beginAttempt(intent);
  };

  // Deadline-based timer: a fresh attempt gets `deadline = now + minutes`.
  // Resuming (restoreState.deadline present) reuses that exact deadline so
  // refreshing/leaving-and-returning can never grant extra time — remaining
  // time is always derived from `deadline - Date.now()`, never stored as a
  // decrementing counter.
  const beginAttempt = (intent, restoreState = null) => {
    const questions = restoreState?.questions || getTestQuestions(intent.testKey);
    const deadline = intent.timed
      ? (restoreState?.deadline || Date.now() + intent.minutes * 60000)
      : null;
    const sess = {
      ...intent, questions, deadline,
      initialState: { ...(restoreState?.state || {}), questions, onState: onQuizState },
    };
    setSession(sess);
    setScreen("quiz");
    saveActive(intent, questions, restoreState?.state || {}, deadline);
  };

  const saveActive = (intent, questions, state, deadline) => {
    setJSON(LS.active, {
      testKey: intent.testKey, section: intent.section, timed: intent.timed, minutes: intent.minutes,
      testTitle: intent.testTitle, questionIds: questions.map((q) => q.id), state, deadline,
    });
  };

  const onQuizState = useCallback((live) => {
    const saved = getJSON(LS.active, null);
    if (saved) setJSON(LS.active, { ...saved, state: live });
  }, []);

  const finishAttempt = (att) => {
    const finished = {
      ...att,
      testKey: session?.testKey || att.testKey,
      testTitle: session?.testTitle || att.testTitle,
    };
    remove(LS.active);
    setAttempt(finished);
    setScreen("results");
  };

  // ---- lead complete ----
  const onLeadComplete = () => {
    setStr(LS.lead, "true");
    if (pending) { const p = pending; setPending(null); beginAttempt(p); }
    else setScreen("home");
  };

  // ---- resume prompt actions ----
  const doResume = () => {
    const s = resumePrompt; setResumePrompt(null);
    const intent = { testKey: s.testKey, section: s.section, timed: s.timed, minutes: s.minutes, testTitle: s.testTitle };
    const questions = getQuestionsByIds(s.questionIds || []);
    beginAttempt(intent, { questions: questions.length ? questions : getTestQuestions(s.testKey), state: s.state, deadline: s.deadline });
  };
  const discardResume = () => { setResumePrompt(null); remove(LS.active); };

  // ---- practice mistakes ----
  const practiceMistakes = (res) => {
    const wrongRows = res.rows.filter((r) => r.status === "incorrect" || r.status === "unanswered");
    const wrongIds = wrongRows.map((r) => r.q?.id).filter(Boolean);
    const freshById = Object.fromEntries(getQuestionsByIds(wrongIds).map((q) => [q.id, q]));
    const wrong = wrongRows.map((r) => freshById[r.q?.id] || r.q).filter(Boolean);
    const sess = {
      testKey: attempt.testKey || "practice", timed: false, minutes: 0, deadline: null, questions: wrong,
      testTitle: "Practice Mistakes", initialState: { onState: () => {}, idx: 0, answers: {}, marked: {} },
    };
    setSession(sess); setScreen("quiz");
  };

  const goHome = () => { setScreen("home"); setSession(null); setPickedSection(null); };
  const askLeave = () => setLeaveConfirm(true);
  const confirmLeave = () => { setLeaveConfirm(false); goHome(); };
  const askHomeReturn = (source) => setHomeReturnConfirm(source);
  const confirmHomeReturn = () => { setHomeReturnConfirm(null); goHome(); };
  const requestPracticeMistakes = (res) => setPracticeMistakesPrompt(res);
  const confirmPracticeMistakes = () => {
    const res = practiceMistakesPrompt;
    setPracticeMistakesPrompt(null);
    if (res) practiceMistakes(res);
  };

  return (
    <div className="app-root">
      <div className="aurora"><span className="b1" /><span className="b2" /><span className="b3" /><span className="b4" /></div>
      <div className="grain" />
      <a className="wa-float global-wa" href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" aria-label={t("whatsapp.ariaLabel")}>
        <FaWhatsapp size={26} aria-hidden="true" />
      </a>

      {screen === "home" && (
        <Home
          dark={dark} onToggleDark={() => setDark((d) => !d)}
          soundOn={soundOn} onToggleSound={() => setSoundOn((s) => !s)}
          onPickSection={(id) => { setPickedSection(id); setScreen("select"); }}
        />
      )}

      {screen === "select" && (
        <SectionSelect
          section={pickedSection}
          dark={dark} onToggleDark={() => setDark((d) => !d)}
          soundOn={soundOn} onToggleSound={() => setSoundOn((s) => !s)}
          onHome={goHome}
          onStart={(testKey, timed) => requestStart(testKey, timed)}
        />
      )}

      {screen === "lead" && (
        <LeadForm
          dark={dark} onToggleDark={() => setDark((d) => !d)}
          soundOn={soundOn} onToggleSound={() => setSoundOn((s) => !s)}
          onComplete={onLeadComplete} onHome={goHome}
        />
      )}

      {screen === "quiz" && session && (
        <Quiz
          questions={session.questions} testTitle={session.testTitle}
          deadline={session.deadline} totalMinutes={session.minutes}
          dark={dark} onToggleDark={() => setDark((d) => !d)}
          soundOn={soundOn} onToggleSound={() => setSoundOn((s) => !s)}
          onFinish={finishAttempt} onHome={askLeave}
          initialState={session.initialState}
        />
      )}

      {screen === "results" && attempt && (
        <Results
          attempt={attempt}
          dark={dark} onToggleDark={() => setDark((d) => !d)}
          soundOn={soundOn} onToggleSound={() => setSoundOn((s) => !s)}
          onHome={() => askHomeReturn("results")}
          onReport={(res) => { if (activeExam.config.performance?.byCategory) { setReportRes(res); setScreen("report"); } }}
          onReview={(res) => { setReviewRes(res); setScreen("review"); }}
          onPracticeMistakes={requestPracticeMistakes}
        />
      )}

      {screen === "report" && reportRes && (
        <PerformanceReport
          res={reportRes}
          dark={dark} onToggleDark={() => setDark((d) => !d)}
          soundOn={soundOn} onToggleSound={() => setSoundOn((s) => !s)}
          onHome={() => askHomeReturn("report")}
          onBack={() => setScreen("results")}
        />
      )}

      {screen === "review" && reviewRes && (
        <Review
          res={reviewRes}
          dark={dark} onToggleDark={() => setDark((d) => !d)}
          soundOn={soundOn} onToggleSound={() => setSoundOn((s) => !s)}
          onHome={() => askHomeReturn("review")}
          onBack={() => setScreen("results")}
        />
      )}

      {adPopup && <PopupAd variant={adPopup} onClose={() => setAdPopup(null)} />}

      {resumePrompt && (
        <Modal title={t("modals.resumeTitle")} body={t("modals.resumeBody", { testTitle: resumePrompt.testTitle })}
          yes={t("modals.resumeYes")} no={t("modals.resumeNo")} onYes={doResume} onNo={discardResume} />
      )}
      {leaveConfirm && (
        <Modal title={t("modals.leaveTitle")} yes={t("common.yes")} no={t("common.no")} onYes={confirmLeave} onNo={() => setLeaveConfirm(false)} />
      )}
      {homeReturnConfirm && (
        <Modal title={t("modals.homeReturnTitle")} yes={t("common.yes")} no={t("common.no")} onYes={confirmHomeReturn} onNo={() => setHomeReturnConfirm(null)} />
      )}
      {practiceMistakesPrompt && (
        <Modal title={t("modals.practiceMistakesTitle")} body={t("modals.practiceMistakesBody")}
          bodyClassName="modal-comment" yes={t("common.yes")} no={t("common.no")} onYes={confirmPracticeMistakes} onNo={() => setPracticeMistakesPrompt(null)} />
      )}
    </div>
  );
}

function Modal({ title, body, bodyClassName = "", yes, no, onYes, onNo }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal">
        <h3>{title}</h3>
        {body && <p className={bodyClassName}>{body}</p>}
        <div className="modal-acts">
          <button className="btn-primary" onClick={() => { Sound.tap(); onYes(); }}>{yes}</button>
          <button className="btn-ghost" onClick={() => { Sound.tap(); onNo(); }}>{no}</button>
        </div>
      </div>
    </div>
  );
}
