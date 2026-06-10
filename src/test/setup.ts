import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co')
vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'test-anon-key')

// Vitest global setup for jsdom quirks
// Polyfill window.matchMedia used by UI libs (e.g., sonner, shadcn)
if (typeof window !== 'undefined' && !window.matchMedia) {
  // @ts-ignore
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })
}

// Polyfill ResizeObserver for libraries/components relying on it (e.g., components that expect it)
if (typeof window !== 'undefined' && !(window as any).ResizeObserver) {
  class ResizeObserver {
    private callback: ResizeObserverCallback
    constructor(cb: ResizeObserverCallback) {
      this.callback = cb
    }
    observe() {
      // no-op
    }
    unobserve() {
      // no-op
    }
    disconnect() {
      // no-op
    }
  }
  // @ts-ignore
  ;(window as any).ResizeObserver = ResizeObserver
}
