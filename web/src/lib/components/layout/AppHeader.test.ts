import { fireEvent, render } from '@testing-library/svelte';
import { readable } from 'svelte/store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppHeader from './AppHeader.svelte';

type PageStoreValue = { url: URL; data: { session: any } };

const pageValue: PageStoreValue = {
  url: new URL('http://localhost/'),
  data: { session: null },
};

const subscribers = new Set<(value: PageStoreValue) => void>();

vi.mock('$app/stores', () => {
  const page = {
    subscribe(run: (value: PageStoreValue) => void) {
      run(pageValue);
      subscribers.add(run);
      return () => subscribers.delete(run);
    },
  };

  return {
    page,
    navigating: readable(null),
    updated: readable(false),
    getStores: () => ({ page, navigating: readable(null), updated: readable(false) }),
  };
});

const gotoMock = vi.hoisted(() => vi.fn());
const invalidateAllMock = vi.hoisted(() => vi.fn());

vi.mock('$app/navigation', () => ({
  goto: gotoMock,
  invalidateAll: invalidateAllMock,
}));

const logoutMock = vi.hoisted(() => vi.fn());

vi.mock('$lib/api', () => ({
  api: {
    auth: {
      logout: logoutMock,
    },
  },
}));

const matchMediaMock = vi.hoisted(() =>
  vi.fn().mockImplementation(() => ({
    matches: false,
    media: '',
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
);

const originalMatchMedia = window.matchMedia;

const setPage = (path: string, session: any) => {
  pageValue.url = new URL(`http://localhost${path}`);
  pageValue.data = { session };
  subscribers.forEach((run) => run(pageValue));
};

describe('AppHeader', () => {
  beforeEach(() => {
    logoutMock.mockReset();
    gotoMock.mockReset();
    invalidateAllMock.mockReset();
    matchMediaMock.mockClear();
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: matchMediaMock,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    if (originalMatchMedia) {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: originalMatchMedia,
      });
    } else {
      Reflect.deleteProperty(window, 'matchMedia');
    }
  });

  it('renders admin navigation with active styling for the current route', () => {
    setPage('/admin/users', { user: { email: 'admin@example.com', role: 'admin' } });

    const { getAllByText } = render(AppHeader);

    const chemicalsLinks = getAllByText('Chemicals');
    const usersLinks = getAllByText('Users');

    expect(chemicalsLinks[0].className).toContain('text-content-secondary');
    expect(usersLinks.some((link) => /text-accent-strong|font-semibold/.test(link.className))).toBe(
      true
    );
  });

  it('hides admin links for non-admin users', () => {
    setPage('/', { user: { email: 'member@example.com', role: 'member' } });

    const { queryAllByText } = render(AppHeader);

    expect(queryAllByText('Chemicals')).toHaveLength(0);
    expect(queryAllByText('Users')).toHaveLength(0);
    expect(queryAllByText('Pool Setup').length).toBeGreaterThan(0);
  });

  it('logs out via the API and redirects to login', async () => {
    logoutMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    setPage('/pools', { user: { email: 'admin@example.com', role: 'admin' } });

    const { getByRole } = render(AppHeader);

    const button = getByRole('button', { name: /logout/i });
    await fireEvent.click(button);

    expect(logoutMock).toHaveBeenCalled();
    expect(invalidateAllMock).toHaveBeenCalled();
    expect(gotoMock).toHaveBeenCalledWith('/auth/login', { invalidateAll: true });
  });
});
