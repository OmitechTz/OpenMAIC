import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const entry = (id: string, output = ['text']) => ({
  id,
  name: id,
  architecture: { input_modalities: ['text', 'image'], output_modalities: output },
  supported_parameters: ['tools'],
  context_length: 128000,
  top_provider: { max_completion_tokens: 8192 },
});

describe('OpenRouter catalog discovery', () => {
  beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('discovers multiple families, filters non-text output, and sends no credentials', async () => {
    fetchMock.mockResolvedValue(
      Response.json({
        data: [
          entry('anthropic/claude'),
          entry('google/gemini'),
          entry('openai/gpt'),
          entry('deepseek/chat'),
          entry('image-only', ['image']),
          null,
          entry('openai/gpt'),
          { id: 3 },
        ],
      }),
    );
    const { getOpenRouterCatalog } = await import('@/lib/server/openrouter-catalog');
    const models = await getOpenRouterCatalog();
    expect(models.map((model) => model.id)).toEqual([
      'anthropic/claude',
      'deepseek/chat',
      'google/gemini',
      'openai/gpt',
    ]);
    expect(models[0]).toMatchObject({
      contextWindow: 128000,
      outputWindow: 8192,
      capabilities: { tools: true, vision: true },
    });
    expect(fetchMock.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/models');
    expect(fetchMock.mock.calls[0][1].headers).toBeUndefined();
    await getOpenRouterCatalog();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps a successful catalog across outages and backs off retries', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(Response.json({ data: [entry('google/gemini')] }));
    const { getOpenRouterCatalog } = await import('@/lib/server/openrouter-catalog');
    const models = await getOpenRouterCatalog();
    vi.advanceTimersByTime(3600001);
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await getOpenRouterCatalog()).toEqual(models);
    expect(await getOpenRouterCatalog()).toEqual(models);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns an empty optional catalog on a cold-start failure', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: 'unavailable' }, { status: 503 }));
    const { getOpenRouterCatalog } = await import('@/lib/server/openrouter-catalog');
    expect(await getOpenRouterCatalog()).toEqual([]);
  });
});
