// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  BROWSER_SEARCH_ENGINE_STORAGE_KEY,
  buildBrowserSearchUrl,
  getPreferredBrowserSearchEngine,
  openBrowserSearch,
  setPreferredBrowserSearchEngine,
} from '@/lib/web-search/browser-search';

describe('browser search', () => {
  beforeEach(() => window.localStorage.clear());

  it('uses Google by default and safely encodes the query', () => {
    expect(buildBrowserSearchUrl('ports & shipping')).toBe(
      'https://www.google.com/search?q=ports%20%26%20shipping',
    );
    expect(getPreferredBrowserSearchEngine()).toBe('google');
  });

  it('persists a supported browser search preference', () => {
    setPreferredBrowserSearchEngine('bing');
    expect(window.localStorage.getItem(BROWSER_SEARCH_ENGINE_STORAGE_KEY)).toBe('bing');
    expect(getPreferredBrowserSearchEngine()).toBe('bing');
  });

  it('opens the selected engine in the browser tab without an opener', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    openBrowserSearch('marine safety', 'duckduckgo');
    expect(open).toHaveBeenCalledWith(
      'https://duckduckgo.com/?q=marine%20safety',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
