import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ providers: vi.fn(), baseUrl: vi.fn(), catalog: vi.fn() }));
vi.mock('@/lib/server/provider-config', () => ({
  getServerProviders: mocks.providers,
  resolveBaseUrl: mocks.baseUrl,
  getServerTTSProviders: () => ({}),
  getServerASRProviders: () => ({}),
  getServerPDFProviders: () => ({}),
  getServerImageProviders: () => ({}),
  getServerVideoProviders: () => ({}),
  getServerWebSearchProviders: () => ({}),
  getParallelSceneConcurrency: () => 2,
}));
vi.mock('@/lib/server/openrouter-catalog', () => ({
  getOpenRouterCatalog: mocks.catalog,
  OPENROUTER_BASE_URL: 'https://openrouter.ai/api/v1',
}));
import { GET } from '@/app/api/server-providers/route';

describe('server provider catalog integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.providers.mockReturnValue({ openrouter: {} });
    mocks.baseUrl.mockReturnValue(undefined);
    mocks.catalog.mockResolvedValue([{ id: 'google/gemini', name: 'Gemini' }]);
  });
  it('adds discovery without converting the public list into a server allowlist', async () => {
    const body = await (await GET()).json();
    expect(body.providers).toEqual({ openrouter: {} });
    expect(body.openrouterModels).toEqual([{ id: 'google/gemini', name: 'Gemini' }]);
  });
  it('serves discovery for browser-configured OpenRouter without marking it server configured', async () => {
    mocks.providers.mockReturnValue({});
    const body = await (
      await GET(new Request('http://localhost/api/server-providers?catalog=openrouter'))
    ).json();
    expect(body.providers).toEqual({});
    expect(body.openrouterModels).toHaveLength(1);
  });
  it('does not fetch or expand an explicit allowlist', async () => {
    mocks.providers.mockReturnValue({ openrouter: { models: ['allowed'] } });
    const body = await (await GET()).json();
    expect(body.providers.openrouter.models).toEqual(['allowed']);
    expect(mocks.catalog).not.toHaveBeenCalled();
  });
  it('does not fetch the public list for an operator-configured gateway', async () => {
    mocks.baseUrl.mockReturnValue('https://gateway.example/v1');
    await GET();
    expect(mocks.catalog).not.toHaveBeenCalled();
  });
});
