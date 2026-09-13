import { Component } from "react";
import { storageKey } from "../lib/storageKeys.js";
import { locale, t } from "../i18n/index.js";

// Last-resort safety net: if a render throws for any reason (e.g. a
// corrupted saved attempt slipping past the defensive checks in
// App.jsx/Quiz.jsx/questions.js), show a plain recoverable screen instead of
// leaving a blank white page with no way forward. Deliberately styled with
// inline styles, not app.css classes, so this fallback can never itself be
// broken by whatever caused the crash.
const ACTIVE_ATTEMPT_KEY = storageKey("active_attempt_v1");

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  // Plain reload/retry — never touches saved quiz progress. A generic
  // render error is not evidence the saved attempt itself is bad, so it
  // must not be destroyed just because something else broke.
  handleReload = () => {
    window.location.reload();
  };

  // Separate, explicit action for the one case a plain reload can't fix:
  // the stored attempt itself is corrupted. Only this button clears it.
  handleResetAttempt = () => {
    try { localStorage.removeItem(ACTIVE_ATTEMPT_KEY); } catch {}
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div
        dir={locale.direction}
        style={{
          position: "fixed", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16, padding: 24,
          textAlign: "center", background: "#100a2b", color: "#f4f3ff",
          fontFamily: "Inter, system-ui, sans-serif", zIndex: 99999,
        }}
      >
        <p style={{ fontSize: "1.1rem", fontWeight: 700, maxWidth: 360, margin: 0 }}>
          {t("error.message")}
        </p>
        <button
          type="button"
          onClick={this.handleReload}
          style={{
            padding: "12px 24px", borderRadius: 14, border: "1px solid rgba(186,163,255,.55)",
            background: "rgba(147,116,255,.30)", color: "#fff", fontWeight: 800,
            fontSize: "1rem", cursor: "pointer",
          }}
        >
          {t("error.reload")}
        </button>
        <button
          type="button"
          onClick={this.handleResetAttempt}
          style={{
            padding: "8px 16px", borderRadius: 12, border: "1px solid rgba(244,243,255,.25)",
            background: "transparent", color: "rgba(244,243,255,.65)", fontWeight: 700,
            fontSize: ".85rem", cursor: "pointer",
          }}
        >
          {t("error.resetAttempt")}
        </button>
      </div>
    );
  }
}
