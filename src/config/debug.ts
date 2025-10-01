// Centralized debug flag for Quackle-related logs
// Enable via VITE_DEBUG_QUACKLE=true; default is OFF even in tests to avoid noisy output
export const isDebugQuackle: boolean = String((import.meta as any)?.env?.VITE_DEBUG_QUACKLE || '').toLowerCase() === 'true'

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
