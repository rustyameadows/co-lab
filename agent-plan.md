Co-Lab MVP – Agent Scratch Pad

Scope for Part 1
- Minimal Cloudflare Pages app with vanilla HTML/CSS/JS
- Pages Functions for: sessions.create, sessions.join, livekit-token
- JWT signing in-worker (HS256 via WebCrypto)
- Basic join flow: host publishes, others subscribe
- Document env vars + deploy steps

Tech Decisions
- Cloudflare Pages + Functions for fast deploy and static assets
- No persistence yet (stateless scaffold) → Durable Object SessionDO next
- No external deps; tiny JWT signer implemented for Workers runtime
- LiveKit client loaded from CDN (UMD build)

Environment Variables (Cloudflare project)
- LIVEKIT_API_KEY: LiveKit API key (Key SID)
- LIVEKIT_API_SECRET: LiveKit API secret
- LIVEKIT_URL: wss URL of your LiveKit (e.g., wss://<tenant>.livekit.cloud)

Endpoints (current scaffold)
- POST /api/sessions.create → { sessionId, inviteUrl, codes: {host,collaborator,viewer} }
  - Stateless; returns codes with prefixes (H-, C-, V-). Not persisted.
- POST /api/sessions.join → body { sessionId, name, code }
  - Derives role from code prefix; returns { role, room, token, url }
  - Token grants: host canPublish; others subscribe-only. Room = sessionId.
- GET /api/livekit-token?room=...&identity=...&role=host|collaborator|viewer
  - Direct token endpoint for simple/manual testing.

Token Details
- Header: alg HS256, typ JWT
- Claims: iss (API key), sub (identity), name, iat, exp
- Grants (video): { room, roomJoin: true, roomCreate: host, canPublish: host, canSubscribe: true, canPublishData: true, canUpdateOwnMetadata: true }
- metadata: JSON string with { role, name, sessionId }

Front-End Flow
- Create: calls /api/sessions.create, shows session+codes, pre-fills sessionId
- Join: user enters name + sessionId + code → calls /api/sessions.join
  - Connects via LiveKit; host publishes local audio+video; others subscribe
- Minimal UI: host video tile + leave

Deploy (Cloudflare Pages)
1) Ensure wrangler is logged in: wrangler login
2) Set variables/secrets (in CF dashboard or via CLI):
   - wrangler secret put LIVEKIT_API_SECRET
   - wrangler secret put LIVEKIT_API_KEY
   - wrangler secret put LIVEKIT_URL
3) Local dev: wrangler pages dev public --compatibility-date=2024-09-01
   - Will auto-mount functions/ and serve public/
4) Deploy:
   - wrangler pages deploy public --project-name=co-lab-mvp
   - Or connect repo in Cloudflare Pages; set env vars in Project → Settings

Notes / Gaps to Address Next
- Persistence: add Durable Object SessionDO (codes, participants, presence, chat, limits)
- Auth: validate codes server-side (hashed), refresh short-lived tokens
- Roles: tighten video grant (e.g., fine-grained publish sources)
- Chat: use LiveKit data channel; DO stores last N messages
- Gen pipeline: Vertex → R2 (originals, thumbs); signed URLs
- Analytics: Workers Analytics Engine events
- Recording: optional egress API behind host-only endpoint

Files added
- public/: index.html, styles.css, app.js
- functions/api/: livekit-token.js, sessions.create.js, sessions.join.js
- functions/_lib/jwt.js (HS256 signer + utils)
- wrangler.toml (Pages config + vars placeholders)

Manual Smoke Test
- Start dev server (see above). In browser:
  1) Click “Create Session” → copy sessionId and host code.
  2) Join as host: enter name, sessionId, host code. Allow camera/mic.
  3) Open another browser window → join with same sessionId and a viewer code.
  4) Viewer should see host video; host badge shown.

Assumptions
- LiveKit Cloud project exists; URL/API key/secret are valid
- Room auto-creation is allowed (host grant sets roomCreate: true)

Security/Limitations (current)
- Codes are not persisted/validated beyond prefix convention (scaffold only)
- Tokens are valid for 1 hour; no refresh endpoint yet
- No rate limits, no CSRF, no auth cookie/session

Cloudflare Pages (GitHub-connected) Settings
- Build command: leave empty (no build step)
- Output directory: `public`
- Framework preset: None
- Functions: auto-detected from `functions/`
- Root directory: repo root (do not set a subdirectory)
- Compatibility date: 2024-09-01 (Project → Functions)
- Env vars (Preview + Production): `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL`
- Deploy flow: connect repo → set settings above → deploy

CDN Notes (LiveKit client)
- Use the UMD build path: `https://cdn.jsdelivr.net/npm/livekit-client@2/dist/livekit-client.umd.min.js`
- Pin at least the major version to avoid breaking changes (`@2`), or pin a specific version (e.g., `@2.3.x`).
- Verify Network response has `content-type: application/javascript`; with `X-Content-Type-Options: nosniff`, mismatched MIME types will be blocked.
- If you see a MIME error or 404, the path is wrong or cached. Fix the URL and hard-refresh (Shift+Reload).
