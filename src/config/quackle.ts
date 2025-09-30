const ENV = (import.meta.env.VITE_QUACKLE_SERVICE_URL || "").trim();
const isDev = import.meta.env.DEV;

export const QUACKLE_SERVICE_URL = (() => {
  if (ENV) return ENV;
  if (!isDev) throw new Error("VITE_QUACKLE_SERVICE_URL is required in production");
  // Development: use Vite proxy to avoid CORS issues
  return "/quackle";
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
