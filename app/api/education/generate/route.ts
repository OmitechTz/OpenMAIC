import { NextRequest } from 'next/server';
import { briefSchema, educationPrompt, parseEducationContent } from '@/lib/education/artifacts';
import { callLLM } from '@/lib/ai/llm';
import { resolveModelFromRequest } from '@/lib/server/resolve-model';
import { apiError, apiSuccess } from '@/lib/server/api-response';
import { llmApiError } from '@/lib/server/llm-error-response';

export const maxDuration = 180;
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 100000) return apiError('INVALID_REQUEST', 413, 'The brief is too large.');
    body = JSON.parse(text);
  } catch {
    return apiError('INVALID_REQUEST', 400, 'Invalid JSON brief.');
  }
  const parsed = briefSchema.safeParse(body);
  if (!parsed.success)
    return apiError('INVALID_REQUEST', 400, parsed.error.issues[0]?.message || 'Invalid brief.');
  try {
    const resolved = await resolveModelFromRequest(request, body);
    const response = await callLLM(
      {
        model: resolved.model,
        prompt: educationPrompt(parsed.data),
        maxOutputTokens: 12000,
        abortSignal: AbortSignal.any([request.signal, AbortSignal.timeout(150000)]),
      },
      'education-resource',
      undefined,
      resolved.thinkingConfig,
    );
    try {
      return apiSuccess({ content: parseEducationContent(response.text, parsed.data) });
    } catch {
      return apiError(
        'GENERATION_FAILED',
        422,
        'The model returned an incomplete resource or invalid source references. Your brief is saved; retry or choose another model.',
      );
    }
  } catch (error) {
    if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name))
      return apiError(
        'GENERATION_FAILED',
        504,
        'Resource generation timed out or was cancelled. Your brief is saved.',
      );
    return llmApiError(error);
  }
}
