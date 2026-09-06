import {
  getServerProviders,
  getServerTTSProviders,
  getServerASRProviders,
  getServerPDFProviders,
  getServerImageProviders,
  getServerVideoProviders,
  getServerWebSearchProviders,
  getParallelSceneConcurrency,
  resolveBaseUrl,
} from '@/lib/server/provider-config';
import { getOpenRouterCatalog, OPENROUTER_BASE_URL } from '@/lib/server/openrouter-catalog';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { createLogger } from '@/lib/logger';

const log = createLogger('ServerProviders');

export async function GET(request?: Request) {
  try {
    const providers = getServerProviders();
    const wantsCatalog =
      providers.openrouter ||
      (request && new URL(request.url).searchParams.get('catalog') === 'openrouter');
    const baseUrl = resolveBaseUrl('openrouter') || OPENROUTER_BASE_URL;
    const openrouterModels =
      wantsCatalog &&
      baseUrl.replace(/\/+$/, '') === OPENROUTER_BASE_URL &&
      !providers.openrouter?.models?.length
        ? await getOpenRouterCatalog()
        : undefined;
    return apiSuccess({
      providers,
      openrouterModels,
      tts: getServerTTSProviders(),
      asr: getServerASRProviders(),
      pdf: getServerPDFProviders(),
      image: getServerImageProviders(),
      video: getServerVideoProviders(),
      webSearch: getServerWebSearchProviders(),
      generation: {
        parallelSceneConcurrency: getParallelSceneConcurrency(),
      },
    });
  } catch (error) {
    log.error('Error fetching server providers:', error);
    return apiError(
      'INTERNAL_ERROR',
      500,
      error instanceof Error ? error.message : 'Unknown error',
    );
  }
}
