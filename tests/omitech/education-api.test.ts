import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { brief, content } from './education-fixtures';
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), call: vi.fn() }));
vi.mock('@/lib/server/resolve-model', () => ({ resolveModelFromRequest: mocks.resolve }));
vi.mock('@/lib/ai/llm', () => ({ callLLM: mocks.call }));
import { POST } from '@/app/api/education/generate/route';

describe('education generation API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolve.mockResolvedValue({ model: 'chosen-model', thinkingConfig: undefined });
    mocks.call.mockResolvedValue({ text: JSON.stringify(content) });
  });
  const request = (body: unknown) =>
    new NextRequest('http://localhost/api/education/generate', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-model': 'openrouter:chosen-model' },
      body: JSON.stringify(body),
    });
  it('uses the existing model resolver and saves no credentials in the response', async () => {
    const req = request(brief);
    const response = await POST(req);
    expect(response.status).toBe(200);
    expect(mocks.resolve).toHaveBeenCalledWith(req, brief);
    expect(mocks.call.mock.calls[0][0].model).toBe('chosen-model');
    expect(await response.json()).toEqual({ success: true, content });
  });
  it('rejects invalid input before any paid call', async () => {
    expect((await POST(request({ ...brief, topic: '' }))).status).toBe(400);
    expect((await POST(request({ topic: 'x'.repeat(100001) }))).status).toBe(413);
    expect(mocks.call).not.toHaveBeenCalled();
  });
  it('rejects incomplete model output instead of pretending generation succeeded', async () => {
    mocks.call.mockResolvedValue({ text: '{}' });
    const response = await POST(request(brief));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toContain('incomplete resource');
  });
  it('sanitizes upstream errors', async () => {
    mocks.call.mockRejectedValue({ status: 401, message: 'secret-response-body' });
    const response = await POST(request(brief));
    expect(response.status).toBe(401);
    expect(await response.text()).not.toContain('secret-response-body');
  });
});
