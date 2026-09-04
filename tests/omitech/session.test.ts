import { createHmac } from 'node:crypto';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createOmitechSessionToken,
  isOmitechIntegrationEnabled,
  readOmitechIdentity,
  verifyOmitechLaunchToken,
  type OmitechIdentity,
} from '@/lib/omitech/session';

const SECRET = 'test-omitech-sso-secret-at-least-32-characters';
const SUBJECT = 'a'.repeat(64);

function encode(value: object): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function launchToken(overrides: Record<string, unknown> = {}): string {
  const now = Math.floor(Date.now() / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    iss: 'omitech-agent',
    aud: 'omitech-learning-studio',
    sub: SUBJECT,
    type: 'openmaic_launch',
    iat: now,
    exp: now + 90,
    jti: 'launch-jti',
    ...overrides,
  });
  const input = `${header}.${payload}`;
  const signature = createHmac('sha256', SECRET).update(input).digest('base64url');
  return `${input}.${signature}`;
}

describe('Omitech Learning Studio session', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('OMITECH_INTEGRATION_ENABLED', 'true');
    vi.stubEnv('OMITECH_SSO_SECRET', SECRET);
  });

  it('enables integration only when explicitly configured', () => {
    expect(isOmitechIntegrationEnabled()).toBe(true);
    vi.stubEnv('OMITECH_INTEGRATION_ENABLED', 'false');
    expect(isOmitechIntegrationEnabled()).toBe(false);
  });

  it('verifies a narrow launch token and derives the server owner key', () => {
    expect(verifyOmitechLaunchToken(launchToken())).toMatchObject({
      subject: SUBJECT,
      ownerId: `omitech:${SUBJECT}`,
      name: 'Learner',
      role: 'learner',
    });
  });

  it('rejects expired, wrong-audience, and tampered launch tokens', () => {
    expect(verifyOmitechLaunchToken(launchToken({ exp: 1 }))).toBeUndefined();
    expect(verifyOmitechLaunchToken(launchToken({ aud: 'another-product' }))).toBeUndefined();
    const valid = launchToken();
    const signatureStart = valid.lastIndexOf('.') + 1;
    const signature = valid.slice(signatureStart);
    const tamperedSignature = `${signature[0] === 'a' ? 'b' : 'a'}${signature.slice(1)}`;
    expect(
      verifyOmitechLaunchToken(`${valid.slice(0, signatureStart)}${tamperedSignature}`),
    ).toBeUndefined();
  });

  it('reads the signed HTTP-only session identity without trusting client headers', () => {
    const identity: OmitechIdentity = {
      subject: SUBJECT,
      ownerId: `omitech:${SUBJECT}`,
      name: 'Learner',
      role: 'learner',
      expiresAt: Math.floor(Date.now() / 1000) + 90,
    };
    const { token } = createOmitechSessionToken(identity);
    const headers = new Headers({
      cookie: `omitech_learning_session=${encodeURIComponent(token)}`,
      'x-learner-key': 'attacker-controlled',
    });

    expect(readOmitechIdentity(headers)).toMatchObject({
      subject: SUBJECT,
      ownerId: `omitech:${SUBJECT}`,
      name: 'Learner',
    });
  });
});
