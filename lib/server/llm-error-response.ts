import { APICallError, RetryError } from 'ai';
import { apiError } from '@/lib/server/api-response';

const HTTP_ERROR_MIN = 400;
const HTTP_ERROR_MAX = 599;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toHttpErrorStatus(value: unknown): number | undefined {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number.parseInt(value, 10)
        : Number.NaN;

  return Number.isInteger(parsed) && parsed >= HTTP_ERROR_MIN && parsed <= HTTP_ERROR_MAX
    ? parsed
    : undefined;
}

function statusFromError(error: unknown, seen = new Set<unknown>()): number | undefined {
  if (!error || seen.has(error)) return undefined;
  seen.add(error);

  if (APICallError.isInstance(error)) {
    return toHttpErrorStatus(error.statusCode);
  }

  if (RetryError.isInstance(error)) {
    return (
      statusFromError(error.lastError, seen) ??
      error.errors
        .map((nested) => statusFromError(nested, seen))
        .find((status): status is number => status !== undefined)
    );
  }

  if (!isRecord(error)) return undefined;

  const status = toHttpErrorStatus(error.statusCode ?? error.status ?? error.status_code);
  if (status !== undefined) return status;

  return statusFromError(error.cause, seen) ?? statusFromError(error.lastError, seen);
}

/** Best-effort message text of an error chain (never includes response bodies). */
function errorMessageText(error: unknown, seen = new Set<unknown>()): string {
  if (!error || seen.has(error)) return '';
  seen.add(error);
  const own = error instanceof Error ? error.message : '';
  if (isRecord(error)) {
    const nested = errorMessageText(error.cause, seen) || errorMessageText(error.lastError, seen);
    return nested ? `${own} ${nested}` : own;
  }
  return own;
}

const CONTEXT_LENGTH_PATTERN =
  /context\s*(length|window|size)|maximum context|too many tokens|token limit|reduce the length/i;

function isContextLengthError(error: unknown): boolean {
  return CONTEXT_LENGTH_PATTERN.test(errorMessageText(error));
}

function isTimeoutStatus(status: number): boolean {
  return status === 408 || status === 504;
}

function messageForStatus(status: number): string {
  if (status === 401) {
    return 'The provider rejected the API key. Check the key configured for the selected provider.';
  }
  if (status === 402) {
    return 'The provider account has insufficient credit for this model. Top up the provider account or choose another model.';
  }
  if (status === 403) {
    return 'The provider denied access to this model. Check the provider plan and model permissions.';
  }
  if (status === 404) {
    return 'The selected model was not found by the provider. Check the model ID or choose another model.';
  }
  if (isTimeoutStatus(status)) {
    return 'The model provider timed out. Please try again.';
  }
  if (status === 429) return 'Upstream rate limit reached. Please try again shortly.';
  if (status >= 500) return 'Upstream model provider is temporarily unavailable. Please try again.';
  return 'Upstream provider rejected the request.';
}

export interface LlmErrorDescription {
  status: number;
  message: string;
}

/**
 * Classify an upstream LLM failure into an HTTP status plus an accurate,
 * user-safe message (401 key rejected, 402 insufficient credit, 404 unknown
 * model, 408/504 timeout, 429 rate limit, context-length exceeded, 5xx
 * provider unavailable). Returns undefined when the error carries no upstream
 * status, so callers can fall back to their generic handling. Never exposes
 * provider response bodies, URLs, or credential-adjacent details.
 */
export function describeLlmError(error: unknown): LlmErrorDescription | undefined {
  const status = statusFromError(error);
  // Context-length rejections usually arrive as a bare 400 whose only signal is
  // the message text; check them before the generic 400 mapping. A real 429
  // (including token-per-minute quota messages) stays a rate limit.
  if (
    status !== 429 &&
    (status === undefined || status === 400 || status === 413) &&
    isContextLengthError(error)
  ) {
    return {
      status: 400,
      message:
        "The input exceeds the selected model's context length. Shorten the input or choose a model with a larger context window.",
    };
  }
  if (status === undefined) return undefined;
  return { status, message: messageForStatus(status) };
}

/**
 * Preserve a provider's HTTP semantics for client retry classification without
 * exposing provider response bodies, URLs, or credential-adjacent details.
 */
export function llmApiError(error: unknown) {
  const described = describeLlmError(error);
  if (described === undefined) {
    return apiError('INTERNAL_ERROR', 500, 'Scene generation failed. Please try again.');
  }

  return apiError(
    described.status === 429 ? 'RATE_LIMITED' : 'UPSTREAM_ERROR',
    described.status,
    described.message,
  );
}
