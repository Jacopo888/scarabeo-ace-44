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
