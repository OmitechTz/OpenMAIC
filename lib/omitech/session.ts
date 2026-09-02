import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export const OMITECH_SESSION_COOKIE = 'omitech_learning_session';

const ISSUER = 'omitech-agent';
const AUDIENCE = 'omitech-learning-studio';
const MAX_TOKEN_LENGTH = 4096;

export interface OmitechIdentity {
  subject: string;
  ownerId: string;
  name: string;
  role: string;
  expiresAt: number;
}

interface TokenClaims extends Record<string, unknown> {
  iss: string;
  aud: string;
  sub: string;
  type: 'openmaic_launch' | 'omitech_session';
  name: string;
  role: string;
  iat: number;
  exp: number;
  jti: string;
}

function enabledValue(value: string | undefined): boolean {
  return value === '1' || value === 'true';
}

export function isOmitechIntegrationEnabled(): boolean {
  return enabledValue(process.env.OMITECH_INTEGRATION_ENABLED);
}

function configuredSecret(): string | undefined {
  const secret = process.env.OMITECH_SSO_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : undefined;
}

function encodeJson(value: object): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function decodeJson(segment: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(Buffer.from(segment, 'base64url').toString('utf8')) as unknown;
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

function signatureFor(input: string, secret: string): Buffer {
  return createHmac('sha256', secret).update(input).digest();
}

function signClaims(claims: TokenClaims, secret: string): string {
  const header = encodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = encodeJson(claims);
  const signingInput = `${header}.${payload}`;
  return `${signingInput}.${signatureFor(signingInput, secret).toString('base64url')}`;
}

function verifiedClaims(
  token: string,
  expectedType: TokenClaims['type'],
): TokenClaims | undefined {
  const secret = configuredSecret();
  if (!secret || !token || token.length > MAX_TOKEN_LENGTH) return undefined;
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  const [headerSegment, payloadSegment, signatureSegment] = parts as [string, string, string];
  const header = decodeJson(headerSegment);
  const payload = decodeJson(payloadSegment);
  if (header?.alg !== 'HS256' || header.typ !== 'JWT' || !payload) return undefined;

  let suppliedSignature: Buffer;
  try {
    suppliedSignature = Buffer.from(signatureSegment, 'base64url');
  } catch {
    return undefined;
  }
  const expectedSignature = signatureFor(`${headerSegment}.${payloadSegment}`, secret);
  if (
    suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(suppliedSignature, expectedSignature)
  ) {
    return undefined;
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    payload.iss !== ISSUER ||
    payload.aud !== AUDIENCE ||
    payload.type !== expectedType ||
    typeof payload.sub !== 'string' ||
    !/^[1-9][0-9]{0,18}$/.test(payload.sub) ||
    typeof payload.name !== 'string' ||
    !payload.name.trim() ||
    typeof payload.role !== 'string' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    typeof payload.jti !== 'string' ||
    payload.iat > now + 60 ||
    payload.exp <= now
  ) {
    return undefined;
  }
  return payload as TokenClaims;
}

function identityFromClaims(claims: TokenClaims): OmitechIdentity {
  return {
    subject: claims.sub,
    ownerId: `omitech:${claims.sub}`,
    name: claims.name.trim(),
    role: claims.role,
    expiresAt: claims.exp,
  };
}

export function verifyOmitechLaunchToken(token: string): OmitechIdentity | undefined {
  const claims = verifiedClaims(token, 'openmaic_launch');
  return claims ? identityFromClaims(claims) : undefined;
}

function sessionTtlSeconds(): number {
  const configured = Number.parseInt(process.env.OMITECH_SESSION_TTL_SECONDS ?? '', 10);
  if (!Number.isFinite(configured)) return 3600;
  return Math.max(300, Math.min(configured, 8 * 60 * 60));
}

export function createOmitechSessionToken(identity: OmitechIdentity): {
  token: string;
  maxAge: number;
} {
  const secret = configuredSecret();
  if (!secret) throw new Error('OMITECH_SSO_SECRET must contain at least 32 characters');
  const now = Math.floor(Date.now() / 1000);
  const maxAge = sessionTtlSeconds();
  const claims: TokenClaims = {
    iss: ISSUER,
    aud: AUDIENCE,
    sub: identity.subject,
    type: 'omitech_session',
    name: identity.name,
    role: identity.role,
    iat: now,
    exp: now + maxAge,
    jti: randomUUID(),
  };
  return { token: signClaims(claims, secret), maxAge };
}

function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const item of cookieHeader.split(';')) {
    const separator = item.indexOf('=');
    if (separator < 0 || item.slice(0, separator).trim() !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function readOmitechIdentity(headers: Headers): OmitechIdentity | undefined {
  const token = readCookie(headers.get('cookie'), OMITECH_SESSION_COOKIE);
  const claims = token ? verifiedClaims(token, 'omitech_session') : undefined;
  return claims ? identityFromClaims(claims) : undefined;
}
