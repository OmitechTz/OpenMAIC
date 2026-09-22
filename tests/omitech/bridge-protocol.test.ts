// @vitest-environment jsdom

/**
 * Guest-side bridge protocol tests — symmetric with the host suite at
 * `frontend/src/features/learning-studio-bridge/protocol.test.ts` in the
 * Omitech Agent repository.
 */
import { describe, expect, it } from 'vitest';
import {
  LEARNING_STUDIO_PROTOCOL_NS,
  LEARNING_STUDIO_PROTOCOL_VERSION,
  parseLearningStudioMessage,
  validateGuestBridgeEvent,
} from '@/lib/omitech/bridge-protocol';

const PARENT_ORIGIN = 'http://localhost:1420';
const SESSION = 'session-guest-1';
const REQUEST_ID = '123e4567-e89b-42d3-a456-426614174000';
const ORIGINS = new Set([PARENT_ORIGIN]);

function v1Message(type: string, payload: unknown, sessionId: string | null = SESSION) {
  return {
    ns: LEARNING_STUDIO_PROTOCOL_NS,
    v: LEARNING_STUDIO_PROTOCOL_VERSION,
    type,
    ...(sessionId ? { sessionId } : {}),
    payload,
  };
}

function hostEvent(data: unknown, origin = PARENT_ORIGIN, source: unknown = undefined) {
  const event = new MessageEvent('message', { data, origin });
  // In jsdom the top window IS its own parent, so `window` stands in for the
  // embedding Omitech Agent frame.
  Object.defineProperty(event, 'source', {
    value: source === undefined ? window : source,
    configurable: true,
  });
  return event;
}

describe('parseLearningStudioMessage (guest)', () => {
  it('accepts a well-formed handshake-ack', () => {
    const parsed = parseLearningStudioMessage(
      v1Message('handshake-ack', {
        sessionId: SESSION,
        hostCapabilities: ['submit-prompt'],
        launchToken: 'token-123',
      }),
    );
    expect(parsed?.type).toBe('handshake-ack');
  });

  it('rejects the wrong protocol version', () => {
    expect(
      parseLearningStudioMessage({
        ...v1Message('handshake-ack', {
          sessionId: SESSION,
          hostCapabilities: [],
          launchToken: 't',
        }),
        v: 2,
      }),
    ).toBeNull();
  });

  it('rejects unknown types and malformed shapes', () => {
    expect(parseLearningStudioMessage(v1Message('steal-documents', {}))).toBeNull();
    expect(
      parseLearningStudioMessage(v1Message('submit-prompt', { requestId: 'x', text: 42 })),
    ).toBeNull();
  });

  it('rejects attachment-metadata without explicit authorization', () => {
    expect(
      parseLearningStudioMessage(
        v1Message('attachment-metadata', {
          authorized: 'yes',
          attachments: [],
        }),
      ),
    ).toBeNull();
  });
});

describe('validateGuestBridgeEvent', () => {
  const context = (sessionId: string | null = SESSION) => ({
    origins: ORIGINS,
    sessionId: () => sessionId,
  });

  it('rejects events from an origin that is not the configured parent', () => {
    const event = hostEvent(v1Message('cancel', { requestId: REQUEST_ID }), 'https://evil.example');
    expect(validateGuestBridgeEvent(event, context())).toBeNull();
  });

  it('rejects events whose source is not the parent window', () => {
    const event = hostEvent(v1Message('cancel', { requestId: REQUEST_ID }), PARENT_ORIGIN, null);
    expect(validateGuestBridgeEvent(event, context())).toBeNull();
  });

  it('accepts the handshake-ack before a session exists and nothing else', () => {
    const ack = hostEvent(
      v1Message('handshake-ack', {
        sessionId: SESSION,
        hostCapabilities: ['submit-prompt'],
        launchToken: 'token',
      }),
    );
    expect(validateGuestBridgeEvent(ack, context(null))?.type).toBe('handshake-ack');

    const submit = hostEvent(
      v1Message('submit-prompt', {
        requestId: REQUEST_ID,
        text: 'hi',
        inputMethod: 'typed',
        attachments: [],
      }),
    );
    expect(validateGuestBridgeEvent(submit, context(null))).toBeNull();
  });

  it('enforces the negotiated session id', () => {
    const foreign = hostEvent(
      v1Message('cancel', { requestId: REQUEST_ID }, 'someone-elses-session'),
    );
    expect(validateGuestBridgeEvent(foreign, context())).toBeNull();

    const own = hostEvent(v1Message('cancel', { requestId: REQUEST_ID }));
    expect(validateGuestBridgeEvent(own, context())?.type).toBe('cancel');
  });

  it('never accepts a handshake echoed back at the guest', () => {
    const echoed = hostEvent(v1Message('handshake', { guestVersion: 1, capabilities: [] }, null));
    expect(validateGuestBridgeEvent(echoed, context(null))).toBeNull();
  });
});
