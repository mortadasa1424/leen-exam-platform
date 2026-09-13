import { useState } from "react";
import QuestionCard from "./QuestionCard.jsx";
import { Header, Footer, MainLogo } from "./Home.jsx";
import { Sound } from "../lib/sound.js";
import { t } from "../i18n/index.js";

export default function Review({ res, dark, onToggleDark, soundOn, onToggleSound, onHome, onBack }) {
  const [filter, setFilter] = useState("all");
  const rows = res.rows.filter((r) => filter === "all" ? true : filter === "wrong" ? r.status === "incorrect" : r.status === "unanswered");
  const filters = [["all", t("review.filterAll")], ["wrong", t("review.filterIncorrect")], ["empty", t("review.filterUnanswered")]];

  return (
    <div className="screen review screen-enter">
      <Header showBack onBack={onBack} showHome onHome={onHome} dark={dark} onToggleDark={onToggleDark} soundOn={soundOn} onToggleSound={onToggleSound} />
      <MainLogo dark={dark} />
      <div className="review-head">
        <h2>{t("review.title")}</h2>
        <div className="review-filters">
          {filters.map(([k, l]) => (
            <button key={k} className={filter === k ? "on" : ""} onClick={() => { Sound.tap(); setFilter(k); }}>{l}</button>
          ))}
        </div>
      </div>
      <div className="scroll-area">
        {rows.map((r) => (
          <div className="review-item" key={r.i}>
            <div className="review-ihead">
              <span className="review-num">{t("review.questionLabel", { n: r.i + 1 })}</span>
              <span className={`review-verdict ${r.status}`}>
                {r.status === "correct" ? t("review.correct") : r.status === "incorrect" ? t("review.incorrect") : t("review.unanswered")}
              </span>
            </div>
            <QuestionCard question={r.q} selected={r.selected} revealed={true} />
          </div>
        ))}
        {rows.length === 0 && <div className="review-empty">{t("review.empty")}</div>}
      </div>
      <Footer />
    </div>
  );
}
