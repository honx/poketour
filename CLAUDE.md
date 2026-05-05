# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A retro 16-bit JRPG-style creature collector set in Hamburg's Karolinenviertel around the Messehallen. Players walk a top-down map and capture tourist archetypes (Sport-Tourist, OMR-Tourist, Internorga-Tourist, Dom-Tourist, …) into a Touristen-Kodex. Each species is gated by a real Hamburg event window — Dom on Heiligengeistfeld, Internorga/OMR in Messehallen, etc. Single-player, local-only.

Full design plan: `/home/honx/.claude/plans/pixi-js-full-sprites-from-stateless-snowflake.md`.

## Stack

- **Game logic + UI**: Pixi.js 8, Vite, TypeScript — runs entirely in the browser/webview, no backend at runtime.
- **Desktop shell** (for Steam): Tauri 2 (`src-tauri/`).
- **Persistence**: a single localStorage JSON blob (`frontend/src/game/storage.ts`).
- **Legacy backend**: `backend/` (FastAPI + SQLAlchemy + SQLite) is kept around because the Railway deploy still ships it as the static-file server. Game routes (`/api/*`) are no longer used by the client; the live web build runs entirely off the bundled assets.

## Run

```bash
# Browser dev (no backend needed)
cd frontend && npm install && npm run dev   # http://localhost:5173

# Desktop dev (Tauri — needs Rust toolchain installed locally)
npm install
npm run tauri:dev

# Type-check + production frontend build
cd frontend && npx tsc -b --noEmit && npx vite build
```

Cross-platform Tauri bundles (Win/macOS/Linux) build via `.github/workflows/tauri-build.yml` on tag push — the dev Pi (aarch64) can't compile webview natively.

## Architecture

### Game content lives in TS modules (formerly YAML)

`frontend/src/game/data/species.ts` and `events.ts` are the single source of truth for tourists, items, balls, and Hamburg event windows. Adding a new tourist = edit `species.ts`. The old `backend/data/*.yaml` files are stale and only kept as reference.

### Capture is a "persuasion battle"

Tourists don't fight. The encounter loop in `frontend/src/game/encounter.ts`:

1. Player applies an **item** to lower **Skepsis** (HP-equivalent). Each species has a **weakness item** that triples damage (e.g. Dom-Tourist ↔ Lebkuchenherz).
2. Or **Talk** for small Skepsis reduction at risk of the tourist fleeing (`flee_rate` per species).
3. Or **throw a ball** — capture probability = `(1 − skepsis/max) × ball_modifier × (shiny ? 0.7 : 1)`.

Encounter state is a single module-global `_current` (single-player). The roll is started by `spawn.rollEncounter()` on each step and persisted-to-disk effects (inventory, kodex) flow through `game/storage.ts`.

### Spawn rates are calendar-driven

`game/spawn.ts` rolls per-step: each species in the player's current zone has its event looked up; if active today the species spawns at `active_rate × ENCOUNTER_RATE_MULTIPLIER`, otherwise `dormant_rate × multiplier`. Shinies (default 1/64, settings-toggle 1/16) only roll during active windows. This is what makes the Kodex a long-term goal.

### `api.ts` is now a thin in-process facade

`frontend/src/api.ts` keeps the same async/Promise interface the scenes were already using (`api.step()`, `api.throwBall()`, …) but everything resolves synchronously against the in-memory game state + localStorage. No fetch, no proxy, no `/api` URLs.

### Coordinate model

Each completed grid step calls `api.step(x, y, zone)`. `zone` is one of: `messehallen`, `heiligengeistfeld`, `karolinenstrasse`, `marktstrasse`, `feldstrasse`, `millerntor`. The map (56×44, see `frontend/src/tilemap.ts`) paints these zones onto the tile grid programmatically.

## Conventions

- Tourist / item / ball IDs are `snake_case` strings used as both save-file keys and sprite filenames: `dom_tourist`, `lebkuchenherz`, `touri_ball`.
- Display strings keep German flavor (Kodex, Skepsis, Touri-Ball, Astra-Bier) even though UI is otherwise English.
- Dates in `events.ts` are absolute ISO (`YYYY-MM-DD`); spawn rolls use the device's current date by default. `api.step()` accepts an `on_date` override for testing.
- The save blob lives at localStorage key `poketour:save:v1`. Bumping the schema version means choosing a new key + writing a migration.
