const ENV = (import.meta.env.VITE_QUACKLE_SERVICE_URL || "").trim();
const host = typeof window !== "undefined" ? window.location.hostname : "";
const isLocal = /^localhost$|^127\.0\.0\.1$/.test(host);
const isDev = import.meta.env.DEV;

export const QUACKLE_SERVICE_URL = (() => {
  if (ENV) return ENV;
  if (isLocal && isDev) {
    // Use proxy in development to avoid CORS issues
    return "/quackle";
  }
  return "https://service-quackle-production.up.railway.app";
})();

// Log once for diagnostics
// eslint-disable-next-line no-console
console.info("[Quackle] base URL =", QUACKLE_SERVICE_URL);

export function quackleApi(path: string) {
  const base = QUACKLE_SERVICE_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export default QUACKLE_SERVICE_URL;
