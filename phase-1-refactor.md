## Phase 1 Wrap-Up + Phase 2 Plan

This app works now. We’ll only do minimal cleanup, then move directly into Phase 2 (chat + persistence). Keep behavior exactly the same until Phase 2 ships.

### Minimal Cleanup (only if needed)
- Pin LiveKit UMD to a minor version (e.g., `@2.3.x`) to avoid breaking changes.
- Keep `GET /api/livekit-token` labeled as “manual testing only” in docs (no code change).
- Confirm `.dev.vars` local dev flow works for you (already documented).

That’s it for cleanup. No refactors before we build Phase 2.

### Phase 1 UX Cleanup (Routing)
- Routes
  - `/` → Join page (blank form by default). Reads `sessionId` and `code` from query to prefill, but works empty.
  - `/new` → New Session page with a “Create Session” button.
- New Session flow
  - Click “Create Session” → call `sessions.create`.
  - Immediately auto-join as host by calling `sessions.join` with the returned host code.
  - Show a simple “Session Info” panel: `sessionId`, role badges, and share actions.
- Share links (copy buttons)
  - “Copy Viewer Link” → `/?sessionId=<id>&code=<viewerCode>`.
  - “Copy Collaborator Link” → `/?sessionId=<id>&code=<collabCode>`.
- Acceptance
  - Visiting `/new` and clicking create lands you in the room as host and displays the two share links.
  - Visiting `/` with no params shows an empty join form; with params, the form is prefilled and ready.
  - No behavior change to LiveKit grants/roles; only UX routing and prefill.

### Phase 2 Scope (Chat + Session Persistence)
- Durable Object: add `SessionDO` as the source of truth for a session.
  - Persist session settings, salted/hashed role codes, participants, and chat messages (last N).
  - Simple presence snapshot (participants list with role and displayName).
- Join flow:
  - `POST /api/sessions.join` validates code against `SessionDO`, assigns role, and mints LiveKit token.
  - Keep room name = `sessionId` as today.
- Chat:
  - Use LiveKit data channel for realtime delivery.
  - Persist messages in `SessionDO`; return history on join.
- Identity:
  - Introduce stable `participantId` per session (from DO) and include in token metadata.
- Safety/limits (minimal):
  - Basic per-session/per-participant rate limits for chat to deter spam.

### Phase 2 Deliverables
- Worker bindings for `SessionDO` (wrangler.toml) and DO class implementation.
- Updated `sessions.create` to create a DO record and return codes (hash stored server-side).
- Updated `sessions.join` to validate code via DO and issue token with the same grants we use now.
- Chat history fetch on join; realtime chat via data channel wiring on the client.
- Minimal UI for a right-rail chat (input, list, timestamps).

### Phase 2 Acceptance Criteria
- Two browsers in one session see each other in presence.
- Host can publish; collaborators/viewers subscribe-only (unchanged).
- Chat messages appear in realtime and persist across refresh (last N on join).
- Codes are validated server-side; wrong code is rejected.

### Out of Scope (defer)
- Generation pipeline (Vertex + R2), moderation, analytics, recording — later phases.
