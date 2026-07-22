# The TTRPG Campaign Tracker

A locally run, type-safe tabletop RPG management system for Game Masters and players. It runs on a GM's machine and is reachable from any device on the same local network — no cloud account, no external hosting.

The long-term design covers campaign/entity management, optional per-system ruleset modules, session flow with an event-sourced history log, PLA-style battle/initiative tracking, a player-facing view, a public display screen, Discord integration, and campaign import/export. This repo is being built incrementally toward that; see [Current status](#current-status) for what actually exists today.

## Current status

Implemented so far:

- **Core entities** — Campaigns, PCs, NPCs, Monsters, Locations, Mysteries/Clues, Organizations, with full CRUD, image uploads, and a generic view/edit/delete UI. Locations can be nested under a parent location (e.g. a building's floors or rooms), shown as a collapsible tree with breadcrumbs (e.g. "Sunken Keep > Basement") anywhere the GM sees a location. Organizations track any group with a shared purpose — a business, religion, gang, government, or the PCs' own party.
- **Sessions & battle tracking** — start/end a session (an untitled session defaults its title to the current local date and time), log GM notes and location changes, and run a battle (build combatants → roll initiative → track turns, damage, healing, and status effects → resolve), all recorded to an append-only, chronological history log with a sortable, infinite-scrolling view (sort preference persisted locally).
- **Entity relationships** — link any two entities to each other with a label (optionally directional, with a separate reverse label), a hidden/revealed visibility flag, and notes. Links show on every linked entity's page, correctly oriented from each side.
- **Clue/Mystery reveal mechanism** — reveal or hide a clue as a dedicated, session-logged action (not a silent field edit), optionally scoped to specific PCs instead of the whole party. Every reveal/hide shows up in the session's history log.
- **XP & leveling (system-agnostic)** — PCs have a GM-editable Level field and an XP total that only changes through a dedicated "Award XP" action (with an optional note), logged to the session history when a session is active and usable outside a session too. No ruleset-specific thresholds or formulas yet — that's blocked on the ruleset/plugin system below.
- **End-of-session summary** — a structured recap (locations visited, GM notes, clues revealed/hidden, battle stats, XP awarded, level changes) computed from the session's event log, shown automatically when a session ends and reopenable anytime from the History Log's "Summary" button. Includes a bulk award panel to give each PC XP and/or a new level in one pass, logged into that session's history even though it's already ended. The same recap also shows automatically ("Last Time: …") right after starting a new session, if a previous one exists, so the table can pick up where they left off.
- **Appearance settings** — dark mode and a customizable color scheme (primary, surface, background, and their text colors), persisted server-side so it's the same regardless of which device or browser opens the app.
- **Campaign export/import** — export a full campaign (every entity, session history, and uploaded image) to a single `.zip` file for moving between machines or backups; import it back in as a brand-new campaign. No merging/conflict resolution — re-importing an edited copy just creates another campaign.
- **Public display screen** — a read-only, TV-friendly view at `/display/:campaignId` (no auth — the campaign's own link is the access control, consistent with the rest of the app today) showing the party roster, current session location, party-wide revealed clues (PC-scoped reveals stay private), and battle turn order (no HP/damage numbers). Polls every 5 seconds rather than pushing live updates, since real-time (WebSocket) push isn't built yet.
- **Players** — a root-level entity (not scoped to any campaign, since the same person can play in multiple) representing a real person the GM plays with, distinct from the PC they play. Managed from its own screen off the main dashboard; a PC can optionally reference which Player plays it.

Not yet built:

- Ruleset/plugin modules (stats are freeform for now)
- GM/player authentication
- The player-facing view
- Discord integration
- Real-time (WebSocket) updates

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
- **Auth** — GM login and player identities. This blocks the player-facing view and Discord integration, which assume auth exists first (the public display screen shipped without it — see above).
- **Real-time updates** — WebSocket push so the player view and public screen stay in sync live during a session.

Requested features, not yet designed:

- **Custom calendar** ([#3](https://github.com/mark-a-bull/The-TTRPG-Campaign-Tracking/issues/3)) — track in-world dates and events on a GM-configurable calendar.
- **Player messages via shareable link** ([#15](https://github.com/mark-a-bull/The-TTRPG-Campaign-Tracking/issues/15)) — GM-composed messages to players, delivered through a no-auth link (like the public display screen) rather than real SMS, which would require a paid third-party API.
- **Focus switching between groups/PCs** ([#5](https://github.com/mark-a-bull/The-TTRPG-Campaign-Tracking/issues/5)) — select which location or group is currently in focus during a session and track that over time.
- **Session start meta details** ([#11](https://github.com/mark-a-bull/The-TTRPG-Campaign-Tracking/issues/11)) — record who's attending and where a session takes place (in person, online, etc.) when starting it.
- **Responsive design validation** ([#12](https://github.com/mark-a-bull/The-TTRPG-Campaign-Tracking/issues/12)) — confirm the app works well on phones and tablets, not just desktop/laptop.
- **Dashboard quick-create options** ([#24](https://github.com/mark-a-bull/The-TTRPG-Campaign-Tracking/issues/24), [#25](https://github.com/mark-a-bull/The-TTRPG-Campaign-Tracking/issues/25)) — create PCs and a dedicated player-characters group directly from the main dashboard, without opening a campaign first.

