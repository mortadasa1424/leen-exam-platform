import { useState } from "react";
import { Header, Footer, MainLogo } from "./Home.jsx";
import { Sound } from "../lib/sound.js";
import activeExam from "../exams/active.js";
import { t } from "../i18n/index.js";

function normalizeDigits(s) {
  const map = { "٠":"0","١":"1","٢":"2","٣":"3","٤":"4","٥":"5","٦":"6","٧":"7","٨":"8","٩":"9","۰":"0","۱":"1","۲":"2","۳":"3","۴":"4","۵":"5","۶":"6","۷":"7","۸":"8","۹":"9" };
  return String(s).replace(/[٠-٩۰-۹]/g, (d) => map[d]).replace(/\D/g, "");
}
function hasTooManyRepeatedDigits(s) {
  return /(\d)\1{4,}/.test(s);
}
function localFromDisplay(display, countryCode) {
  const codeDigits = normalizeDigits(countryCode);
  let digits = normalizeDigits(display);
  if (digits.startsWith(codeDigits)) digits = digits.slice(codeDigits.length);
  return digits;
}

export default function LeadForm({ dark, onToggleDark, soundOn, onToggleSound, onComplete, onHome }) {
  const { countries: COUNTRIES, gradeLevels: GRADE_LEVELS, webhookGlobalVar } = activeExam.config.leadCapture;
  const [name, setName] = useState("");
  const [country, setCountry] = useState(COUNTRIES[0]);
  const [phone, setPhone] = useState("");
  const [gradeLevel, setGradeLevel] = useState("");
  const [showCountryMenu, setShowCountryMenu] = useState(false);
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);

  const validate = () => {
    const p = normalizeDigits(phone);
    if (!p) return t("lead.errPhoneRequired");
    if (hasTooManyRepeatedDigits(p)) return t("lead.errPhoneInvalid");
    if (!gradeLevel) return t("lead.errGradeRequired");
    return "";
  };

  const submit = async () => {
    const e = validate();
    if (e) { setErr(e); Sound.warn(); return; }
    setErr(""); setSending(true); Sound.tap();
    const url = window[webhookGlobalVar];
    // Form-encoded + no-cors (kept intentionally, not yet reverted): this is a
    // CORS-safelisted simple request, so it reaches Apps Script's doPost with
    // no preflight. mode:"no-cors" makes the response opaque — status/body are
    // unreadable — so success is NOT verified here. Once the write path to the
    // sheet is confirmed working end-to-end, this must be replaced with a
    // verifiable path before onComplete() can be trusted to mean "saved".
    const body = new URLSearchParams({
      name: name.trim() || "",
      phone: country.code + normalizeDigits(phone),
      grade_level: gradeLevel,
      submission_date: new Date().toISOString(),
    });
    try {
      if (!url) throw new Error("missing webhook url");
      await fetch(url, { method: "POST", body, mode: "no-cors" });
      Sound.start();
      onComplete();
    } catch {
      setErr(t("lead.errSubmitFailed"));
      setSending(false);
    }
  };

  return (
    <div className="screen lead screen-enter">
      <Header showHome onHome={onHome} dark={dark} onToggleDark={onToggleDark} soundOn={soundOn} onToggleSound={onToggleSound} />
      <MainLogo dark={dark} />
      <div className="scroll-area">
        <div className="lead-card clean-lead-card">
          <label className="lead-field"><span>{t("lead.nameLabel")}</span>
            <input className="lead-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("lead.namePlaceholder")} /></label>

          <label className="lead-field"><span>{t("lead.phoneLabel")}</span>
            <div className="lead-phone flag-phone" dir="ltr">
              <div className="country-picker-wrap">
                <button type="button" className="country-picker-btn" aria-label={t("lead.selectCountry")} onClick={() => setShowCountryMenu((v) => !v)}>
                  <img className="country-flag-img" src={country.flagSrc} alt="" />
                  <span className="country-caret">▾</span>
                </button>
                {showCountryMenu && (
                  <div className="country-menu" role="listbox" aria-label={t("lead.countriesAriaLabel")}>
                    {COUNTRIES.map((c) => (
                      <button
                        key={c.iso}
                        type="button"
                        className={`country-item ${country.iso === c.iso ? "active" : ""}`}
                        onClick={() => {
                          setCountry(c);
                          setPhone((prev) => localFromDisplay(`${c.code}${prev}`, c.code));
                          setShowCountryMenu(false);
                        }}
                      >
                        <img className="country-flag-img" src={c.flagSrc} alt="" />
                        <span className="country-name">{c.label}</span>
                        <span className="country-code">{c.code}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <input
                className="lead-input phone-full-input"
                value={`${country.code}${phone}`}
                onChange={(e) => setPhone(localFromDisplay(e.target.value, country.code))}
                inputMode="tel"
                dir="ltr"
                placeholder={`${country.code}555579299`}
              />
            </div>
          </label>

          <label className="lead-field"><span>{t("lead.gradeLevelLabel")}</span>
            <div className="lead-chips" role="radiogroup" aria-label={t("lead.gradeLevelLabel")}>
              {GRADE_LEVELS.map((g) => (
                <button key={g} className={gradeLevel === g ? "on" : ""} onClick={() => { Sound.select(); setGradeLevel(g); }} type="button" role="radio" aria-checked={gradeLevel === g}>{g}</button>
              ))}
            </div></label>

          {err && <div className="lead-error" role="alert">{err}</div>}
          <button className="btn-primary lead-submit" onClick={submit} disabled={sending}>{sending ? t("lead.sending") : t("lead.start")}</button>
        </div>
      </div>
      <Footer />
    </div>
  );
}
