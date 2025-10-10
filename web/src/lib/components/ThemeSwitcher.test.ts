import { fireEvent, render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ThemeSwitcher from './ThemeSwitcher.svelte';

type MatchMediaMock = {
  matches: boolean;
  media: string;
  onchange: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | null;
  addEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  removeEventListener: (type: string, listener: EventListenerOrEventListenerObject) => void;
  addListener: (listener: EventListenerOrEventListenerObject) => void;
  removeListener: (listener: EventListenerOrEventListenerObject) => void;
  dispatchEvent: (event: Event) => boolean;
};

function createMatchMedia(matches: boolean): MatchMediaMock {
  return {
    matches,
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

beforeEach(() => {
  document.body?.removeAttribute('data-theme');
  document.documentElement.classList.remove('dark');
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ThemeSwitcher', () => {
  it('sets the html data-theme before toggling dark mode on initial load', () => {
    vi.stubGlobal('matchMedia', () => createMatchMedia(false));

    render(ThemeSwitcher);

    expect(document.body?.getAttribute('data-theme')).toBe('h2own');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('toggles between light and dark themes while persisting the preference', async () => {
    localStorage.setItem('theme', 'light');
    vi.stubGlobal('matchMedia', () => createMatchMedia(false));

    const { getByRole } = render(ThemeSwitcher);

    const toggleButton = getByRole('button', { name: 'Activate dark theme' });
    expect(document.body?.getAttribute('data-theme')).toBe('h2own');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');

    await fireEvent.click(toggleButton);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem('theme')).toBe('dark');

    await fireEvent.click(toggleButton);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('theme')).toBe('light');
  });
});
