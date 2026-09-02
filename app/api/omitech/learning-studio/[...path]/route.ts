import { NextResponse } from 'next/server';

import { OMITECH_SESSION_COOKIE, readOmitechIdentity } from '@/lib/omitech/session';

const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE']);

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  if (!readOmitechIdentity(request.headers)) {
    return NextResponse.json(
      { error: 'Omitech Learning Studio session required' },
      { status: 401 },
    );
  }
  if (!ALLOWED_METHODS.has(request.method)) {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }
  const token = request.headers
    .get('cookie')
    ?.split(';')
    .map((item) => item.trim().split('='))
    .find(([name]) => name === OMITECH_SESSION_COOKIE)?.[1];
  const base = process.env.OMITECH_AGENT_INTERNAL_URL?.replace(/\/$/, '');
  if (!token || !base) {
    return NextResponse.json({ error: 'Omitech Agent connection is unavailable' }, { status: 503 });
  }
  const { path } = await context.params;
  const source = new URL(request.url);
  const target = `${base}/api/v1/learning-studio/${path.map(encodeURIComponent).join('/')}${source.search}`;
  const response = await fetch(target, {
    method: request.method,
    headers: {
      authorization: `Bearer ${decodeURIComponent(token)}`,
      ...(request.headers.get('content-type')
        ? { 'content-type': request.headers.get('content-type') as string }
        : {}),
    },
    body: request.method === 'GET' ? undefined : await request.arrayBuffer(),
    cache: 'no-store',
  });
  return new NextResponse(response.body, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
