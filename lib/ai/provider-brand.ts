/**
 * Centralized provider/model brand metadata.
 *
 * Single source of truth for provider detection from a model-ID prefix,
 * friendly display names, free/paid detection, and logo mapping. All logos
 * are local `/logos/*` assets (never hotlinked CDNs); unknown providers
 * resolve to a brand with no icon so callers can render a generic AI icon
 * without crashing. Safe to import on client and server.
 */

import { getProvider, MONO_LOGO_PROVIDERS } from './providers';

export interface ProviderBrand {
  /** Canonical brand key (provider id or OpenRouter vendor prefix). */
  id: string;
  /** Human-readable provider/vendor name. */
  name: string;
  /** Local logo asset path; undefined → caller renders a generic AI icon. */
  icon?: string;
  /** Monochrome-dark logo that needs `dark:invert` in dark mode. */
  mono?: boolean;
}

/**
 * Brand lookup for OpenRouter-style `vendor/model` prefixes that are not
 * themselves provider ids (e.g. `meta-llama`, `x-ai`). Vendors without a
 * local logo asset deliberately omit `icon` — the generic fallback applies.
 */
const VENDOR_PREFIX_BRANDS: Record<string, { name: string; icon?: string; mono?: boolean }> = {
  openai: { name: 'OpenAI', icon: '/logos/openai.svg', mono: true },
  anthropic: { name: 'Anthropic', icon: '/logos/claude.svg' },
  google: { name: 'Google', icon: '/logos/gemini.svg' },
  deepseek: { name: 'DeepSeek', icon: '/logos/deepseek.svg' },
  'deepseek-ai': { name: 'DeepSeek', icon: '/logos/deepseek.svg' },
  qwen: { name: 'Qwen', icon: '/logos/qwen.svg' },
  alibaba: { name: 'Alibaba', icon: '/logos/bailian.svg' },
  moonshotai: { name: 'Moonshot AI', icon: '/logos/kimi.png' },
  'x-ai': { name: 'xAI', icon: '/logos/grok.svg' },
  'zai-org': { name: 'Z.ai', icon: '/logos/glm.svg' },
  thudm: { name: 'Z.ai', icon: '/logos/glm.svg' },
  bytedance: { name: 'ByteDance', icon: '/logos/doubao.svg' },
  tencent: { name: 'Tencent', icon: '/logos/hunyuan.svg' },
  xiaomi: { name: 'Xiaomi', icon: '/logos/xiaomi.svg' },
  amazon: { name: 'Amazon', icon: '/logos/bedrock.svg' },
  openrouter: { name: 'OpenRouter', icon: '/logos/openrouter.svg', mono: true },
  siliconflow: { name: 'SiliconFlow', icon: '/logos/siliconflow.svg' },
  minimax: { name: 'MiniMax', icon: '/logos/minimax.svg' },
  ollama: { name: 'Ollama', icon: '/logos/ollama.svg', mono: true },
  'meta-llama': { name: 'Meta Llama' },
  mistralai: { name: 'Mistral AI' },
  nousresearch: { name: 'Nous Research' },
  microsoft: { name: 'Microsoft' },
  cohere: { name: 'Cohere' },
  perplexity: { name: 'Perplexity' },
  nvidia: { name: 'NVIDIA' },
};

/** Well-known model-name tokens rendered with fixed casing. */
const MODEL_NAME_TOKENS: Record<string, string> = {
  gpt: 'GPT',
  chatgpt: 'ChatGPT',
  claude: 'Claude',
  gemini: 'Gemini',
  llama: 'Llama',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  qwq: 'QwQ',
  mistral: 'Mistral',
  mixtral: 'Mixtral',
  codestral: 'Codestral',
  grok: 'Grok',
  kimi: 'Kimi',
  glm: 'GLM',
  chatglm: 'ChatGLM',
  minimax: 'MiniMax',
  nova: 'Nova',
  o1: 'o1',
  o3: 'o3',
  o4: 'o4',
  r1: 'R1',
  v3: 'V3',
  vl: 'VL',
  it: 'IT',
  gguf: 'GGUF',
};

function prettifyToken(token: string): string {
  const mapped = MODEL_NAME_TOKENS[token.toLowerCase()];
  if (mapped) return mapped;
  if (/^[a-z]+$/.test(token)) return token[0].toUpperCase() + token.slice(1);
  if (/^[A-Z0-9]+$/.test(token)) return token;
  return token;
}

function prettifyIdentifier(id: string): string {
  return id
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map(prettifyToken)
    .join(' ');
}

/**
 * Detect the provider/vendor prefix of a model ID. OpenRouter-style IDs are
 * `vendor/model` (e.g. `anthropic/claude-sonnet-4` → `anthropic`); IDs without
 * a prefix return undefined (the connection's provider id applies instead).
 */
export function getModelProvider(modelId: string): string | undefined {
  const trimmed = modelId.trim();
  const slash = trimmed.indexOf('/');
  if (slash <= 0) return undefined;
  return trimmed.slice(0, slash).toLowerCase();
}

/**
 * Friendly display name for a model ID: strips the vendor prefix and the
 * `:free` suffix, then prettifies tokens (`openai/gpt-5.4-mini:free` →
 * `GPT 5.4 Mini`). Used as a fallback when no catalog `ModelInfo.name` exists,
 * so the UI never shows only a raw model ID.
 */
export function getModelDisplayName(modelId: string): string {
  const trimmed = modelId.trim();
  if (!trimmed) return 'Select model';
  const segment = trimmed.includes('/') ? trimmed.slice(trimmed.lastIndexOf('/') + 1) : trimmed;
  const core = segment.replace(/:free$/i, '');
  const pretty = prettifyIdentifier(core);
  return pretty || trimmed;
}

/**
 * Free-model detection for display purposes: OpenRouter free tiers end in
 * `:free`, and the free auto-router IDs end in `/free` (`openrouter/free`,
 * `router/free`). Pattern-based only — a paid model never carries these
 * suffixes on OpenRouter, so this cannot misclassify.
 */
export function isFreeModel(modelId: string): boolean {
  return /(:free|\/free)$/i.test(modelId.trim());
}

/**
 * Brand for a connection-level provider id (`openai`, `openrouter`, …).
 * Built-ins resolve through the provider registry (name + local icon);
 * unknown/custom ids get a prettified name and no icon (generic fallback).
 */
export function getProviderBrand(providerId: string): ProviderBrand {
  const registered = getProvider(providerId as Parameters<typeof getProvider>[0]);
  if (registered) {
    return {
      id: providerId,
      name: registered.name,
      icon: registered.icon,
      mono: MONO_LOGO_PROVIDERS.has(providerId),
    };
  }
  const vendor = VENDOR_PREFIX_BRANDS[providerId.trim().toLowerCase()];
  if (vendor) {
    return { id: providerId, name: vendor.name, icon: vendor.icon, mono: vendor.mono };
  }
  return { id: providerId, name: prettifyIdentifier(providerId) };
}

/**
 * Brand for a specific model under a provider: OpenRouter-style `vendor/model`
 * IDs resolve to the vendor's brand (logo follows the model, not the gateway);
 * anything else falls back to the provider brand.
 */
export function getModelBrand(providerId: string, modelId: string): ProviderBrand {
  const vendorId = getModelProvider(modelId);
  if (vendorId) {
    const vendor = VENDOR_PREFIX_BRANDS[vendorId];
    if (vendor) return { id: vendorId, name: vendor.name, icon: vendor.icon, mono: vendor.mono };
  }
  return getProviderBrand(providerId);
}
