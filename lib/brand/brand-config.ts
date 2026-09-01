/**
 * Brand configuration.
 *
 * The reference (live deployment) resolves the brand per vendor from the
 * desktop shell's User-Agent token. This workspace has no vendor shell: the
 * Omitech Agent ships this fork as its integrated Learning Studio, so the
 * config is static and the desktop flag is always off. The shape is kept so
 * surfaces that read the brand share one source of truth.
 */

export interface BrandConfig {
  /** Full product name (page titles, logo alt text). */
  productName: string;
  /** Short name for space-constrained spots. */
  shortName: string;
  /** Horizontal logo asset under `public/`. */
  logoSrc: string;
  /** Whether `logoSrc` already carries the product wordmark. */
  logoHasWordmark: boolean;
  /** Square brand mark under `public/` (favicon, workspace header). */
  markSrc: string;
  /** Browser theme color (`<meta name="theme-color">` / PWA). */
  themeColor: string;
}

/** Omitech Agent's integrated Learning Studio brand. */
export const DEFAULT_BRAND: BrandConfig = {
  productName: 'Omitech Learning Studio',
  shortName: 'Learning Studio',
  logoSrc: '/omitech-learning-studio-logo.svg',
  logoHasWordmark: true,
  markSrc: '/omitech-agent-mark.svg',
  themeColor: '#d6336c',
};
