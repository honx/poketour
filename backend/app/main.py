import os
from contextlib import asynccontextmanager
from datetime import date, datetime, timezone
from pathlib import Path

from fastapi import APIRouter, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session

from . import encounter as enc
from . import events, models, schemas, spawn, species
from .db import Base, engine, get_session


@asynccontextmanager
async def lifespan(_: FastAPI):
    species.load()
    events.load()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="Poketour", version="0.1.0", lifespan=lifespan)

# In dev the Vite server proxies /api → here, so localhost origins must be
# allowed. In prod (single-service deploy) frontend and API share an origin so
# CORS is a no-op, but leaving it broad is harmless.
_extra_origins = [o for o in os.environ.get("POKETOUR_CORS_ORIGINS", "").split(",") if o]
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        *_extra_origins,
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api")


STARTER_INVENTORY = {
    "items": {"bratwurst": 3, "lebkuchenherz": 3, "astra_bier": 3, "probierhaeppchen": 2, "visitenkarte": 2},
    "balls": {"touri_ball": 10, "premium_ball": 3, "hanse_ball": 1},
}


# --- helpers ---------------------------------------------------------------

def _get_or_create_player(db: Session) -> models.Player:
    p = db.query(models.Player).first()
    if p:
        return p
    p = models.Player(name="Trainer", x=10, y=20)
    db.add(p)
    db.flush()
    for item_id, qty in STARTER_INVENTORY["items"].items():
        db.add(models.InventoryItem(player_id=p.id, item_id=item_id, qty=qty))
    for ball_id, qty in STARTER_INVENTORY["balls"].items():
        db.add(models.InventoryItem(player_id=p.id, item_id=ball_id, qty=qty))
    db.commit()
    db.refresh(p)
    return p


def _species_to_schema(s: species.Species) -> schemas.SpeciesOut:
    return schemas.SpeciesOut(
        id=s.id,
        name=s.name,
        flavor=s.flavor,
        max_skepsis=s.max_skepsis,
        weakness=s.weakness,
        zones=list(s.zones),
        event=s.event,
    )


def _enc_to_schema(s: enc.EncounterState) -> schemas.EncounterStateOut:
    return schemas.EncounterStateOut(
        species_id=s.species_id,
        shiny=s.shiny,
        skepsis=s.skepsis,
        max_skepsis=s.max_skepsis,
        ended=s.ended,
        outcome=s.outcome,
        log=list(s.log),
    )


# --- routes ----------------------------------------------------------------

@api.get("/healthz")
def healthz():
    return {"ok": True, "species": len(species.all_species()), "events": len(events.all_events())}


@api.post("/player", response_model=schemas.PlayerOut)
def player(db: Session = Depends(get_session)):
    p = _get_or_create_player(db)
    return schemas.PlayerOut(id=p.id, name=p.name, x=p.x, y=p.y)


@api.post("/player/reset", response_model=schemas.InventoryOut)
def player_reset(db: Session = Depends(get_session)):
    """Restore items + balls to the starter inventory. Kodex / capture history
    are intentionally preserved — only the consumables refill."""
    p = _get_or_create_player(db)
    db.query(models.InventoryItem).filter_by(player_id=p.id).delete()
    for item_id, qty in STARTER_INVENTORY["items"].items():
        db.add(models.InventoryItem(player_id=p.id, item_id=item_id, qty=qty))
    for ball_id, qty in STARTER_INVENTORY["balls"].items():
        db.add(models.InventoryItem(player_id=p.id, item_id=ball_id, qty=qty))
    # If a stale encounter is *still active*, end it so the client can't keep
    # using it after a reset. (An already-ended encounter is fine to leave.)
    cur = enc.current()
    if cur is not None and not cur.ended:
        enc.run()
    db.commit()
    return inventory(db)


@api.post("/step", response_model=schemas.EncounterRollOut)
def step(payload: schemas.StepIn, db: Session = Depends(get_session)):
    p = _get_or_create_player(db)
    p.x = payload.x
    p.y = payload.y
    db.commit()

    if not payload.zone:
        return schemas.EncounterRollOut(species=None, shiny=False)

    on = payload.on_date or date.today()
    rolled = spawn.roll_encounter(payload.zone, on)
    if rolled is None:
        return schemas.EncounterRollOut(species=None, shiny=False)
    sp, shiny = rolled
    enc.start(sp.id, shiny)
    return schemas.EncounterRollOut(species=_species_to_schema(sp), shiny=shiny)


@api.get("/encounter", response_model=schemas.EncounterStateOut | None)
def get_encounter():
    s = enc.current()
    return _enc_to_schema(s) if s else None


@api.post("/encounter/item", response_model=schemas.EncounterStateOut)
def encounter_item(action: schemas.ItemAction, db: Session = Depends(get_session)):
    p = _get_or_create_player(db)
    inv = (
        db.query(models.InventoryItem)
        .filter_by(player_id=p.id, item_id=action.item_id)
        .first()
    )
    if inv is None or inv.qty <= 0:
        raise HTTPException(400, f"no {action.item_id} in inventory")
    try:
        s = enc.use_item(action.item_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    inv.qty -= 1
    db.commit()
    return _enc_to_schema(s)


@api.post("/encounter/talk", response_model=schemas.EncounterStateOut)
def encounter_talk():
    try:
        return _enc_to_schema(enc.talk())
    except ValueError as e:
        raise HTTPException(400, str(e))


@api.post("/encounter/throw", response_model=schemas.EncounterStateOut)
def encounter_throw(action: schemas.BallAction, db: Session = Depends(get_session)):
    p = _get_or_create_player(db)
    inv = (
        db.query(models.InventoryItem)
        .filter_by(player_id=p.id, item_id=action.ball_id)
        .first()
    )
    if inv is None or inv.qty <= 0:
        raise HTTPException(400, f"no {action.ball_id} in inventory")
    inv.qty -= 1

    try:
        s = enc.throw_ball(action.ball_id)
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))

    db.add(
        models.CaptureLog(
            player_id=p.id,
            species_id=s.species_id,
            shiny=s.shiny,
            ball_id=action.ball_id,
            success=(s.outcome == "caught"),
        )
    )

    if s.outcome == "caught":
        entry = (
            db.query(models.KodexEntry)
            .filter_by(player_id=p.id, species_id=s.species_id)
            .first()
        )
        now = datetime.now(timezone.utc)
        if entry is None:
            entry = models.KodexEntry(
                player_id=p.id,
                species_id=s.species_id,
                first_caught_at=now,
                shiny_caught_at=now if s.shiny else None,
                total_caught=1,
            )
            db.add(entry)
        else:
            entry.total_caught += 1
            if s.shiny and entry.shiny_caught_at is None:
                entry.shiny_caught_at = now

    db.commit()
    return _enc_to_schema(s)


@api.post("/encounter/run", response_model=schemas.EncounterStateOut)
def encounter_run():
    try:
        return _enc_to_schema(enc.run())
    except ValueError as e:
        raise HTTPException(400, str(e))


@api.get("/kodex", response_model=list[schemas.KodexEntryOut])
def kodex(db: Session = Depends(get_session)):
    p = _get_or_create_player(db)
    entries = {
        e.species_id: e
        for e in db.query(models.KodexEntry).filter_by(player_id=p.id).all()
    }
    out: list[schemas.KodexEntryOut] = []
    for sp in species.all_species():
        e = entries.get(sp.id)
        out.append(
            schemas.KodexEntryOut(
                species_id=sp.id,
                name=sp.name,
                caught=e is not None and e.total_caught > 0,
                shiny_caught=bool(e and e.shiny_caught_at),
                total_caught=e.total_caught if e else 0,
                first_caught_at=e.first_caught_at if e else None,
            )
        )
    return out


@api.get("/events", response_model=list[schemas.EventOut])
def events_list():
    today = date.today()
    return [
        schemas.EventOut(
            id=e.id,
            name=e.name,
            zone=e.zone,
            calendar_active=e.is_active(today),
            override=events.get_override(e.id),
            active=events.is_active(e.id, today),
        )
        for e in events.all_events()
    ]


@api.post("/events/{event_id}", response_model=schemas.EventOut)
def event_set_override(event_id: str, body: schemas.EventOverrideIn):
    e = events.get_event(event_id)
    if e is None:
        raise HTTPException(404, f"unknown event {event_id}")
    events.set_override(event_id, body.override)
    today = date.today()
    return schemas.EventOut(
        id=e.id,
        name=e.name,
        zone=e.zone,
        calendar_active=e.is_active(today),
        override=events.get_override(e.id),
        active=events.is_active(e.id, today),
    )


@api.get("/inventory", response_model=schemas.InventoryOut)
def inventory(db: Session = Depends(get_session)):
    p = _get_or_create_player(db)
    rows = db.query(models.InventoryItem).filter_by(player_id=p.id).all()
    item_ids = {i.id for i in species.all_items()}
    ball_ids = {b.id for b in species.all_balls()}
    items: dict[str, int] = {}
    balls: dict[str, int] = {}
    for r in rows:
        if r.item_id in item_ids:
            items[r.item_id] = r.qty
        elif r.item_id in ball_ids:
            balls[r.item_id] = r.qty
    return schemas.InventoryOut(items=items, balls=balls)


app.include_router(api)


# --- static frontend -------------------------------------------------------
# In production we ship the Vite-built `frontend/dist` inside the Docker image
# and the FastAPI process serves it at `/`. Routes registered above already
# live under `/api/*`, so they don't conflict with the SPA. POKETOUR_STATIC_DIR
# lets ops point this somewhere else if needed.

_static_dir = Path(os.environ.get("POKETOUR_STATIC_DIR", "/app/static"))
if _static_dir.is_dir() and (_static_dir / "index.html").is_file():
    # Serve fingerprinted bundles + assets
    app.mount("/assets", StaticFiles(directory=_static_dir / "assets"), name="assets")

    @app.get("/", include_in_schema=False)
    def _index():
        return FileResponse(_static_dir / "index.html")

    @app.get("/{path:path}", include_in_schema=False)
    def _spa_fallback(path: str):
        # Pass through real files (favicons, /assets/* if mount missed,
        # /assets/sprites/*.png, /assets/tiles/*.png, …); otherwise fall back
        # to index.html so the SPA can handle the route on the client.
        candidate = _static_dir / path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(_static_dir / "index.html")
