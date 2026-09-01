import { describe, expect, it } from 'vitest';
import { DEFAULT_BRAND } from '@/lib/brand/brand-config';

describe('DEFAULT_BRAND (single-brand build)', () => {
  it('uses the Omitech Learning Studio identity for full chrome', () => {
    expect(DEFAULT_BRAND.productName).toBe('Omitech Learning Studio');
    expect(DEFAULT_BRAND.shortName).toBe('Learning Studio');
    expect(DEFAULT_BRAND.markSrc).toBe('/omitech-agent-mark.svg');
    expect(DEFAULT_BRAND.themeColor).toBe('#d6336c');
  });

  it('marks its horizontal logo as already containing the wordmark', () => {
    expect(DEFAULT_BRAND.logoHasWordmark).toBe(true);
    expect(DEFAULT_BRAND.logoSrc).toBe('/omitech-learning-studio-logo.svg');
  });
});
