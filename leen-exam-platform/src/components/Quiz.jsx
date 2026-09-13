import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import QuestionCard from "./QuestionCard.jsx";
import NavOverlay from "./NavOverlay.jsx";
import { CourseFooter, getLeenLogoSrc } from "./Home.jsx";
import { Sound } from "../lib/sound.js";
import { t } from "../i18n/index.js";
import { Flag, LayoutGrid, Pause, Home as HomeIcon, Sun, Moon, Volume2, VolumeX, Check, Clock } from "./icons.jsx";

export default function Quiz({
  questions, testTitle, deadline, totalMinutes, dark, onToggleDark, soundOn, onToggleSound, onFinish, onHome, initialState,
}) {
  // A resumed attempt's saved index can outlive the question set it pointed
  // at (e.g. a corrupted/mismatched save) — clamp it into range so a stale
  // index can never index past the end of `questions` and crash the render.
  const [idx, setIdx] = useState(() => {
    const saved = Number(initialState?.idx);
    const max = Math.max(questions.length - 1, 0);
    return Number.isFinite(saved) ? Math.min(Math.max(saved, 0), max) : 0;
  });
  const [answers, setAnswers] = useState(initialState?.answers || {});
  const [marked, setMarked] = useState(initialState?.marked || {});
  const [showNav, setShowNav] = useState(false);
  const [paused, setPaused] = useState(false);
  const [submitConfirm, setSubmitConfirm] = useState(false);
  const [anim, setAnim] = useState("in");

  // Deadline-based countdown: remaining time is always derived from
  // `deadline - Date.now()`, never stored/decremented as a bare counter, so a
  // page refresh or resume can never grant extra time. `deadline` is null for
  // untimed sessions (e.g. Practice Mistakes).
  const computeRemaining = () => (deadline ? Math.max(0, Math.round((deadline - Date.now()) / 1000)) : 0);
  const [overall, setOverall] = useState(computeRemaining);
  const [timeUp, setTimeUp] = useState(() => Boolean(deadline) && computeRemaining() <= 0);
  const oTimerRef = useRef(null);
  const warnedRef = useRef(computeRemaining() <= 60);
  const finishedRef = useRef(false);

  const q = questions[idx];
  const total = questions.length;

  useEffect(() => {
    if (initialState?.onState) initialState.onState({ idx, answers, marked });
  });

  // Reset the enter/exit transition whenever the question changes.
  useEffect(() => { setAnim("in"); }, [idx]);

  // Single overall unified test timer — no per-question timer. Ticks purely
  // to refresh the display / detect expiry; the deadline itself never moves.
  useEffect(() => {
    clearInterval(oTimerRef.current);
    if (!deadline || timeUp || paused || submitConfirm) return;
    oTimerRef.current = setInterval(() => {
      const remaining = computeRemaining();
      setOverall(remaining);
      if (remaining <= 60 && !warnedRef.current) { warnedRef.current = true; Sound.warn(); }
      if (remaining <= 0) {
        clearInterval(oTimerRef.current);
        setTimeUp(true);
        setShowNav(false);
        setSubmitConfirm(false);
      }
    }, 1000);
    return () => clearInterval(oTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, submitConfirm, deadline, timeUp]);

  useEffect(() => {
    if (!deadline) return;
    const onVis = () => { if (document.hidden) setPaused(true); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [deadline]);

  const pick = (i) => {
    if (timeUp) return;
    Sound.select();
    setAnswers((a) => ({ ...a, [idx]: i }));
  };

  const go = (next) => {
    if (timeUp || next < 0 || next >= total) return;
    Sound.swoosh(); setAnim("out");
    setTimeout(() => setIdx(next), 220);
  };
  const finish = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    clearInterval(oTimerRef.current);
    onFinish({ questions, answers, marked });
  };
  const requestFinish = () => { if (timeUp) return; Sound.tap(); setSubmitConfirm(true); };
  const toggleMark = () => { if (timeUp) return; Sound.tap(); setMarked((m) => ({ ...m, [idx]: !m[idx] })); };
  const resumeFromPause = () => {
    Sound.tap();
    setPaused(false);
    if (deadline && computeRemaining() <= 0) { setTimeUp(true); setShowNav(false); setSubmitConfirm(false); }
  };

  const overallStr = `${String(Math.floor(overall / 60)).padStart(2, "0")}:${String(overall % 60).padStart(2, "0")}`;
  const unansweredCount = total - Object.keys(answers).length;
  // Split around the current-question number so it can stay wrapped in <b>
  // regardless of where the translated sentence places it.
  const [qOfBefore, qOfAfter] = t("quiz.questionOf", { current: "QOFMARK", total }).split("QOFMARK");
  const navControls = (
    <div className="card-nav-row">
      <button className="nav-btn" onClick={() => go(idx - 1)} disabled={idx === 0 || timeUp}>{t("quiz.previous")}</button>
      {idx + 1 >= total
        ? <button className="nav-btn primary" onClick={requestFinish} disabled={timeUp}>{t("quiz.submitTest")}</button>
        : <button className="nav-btn primary" onClick={() => go(idx + 1)} disabled={timeUp}>{t("quiz.next")}</button>}
    </div>
  );

  const cardTools = (
    <>
      <button className="quiz-tool-btn card-grid-btn mobile-only-nav-btn" onClick={() => { if (!timeUp) { Sound.tap(); setShowNav(true); } }} aria-label={t("quiz.viewAllQuestions")} type="button">
        <LayoutGrid size={16} aria-hidden="true" /> {t("quiz.viewAllQuestions")}
      </button>
      {deadline != null && (
        <div className={`quiz-tool-btn quiz-timer-inline mobile-only-nav-btn ${overall <= 60 ? "warn" : ""}`} aria-label={t("quiz.timeRemaining")} role="timer">
          <Clock size={14} aria-hidden="true" /> {overallStr}
        </div>
      )}
      <button className={`quiz-tool-btn flag-btn compact ${marked[idx] ? "on" : ""}`} onClick={toggleMark} aria-label={t("quiz.markForReview")} type="button">
        <Flag size={16} aria-hidden="true" /> {t("quiz.markForReview")}
      </button>
    </>
  );

  return (
    <div className="screen quiz screen-enter quiz-v2">
      <header className="quiz-header">
        <div className="quiz-header-left">
          <button className="icon-btn" onClick={onHome} aria-label={t("quiz.exitToHome")}><HomeIcon size={18} aria-hidden="true" /></button>
          <img className="quiz-header-logo" src={getLeenLogoSrc(dark)} alt="Leen" />
          {testTitle && <span className="quiz-header-title">{testTitle}</span>}
        </div>
        <div className="quiz-header-center">
          {qOfBefore}<b>{idx + 1}</b>{qOfAfter}
        </div>
        <div className="quiz-header-right">
          {deadline != null && <div className={`quiz-overall ${overall <= 60 ? "warn" : ""}`}>{overallStr}</div>}
          <button className="icon-btn" onClick={() => { Sound.tap(); onToggleDark?.(); }} aria-label={t("common.theme")}>
            {dark ? <Moon size={17} aria-hidden="true" /> : <Sun size={17} aria-hidden="true" />}
          </button>
          <button className="icon-btn" onClick={() => { Sound.tap(); onToggleSound?.(); }} aria-label={t("common.sound")}>
            {soundOn ? <Volume2 size={17} aria-hidden="true" /> : <VolumeX size={17} aria-hidden="true" />}
          </button>
        </div>
      </header>

      <div className="quiz-workspace">
        <div className="frame">
          <div className="frame-glow" />
          <div className="q-scroll">
            <div className={`q-anim ${anim === "in" ? "q-in" : "q-out"}`} key={idx}>
              <QuestionCard
                question={q}
                selected={answers[idx] ?? null}
                revealed={false}
                onPick={pick}
                tools={cardTools}
                navigation={navControls}
              />
            </div>
          </div>
        </div>

        <aside className="quiz-sidebar" aria-label={t("quiz.questionNavigator")}>
          <NavOverlay inline total={total} current={idx} answers={answers} marked={marked}
            onJump={(n) => go(n)} onSubmit={requestFinish} />
        </aside>
      </div>

      {showNav && (
        <NavOverlay total={total} current={idx} answers={answers} marked={marked}
          onJump={(n) => { setShowNav(false); go(n); }} onClose={() => setShowNav(false)} />
      )}

      {paused && !timeUp && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t("quiz.testPaused")}>
          <div className="pause-card">
            <div className="modal-icon"><Pause size={28} aria-hidden="true" /></div>
            <h3>{t("quiz.testPaused")}</h3>
            <button className="btn-primary pause-continue" onClick={resumeFromPause}>{t("quiz.resume")}</button>
          </div>
        </div>
      )}

      {submitConfirm && !timeUp && createPortal(
        // Rendered via a portal straight onto document.body (not inside
        // .app-root/.screen) so its position:fixed backdrop is always
        // anchored to the true viewport, edge-to-edge, independent of the
        // .screen container's own max-width/centering and of any ancestor
        // CSS between here and <body> — the same fix already used for
        // PopupAd's overlay (see PopupAd.jsx).
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t("quiz.submitConfirmTitle")}>
          <div className="modal">
            <div className="modal-icon"><Check size={26} aria-hidden="true" /></div>
            <h3>{t("quiz.submitConfirmTitle")}</h3>
            <p>
              {unansweredCount > 0
                ? t("quiz.submitConfirmUnanswered", { count: unansweredCount, noun: unansweredCount === 1 ? t("quiz.questionSingular") : t("quiz.questionPlural") })
                : t("quiz.submitConfirmAllAnswered")}
            </p>
            <div className="modal-acts">
              <button className="btn-primary" onClick={() => { Sound.tap(); finish(); }}>{t("quiz.submitTest")}</button>
              <button className="btn-ghost" onClick={() => { Sound.tap(); setSubmitConfirm(false); }}>{t("quiz.continueTest")}</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      <CourseFooter />

      {timeUp && (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={t("quiz.timeUpTitle")}>
          <div className="modal">
            <div className="modal-icon"><Clock size={26} aria-hidden="true" /></div>
            <h3>{t("quiz.timeUpTitle")}</h3>
            <p>{t("quiz.timeUpBody", { minutes: totalMinutes })}</p>
            <div className="modal-acts">
              <button className="btn-primary" onClick={() => { Sound.tap(); finish(); }}>{t("quiz.ok")}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
