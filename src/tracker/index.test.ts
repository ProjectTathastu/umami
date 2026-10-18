import { afterEach, expect, test, vi } from 'vitest';

const localStorageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');

afterEach(() => {
  delete (window as Window & { umami?: unknown }).umami;
  delete (document as Document & { currentScript?: HTMLScriptElement }).currentScript;
  delete (document as Document & { readyState?: DocumentReadyState }).readyState;
  if (localStorageDescriptor) {
    Object.defineProperty(window, 'localStorage', localStorageDescriptor);
  } else {
    delete (window as Window & { localStorage?: Storage }).localStorage;
  }
  vi.unstubAllGlobals();
  vi.resetModules();
});

const setCurrentScript = (distinctId?: string) => {
  const script = document.createElement('script');
  script.src = 'https://analytics.example.com/script.js';
  script.dataset.websiteId = 'website-id';
  if (distinctId) script.dataset.distinctId = distinctId;

  Object.defineProperties(document, {
    currentScript: { configurable: true, value: script },
    readyState: { configurable: true, value: 'complete' },
  });
};

const setLocalStorage = (getItem: Storage['getItem']) => {
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: { getItem } as Storage,
  });
};

test('identifies data-distinct-id before the initial page view', async () => {
  setCurrentScript('visitor-id');
  setLocalStorage(vi.fn().mockReturnValue(null));

  const fetchMock = vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue({}) });
  vi.stubGlobal('fetch', fetchMock);

  await import('./index');

  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const requests = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));

  expect(requests[0]).toMatchObject({
    type: 'identify',
    payload: { id: 'visitor-id', website: 'website-id' },
  });
  expect(requests[1]).toMatchObject({
    type: 'event',
    payload: { id: 'visitor-id', website: 'website-id' },
  });
});

test('does not track when localStorage disables tracking', async () => {
  setCurrentScript();
  const getItem = vi.fn().mockReturnValue('1');
  setLocalStorage(getItem);

  const fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);

  await import('./index');

  expect(getItem).toHaveBeenCalledWith('umami.disabled');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('continues tracking when localStorage is unavailable', async () => {
  setCurrentScript('visitor-id');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() {
      throw new DOMException('Storage is unavailable', 'SecurityError');
    },
  });

  const fetchMock = vi.fn().mockResolvedValue({ json: vi.fn().mockResolvedValue({}) });
  vi.stubGlobal('fetch', fetchMock);

  await import('./index');

  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  const requests = fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body));

  expect(requests[0]).toMatchObject({
    type: 'identify',
    payload: { id: 'visitor-id', website: 'website-id' },
  });
  expect(requests[1]).toMatchObject({
    type: 'event',
    payload: { id: 'visitor-id', website: 'website-id' },
  });
});
