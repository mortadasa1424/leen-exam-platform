// Web Audio cue engine — no audio files. Rich, soft, responsive cues.
let ctx = null;
let enabled = true;

function ac() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
  return ctx;
}
function tone(freq, t0, dur, { type = "sine", vol = 0.14, glideTo = null } = {}) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0); o.stop(t0 + dur);
}
export const Sound = {
  setEnabled(v) { enabled = v; },
  get enabled() { return enabled; },
  unlock() { ac(); },
  tap() { if (!enabled) return; const c = ac(); if (!c) return; tone(420, c.currentTime, 0.06, { type: "triangle", vol: 0.08 }); },
  select() { if (!enabled) return; const c = ac(); if (!c) return; tone(540, c.currentTime, 0.07, { type: "triangle", vol: 0.11 }); },
  warn() { if (!enabled) return; const c = ac(); if (!c) return; const t = c.currentTime; tone(330, t, 0.1, { type: "triangle", vol: 0.1 }); tone(330, t + 0.16, 0.1, { type: "triangle", vol: 0.1 }); },
  swoosh() { if (!enabled) return; const c = ac(); if (!c) return; tone(300, c.currentTime, 0.18, { type: "sine", vol: 0.06, glideTo: 760 }); },
  complete(pct = 100) { if (!enabled) return; const c = ac(); if (!c) return; const t = c.currentTime; const notes = pct >= 50 ? [523, 659, 784, 1047] : [523, 587, 659]; notes.forEach((f, i) => tone(f, t + i * 0.1, 0.32, { type: "triangle", vol: 0.15 })); },
  start() { if (!enabled) return; const c = ac(); if (!c) return; const t = c.currentTime; tone(523, t, 0.12, { type: "sine", vol: 0.12 }); tone(784, t + 0.1, 0.18, { type: "sine", vol: 0.12 }); },
};
