/**
 * Brave Web Search integration.
 *
 * Uses the official Brave Search API with an explicitly configured API key.
 * Public-result-page scraping is intentionally not used: it is unreliable,
 * triggers bot challenges, and previously exposed raw CAPTCHA HTML to users.
 */

import { proxyFetch } from '@/lib/server/proxy-fetch';
import type { WebSearchResult, WebSearchSource } from '@/lib/types/web-search';
import { normalizeWebSearchQuery } from './utils';

function decodeHtml(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function stripHtml(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function isBraveOwnedUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host === 'brave.com' || host.endsWith('.brave.com');
  } catch {
    return true;
  }
}

export function parseBraveSearchHtml(html: string, maxResults: number): WebSearchSource[] {
  const results: WebSearchSource[] = [];
  const snippetRegex =
    /<div[^>]*class="[^"]*\bsnippet\b[^"]*"[^>]*data-type="web"[^>]*>([\s\S]*?)(?=<div[^>]*class="[^"]*\bsnippet\b[^"]*"[^>]*data-type="web"|<footer|$)/gi;

  let snippetMatch: RegExpExecArray | null;
  while ((snippetMatch = snippetRegex.exec(html)) !== null && results.length < maxResults) {
    const block = snippetMatch[1];
    const linkMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*>/i);
    if (!linkMatch) continue;

    const url = decodeHtml(linkMatch[1].trim());
    if (!url || isBraveOwnedUrl(url)) continue;

    // Brave moved the result title from `<span class="search-snippet-title">`
    // to `<div class="title search-snippet-title …">`, which made this parser
    // return zero results against the live page. Accept either element so we are
    // robust to that (and a future) swap; the title text is stripped of tags
    // regardless. The `\1` backreference ties the closing tag to the captured
    // opening tag, so a mismatched `<span …>…</div>` can't be picked up as a title.
    const titleMatch = block.match(
      /<(span|div)[^>]*class="[^"]*search-snippet-title[^"]*"[^>]*>([\s\S]*?)<\/\1>/i,
    );
    const title = titleMatch ? stripHtml(titleMatch[2]) : '';
    if (!title) continue;

    const genericMatch = block.match(
      /<div[^>]*class="[^"]*generic-snippet[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    );
    const descMatch = block.match(
      /<p[^>]*class="[^"]*snippet-description[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
    );
    const rawContent = genericMatch?.[1] || descMatch?.[1] || '';
    const content = stripHtml(rawContent)
      .replace(/^\d+ \w+ ago\s*-\s*/, '')
      .replace(/^[A-Z][a-z]+ \d+, \d{4}\s*-\s*/, '');

    results.push({
      title,
      url,
      content,
      score: Number((1 - results.length * 0.1).toFixed(2)),
    });
  }

  return results;
}

const BRAVE_API_BASE_URL = 'https://api.search.brave.com';

/**
 * Use the official Brave Search API (requires API key).
 * Docs: https://api.search.brave.com/app/documentation/web-search
 */
async function searchWithBraveApi(
  query: string,
  apiKey: string,
  maxResults: number,
  signal?: AbortSignal,
): Promise<WebSearchSource[]> {
  const url = new URL('/res/v1/web/search', BRAVE_API_BASE_URL);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(Math.min(maxResults, 20)));

  const res = await proxyFetch(url.toString(), {
    method: 'GET',
    headers: {
      'X-Subscription-Token': apiKey,
      Accept: 'application/json',
    },
    ...(signal ? { signal } : {}),
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => '');
    throw new Error(`Brave API error (${res.status}): ${errorText || res.statusText}`);
  }

  const data = (await res.json()) as {
    web?: {
      results?: Array<{
        title?: string;
        url?: string;
        description?: string;
      }>;
    };
  };

  return (data.web?.results || [])
    .filter((r) => r.url)
    .slice(0, maxResults)
    .map((r, i) => ({
      title: r.title || '',
      url: r.url || '',
      content: stripHtml(r.description || ''),
      score: Number((1 - i * 0.05).toFixed(2)),
    }));
}

export async function searchWithBrave(params: {
  query: string;
  apiKey?: string;
  maxResults?: number;
  baseUrl?: string;
  signal?: AbortSignal;
}): Promise<WebSearchResult> {
  const { query: rawQuery, apiKey, maxResults = 5, signal } = params;
  const query = normalizeWebSearchQuery(rawQuery);
  const startedAt = Date.now();

  if (!apiKey?.trim()) {
    throw new Error('Brave Search API key is not configured');
  }
  const sources = await searchWithBraveApi(query, apiKey, maxResults, signal);

  return {
    answer: '',
    sources,
    query,
    responseTime: (Date.now() - startedAt) / 1000,
  };
}
