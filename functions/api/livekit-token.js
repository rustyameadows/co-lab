// Cloudflare Pages Function: GET /api/livekit-token?room=...&identity=...&role=host|collaborator|viewer
// Returns { token, url }
import { signJWT, nowInSeconds } from '../_lib/jwt.js';

function buildVideoGrant({ room, role }) {
  const isHost = role === 'host';
  return {
    room,
    roomJoin: true,
    roomCreate: isHost,
    canPublish: isHost,
    canSubscribe: true,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  };
}

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const room = url.searchParams.get('room');
  const identity = url.searchParams.get('identity');
  const name = url.searchParams.get('name') || identity || 'user';
  const role = (url.searchParams.get('role') || 'viewer').toLowerCase();

  if (!room || !identity) {
    return new Response(JSON.stringify({ error: 'missing room or identity' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_URL) {
    return new Response(JSON.stringify({ error: 'LIVEKIT env vars not set' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const iat = nowInSeconds();
  const exp = iat + 60 * 60; // 1 hour
  const claims = {
    iss: env.LIVEKIT_API_KEY,
    sub: identity,
    name,
    iat,
    exp,
    video: buildVideoGrant({ room, role }),
    // optional metadata for clients
    metadata: JSON.stringify({ role }),
  };
  const token = await signJWT(claims, env.LIVEKIT_API_SECRET);
  return new Response(JSON.stringify({ token, url: env.LIVEKIT_URL }), {
    headers: { 'content-type': 'application/json' },
  });
}

