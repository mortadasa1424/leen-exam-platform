import { createPortal } from "react-dom";
import { useLayoutEffect, useRef } from "react";
import { Sound } from "../lib/sound.js";
import activeExam from "../exams/active.js";
import { t } from "../i18n/index.js";
import { X } from "./icons.jsx";

// Video-only promo popup: the card is nothing but the active exam's promo video.
// Clicking anywhere on it opens the course link; the circular X only closes
// the popup. The card has no fixed aspect-ratio of its own — it shrink-wraps
// whatever the <video> renders at (see .ad-pop-card.open-ad/.finish-ad in
// app.css), so the box always matches the video's real proportions instead
// of forcing the video into a preset shape.
//
// Rendered via a portal straight onto document.body (not inside .app-root)
// so its position:fixed overlay is always anchored to the true viewport,
// completely independent of any current or future ancestor CSS (a
// transform/filter/perspective/contain anywhere between here and <body>
// would otherwise re-anchor position:fixed descendants to that ancestor
// instead of the viewport) and of app-root's own stacking context.
export default function PopupAd({ variant = "open", onClose }) {
  const { courseUrl, promoVideo, copy } = activeExam.config.marketing;
  const videoRef = useRef(null);

  // Cross-browser muted autoplay: PopupAd fully (re)mounts every time the
  // popup opens (App.jsx conditionally renders it), so this effect's own
  // mount is exactly "whenever the popup becomes visible" — no extra
  // open/close state needed here. useLayoutEffect (not useEffect) so
  // .muted/.defaultMuted are forced on the element before the browser gets
  // a chance to paint/evaluate autoplay, closing the one real cross-engine
  // gap: the muted="" JSX attribute alone is reliable on a fresh mount in
  // every browser we target, but forcing the DOM property directly removes
  // any doubt rather than trusting each engine's attribute-to-property sync.
  useLayoutEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    v.muted = true;
    v.defaultMuted = true;

    // Retry at most once, only if the first attempt is actually rejected
    // (not "sometimes retry forever") — typically because the element
    // wasn't far enough along (no metadata yet) for that specific engine
    // to honor play() synchronously. Whichever readiness event fires
    // first retries; the flag stops the other one from firing a second
    // attempt. No console output either way — a rejected autoplay is an
    // expected, silent outcome, not an error.
    let retried = false;
    const retryOnce = () => {
      if (retried) return;
      retried = true;
      v.play().catch(() => {});
    };
    const tryPlay = () => {
      v.play()?.catch(() => {
        v.addEventListener("loadedmetadata", retryOnce, { once: true });
        v.addEventListener("canplay", retryOnce, { once: true });
      });
    };
    tryPlay();

    // Plays once (no loop) and stays frozen on its last frame rather than
    // resetting to the first — a few engines can briefly blank/reset the
    // displayed frame right at the exact duration timestamp when playback
    // ends, so nudge back a fraction of a frame to pin on the last real
    // rendered frame instead of that edge. currentTime is never set to 0
    // here — only ever backward from the end. Reopening the popup already
    // starts from the beginning on its own, since PopupAd (and this
    // <video>) fully remounts fresh each time the popup opens.
    const holdLastFrame = () => {
      v.pause();
      if (Number.isFinite(v.duration)) v.currentTime = Math.max(0, v.duration - 0.033);
    };
    v.addEventListener("ended", holdLastFrame);

    return () => {
      v.removeEventListener("loadedmetadata", retryOnce);
      v.removeEventListener("canplay", retryOnce);
      v.removeEventListener("ended", holdLastFrame);
    };
  }, []);

  const closeAd = () => { Sound.tap(); onClose?.(); };
  const openCourse = () => {
    Sound.tap();
    const opened = window.open(courseUrl, "_blank", "noopener,noreferrer");
    if (opened) opened.opener = null;
    onClose?.();
  };

  return createPortal(
    <div className="ad-pop-overlay" role="dialog" aria-modal="true" aria-label={t("popup.advertisement")}>
      <div className={`ad-pop-card ${variant === "finish" ? "finish-ad" : "open-ad"}`}>
        <button className="ad-pop-close" type="button" aria-label={t("popup.closeAd")} onClick={closeAd}>
          <X size={15} aria-hidden="true" />
        </button>

        <button className="ad-pop-media ad-pop-video-btn" type="button" aria-label={copy.popupAriaLabel} onClick={openCourse}>
          <video
            ref={videoRef}
            className="ad-pop-video"
            src={promoVideo}
            autoPlay
            muted
            defaultMuted
            playsInline
            webkit-playsinline="true"
            disablePictureInPicture
            preload="auto"
          />
        </button>
      </div>
    </div>,
    document.body
  );
}
