# The TTRPG Campaign Tracker

A locally run, type-safe tabletop RPG management system for Game Masters and players. It runs on a GM's machine and is reachable from any device on the same local network — no cloud account, no external hosting.

The long-term design covers campaign/entity management, optional per-system ruleset modules, session flow with an event-sourced history log, PLA-style battle/initiative tracking, a player-facing view, a public display screen, Discord integration, and campaign import/export. This repo is being built incrementally toward that; see [Current status](#current-status) for what actually exists today.

## Current status

Implemented so far:

- **Core entities** — Campaigns, PCs, NPCs, Monsters, Locations, Mysteries/Clues, with full CRUD, image uploads, and a generic view/edit/delete UI.
- **Sessions & battle tracking** — start/end a session, log GM notes and location changes, and run a battle (build combatants → roll initiative → track turns, damage, healing, and status effects → resolve), all recorded to an append-only, chronological history log.

Not yet built: ruleset/plugin modules (stats are freeform for now), entity relationships, GM/player authentication, the player-facing view, the public display screen, Discord integration, import/export, and real-time (WebSocket) updates.

## Tech stack

TypeScript throughout, in a pnpm workspace monorepo:

- `packages/shared` — Zod schemas and types shared by the client and server
- `packages/server` — Fastify + Prisma/SQLite REST API
- `packages/web` — React + Vite frontend using Material Web Components (Material Design 3)

## Getting started

**Prerequisites:** Node.js 20+, with [Corepack](https://nodejs.org/api/corepack.html) enabled (ships with Node; run `corepack enable` once if you haven't).

```bash
# 1. Install dependencies
pnpm install

# 2. Configure the server's environment
cp packages/server/.env.example packages/server/.env

# 3. Create the local SQLite database and apply migrations
pnpm --filter @ttrpg/server exec prisma migrate deploy

# 4. Start the API server and the web app together
pnpm dev
```

The web app runs at http://localhost:5173, the API at http://localhost:3001. Both bind to `0.0.0.0`, so the app is also reachable from other devices on your LAN at `http://<your-machine's-LAN-IP>:5173`.

Uploaded images and the SQLite database are written to `data/` at the repo root (gitignored).

## Running tests

```bash
pnpm test
```

This runs the server's integration test suite (Vitest), covering entity CRUD, session lifecycle, and a full battle flow end to end. Tests run against a separate SQLite database (`data/test.db`) so they don't touch your dev data.

## Building for production

```bash
pnpm build
```

Builds `shared`, then `server`, then `web` in dependency order.
