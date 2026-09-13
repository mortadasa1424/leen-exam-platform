import { useEffect, useMemo, useRef, useState } from "react";
import { Header, Footer, MainLogo } from "./Home.jsx";
import { scoreAttempt } from "../lib/scoring.js";
import activeExam from "../exams/active.js";
import { Sound } from "../lib/sound.js";
import { t } from "../i18n/index.js";
import { BarChart3, Eye, RotateCcw, MessageCircle, ChevronDown } from "./icons.jsx";

const RC = 2 * Math.PI * 74;

export default function Results({ attempt, dark, onToggleDark, soundOn, onToggleSound, onHome, onReport, onReview, onPracticeMistakes }) {
  const { courseUrl, whatsappUrl, copy } = activeExam.config.marketing;
  const byCategory = Boolean(activeExam.config.performance?.byCategory);
  const currentAttempt = useMemo(() => ({
    ...attempt,
    questions: activeExam.rehydrateQuestions(attempt?.questions || []),
  }), [attempt]);
  const res = scoreAttempt(currentAttempt);
  const { pct, correct, incorrect, unanswered } = res;
  const [shown, setShown] = useState(0);
  const [offset, setOffset] = useState(RC);
  const [help, setHelp] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    const scoreTimer = setTimeout(() => setOffset(RC * (1 - pct / 100)), 200);
    let n = 0; const step = Math.max(1, Math.round(pct / 40));
    const ci = setInterval(() => { n = Math.min(n + step, pct); setShown(n); if (n >= pct) clearInterval(ci); }, 26);
    Sound.complete(pct);
    // The rest of the app's animations are CSS and already respect
    // prefers-reduced-motion (app.css); this confetti burst is a canvas/
    // requestAnimationFrame loop, which CSS can't neutralize, so it needs
    // its own check.
    const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (pct >= 50 && !reduceMotion) burst();
    return () => { clearTimeout(scoreTimer); clearInterval(ci); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const burst = () => {
    const cv = canvasRef.current; if (!cv) return;
    const cx = cv.getContext("2d"); cv.width = innerWidth; cv.height = innerHeight;
    const cols = ["#00c3e1", "#ff8b13", "#fd5f6d", "#22c58b", "#ffd23f", "#fff"];
    const P = Array.from({ length: 120 }, () => ({ x: innerWidth / 2, y: innerHeight * 0.3,
      vx: (Math.random() - 0.5) * 11, vy: Math.random() * -13 - 3, g: 0.35,
      s: Math.random() * 8 + 4, c: cols[(Math.random() * cols.length) | 0], r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.5, life: 1 }));
    let f = 0;
    const loop = () => {
      cx.clearRect(0, 0, cv.width, cv.height); f++;
      P.forEach((p) => { p.vy += p.g; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life -= 0.008;
        cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.globalAlpha = Math.max(p.life, 0);
        cx.fillStyle = p.c; cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6); cx.restore(); });
      if (f < 190) requestAnimationFrame(loop); else cx.clearRect(0, 0, cv.width, cv.height);
    };
    loop();
  };

  const hasMistakes = incorrect + unanswered > 0;
  const allCorrect = correct === res.total && res.total > 0;

  return (
    <div className="screen results screen-enter">
      <canvas id="confetti" ref={canvasRef} />
      <Header showHome onHome={onHome} dark={dark} onToggleDark={onToggleDark} soundOn={soundOn} onToggleSound={onToggleSound} />
      <MainLogo dark={dark} />

      <div className="scroll-area results-scroll">
        <div className="res-title">{t("results.title")}</div>

        <div className="results-layout">
          <div className="results-primary">
            <div className="score-card clean-score-card">
              <div className="ring">
                <svg width="178" height="178" viewBox="0 0 178 178">
                  <defs><linearGradient id="grG" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#00c3e1" /><stop offset="1" stopColor="#ff8b13" /></linearGradient></defs>
                  <circle className="trk" cx="89" cy="89" r="74" fill="none" strokeWidth="13" />
                  <circle className="fil" cx="89" cy="89" r="74" fill="none" strokeWidth="13" strokeDasharray={RC} strokeDashoffset={offset} />
                </svg>
                <div className="pct">{shown}<small>%</small></div>
              </div>
            </div>

            <div className="res-badges">
              <div className="rbadge ok"><b>{correct}</b><span>{t("results.correct")}</span></div>
              <div className="rbadge no"><b>{incorrect}</b><span>{t("results.incorrect")}</span></div>
              <div className="rbadge gr"><b>{unanswered}</b><span>{t("results.unanswered")}</span></div>
            </div>
          </div>

          <div className="results-secondary">
            <div className={`expander ${help ? "open" : ""}`}>
              <button className="expander-head" onClick={() => { Sound.tap(); setHelp((h) => !h); }}>
                {t("results.needHelp")} <ChevronDown size={16} className="chev" aria-hidden="true" />
              </button>
              {help && (
                <div className="expander-body help-body">
                  <a className="help-link" href={courseUrl} target="_blank" rel="noopener noreferrer">{copy.helpLinkText}</a>
                  <a className="help-link wa-action" href={whatsappUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle size={16} aria-hidden="true" /> {t("results.contactWhatsapp")}
                  </a>
                </div>
              )}
            </div>

            {!allCorrect && (
              <div className="res-actions clean-actions">
                {byCategory && (
                  <button className="btn-primary action-report" onClick={() => { Sound.tap(); onReport(res); }}>
                    <BarChart3 size={16} aria-hidden="true" /> {t("results.performanceBySkill")}
                  </button>
                )}
                <button className="btn-primary" onClick={() => { Sound.tap(); onReview(res); }}>
                  <Eye size={16} aria-hidden="true" /> {t("results.reviewAnswers")}
                </button>
                {hasMistakes && (
                  <button className="btn-primary action-warn" onClick={() => { Sound.tap(); onPracticeMistakes(res); }}>
                    <RotateCcw size={16} aria-hidden="true" /> {t("results.practiceMistakes")}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
