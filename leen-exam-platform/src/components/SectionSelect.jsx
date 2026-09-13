import { useState } from "react";
import { Header, Footer, MainLogo } from "./Home.jsx";
import { Sound } from "../lib/sound.js";
import { Check, getSectionIcon } from "./icons.jsx";
import activeExam from "../exams/active.js";
import { t } from "../i18n/index.js";

export default function SectionSelect({ section, dark, onToggleDark, soundOn, onToggleSound, onHome, onStart }) {
  const sectionConfig = activeExam.config.sections.find((s) => s.id === section);
  const items = sectionConfig?.tests || [];
  const TileIcon = getSectionIcon(sectionConfig?.icon);
  const { minutes: timerMinutes, defaultOn: timedDefault } = activeExam.config.timer;
  const [picked, setPicked] = useState(null);
  const [timed, setTimed] = useState(timedDefault);

  const start = () => {
    if (!picked) return;
    Sound.start();
    onStart(picked, timed);
  };

  return (
    <div className="screen select screen-enter exam-select">
      <Header showHome onHome={onHome} dark={dark} onToggleDark={onToggleDark} soundOn={soundOn} onToggleSound={onToggleSound} />
      <MainLogo dark={dark} />

      <div className="select-title">
        <h2>{sectionConfig?.name}</h2>
        <p className="select-sub">{t("section.chooseTest")}</p>
      </div>

      <div className="tests-grid">
        {items.map((test) => (
          <button key={test.key} className={`tile ${picked === test.key ? "sel" : ""}`}
            onClick={() => { Sound.select(); setPicked(test.key); }}>
            <span className="tile-icon"><TileIcon size={22} aria-hidden="true" /></span>
            <span className="tile-body">
              <span className="tile-title">{test.tileTitle}</span>
            </span>
            <span className="tile-check"><Check size={13} aria-hidden="true" /></span>
          </button>
        ))}
      </div>

      <div className="select-action-panel">
        <div className="select-action-row">
          <div className="timer-toggle-group">
            <span className="timer-toggle-caption">{t("section.timer")}</span>
            <button
              type="button"
              className={`timer-toggle timer-toggle-compact ${timed ? "on" : ""}`}
              onClick={() => { Sound.tap(); setTimed((v) => !v); }}
              aria-pressed={timed}
              aria-label={t("section.timedAriaLabel", { minutes: timerMinutes })}
              title={t("section.timedTitle", { minutes: timerMinutes })}
            >
              <span className="timer-toggle-switch" aria-hidden="true">
                <span className="timer-toggle-knob" />
              </span>
              <span className="timer-toggle-onoff" aria-hidden="true">{timed ? t("section.on") : t("section.off")}</span>
            </button>
          </div>

          <button className="btn-primary select-start-btn" disabled={!picked} onClick={start}>{t("section.startTest")}</button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
