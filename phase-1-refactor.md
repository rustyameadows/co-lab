# Phase 1 Refactor Plan (Prep for Build Step 2: Chat)

## Summary
- Current scaffold works: Cloudflare Pages + Functions, LiveKit token minting, basic create/join, and host-only publish. Frontend uses LiveKit UMD with robust fallbacks and autoplay safeguards.
- Scope now: plan a minimal refactor that preserves behavior while improving structure, safety, and DX to unblock Step 2 (chat with persistence via Durable Object).

## Quick Assessment
- Functions
  - `sessions.create` and `sessions.join` are clean and focused; video grants correctly restrict non-hosts.
  - JWT signer is minimal and compatible with Workers (WebCrypto) — good fit for no-deps.
  - Error responses are JSON but not yet normalized; env validation duplicated across endpoints.
  - Codes are stateless and derived only by prefix; fine for step 1, but we’ll need validation for step 2.
- Frontend
  - UMD client usage is defensive across enum/string event names and API variants — pragmatic and resilient.
  - Single `app.js` keeps things simple, but Step 2 will benefit from light modularity.
  - Autoplay handling, local preview for host, and attach/subscribe race-condition coverage are good.
- Config/Ops
  - Wrangler config is straightforward; CDN version is pinned at major (`@2`). Consider pinning minor for stability.

## Goals (no behavior change)
- Centralize config, env validation, and error shapes.
- Isolate LiveKit grant/token helpers.
- Establish lightweight request/response utilities.
- Define interfaces and storage model for SessionDO (without wiring it yet).
- Prepare client structure and UI hooks to add chat cleanly in Step 2.
- Add security and observability guardrails that won’t alter behavior.

## Backend Refactor Plan
1) Config + Env Validation
- Add `functions/_lib/config.js` with `getEnv(env)` and `assertEnv(env)` that validates `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `LIVEKIT_URL` and returns a typed config object.
- Replace per-endpoint env checks with shared helper.

2) Error/Response Helpers
- Add `functions/_lib/http.js` with `json(data, status=200)`, `badRequest(message, code='bad_request')`, `serverError(message, code='server_error')` to standardize shape: `{ ok: false, code, message }`.
- Adopt consistent headers: `content-type: application/json`, optional `x-request-id` passthrough.

3) LiveKit Helpers
- Add `functions/_lib/livekit.js` with `videoGrantForRole(role, room)` and `buildAccessToken({identity,name,role,room,config})` to centralize claim creation.
- Keep grants identical to today (no behavior change); encapsulate for Step 2 reuse.

4) Request Parsing Utilities
- Add `parseJson(request, { maxBytes })` guard (size cap ~16KB) and content-type check to harden endpoints without changing current usage.

5) Identity + Codes Conventions (Doc/Interfaces Only)
- Document stable identity scheme for reconnects: `${sessionId}:${shortId}` for now; later can be `${sessionId}:${participantId}` from DO.
- Document role resolution contract: prefix → role for scaffold; Step 2 moves to server-side validation via DO.

6) Durable Object Interfaces (Skeleton Spec)
- Define `SessionDO` interface (doc or stub module) methods to implement in Step 2:
  - `createSession(settings?): { sessionId, codesHash, createdAt }`
  - `join({ sessionId, code, name }): { participantId, role }`
  - `appendChat({ participantId, text }): ChatMessage`
  - `getChatHistory({ limit }): ChatMessage[]`
  - `presence(): { participants }`
  - Rate limit helpers per session/participant.
- Plan wrangler bindings (not applied yet): `durable_objects.bindings = [{ name = "SESSION_DO", class_name = "SessionDO" }]`.

7) Security + Guardrails (No-op Behavior Today)
- CORS: keep same-origin only; explicitly set `Access-Control-Allow-Origin` to `origin` when on same host.
- Rate limits: define helper stubs and error codes; wire in Step 2 when DO exists.
- Logging: standardized structured logs `{ event, sessionId, participantId, ... }` via `console.log` for now.

## Frontend Refactor Plan
1) Module Structure (lightweight)
- Plan split of `public/app.js` into:
  - `api.js` (fetch wrappers for sessions.create/join),
  - `lk.js` (connect/publish/subscribe helpers),
  - `ui.js` (DOM bindings + render helpers),
  - `state.js` (session/role/room state).
- Keep a single bundle (native modules) to avoid build tooling; preserve current behavior.

2) UI Hooks for Chat (markup plan only)
- Plan elements: `#chatList`, `#chatInput`, `#chatSend`, right-rail container; CSS tokens for scroll and timestamps.
- Event bus (simple) for app-level events: `joined`, `chat:received`, `chat:send`.

3) Reliability
- Formalize leave/cleanup path: detach tracks, clear event handlers, null room; keep same UI flow.
- Guard all media calls with try/catch and visible non-fatal errors (already mostly present).

4) DX/Debug
- Keep `window.__lk.stats()`; add `window.__app` with minimal state readers.

## Non-Functional Improvements
- Pin LiveKit UMD dependency to minor (e.g., `@2.3.x`) for stability.
- Add basic CSP in `index.html` (plan only): `default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; connect-src 'self' wss: https:; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';`.
- Document local dev and env checks in `readme.md` (small expansion).

## Testing Plan (No new tools)
- Manual smoke: existing 5-step flow continues to work.
- Add curl snippets for `/api/sessions.create` and `/api/sessions.join` to verify error shapes and env validation.
- Browser console checks remain valid (`window.lkRoom`, `__lk.stats()`).

## Acceptance Criteria
- No functional changes to current flows.
- Endpoints return consistent JSON error shapes; env validation unified.
- LiveKit token creation is centralized but produces identical grants.
- Codebase structured to add SessionDO + chat in Step 2 with minimal churn.

## Deliverables (in subsequent PR)
- `functions/_lib/config.js`
- `functions/_lib/http.js`
- `functions/_lib/livekit.js`
- Optional: doc stub `functions/_lib/do-contract.md` describing `SessionDO` methods
- Updated endpoints to use helpers (no behavior change)

## Step 2 Readiness Checklist
- [ ] Shared config/env helper in place
- [ ] Standard error/response utilities used by all endpoints
- [ ] LiveKit helpers adopted (no logic changes)
- [ ] Identity and role conventions documented
- [ ] DO contract drafted; wrangler bindings plan ready
- [ ] Frontend module split plan agreed; chat UI hooks defined
- [ ] CSP and CDN pinning decisions confirmed

