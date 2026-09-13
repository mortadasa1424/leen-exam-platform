import { Sound } from "../lib/sound.js";
import { LOGO_LIGHT, LOGO_DARK } from "../config/brand.js";
import activeExam from "../exams/active.js";
import { locale, t } from "../i18n/index.js";
import { Home as HomeIcon, Sun, Moon, Volume2, VolumeX, ChevronRight, Calculator, SECTION_ICONS } from "./icons.jsx";

export function getLeenLogoSrc(dark) {
  if (typeof dark === "boolean") return dark ? LOGO_DARK : LOGO_LIGHT;
  if (typeof document !== "undefined") return document.body.classList.contains("light") ? LOGO_LIGHT : LOGO_DARK;
  return LOGO_DARK;
}

export default function Home({ onPickSection, dark, onToggleDark, soundOn, onToggleSound }) {
  const { sections } = activeExam.config;
  const { heroTitle, heroLede } = activeExam.config.branding;
  return (
    <div className="screen home screen-enter">
      <Header dark={dark} onToggleDark={onToggleDark} soundOn={soundOn} onToggleSound={onToggleSound} />

      <div className="home-entry">
        <div className="home-copy">
          <MainLogo dark={dark} />
          <h1 className="home-title">{heroTitle}</h1>
          <p className="home-lede">{heroLede}</p>
        </div>

        <div className="home-options" role="group" aria-label={t("home.chooseSection")}>
          {sections.map((section) => {
            const Icon = SECTION_ICONS[section.icon] || Calculator;
            return (
              <button key={section.id} className="entry-option" aria-label={section.ariaLabel}
                onClick={() => { Sound.tap(); onPickSection(section.id); }}>
                <span className="entry-option-icon"><Icon size={22} aria-hidden="true" /></span>
                <span className="entry-option-body">
                  <span className="entry-option-title">{section.name}</span>
                  <span className="entry-option-sub">{section.description}</span>
                </span>
                <ChevronRight className="entry-option-chevron" size={18} aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export function Header({ dark, onToggleDark, soundOn, onToggleSound, showHome = false, onHome, extraControls = null, showBack = false, onBack }) {
  return (
    <header className="appbar clean-appbar" dir={locale.direction}>
      <div className="appbar-icons-left">
        <button className="icon-btn" onClick={() => { Sound.tap(); onToggleDark?.(); }} aria-label={t("common.theme")}>
          {dark ? <Moon size={20} aria-hidden="true" /> : <Sun size={20} aria-hidden="true" />}
        </button>
        <button className="icon-btn" onClick={() => { Sound.tap(); onToggleSound?.(); }} aria-label={t("common.sound")}>
          {soundOn ? <Volume2 size={20} aria-hidden="true" /> : <VolumeX size={20} aria-hidden="true" />}
        </button>
        {extraControls}
        {showHome && (
          <button className="icon-btn home-icon-btn" onClick={() => { Sound.tap(); onHome?.(); }} aria-label={t("common.home")}>
            <HomeIcon size={20} aria-hidden="true" />
          </button>
        )}
      </div>
      {showBack && (
        <button className="icon-btn return-top" onClick={() => { Sound.tap(); onBack?.(); }} aria-label={t("common.back")}>
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      )}
    </header>
  );
}

export function MainLogo({ dark } = {}) {
  return (
    <div className="main-logo" aria-label="Leen">
      <img src={getLeenLogoSrc(dark)} alt="Leen" />
    </div>
  );
}

export function Footer() {
  const { courseUrl, footerBanner, copy } = activeExam.config.marketing;
  if (!footerBanner) return <CourseFooter />;
  return (
    <footer className="appfooter ad-footer" aria-label={copy.footerAriaLabel}>
      <a className="footer-ad-banner" href={courseUrl} target="_blank" rel="noopener noreferrer" aria-label={copy.footerBannerAriaLabel}>
        <img className="footer-ad-img" src={footerBanner} alt={copy.footerBannerAlt} loading="eager" decoding="async" draggable="false" />
      </a>
    </footer>
  );
}

export function CourseFooter() {
  const { courseUrl, copy } = activeExam.config.marketing;
  return (
    <footer className="appfooter clean-footer course-footer">
      <span>{copy.courseFooterText}</span>
      <a href={courseUrl} target="_blank" rel="noopener noreferrer">{t("common.here")}</a>
    </footer>
  );
}
