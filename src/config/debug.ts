// Centralized debug flag for Quackle-related logs
// Goal: show clean debug info also for normal users unless explicitly disabled.
// Behavior:
// - If VITE_DEBUG_QUACKLE is set: 'true' enables, 'false' disables
// - If not set: default to true in browser to aid users; tests can set it to false to keep output quiet
const RAW_DEBUG = String((import.meta as any)?.env?.VITE_DEBUG_QUACKLE ?? '').toLowerCase()
const DEFAULT_ON = true
export const isDebugQuackle: boolean = RAW_DEBUG === 'true' ? true : RAW_DEBUG === 'false' ? false : DEFAULT_ON
export const DEBUG_USER_MODE = isDebugQuackle

export function qlog(...args: any[]) {
  if (isDebugQuackle) {
    try { console.log(...args) } catch {}
  }
}

export function qerror(...args: any[]) {
  if (isDebugQuackle) {
    try { console.error(...args) } catch {}
  }
}
