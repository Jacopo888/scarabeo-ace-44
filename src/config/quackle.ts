const ENV = (import.meta.env.VITE_QUACKLE_SERVICE_URL || "").trim();
const host = typeof window !== "undefined" ? window.location.hostname : "";
const isLocal = /^localhost$|^127\.0\.0\.1$/.test(host);
export const QUACKLE_SERVICE_URL =
  ENV || (isLocal ? "http://localhost:5000" : "https://service-quackle-production.up.railway.app");

// Log once for diagnostics
// eslint-disable-next-line no-console
console.info("[Quackle] base URL =", QUACKLE_SERVICE_URL);

export function quackleApi(path: string) {
  const base = QUACKLE_SERVICE_URL.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export default QUACKLE_SERVICE_URL;
