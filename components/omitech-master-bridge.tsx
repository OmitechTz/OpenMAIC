'use client';

/**
 * OmitechMasterBridge — the guest side of the versioned Learning Studio
 * bridge protocol (`lib/omitech/bridge-protocol.ts`; host counterpart:
 * `frontend/src/features/learning-studio-bridge/` in the Omitech Agent repo).
 *
 * What it does, and only what it does:
 *
 *  - Announces v1 capability with a `handshake` (the legacy `ready` is still
 *    sent by `OmitechSessionBridge` — both generations coexist).
 *  - Accepts the host's `handshake-ack` and pins the negotiated session id.
 *    The launch token inside the ack is deliberately NOT used here: the HTTP
 *    session exchange stays on the legacy `launch` path in
 *    `OmitechSessionBridge`, so there is exactly one session flow.
 *  - Stages `submit-prompt` / `draft-sync` payloads into the workbench
 *    composer via `lib/workbench/external-prompt` — as a DRAFT for review,
 *    never an auto-send.
 *  - Answers `cancel` for the active bridged request (the draft stays; only
 *    the host's pending execution is released).
 *  - Reports the workbench run status for the active bridged request back as
 *    `progress` / `result` / `failure`, correlated by request id.
 *
 * Every inbound event passes `validateGuestBridgeEvent` (parent source,
 * allowed origin, protocol version, type whitelist, schema, session) and every
 * outbound message goes only to the configured parent origins — never `*`.
 */
import { useEffect } from 'react';

import {
  LEARNING_STUDIO_PROTOCOL_NS,
  LEARNING_STUDIO_PROTOCOL_VERSION,
  validateGuestBridgeEvent,
  type LearningStudioMessage,
} from '@/lib/omitech/bridge-protocol';
import { publishExternalPrompt } from '@/lib/workbench/external-prompt';
import { useWorkbenchStore, type SessionStatus } from '@/lib/workbench/session-store';

const GUEST_CAPABILITIES = [
  'submit-prompt',
  'reviewed-voice-text',
  'draft-sync',
  'progress',
  'result',
  'failure',
  'cancel',
];

export function OmitechMasterBridge({ origins }: { origins: Set<string> }) {
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window || origins.size === 0) return;

    let sessionId: string | null = null;
    let activeRequestId: string | null = null;
    let lastPrompt: { text: string; requestId: string } | null = null;

    /** Outbound messages only ever go to the configured parent origins. */
    const post = (message: object) => {
      for (const origin of origins) window.parent.postMessage(message, origin);
    };

    const postV1 = (message: LearningStudioMessage) => {
      const session = sessionId;
      if (!session) return;
      post({ ...message, sessionId: session });
    };

    // Announce v1 capability alongside the legacy `ready`.
    post({
      ns: LEARNING_STUDIO_PROTOCOL_NS,
      v: LEARNING_STUDIO_PROTOCOL_VERSION,
      type: 'handshake',
      payload: { guestVersion: LEARNING_STUDIO_PROTOCOL_VERSION, capabilities: GUEST_CAPABILITIES },
    });

    const receive = (event: MessageEvent) => {
      const message = validateGuestBridgeEvent(event, {
        origins,
        sessionId: () => sessionId,
      });
      if (!message) return;
      switch (message.type) {
        case 'handshake-ack':
          sessionId = message.payload.sessionId;
          return;
        case 'submit-prompt': {
          const { requestId, text, inputMethod, attachments } = message.payload;
          activeRequestId = requestId;
          lastPrompt = { text, requestId };
          publishExternalPrompt({ requestId, text, inputMethod, attachments });
          postV1({
            ns: LEARNING_STUDIO_PROTOCOL_NS,
            v: LEARNING_STUDIO_PROTOCOL_VERSION,
            type: 'progress',
            payload: { requestId, message: 'Staged in the Learning Studio composer for review.' },
          });
          return;
        }
        case 'draft-sync':
          publishExternalPrompt({
            requestId: message.payload.requestId,
            text: message.payload.text,
            inputMethod: 'typed',
            attachments: [],
          });
          return;
        case 'cancel': {
          const { requestId } = message.payload;
          if (activeRequestId === requestId) {
            activeRequestId = null;
            postV1({
              ns: LEARNING_STUDIO_PROTOCOL_NS,
              v: LEARNING_STUDIO_PROTOCOL_VERSION,
              type: 'result',
              payload: { requestId, status: 'cancelled' },
            });
          }
          return;
        }
        case 'retry': {
          const { requestId } = message.payload;
          if (lastPrompt && lastPrompt.requestId === requestId) {
            activeRequestId = requestId;
            publishExternalPrompt({
              requestId,
              text: lastPrompt.text,
              inputMethod: 'typed',
              attachments: [],
            });
          }
          return;
        }
        case 'reviewed-voice-text':
          // Handled by `OmitechVoiceInput` on the legacy channel; the v1 copy
          // is accepted here so the validator's session gate is exercised, but
          // there is exactly one dictation insertion path.
          return;
        default:
          // focus / attachment-metadata / workspace-context / progress /
          // result / failure are host-side concerns on this channel.
          return;
      }
    };
    window.addEventListener('message', receive);

    // Report the run status for the active bridged request. The composer only
    // STAGES bridged prompts, so a run belongs to the request only once the
    // user sends it themselves — which is exactly the review gate we want.
    let lastStatus: SessionStatus | null = null;
    const unsubscribe = useWorkbenchStore.subscribe((state) => {
      const status = state.status;
      if (!activeRequestId || !sessionId || status === lastStatus) return;
      lastStatus = status;
      const requestId = activeRequestId;
      if (status === 'queued' || status === 'running') {
        postV1({
          ns: LEARNING_STUDIO_PROTOCOL_NS,
          v: LEARNING_STUDIO_PROTOCOL_VERSION,
          type: 'progress',
          payload: { requestId, message: 'Learning Studio is working on it.' },
        });
      } else if (status === 'succeeded') {
        postV1({
          ns: LEARNING_STUDIO_PROTOCOL_NS,
          v: LEARNING_STUDIO_PROTOCOL_VERSION,
          type: 'result',
          payload: { requestId, status: 'completed' },
        });
        activeRequestId = null;
      } else if (status === 'cancelled') {
        postV1({
          ns: LEARNING_STUDIO_PROTOCOL_NS,
          v: LEARNING_STUDIO_PROTOCOL_VERSION,
          type: 'result',
          payload: { requestId, status: 'cancelled' },
        });
        activeRequestId = null;
      } else if (status === 'failed') {
        postV1({
          ns: LEARNING_STUDIO_PROTOCOL_NS,
          v: LEARNING_STUDIO_PROTOCOL_VERSION,
          type: 'failure',
          payload: {
            requestId,
            error: state.error ?? 'The Learning Studio run failed.',
            retryable: true,
          },
        });
        activeRequestId = null;
      }
    });

    return () => {
      window.removeEventListener('message', receive);
      unsubscribe();
    };
  }, [origins]);

  return null;
}
