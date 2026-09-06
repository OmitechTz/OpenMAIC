import type { ModelInfo } from '@/lib/types/provider';
import { fetchWithTimeout } from './fetch-with-timeout';

export const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
let cached: ModelInfo[] = [];
let retryAfter = 0;
let pending: Promise<ModelInfo[]> | undefined;

/** Public metadata only: never send a learner's prompt or API key. */
export function getOpenRouterCatalog(): Promise<ModelInfo[]> {
  if (Date.now() < retryAfter) return Promise.resolve(cached);
  if (pending) return pending;
  pending = (async () => {
    try {
      const response = await fetchWithTimeout(
        `${OPENROUTER_BASE_URL}/models`,
        { redirect: 'error' },
        5000,
      );
      if (!response.ok) throw new Error('Catalog unavailable');
      const body = await response.json();
      if (!Array.isArray(body.data)) throw new Error('Invalid catalog');
      const models: ModelInfo[] = [];
      const seen = new Set<string>();
      for (const entry of body.data) {
        if (
          !entry ||
          typeof entry.id !== 'string' ||
          !entry.id.trim() ||
          seen.has(entry.id) ||
          !Array.isArray(entry.architecture?.output_modalities) ||
          !entry.architecture.output_modalities.includes('text')
        )
          continue;
        seen.add(entry.id);
        models.push({
          id: entry.id,
          name: typeof entry.name === 'string' ? entry.name : entry.id,
          contextWindow: positiveNumber(entry.context_length),
          outputWindow: positiveNumber(entry.top_provider?.max_completion_tokens),
          capabilities: {
            tools:
              Array.isArray(entry.supported_parameters) &&
              entry.supported_parameters.includes('tools'),
            vision:
              Array.isArray(entry.architecture.input_modalities) &&
              entry.architecture.input_modalities.includes('image'),
          },
        });
      }
      if (!models.length) throw new Error('Empty catalog');
      cached = models.sort((a, b) => a.name.localeCompare(b.name));
      retryAfter = Date.now() + 60 * 60 * 1000;
    } catch {
      // Keep the last good catalog; the client retains its built-ins and custom
      // entries even on a cold-start outage. Avoid retrying on every page load.
      retryAfter = Date.now() + 60 * 1000;
    }
    return cached;
  })().finally(() => {
    pending = undefined;
  });
  return pending;
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined;
}
