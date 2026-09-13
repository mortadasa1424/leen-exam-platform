// Thin localStorage helpers — every call is wrapped so a blocked/unavailable
// storage (private browsing, disabled cookies) degrades to a no-op instead of
// throwing.
export function getStr(key, fallback = null) {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function setStr(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}
export function getJSON(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
export function setJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}
export function remove(key) {
  try { localStorage.removeItem(key); } catch {}
}

// sessionStorage variants — cleared when the browser/tab is closed, so a
// flag stored here re-triggers on every fresh visit instead of only once.
export function getSessionStr(key, fallback = null) {
  try { return sessionStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function setSessionStr(key, value) {
  try { sessionStorage.setItem(key, value); } catch {}
}
