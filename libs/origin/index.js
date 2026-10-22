// Login origin badge: cosmetic only. Never use for permissions or routing.
export const ORIGIN_COOKIE = 'ss_origin';
export const ORIGINS = {
  drones: { src: '/brand/icon.svg', alt: 'SleepySquid Drones', w: 32, h: 32 },
  ai: { src: '/brand/origin/ai.svg', alt: 'SleepySquid AI', w: 32, h: 32 },
  site: { src: '/brand/origin/sleepysquid.png', alt: 'SleepySquid', w: 32, h: 32 },
};
export const DEFAULT_ORIGIN = ORIGINS.site;
export const normalizeOrigin = (v) => {
  const k = String(Array.isArray(v) ? v[0] : v || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(ORIGINS, k) ? k : null;
};
export function saveOrigin(v) {
  const k = normalizeOrigin(v);
  if (!k || typeof document === 'undefined') return null;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ORIGIN_COOKIE}=${k}; Max-Age=${30 * 24 * 3600}; Path=/; SameSite=Lax${secure}`;
  return k;
}
export function readOrigin() {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)ss_origin=([^;]*)/);
  return normalizeOrigin(m && decodeURIComponent(m[1]));
}
