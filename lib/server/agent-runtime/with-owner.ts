import { resolveRequestOwnerId } from './owner';
import { isOmitechIntegrationEnabled, readOmitechIdentity } from '@/lib/omitech/session';

/**
 * Resolve the anonymous owner identity and run a handler with its response
 * headers.
 *
 * The Set-Cookie minted by resolveRequestOwnerId must ride every response,
 * including 4xx and 5xx: a client that retries after an error keeps the same
 * owner partition, while a 500 that dropped the cookie would silently make
 * the retry a different anonymous owner.
 */
export async function withRequestOwnerId(
  req: Pick<Request, 'headers'>,
  handler: (ownerId: string, responseHeaders: Headers) => Promise<Response>,
): Promise<Response> {
  const responseHeaders = new Headers();
  const integrated = isOmitechIntegrationEnabled();
  const identity = integrated ? readOmitechIdentity(req.headers) : undefined;
  if (integrated && !identity) {
    return Response.json(
      { error: { code: 'OMITECH_SESSION_REQUIRED', message: 'Open from Omitech Agent to continue.' } },
      { status: 401 },
    );
  }
  const ownerId = resolveRequestOwnerId(req, responseHeaders, identity?.ownerId);
  try {
    return await handler(ownerId, responseHeaders);
  } catch (error) {
    console.error('[agent-runtime] request failed under an anonymous owner', error);
    return new Response('Internal Server Error', { status: 500, headers: responseHeaders });
  }
}
