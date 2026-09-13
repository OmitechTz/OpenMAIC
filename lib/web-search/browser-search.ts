export type BrowserSearchEngineId = 'google' | 'bing' | 'duckduckgo';

export const BROWSER_SEARCH_ENGINES: Record<
  BrowserSearchEngineId,
  { name: string; searchUrl: string }
> = {
  google: { name: 'Google', searchUrl: 'https://www.google.com/search?q=' },
  bing: { name: 'Bing', searchUrl: 'https://www.bing.com/search?q=' },
  duckduckgo: { name: 'DuckDuckGo', searchUrl: 'https://duckduckgo.com/?q=' },
};

export const BROWSER_SEARCH_ENGINE_STORAGE_KEY = 'openmaic-browser-search-engine';

export function buildBrowserSearchUrl(
  query: string,
  engineId: BrowserSearchEngineId = 'google',
): string {
  const engine = BROWSER_SEARCH_ENGINES[engineId] ?? BROWSER_SEARCH_ENGINES.google;
  return `${engine.searchUrl}${encodeURIComponent(query.trim())}`;
}

export function getPreferredBrowserSearchEngine(): BrowserSearchEngineId {
  if (typeof window === 'undefined') return 'google';
  const stored = window.localStorage.getItem(BROWSER_SEARCH_ENGINE_STORAGE_KEY);
  return stored && stored in BROWSER_SEARCH_ENGINES
    ? (stored as BrowserSearchEngineId)
    : 'google';
}

export function setPreferredBrowserSearchEngine(engineId: BrowserSearchEngineId): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(BROWSER_SEARCH_ENGINE_STORAGE_KEY, engineId);
  }
}

export function openBrowserSearch(query: string, engineId: BrowserSearchEngineId): Window | null {
  if (typeof window === 'undefined' || !query.trim()) return null;
  return window.open(buildBrowserSearchUrl(query, engineId), '_blank', 'noopener,noreferrer');
}
