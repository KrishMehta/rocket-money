import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});

const alertMock = vi.fn();
const confirmMock = vi.fn(() => true);

beforeEach(() => {
  alertMock.mockClear();
  confirmMock.mockClear();
});

Object.defineProperty(window, 'alert', {
  value: alertMock,
  writable: true,
});

Object.defineProperty(window, 'confirm', {
  value: confirmMock,
  writable: true,
});

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (!('scrollTo' in window)) {
  window.scrollTo = vi.fn();
}

if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

if (!('ResizeObserver' in window)) {
  // @ts-expect-error jsdom global assignment
  window.ResizeObserver = ResizeObserverStub;
}
