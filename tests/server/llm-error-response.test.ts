import { describe, expect, it } from 'vitest';

import { describeLlmError, llmApiError } from '@/lib/server/llm-error-response';

function upstreamError(message: string, statusCode: number): Error {
  return Object.assign(new Error(message), { statusCode });
}

describe('describeLlmError — accurate upstream failure mapping', () => {
  it('maps 401 to an API-key message', () => {
    expect(describeLlmError(upstreamError('unauthorized', 401))).toEqual({
      status: 401,
      message:
        'The provider rejected the API key. Check the key configured for the selected provider.',
    });
  });

  it('maps 402 to an insufficient-credit message (never "paid models are disabled")', () => {
    const described = describeLlmError(upstreamError('payment required', 402));
    expect(described?.status).toBe(402);
    expect(described?.message).toMatch(/insufficient credit/i);
    expect(described?.message).not.toMatch(/disabled/i);
  });

  it('maps 404 to an unknown-model message', () => {
    const described = describeLlmError(upstreamError('not found', 404));
    expect(described?.status).toBe(404);
    expect(described?.message).toMatch(/model was not found/i);
  });

  it('maps 408 and 504 to a timeout message', () => {
    for (const status of [408, 504]) {
      expect(describeLlmError(upstreamError('gateway timeout', status))).toEqual({
        status,
        message: 'The model provider timed out. Please try again.',
      });
    }
  });

  it('keeps 429 as a rate limit even when the message mentions token quotas', () => {
    const described = describeLlmError(
      upstreamError('Rate limit exceeded: max tokens per minute reached', 429),
    );
    expect(described?.status).toBe(429);
    expect(described?.message).toMatch(/rate limit/i);
  });

  it('detects context-length rejections from a bare 400 message', () => {
    const described = describeLlmError(
      upstreamError("This model's maximum context length is 8192 tokens", 400),
    );
    expect(described?.status).toBe(400);
    expect(described?.message).toMatch(/context length/i);
  });

  it('maps 5xx to provider-unavailable', () => {
    const described = describeLlmError(upstreamError('overloaded', 503));
    expect(described?.status).toBe(503);
    expect(described?.message).toMatch(/temporarily unavailable/i);
  });

  it('returns undefined for errors without an upstream status', () => {
    expect(describeLlmError(new Error('local validation failed'))).toBeUndefined();
    expect(describeLlmError('not an error')).toBeUndefined();
  });

  it('llmApiError keeps the 429 RATE_LIMITED code and status', async () => {
    const response = llmApiError(upstreamError('slow down', 429));
    expect(response.status).toBe(429);
    const body = await response.json();
    expect(body).toMatchObject({
      success: false,
      errorCode: 'RATE_LIMITED',
      error: 'Upstream rate limit reached. Please try again shortly.',
    });
  });

  it('llmApiError preserves a 402 with an accurate credit message', async () => {
    const response = llmApiError(upstreamError('insufficient balance', 402));
    expect(response.status).toBe(402);
    const body = await response.json();
    expect(body.errorCode).toBe('UPSTREAM_ERROR');
    expect(body.error).toMatch(/insufficient credit/i);
  });
});
