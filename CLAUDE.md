# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A locally run, type-safe tabletop RPG campaign tracker for GMs. Runs on the GM's machine, reachable from any device on the LAN — no cloud account, no external hosting. See [README.md](README.md) for full feature status and roadmap.

TypeScript throughout, pnpm workspace monorepo with three packages:

- `packages/shared` — Zod schemas and types, the single source of truth consumed by both client and server
- `packages/server` — Fastify + Prisma/SQLite REST API
- `packages/web` — React + Vite frontend using Material Web Components (Material Design 3)

## Commands

```bash
pnpm install                                          # install all workspace deps
cp packages/server/.env.example packages/server/.env  # one-time setup
pnpm --filter @ttrpg/server exec prisma migrate deploy # apply DB migrations
pnpm dev                                               # run server (3001) + web (5173) together
pnpm build                                             # builds shared -> server -> web, in that order
pnpm test                                              # server integration tests (Vitest) — the root "test" script only covers @ttrpg/server
```

Web has its own Playwright e2e suite, run separately:

```bash
pnpm --filter @ttrpg/web test       # playwright test
pnpm --filter @ttrpg/web test:ui    # playwright test --ui
```

Run a single server test file or case:

```bash
pnpm --filter @ttrpg/server exec vitest run test/clues.test.ts
pnpm --filter @ttrpg/server exec vitest run -t "rejects a self-link"
```

**After changing anything in `packages/shared` (schemas, types), rebuild it before testing server or web changes**: `pnpm --filter @ttrpg/shared build`. Server and web import `@ttrpg/shared`'s compiled `dist/` output, not its source — `tsx watch`/Vite dev servers will pick up a `pnpm dev`-driven shared rebuild automatically, but one-off `vitest run` invocations will not, and will silently run against a stale build. This has caused real, confusing bugs (a stale `dist/` masking a schema field entirely from serialized API responses).

Prisma schema changes need a migration: `pnpm --filter @ttrpg/server exec prisma migrate dev --name <description>`.

## Merge policy

No change is ready to merge until `pnpm test` **and** `pnpm build` both pass in full. Run both before opening a PR, not just before committing — a change can pass in isolation but break an unrelated test or type (e.g. an API response shape change breaking an older test that assumed the old shape). `pnpm test` runs Vitest, which does not typecheck via `tsc` — a real compile error can sit unnoticed on `main` indefinitely if only `pnpm test` is checked, since nothing in the merge workflow otherwise runs a full build. If either fails, fix it as part of the same change before the PR is opened; don't merge with a known-broken suite or build and fix it later.

## Architecture

### Shared schemas drive both ends

Every entity has one Zod schema file in `packages/shared/src/schemas/`, exporting a `*CreateSchema`, `*UpdateSchema` (usually `.partial()` of create), and a full read schema, plus inferred types. Server routes validate request/response against these; web forms validate against the same `*CreateSchema` via `zodResolver`.

Use `z.input<typeof xSchema>` (not `z.infer`/`z.output`) for `*Create`/`*Update` exported types — fields with `.default()` are optional on input but required on output, and `z.infer` would wrongly make them required in the create payload type.

**Known footgun**: a response schema's array-typed field with a non-primitive `.default()` (e.g. `z.array(idSchema).default([])`) is silently dropped from the serialized JSON response by `fastify-type-provider-zod`/`zod-to-json-schema`. Keep the `.default()` on the create/update input schema only, and redeclare the field without a default when extending into the read/response schema (see `visibleTo` in `packages/shared/src/schemas/clue.ts` for the pattern).

### Server: generic CRUD + hand-rolled custom routes

`packages/server/src/routes/nested-entity.ts` exports `registerNestedEntityRoutes`, a factory that wires up list/create/read/update/delete for a Prisma delegate + Zod schema trio. Simple entities (PCs, NPCs, Monsters, Locations, Mysteries) just call this factory in a one-file route module.

Entities with custom actions or non-trivial serialization (JSON-encoded fields, session-event side effects) don't use the factory — they hand-roll routes instead, following the pattern in `routes/sessions.ts`, `routes/battles.ts`, or `routes/clues.ts` (which encodes/decodes its `visibleTo` array to/from a JSON string column and adds `/reveal` and `/hide` actions beyond plain CRUD).

`registerNestedEntityRoutes` supports an optional `beforeDelete` hook for domain-specific delete guards (e.g. "is this actor in an active battle?", see `battle-guards.ts`) without coupling the generic factory to specific domains.

### Polymorphic references, no DB-level FK

Several models reference "an entity of some type" generically — `InitiativeEntry`/`SessionEvent` (`actorType`/`actorId`, `pc|npc|monster`), `EntityLink` (`fromType`/`fromId`/`toType`/`toId`, any of the 6 entity types), `Clue.visibleTo` (array of PC ids). These are plain string columns with no Prisma relation, validated at the application level via `entity-lookup.ts`'s `findEntityInCampaign` (or `battle-guards.ts`'s narrower actor-only lookup). A deleted entity's dangling references degrade gracefully (rendered as "Unknown") rather than being cascaded or blocked — an intentional tradeoff, not an oversight.

### Event-sourced session history

`SessionEvent` is an append-only log (`session-events.ts`'s `appendSessionEvent`/`serializeSessionEvent`). Every session-scoped action (location change, GM note, battle start/turn/damage/status, clue reveal/hide) appends one. The web `HistoryLog` screen and any "what happened" view are derived reads over this log, not separate mutable state — when adding a new loggable action, add a new `SessionEventType` in `packages/shared/src/schemas/session.ts`, call `appendSessionEvent` from the route, and add a label/description case in `packages/web/src/screens/HistoryLog.tsx`'s `EVENT_LABELS`/`describeEvent`.

### Web: config-driven generic entity form

`packages/web/src/entity-schemas.ts` maps each `EntityType` to its Zod create schema and a `FieldConfig[]` (label, kind: text/longtext/select/image). `EntityForm.tsx` renders whichever entity type it's given purely from that config — adding a field to an existing entity type is a one-line change in `entity-schemas.ts`, not a per-screen edit. `EntityList.tsx` drives the generic list/card/dialog UI the same way via `entityHooksByType`/`entityTypeConfig`.

Card click opens the form read-only (`EntityForm`'s `readOnly` prop renders `ReadOnlyField` — plain text, not disabled inputs); dedicated edit/delete icon buttons open it editable. Entity-specific sections (`EntityLinksSection`, `ClueRevealSection`) are conditionally embedded into `EntityForm` only when there's an existing record (not on create) and, for `ClueRevealSection`, only for the `clues` entity type.

A section like `ClueRevealSection` that mutates server state must re-read live data via its own query hook rather than trusting a `clue`/entity prop passed down from the parent — the parent dialog (`EntityList.tsx`) holds a static snapshot taken when the dialog opened and does not re-render on mutation success.

### Material Web Components gotchas

- MWC elements' JS properties (e.g. `value`) aren't reflected HTML attributes — sync them imperatively via a ref + `useEffect`, not JSX props (see `ui/TextField.tsx`).
- `md-icon-button` defaults to submit-like behavior; always pass `type="button"` explicitly (see `ui/IconButton.tsx`) or a click inside a `Dialog` will submit and close it.
- `ui/Dialog.tsx` deliberately renders plain `<div slot="content">`, not `<form method="dialog">` — a form wrapper breaks once a `Dialog` is nested inside another `Dialog`'s content (invalid nested `<form>`), and isn't needed since every close goes through an explicit handler.

### Data storage

SQLite files and uploaded assets live in `data/` at the repo root (gitignored): `data/dev.db` for `pnpm dev`, `data/test.db` for `pnpm test` (set via `DATABASE_URL` in `packages/server/vitest.config.ts`'s `globalSetup`, which runs `prisma migrate deploy` against the test DB before the suite runs).
