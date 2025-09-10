// Cloudflare Pages Function: POST /api/sessions.create
// Returns a new session scaffold with role codes and a join URL.
import { randomId } from '../_lib/jwt.js';

function genCode(prefix) {
  const num = Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0');
  return `${prefix}-${num}`;
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }
  const sessionId = `sess_${randomId(8)}`;
  const codes = {
    host: genCode('H'),
    collaborator: genCode('C'),
    viewer: genCode('V'),
  };
  const origin = new URL(request.url).origin;
  const inviteUrl = `${origin}/?sessionId=${encodeURIComponent(sessionId)}`;

  // NOTE: This is a stateless scaffold. Persist to Durable Objects in the next step.
  return new Response(
    JSON.stringify({ sessionId, inviteUrl, codes }),
    { headers: { 'content-type': 'application/json' } }
  );
}

