import { Header, Footer, MainLogo } from "./Home.jsx";
import { diagnose, weakestCategory } from "../lib/scoring.js";
import { t } from "../i18n/index.js";

const TIER_FEEDBACK_KEY = { good: "report.tierGood", mid: "report.tierMid", low: "report.tierLow" };

export default function PerformanceReport({ res, dark, onToggleDark, soundOn, onToggleSound, onHome, onBack }) {
  const rows = diagnose(res.rows, (q) => q.generalCategory);
  const weakest = weakestCategory(rows);

  return (
    <div className="screen report screen-enter">
      <Header showBack onBack={onBack} showHome onHome={onHome} dark={dark} onToggleDark={onToggleDark} soundOn={soundOn} onToggleSound={onToggleSound} />
      <MainLogo dark={dark} />
      <div className="report-head">
        <h2>{t("report.title")}</h2>
        {weakest && <p className="report-weakest">{t("report.weakestArea")}<b>{weakest.label}</b></p>}
      </div>
      <div className="scroll-area report-scroll">
        <div className="report-cards">
          {rows.map((r) => <ReportCard key={r.key} r={r} />)}
        </div>
        {rows.length === 0 && <div className="review-empty">{t("report.empty")}</div>}
      </div>
      <Footer />
    </div>
  );
}

function ReportCard({ r }) {
  return (
    <article className={`perf-card ${r.tier}`}>
      <div className="perf-top">
        <span className="perf-pct">{r.pct}%</span>
        <h4>{r.label}</h4>
      </div>
      <div className="perf-bar"><i style={{ width: `${r.pct}%` }} /></div>
      <p>{t(TIER_FEEDBACK_KEY[r.tier])}</p>
      <div className="perf-stats">
        <span><b>{r.correct}</b> {t("report.correct")}</span>
        <span><b>{r.incorrect}</b> {t("report.incorrect")}</span>
        <span><b>{r.unanswered}</b> {t("report.emptyStat")}</span>
      </div>
    </article>
  );
}
