import '@testing-library/jest-dom/vitest'
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

// Polyfill ResizeObserver for libraries/components relying on it (e.g., Recharts ResponsiveContainer, custom hooks)
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
