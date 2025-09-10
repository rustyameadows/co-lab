// Cloudflare Pages Function: POST /api/sessions.join
// Body: { sessionId, code, name }
// Returns: { role, room, token, url }
import { signJWT, nowInSeconds, randomId } from '../_lib/jwt.js';

function roleFromCode(code) {
  if (!code || typeof code !== 'string') return 'viewer';
  const c = code.trim().toUpperCase();
  if (c.startsWith('H-')) return 'host';
  if (c.startsWith('C-')) return 'collaborator';
  if (c.startsWith('V-')) return 'viewer';
  // fallback: treat specific words
  if (c === 'HOST') return 'host';
  return 'viewer';
}

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
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  if (!env.LIVEKIT_API_KEY || !env.LIVEKIT_API_SECRET || !env.LIVEKIT_URL) {
    return new Response(JSON.stringify({ error: 'LIVEKIT env vars not set' }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = String(body.sessionId || '').trim();
  const code = String(body.code || '').trim();
  const displayName = (body.name && String(body.name).trim()) || 'guest';
  if (!sessionId) {
    return new Response(JSON.stringify({ error: 'missing sessionId' }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  const role = roleFromCode(code);

  // Identity should be unique per participant per session
  const identity = `${sessionId}:${randomId(6)}`;

  const iat = nowInSeconds();
  const exp = iat + 60 * 60; // 1 hour
  const claims = {
    iss: env.LIVEKIT_API_KEY,
    sub: identity,
    name: displayName,
    iat,
    exp,
    video: buildVideoGrant({ room: sessionId, role }),
    metadata: JSON.stringify({ role, name: displayName, sessionId }),
  };
  const token = await signJWT(claims, env.LIVEKIT_API_SECRET);

  return new Response(
    JSON.stringify({ role, room: sessionId, token, url: env.LIVEKIT_URL }),
    { headers: { 'content-type': 'application/json' } }
  );
}

