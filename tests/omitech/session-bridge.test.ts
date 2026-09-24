// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  setNickname: vi.fn(),
  activateResources: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/store/user-profile', () => ({
  useUserProfileStore: (selector: (state: { setNickname: typeof mocks.setNickname }) => unknown) =>
    selector({ setNickname: mocks.setNickname }),
}));
vi.mock('@/lib/store/learning-resources', () => ({
  activateLearningResources: mocks.activateResources,
}));
vi.mock('@/components/omitech-voice-input', () => ({ OmitechVoiceInput: () => null }));
vi.mock('@/components/omitech-master-bridge', () => ({ OmitechMasterBridge: () => null }));

import { OmitechSessionBridge } from '@/components/omitech-session-bridge';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const authenticated = {
  ok: true,
  json: async () => ({ enabled: true, authenticated: true, user: { name: 'Learner', learner_key: 'learner-1' } }),
};

function launch() {
  window.dispatchEvent(new MessageEvent('message', {
    origin: 'http://localhost:1420',
    source: window.parent,
    data: { type: 'omitech:learning-studio:launch', token: 'renewal-token' },
  }));
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_OMITECH_PARENT_ORIGINS', 'http://localhost:1420');
  mocks.setNickname.mockClear();
  mocks.activateResources.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('OmitechSessionBridge', () => {
  it('keeps the workspace mounted while a session renewal is pending', async () => {
    let finishRenewal!: (value: typeof authenticated) => void;
    const renewal = new Promise<typeof authenticated>((resolve) => { finishRenewal = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(authenticated)
      .mockReturnValueOnce(renewal);
    vi.stubGlobal('fetch', fetchMock);
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(OmitechSessionBridge, null, createElement('div', { id: 'workspace' }, 'Workspace'))));
    const workspace = container.querySelector('#workspace');
    expect(workspace).not.toBeNull();

    await act(async () => launch());
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.querySelector('#workspace')).toBe(workspace);

    await act(async () => { finishRenewal(authenticated); await renewal; });
    expect(container.querySelector('#workspace')).toBe(workspace);
    await act(async () => root.unmount());
  });

  it('ignores an initial session check that finishes after a signed launch', async () => {
    let finishInitial!: (value: { ok: boolean; json: () => Promise<{ enabled: boolean; authenticated: boolean }> }) => void;
    const initial = new Promise<{ ok: boolean; json: () => Promise<{ enabled: boolean; authenticated: boolean }> }>((resolve) => { finishInitial = resolve; });
    vi.stubGlobal('fetch', vi.fn().mockReturnValueOnce(initial).mockResolvedValueOnce(authenticated));
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => root.render(createElement(OmitechSessionBridge, null, createElement('div', { id: 'workspace' }, 'Workspace'))));
    await act(async () => launch());
    const workspace = container.querySelector('#workspace');
    expect(workspace).not.toBeNull();

    await act(async () => {
      finishInitial({ ok: false, json: async () => ({ enabled: true, authenticated: false }) });
      await initial;
    });
    expect(container.querySelector('#workspace')).toBe(workspace);
    await act(async () => root.unmount());
  });
});
