# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A retro 16-bit JRPG-style creature collector set in Hamburg's Karolinenviertel around the Messehallen. Players walk a top-down map and capture tourist archetypes (Sport-Tourist, OMR-Tourist, Internorga-Tourist, Dom-Tourist, …) into a Touristen-Kodex. Each species is gated by a real Hamburg event window — Dom on Heiligengeistfeld, Internorga/OMR in Messehallen, etc. Single-player, local-only.

Full design plan: `/home/honx/.claude/plans/pixi-js-full-sprites-from-stateless-snowflake.md`.

## Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.x, SQLite, PyYAML
- **Frontend**: Pixi.js 8, Vite, TypeScript
- **Map authoring**: Tiled (planned, not yet wired)

## Run

```bash
# Backend (port 8765 — note: not 8000, that's taken on this host)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8765

# Frontend (port 5173, proxies /api → backend)
cd frontend
npm install
npm run dev
```

```bash
# Type-check + build
cd frontend && npx tsc -b --noEmit && npx vite build
```

## Architecture

### Game content lives in YAML, not code

`backend/data/species.yaml` and `backend/data/events.yaml` define every tourist archetype, item, ball, and Hamburg event window. Adding a new tourist or event is a YAML edit — no Python changes needed unless introducing new mechanics. Loaded once at FastAPI startup (`lifespan` in `main.py`) into in-memory dicts in `species.py` and `events.py`.

### Capture is a "persuasion battle"

Tourists don't fight. The encounter loop in `backend/app/encounter.py`:
1. Player applies an **item** to lower **Skepsis** (HP-equivalent). Each species has a **weakness item** that triples damage (e.g. Dom-Tourist ↔ Lebkuchenherz).
2. Or **Talk** for small Skepsis reduction at risk of the tourist fleeing (`flee_rate` per species).
3. Or **throw a ball** — capture probability = `(1 − skepsis/max) × ball_modifier × (shiny ? 0.7 : 1)`.

Encounter state is held in a single module-global `_current` (single-player, MVP). When a step triggers a roll in `spawn.py`, `enc.start()` is called server-side.

### Spawn rates are calendar-driven

`backend/app/spawn.py` rolls per-step: each species in the player's current zone has its event looked up; if active today the species spawns at `active_rate`, otherwise `dormant_rate`. Shinies (1/512) only roll during active windows. This is what makes the Kodex a long-term goal — you can't catch a Dom-Tourist outside the three Dom windows except as a vanishingly rare ghost spawn.

### Frontend ↔ backend boundary

Game logic (RNG, capture math, calendar) is **server-authoritative** — the client only animates outcomes. Frontend talks to backend via `frontend/src/api.ts` against `/api/*`, which Vite proxies to `localhost:8765` (`vite.config.ts`).

### Coordinate model

The frontend reports `(x, y, zone)` to `POST /step` after each grid step. `zone` is a string (e.g. `"heiligengeistfeld"`, `"messehallen"`) and comes from polygons authored in the Tiled `zones` object layer (Phase 3). Server doesn't validate that `(x, y)` is inside `zone` — trust the client for now.

## Current phase status

- ✅ Phase 1: Backend skeleton + full encounter loop (verified end-to-end via curl)
- ✅ Phase 2: Frontend skeleton (Pixi boots, talks to backend, placeholder square moves)
- ⏳ Phase 3: Real Karolinenviertel tilemap (needs tileset art + Tiled authoring)
- ⏳ Phases 4–10: grid-locked movement, encounter UI, Kodex screen, calendar polish, sprite art, audio

## Conventions

- Tourist / item / ball IDs are `snake_case` strings used as both DB keys and (eventually) sprite filenames: `dom_tourist`, `lebkuchenherz`, `touri_ball`.
- Display strings keep German flavor (Kodex, Skepsis, Touri-Ball, Astra-Bier) even though UI is otherwise English.
- Dates in `events.yaml` are absolute ISO (`YYYY-MM-DD`) so spawn behavior is reproducible — for testing, `POST /step` accepts an `on_date` override.
