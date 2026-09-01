import { NextRequest, NextResponse } from 'next/server';

import { isAgentRuntimeConfigured, isProWorkbenchEnabled } from '@/lib/config/feature-flags';

/** Convert string to Uint8Array */
function encode(str: string): Uint8Array {
  return new TextEncoder().encode(str);
}

/** Convert ArrayBuffer to hex string */
function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function base64UrlBytes(value: string): Uint8Array | undefined {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
}

function base64UrlJson(value: string): Record<string, unknown> | undefined {
  const bytes = base64UrlBytes(value);
  if (!bytes) return undefined;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : undefined;
  } catch {
    return undefined;
  }
}

async function verifyOmitechSession(token: string, secret: string): Promise<boolean> {
  if (!token || token.length > 4096) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  const [headerSegment, payloadSegment, signatureSegment] = parts as [string, string, string];
  const header = base64UrlJson(headerSegment);
  const payload = base64UrlJson(payloadSegment);
  const supplied = base64UrlBytes(signatureSegment);
  if (header?.alg !== 'HS256' || header.typ !== 'JWT' || !payload || !supplied) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    encode(secret).buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign(
      'HMAC',
      key,
      encode(`${headerSegment}.${payloadSegment}`).buffer as ArrayBuffer,
    ),
  );
  if (supplied.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < supplied.length; index += 1) {
    mismatch |= supplied[index]! ^ expected[index]!;
  }
  const now = Math.floor(Date.now() / 1000);
  return (
    mismatch === 0 &&
    payload.iss === 'omitech-agent' &&
    payload.aud === 'omitech-learning-studio' &&
    payload.type === 'omitech_session' &&
    typeof payload.sub === 'string' &&
    /^[1-9][0-9]{0,18}$/.test(payload.sub) &&
    typeof payload.exp === 'number' &&
    payload.exp > now
  );
}

/** Verify an HMAC-signed token using Web Crypto API (Edge-compatible) */
async function verifyToken(token: string, accessCode: string): Promise<boolean> {
  const dotIndex = token.indexOf('.');
  if (dotIndex === -1) return false;

  const timestamp = token.substring(0, dotIndex);
  const signature = token.substring(dotIndex + 1);

  const keyData = encode(accessCode);
  const key = await crypto.subtle.importKey(
    'raw',
    keyData.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

  const data = encode(timestamp);
  const expected = bufToHex(await crypto.subtle.sign('HMAC', key, data.buffer as ArrayBuffer));

  // Constant-length comparison (not truly constant-time in JS, but sufficient here)
  if (signature.length !== expected.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Return an actual server-side 404 when either half of the workbench is off.
  // Edge middleware cannot reliably inspect server-only deployment variables,
  // so it enforces the public gate and leaves the complete runtime/database
  // check to Node. A Node-hosted middleware uses the same gate as startup.
  const canInspectServerRuntime = process.env.NEXT_RUNTIME !== 'edge';
  const workbenchEnabled =
    isProWorkbenchEnabled() && (!canInspectServerRuntime || isAgentRuntimeConfigured());
  if (!workbenchEnabled && (pathname === '/workbench' || pathname.startsWith('/workbench/'))) {
    return new NextResponse('Not found', { status: 404 });
  }

  const omitechIntegrated = ['1', 'true'].includes(
    (process.env.OMITECH_INTEGRATION_ENABLED ?? '').toLowerCase(),
  );
  if (omitechIntegrated) {
    if (pathname === '/api/health' || pathname.startsWith('/api/omitech/session')) {
      return NextResponse.next();
    }
    const secret = process.env.OMITECH_SSO_SECRET?.trim();
    const cookie = request.cookies.get('omitech_learning_session');
    const authenticated = Boolean(
      secret &&
        secret.length >= 32 &&
        cookie?.value &&
        (await verifyOmitechSession(cookie.value, secret)),
    );
    if (authenticated) return NextResponse.next();
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, errorCode: 'OMITECH_SESSION_REQUIRED', error: 'Open from Omitech Agent.' },
        { status: 401 },
      );
    }
    // Page requests render the branded session bridge, which explains how to
    // return to Omitech Agent. Static assets are excluded by the matcher.
    return NextResponse.next();
  }

  const accessCode = process.env.ACCESS_CODE;
  if (!accessCode) {
    return NextResponse.next();
  }

  // Whitelist: access-code endpoints, health check
  if (pathname.startsWith('/api/access-code/') || pathname === '/api/health') {
    return NextResponse.next();
  }

  // Check cookie — validate HMAC signature, not just existence
  const cookie = request.cookies.get('openmaic_access');
  if (cookie?.value && (await verifyToken(cookie.value, accessCode))) {
    return NextResponse.next();
  }

  // API requests without valid cookie → 401
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { success: false, errorCode: 'INVALID_REQUEST', error: 'Access code required' },
      { status: 401 },
    );
  }

  // Page requests → let through, frontend shows modal
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|logos/).*)'],
};
