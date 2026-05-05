import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# In production (Railway) point POKETOUR_DB at a path on the mounted volume,
# e.g. POKETOUR_DB=/data/poketour.db so the Kodex survives redeploys.
_DEFAULT_DB = Path(__file__).resolve().parent.parent / "poketour.db"
DB_PATH = Path(os.environ.get("POKETOUR_DB", str(_DEFAULT_DB)))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
engine = create_engine(f"sqlite:///{DB_PATH}", echo=False, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
