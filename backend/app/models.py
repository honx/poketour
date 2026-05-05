from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Boolean
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Player(Base):
    __tablename__ = "player"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(64), default="Trainer")
    x: Mapped[int] = mapped_column(Integer, default=0)
    y: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    kodex: Mapped[list["KodexEntry"]] = relationship(back_populates="player", cascade="all, delete-orphan")
    inventory: Mapped[list["InventoryItem"]] = relationship(back_populates="player", cascade="all, delete-orphan")


class KodexEntry(Base):
    __tablename__ = "kodex_entry"

    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("player.id"))
    species_id: Mapped[str] = mapped_column(String(64))
    first_caught_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    shiny_caught_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    total_caught: Mapped[int] = mapped_column(Integer, default=0)

    player: Mapped[Player] = relationship(back_populates="kodex")


class InventoryItem(Base):
    __tablename__ = "inventory_item"

    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("player.id"))
    item_id: Mapped[str] = mapped_column(String(64))
    qty: Mapped[int] = mapped_column(Integer, default=0)

    player: Mapped[Player] = relationship(back_populates="inventory")


class CaptureLog(Base):
    __tablename__ = "capture_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    player_id: Mapped[int] = mapped_column(ForeignKey("player.id"))
    species_id: Mapped[str] = mapped_column(String(64))
    shiny: Mapped[bool] = mapped_column(Boolean, default=False)
    ball_id: Mapped[str] = mapped_column(String(64))
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)
