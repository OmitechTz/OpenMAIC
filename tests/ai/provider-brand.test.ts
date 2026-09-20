import { describe, expect, it } from 'vitest';

import {
  getModelBrand,
  getModelDisplayName,
  getModelProvider,
  getProviderBrand,
  isFreeModel,
} from '@/lib/ai/provider-brand';

describe('provider-brand — centralized model/provider metadata', () => {
  it('detects the vendor prefix of OpenRouter-style model IDs', () => {
    expect(getModelProvider('openai/gpt-5')).toBe('openai');
    expect(getModelProvider('Anthropic/Claude-Sonnet-4')).toBe('anthropic');
    expect(getModelProvider('gpt-5.4-mini')).toBeUndefined();
    expect(getModelProvider('')).toBeUndefined();
  });

  it('derives friendly display names (never the raw model ID)', () => {
    expect(getModelDisplayName('openai/gpt-5.4-mini:free')).toBe('GPT 5.4 Mini');
    expect(getModelDisplayName('meta-llama/llama-3.3-70b-instruct')).toBe('Llama 3.3 70b Instruct');
    expect(getModelDisplayName('anthropic/claude-sonnet-4-6')).toBe('Claude Sonnet 4 6');
    expect(getModelDisplayName('deepseek-chat')).toBe('DeepSeek Chat');
  });

  it('detects free models only via the free suffix patterns', () => {
    expect(isFreeModel('meta-llama/llama-3.3:free')).toBe(true);
    expect(isFreeModel('openrouter/free')).toBe(true);
    expect(isFreeModel('router/free')).toBe(true);
    expect(isFreeModel('OpenAI/GPT-5:FREE')).toBe(true);
    expect(isFreeModel('openai/gpt-5')).toBe(false);
    expect(isFreeModel('freed/openai-gpt-5')).toBe(false);
  });

  it('resolves built-in provider brands with local logos', () => {
    expect(getProviderBrand('openai')).toMatchObject({
      name: 'OpenAI',
      icon: '/logos/openai.svg',
      mono: true,
    });
    expect(getProviderBrand('openrouter')).toMatchObject({
      name: 'OpenRouter',
      icon: '/logos/openrouter.svg',
    });
    expect(getProviderBrand('anthropic')).toMatchObject({
      name: 'Claude',
      icon: '/logos/claude.svg',
    });
  });

  it('falls back to a prettified name and no icon for unknown providers', () => {
    const brand = getProviderBrand('acme-ai');
    expect(brand.icon).toBeUndefined();
    expect(brand.name).toBe('Acme Ai');
  });

  it('resolves the model vendor brand for gateway providers', () => {
    expect(getModelBrand('openrouter', 'anthropic/claude-sonnet-4')).toMatchObject({
      name: 'Anthropic',
      icon: '/logos/claude.svg',
    });
    expect(getModelBrand('openrouter', 'x-ai/grok-4')).toMatchObject({
      name: 'xAI',
      icon: '/logos/grok.svg',
    });
    // Unknown vendor → provider brand fallback (OpenRouter logo, no crash).
    expect(getModelBrand('openrouter', 'unknownvendor/some-model')).toMatchObject({
      name: 'OpenRouter',
      icon: '/logos/openrouter.svg',
    });
    // Vendor without a local logo resolves a name but no icon (generic fallback).
    const llama = getModelBrand('openrouter', 'meta-llama/llama-3.3');
    expect(llama.name).toBe('Meta Llama');
    expect(llama.icon).toBeUndefined();
  });
});
