/**
 * Learning Studio bridge protocol — GUEST side.
 *
 * Counterpart: `frontend/src/features/learning-studio-bridge/protocol.ts` in
 * the Omitech Agent repository carries the same constants, message shapes and
 * guards for the host (Vite) side. Keep the two files in sync — the contract
 * is shared, the code is not. Do not import across the product boundary.
 *
 * Privacy boundary: this channel NEVER carries Omitech private documents,
 * memory, credentials, BYOK keys, or unrelated account data. The only payloads
 * allowed across are the ones typed below; `attachment-metadata` additionally
 * requires `authorized: true` (an explicit, reviewable user action staged the
 * transfer) or the message is rejected. Prompts arriving over `submit-prompt`
 * are STAGED in the workbench composer for review — never auto-sent.
 */

export const LEARNING_STUDIO_PROTOCOL_NS = 'omitech-learning-studio' as const;
export const LEARNING_STUDIO_PROTOCOL_VERSION = 1 as const;

export const LEARNING_STUDIO_MESSAGE_TYPES = [
  'handshake',
  'handshake-ack',
  'submit-prompt',
  'reviewed-voice-text',
  'attachment-metadata',
  'workspace-context',
  'progress',
  'result',
  'cancel',
  'failure',
  'retry',
  'focus',
  'draft-sync',
] as const;

export type LearningStudioMessageType = (typeof LEARNING_STUDIO_MESSAGE_TYPES)[number];

const MESSAGE_TYPE_SET: ReadonlySet<string> = new Set(LEARNING_STUDIO_MESSAGE_TYPES);

/** Types that must carry the negotiated `sessionId`. Only the guest's opening
 * `handshake` is session-less (it is what starts the negotiation). */
const SESSION_SCOPED_TYPES: ReadonlySet<string> = new Set([
  'handshake-ack',
  'submit-prompt',
  'reviewed-voice-text',
  'attachment-metadata',
  'workspace-context',
  'progress',
  'result',
  'cancel',
  'failure',
  'retry',
  'focus',
  'draft-sync',
]);

const REQUEST_ID_PATTERN = /^[a-f0-9-]{36}$/i;

const MAX_TEXT_LENGTH = 20_000;
const MAX_ATTACHMENTS = 16;
const MAX_NAME_LENGTH = 240;
const MAX_CAPABILITIES = 32;

export type BridgePromptInputMethod = 'typed' | 'voice_transcribe' | 'imported';

export interface BridgeAttachmentMetadata {
  id: string;
  name: string;
  kind: 'file' | 'document' | 'artifact' | 'image' | 'other';
  refId?: number | string;
}

export interface BridgeArtifact {
  id: number | string;
  type: string;
  label: string;
}

interface Envelope<T extends LearningStudioMessageType, P> {
  ns: typeof LEARNING_STUDIO_PROTOCOL_NS;
  v: typeof LEARNING_STUDIO_PROTOCOL_VERSION;
  type: T;
  /** Negotiated session id (required for every type except `handshake`). */
  sessionId?: string;
  payload: P;
}

export interface HandshakePayload {
  guestVersion: number;
  capabilities: string[];
}

export interface HandshakeAckPayload {
  sessionId: string;
  hostCapabilities: string[];
  /** Short-lived launch token for the guest's HTTP session exchange. */
  launchToken: string;
}

export interface SubmitPromptPayload {
  requestId: string;
  text: string;
  inputMethod: BridgePromptInputMethod;
  originApplicationId?: string;
  attachments: BridgeAttachmentMetadata[];
}

export interface ReviewedVoiceTextPayload {
  requestId: string;
  /** Reviewed transcript; absent/omitted means the user cancelled dictation. */
  text?: string;
}

export interface AttachmentMetadataPayload {
  requestId?: string;
  attachments: BridgeAttachmentMetadata[];
  /** Must be literal `true`: only explicitly authorized transfers may cross. */
  authorized: true;
}

export interface WorkspaceContextPayload {
  contextId: string;
  workspaceLabel?: string;
  activeCourse?: { id: string; title: string };
}

export interface ProgressPayload {
  requestId: string;
  message?: string;
  percent?: number;
}

export interface ResultPayload {
  requestId: string;
  status: 'completed' | 'cancelled';
  artifacts?: BridgeArtifact[];
}

export interface FailurePayload {
  requestId: string;
  error: string;
  retryable: boolean;
}

export interface RequestRefPayload {
  requestId: string;
}

export interface FocusPayload {
  requestId?: string;
  target?: string;
}

export interface DraftSyncPayload {
  requestId?: string;
  text: string;
}

export type LearningStudioMessage =
  | Envelope<'handshake', HandshakePayload>
  | Envelope<'handshake-ack', HandshakeAckPayload>
  | Envelope<'submit-prompt', SubmitPromptPayload>
  | Envelope<'reviewed-voice-text', ReviewedVoiceTextPayload>
  | Envelope<'attachment-metadata', AttachmentMetadataPayload>
  | Envelope<'workspace-context', WorkspaceContextPayload>
  | Envelope<'progress', ProgressPayload>
  | Envelope<'result', ResultPayload>
  | Envelope<'cancel', RequestRefPayload>
  | Envelope<'failure', FailurePayload>
  | Envelope<'retry', RequestRefPayload>
  | Envelope<'focus', FocusPayload>
  | Envelope<'draft-sync', DraftSyncPayload>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isBoundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max;
}

function isRequestId(value: unknown): value is string {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value);
}

function isStringList(value: unknown, max: number): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_CAPABILITIES &&
    value.every((entry) => isBoundedString(entry, max))
  );
}

function isAttachment(value: unknown): value is BridgeAttachmentMetadata {
  if (!isRecord(value)) return false;
  return (
    isBoundedString(value.id, MAX_NAME_LENGTH) &&
    isBoundedString(value.name, MAX_NAME_LENGTH) &&
    typeof value.kind === 'string' &&
    ['file', 'document', 'artifact', 'image', 'other'].includes(value.kind) &&
    (value.refId === undefined ||
      typeof value.refId === 'string' ||
      typeof value.refId === 'number')
  );
}

function isAttachmentList(value: unknown): value is BridgeAttachmentMetadata[] {
  return Array.isArray(value) && value.length <= MAX_ATTACHMENTS && value.every(isAttachment);
}

function isArtifact(value: unknown): value is BridgeArtifact {
  if (!isRecord(value)) return false;
  return (
    (typeof value.id === 'string' || typeof value.id === 'number') &&
    isBoundedString(value.type, MAX_NAME_LENGTH) &&
    isBoundedString(value.label, MAX_NAME_LENGTH)
  );
}

/** Strict per-type payload validation. Returns null on any shape violation. */
function validPayload(type: LearningStudioMessageType, payload: unknown): boolean {
  if (!isRecord(payload)) return false;
  switch (type) {
    case 'handshake':
      return (
        typeof payload.guestVersion === 'number' &&
        Number.isInteger(payload.guestVersion) &&
        payload.guestVersion >= 1 &&
        isStringList(payload.capabilities, MAX_NAME_LENGTH)
      );
    case 'handshake-ack':
      return (
        isBoundedString(payload.sessionId, 128) &&
        payload.sessionId.length > 0 &&
        isStringList(payload.hostCapabilities, MAX_NAME_LENGTH) &&
        isBoundedString(payload.launchToken, 512) &&
        payload.launchToken.length > 0
      );
    case 'submit-prompt':
      return (
        isRequestId(payload.requestId) &&
        isBoundedString(payload.text, MAX_TEXT_LENGTH) &&
        (payload.inputMethod === 'typed' ||
          payload.inputMethod === 'voice_transcribe' ||
          payload.inputMethod === 'imported') &&
        (payload.originApplicationId === undefined ||
          isBoundedString(payload.originApplicationId, MAX_NAME_LENGTH)) &&
        isAttachmentList(payload.attachments)
      );
    case 'reviewed-voice-text':
      return (
        isRequestId(payload.requestId) &&
        (payload.text === undefined || isBoundedString(payload.text, MAX_TEXT_LENGTH))
      );
    case 'attachment-metadata':
      // The privacy gate: transfers must be explicitly authorized, metadata only.
      return (
        payload.authorized === true &&
        isAttachmentList(payload.attachments) &&
        (payload.requestId === undefined || isRequestId(payload.requestId))
      );
    case 'workspace-context':
      return (
        isBoundedString(payload.contextId, MAX_NAME_LENGTH) &&
        (payload.workspaceLabel === undefined ||
          isBoundedString(payload.workspaceLabel, MAX_NAME_LENGTH)) &&
        (payload.activeCourse === undefined ||
          (isRecord(payload.activeCourse) &&
            isBoundedString(payload.activeCourse.id, MAX_NAME_LENGTH) &&
            isBoundedString(payload.activeCourse.title, MAX_NAME_LENGTH)))
      );
    case 'progress':
      return (
        isRequestId(payload.requestId) &&
        (payload.message === undefined || isBoundedString(payload.message, 1000)) &&
        (payload.percent === undefined ||
          (typeof payload.percent === 'number' && payload.percent >= 0 && payload.percent <= 100))
      );
    case 'result':
      return (
        isRequestId(payload.requestId) &&
        (payload.status === 'completed' || payload.status === 'cancelled') &&
        (payload.artifacts === undefined ||
          (Array.isArray(payload.artifacts) &&
            payload.artifacts.length <= MAX_ATTACHMENTS &&
            payload.artifacts.every(isArtifact)))
      );
    case 'cancel':
    case 'retry':
      return isRequestId(payload.requestId);
    case 'failure':
      return (
        isRequestId(payload.requestId) &&
        isBoundedString(payload.error, 1000) &&
        typeof payload.retryable === 'boolean'
      );
    case 'focus':
      return (
        (payload.requestId === undefined || isRequestId(payload.requestId)) &&
        (payload.target === undefined || isBoundedString(payload.target, MAX_NAME_LENGTH))
      );
    case 'draft-sync':
      return (
        isBoundedString(payload.text, MAX_TEXT_LENGTH) &&
        (payload.requestId === undefined || isRequestId(payload.requestId))
      );
    default:
      return false;
  }
}

/** Parse and fully validate a raw postMessage payload. Unknown types, wrong
 * versions and malformed shapes all return null — callers ignore them. */
export function parseLearningStudioMessage(data: unknown): LearningStudioMessage | null {
  if (!isRecord(data)) return null;
  if (data.ns !== LEARNING_STUDIO_PROTOCOL_NS) return null;
  if (data.v !== LEARNING_STUDIO_PROTOCOL_VERSION) return null;
  if (typeof data.type !== 'string' || !MESSAGE_TYPE_SET.has(data.type)) return null;
  const type = data.type as LearningStudioMessageType;
  if (!validPayload(type, data.payload)) return null;
  if (SESSION_SCOPED_TYPES.has(type)) {
    if (!isBoundedString(data.sessionId, 128) || data.sessionId.length === 0) return null;
  }
  return data as unknown as LearningStudioMessage;
}

export interface GuestValidationContext {
  /** Allowed parent origins (from NEXT_PUBLIC_OMITECH_PARENT_ORIGINS). */
  origins: ReadonlySet<string>;
  /** Live accessor for the negotiated session id (null before the ack). */
  sessionId: () => string | null;
}

/**
 * Guest-side event validation, symmetric with the host's `validateBridgeEvent`:
 * the event must come from the parent window, from an allowed origin, parse as
 * a v1 message, and (once negotiated) carry the current session id. Only
 * `handshake-ack` may arrive without a session — it is what establishes it.
 */
export function validateGuestBridgeEvent(
  event: MessageEvent,
  context: GuestValidationContext,
): LearningStudioMessage | null {
  if (typeof window === 'undefined') return null;
  if (event.source !== window.parent) return null;
  if (!context.origins.has(event.origin)) return null;
  const message = parseLearningStudioMessage(event.data);
  if (!message) return null;
  if (message.type === 'handshake-ack') return message;
  if (message.type === 'handshake') return null; // guests never accept their own opening
  const session = context.sessionId();
  if (!session || message.sessionId !== session) return null;
  return message;
}
