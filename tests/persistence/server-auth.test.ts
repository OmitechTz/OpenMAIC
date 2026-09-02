import type { IncomingMessage } from 'node:http';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authenticatePersistenceRequest } from '@/lib/persistence/server-auth';
import { createOmitechSessionToken, type OmitechIdentity } from '@/lib/omitech/session';

function request(headers: IncomingMessage['headers']): IncomingMessage {
  return { headers } as IncomingMessage;
}

describe('embedded persistence development authentication', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv('PERSISTENCE_DEV_TOKEN', 'shared-secret');
    vi.stubEnv('OMITECH_INTEGRATION_ENABLED', 'false');
  });

  it('accepts the configured bearer token and learner partition', async () => {
    await expect(
      authenticatePersistenceRequest(
        request({
          authorization: 'Bearer shared-secret',
          'x-learner-key': 'anon:learner-1',
        }),
      ),
    ).resolves.toEqual({ key: 'shared', learnerKey: 'anon:learner-1' });
  });

  it('shares one asset principal across learner keys, like the global documents', async () => {
    const first = await authenticatePersistenceRequest(
      request({ authorization: 'Bearer shared-secret', 'x-learner-key': 'anon:a' }),
    );
    const second = await authenticatePersistenceRequest(
      request({ authorization: 'Bearer shared-secret', 'x-learner-key': 'anon:b' }),
    );
    expect(first?.key).toBe('shared');
    expect(second?.key).toBe('shared');
    expect(first?.learnerKey).not.toBe(second?.learnerKey);
  });

  it('issues the shared asset principal even without a learner key', async () => {
    await expect(
      authenticatePersistenceRequest(request({ authorization: 'Bearer shared-secret' })),
    ).resolves.toEqual({ key: 'shared' });
  });

  it('rejects missing and incorrect bearer tokens', async () => {
    await expect(authenticatePersistenceRequest(request({}))).resolves.toBeUndefined();
    await expect(
      authenticatePersistenceRequest(request({ authorization: 'Bearer shared-secreu' })),
    ).resolves.toBeUndefined();
  });

  it('derives runtime and asset partitions from the signed Omitech session', async () => {
    vi.stubEnv('OMITECH_INTEGRATION_ENABLED', 'true');
    vi.stubEnv('OMITECH_SSO_SECRET', 'test-omitech-sso-secret-at-least-32-characters');
    const identity: OmitechIdentity = {
      subject: '42',
      ownerId: 'omitech:42',
      name: 'Omitech Owner',
      role: 'admin',
      expiresAt: Math.floor(Date.now() / 1000) + 60,
    };
    const { token } = createOmitechSessionToken(identity);

    await expect(
      authenticatePersistenceRequest(
        request({
          cookie: `omitech_learning_session=${encodeURIComponent(token)}`,
          'x-learner-key': 'attacker-controlled',
          authorization: 'Bearer wrong-development-token',
        }),
      ),
    ).resolves.toEqual({ key: 'omitech:42', learnerKey: 'omitech:42' });
  });

  it('does not fall back to development credentials in Omitech integration mode', async () => {
    vi.stubEnv('OMITECH_INTEGRATION_ENABLED', 'true');
    vi.stubEnv('OMITECH_SSO_SECRET', 'test-omitech-sso-secret-at-least-32-characters');

    await expect(
      authenticatePersistenceRequest(
        request({
          authorization: 'Bearer shared-secret',
          'x-learner-key': 'anon:attacker',
        }),
      ),
    ).resolves.toBeUndefined();
  });
});
