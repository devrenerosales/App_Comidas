import '@testing-library/jest-dom/vitest';

// jsdom no implementa matchMedia; Ionic lo usa para el modo y el tema oscuro.
window.matchMedia =
  window.matchMedia ||
  ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }));
