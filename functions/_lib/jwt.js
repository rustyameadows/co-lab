// Minimal HS256 JWT signer for Cloudflare Workers/Pages (WebCrypto)
// Usage: const jwt = await signJWT(payload, secret)

function base64urlEncode(data) {
  const str = typeof data === 'string' ? data : String.fromCharCode(...new Uint8Array(data));
  // btoa expects binary string
  const b64 = btoa(str);
  return b64.replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function hmacSha256(key, data) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data));
  return new Uint8Array(signature);
}

export async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = new TextEncoder();
  const headerB64 = base64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(enc.encode(JSON.stringify(payload)));
  const toSign = `${headerB64}.${payloadB64}`;
  const sig = await hmacSha256(secret, toSign);
  const sigB64 = base64urlEncode(sig);
  return `${toSign}.${sigB64}`;
}

export function nowInSeconds() {
  return Math.floor(Date.now() / 1000);
}

export function randomId(len = 10) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

