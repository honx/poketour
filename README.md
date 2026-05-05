# Poketour

A retro 16-bit JRPG-style creature collector set in Hamburg's Karolinenviertel around the Messehallen. Catch tourist archetypes (Sport-Tourist, OMR-Tourist, Internorga-Tourist, Dom-Tourist, …) for your Touristen-Kodex. Each tourist type spawns around its real-world Hamburg event; rare shinies appear during active event windows.

## Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy, SQLite
- **Frontend**: Pixi.js + Vite + TypeScript

## Quick start

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn app.main:app --reload --port 8765
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Layout

```
backend/   FastAPI + SQLite, content YAML in backend/data/
frontend/  Pixi.js + Vite, assets in frontend/public/assets/
tools/     Map authoring notes (Tiled)
```

See `/home/honx/.claude/plans/pixi-js-full-sprites-from-stateless-snowflake.md` for full design plan.
