# Co-LAB
## Collaborative Gen AI Platform

### Local Development
- Create a `.dev.vars` file at the repo root (same folder as `wrangler.toml`). You can copy `/.dev.vars.example`:
  - `cp .dev.vars.example .dev.vars` and fill in your values.

- Start Pages dev with env vars loaded:
  - `wrangler pages dev public --compatibility-date=2024-09-01 --env-file .dev.vars`

- Alternative (one-off) without a file:
  - `wrangler pages dev public --compatibility-date=2024-09-01 -b LIVEKIT_API_KEY=... -b LIVEKIT_API_SECRET=... -b LIVEKIT_URL=wss://...`

- Quick verification (new terminal):
  - `curl "http://127.0.0.1:8788/api/livekit-token?room=test&identity=dev&role=host"`
  - You should get `{ token, url }`. If you see an error about env vars, recheck `.dev.vars` path and values.

Notes
- This is a Cloudflare Pages app. Use `wrangler pages dev` (not `wrangler dev`).
- Do not commit `.dev.vars` (it’s in `.gitignore`).
