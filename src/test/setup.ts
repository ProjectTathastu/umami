import '@testing-library/jest-dom/vitest';
import { cleanup, configure } from '@testing-library/react';
import { afterEach, vi } from 'vitest';
import { resetTestNavigation } from './navigation';

configure({ testIdAttribute: 'data-test' });

const isStorage = (value: unknown): value is Storage => {
  if (!value || typeof value !== 'object') return false;

  const storage = value as Storage;
  return (
    typeof storage.length === 'number' &&
    typeof storage.getItem === 'function' &&
    typeof storage.key === 'function' &&
    typeof storage.setItem === 'function' &&
    typeof storage.removeItem === 'function' &&
    typeof storage.clear === 'function'
  );
};

const getStorage = (target: Window | typeof globalThis) => {
  try {
    const storage = target.localStorage;
    return isStorage(storage) ? storage : undefined;
  } catch {
    return undefined;
  }
};

const createStorage = (): Storage => {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: key => values.get(String(key)) ?? null,
    key: index => Array.from(values.keys())[index] ?? null,
    removeItem: key => values.delete(String(key)),
    setItem: (key, value) => values.set(String(key), String(value)),
  };
};

const testStorage = getStorage(window) ?? getStorage(globalThis) ?? createStorage();

if (!getStorage(window)) {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: testStorage });
}

if (!getStorage(globalThis)) {
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: testStorage });
}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(navigator, 'clipboard', {
  configurable: true,
  value: {
    readText: vi.fn(),
    writeText: vi.fn(),
  },
});

window.scrollTo = vi.fn();

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

class IntersectionObserver {
  readonly root = null;
  readonly rootMargin = '';
  readonly scrollMargin = '';
  readonly thresholds = [];

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

window.ResizeObserver = ResizeObserver;
window.IntersectionObserver = IntersectionObserver;

afterEach(() => {
  cleanup();
  resetTestNavigation();
  vi.restoreAllMocks();
  try {
    window.localStorage.clear();
  } catch {
    // Some tests intentionally make localStorage unavailable.
  }
});
