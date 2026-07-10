# The TTRPG Campaign Tracker

A locally run, type-safe tabletop RPG management system for Game Masters and players. It runs on a GM's machine and is reachable from any device on the same local network — no cloud account, no external hosting.

The long-term design covers campaign/entity management, optional per-system ruleset modules, session flow with an event-sourced history log, PLA-style battle/initiative tracking, a player-facing view, a public display screen, Discord integration, and campaign import/export. This repo is being built incrementally toward that; see [Current status](#current-status) for what actually exists today.

## Current status

Implemented so far:

- **Core entities** — Campaigns, PCs, NPCs, Monsters, Locations, Mysteries/Clues, with full CRUD, image uploads, and a generic view/edit/delete UI.
- **Sessions & battle tracking** — start/end a session (an untitled session defaults its title to the current local date and time), log GM notes and location changes, and run a battle (build combatants → roll initiative → track turns, damage, healing, and status effects → resolve), all recorded to an append-only, chronological history log with a sortable, infinite-scrolling view (sort preference persisted locally).
- **Entity relationships** — link any two entities to each other with a label (optionally directional, with a separate reverse label), a hidden/revealed visibility flag, and notes. Links show on every linked entity's page, correctly oriented from each side.
- **Clue/Mystery reveal mechanism** — reveal or hide a clue as a dedicated, session-logged action (not a silent field edit), optionally scoped to specific PCs instead of the whole party. Every reveal/hide shows up in the session's history log.
- **Appearance settings** — dark mode and a customizable color scheme (primary, surface, background, and their text colors), persisted locally per browser.

Not yet built: ruleset/plugin modules (stats are freeform for now), GM/player authentication, the player-facing view, the public display screen, Discord integration, import/export, XP/leveling, end-of-session summaries, and real-time (WebSocket) updates.

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

## Contributing

See [CLAUDE.md](CLAUDE.md) for architecture notes and development gotchas (generic vs. custom CRUD routes, the event-sourced session history, Material Web Components quirks, and more).

## Building for production

```bash
pnpm build
```

Builds `shared`, then `server`, then `web` in dependency order.

## Roadmap

The long-term design covers more than what's built today. Roughly in the order these are expected to be tackled next:

- **Ruleset/plugin modules** — the biggest gap between design and code; entities currently have only freeform fields, with no stats, mechanics, or formulas tied to a specific system.
- **Auth** — GM login and player identities. This blocks the player-facing view, the public display screen, and Discord integration, which all assume auth exists first.
- **XP/leveling** — a core/optional-ruleset split, designed but not started.
- **End-of-session summary generation** — a GM-facing recap built from the session's event log.
- **Real-time updates** — WebSocket push so the player view and public screen stay in sync live during a session.
- **Import/export** — moving campaigns between machines, with conflict resolution for entities edited independently on both sides.

Known small gaps, tracked but not yet fixed:

- The delete-confirmation dialog on entity list screens doesn't surface errors, so a blocked delete (e.g. a combatant that's part of an active battle) fails silently there.
- Campaign Dashboard cards don't yet have the edit/delete icon treatment other entity cards use — clicking one just navigates.
