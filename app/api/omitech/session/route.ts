import { NextResponse } from 'next/server';

import {
  createOmitechSessionToken,
  isOmitechIntegrationEnabled,
  OMITECH_SESSION_COOKIE,
  readOmitechIdentity,
  verifyOmitechLaunchToken,
} from '@/lib/omitech/session';

export const runtime = 'nodejs';

function publicIdentity(identity: NonNullable<ReturnType<typeof readOmitechIdentity>>) {
  return {
    id: identity.subject,
    name: identity.name,
    role: identity.role,
    learner_key: identity.ownerId,
  };
}

export async function GET(request: Request) {
  if (!isOmitechIntegrationEnabled()) {
    return NextResponse.json({ enabled: false, authenticated: false });
  }
  const identity = readOmitechIdentity(request.headers);
  if (!identity) {
    return NextResponse.json(
      { enabled: true, authenticated: false, error: 'Open from Omitech Agent to continue.' },
      { status: 401 },
    );
  }
  return NextResponse.json({ enabled: true, authenticated: true, user: publicIdentity(identity) });
}

export async function POST(request: Request) {
  if (!isOmitechIntegrationEnabled()) {
    return NextResponse.json({ error: 'Omitech integration is disabled' }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const launchToken =
    body && typeof body === 'object' && typeof (body as { launch_token?: unknown }).launch_token === 'string'
      ? (body as { launch_token: string }).launch_token
      : '';
  const identity = verifyOmitechLaunchToken(launchToken);
  if (!identity) {
    return NextResponse.json({ error: 'Invalid or expired Omitech launch token' }, { status: 401 });
  }

  const session = createOmitechSessionToken(identity);
  const response = NextResponse.json({
    enabled: true,
    authenticated: true,
    user: publicIdentity(identity),
    expires_in: session.maxAge,
  });
  response.cookies.set(OMITECH_SESSION_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: session.maxAge,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ authenticated: false });
  response.cookies.set(OMITECH_SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return response;
}
