from datetime import date, datetime

from pydantic import BaseModel


class PlayerOut(BaseModel):
    id: int
    name: str
    x: int
    y: int


class StepIn(BaseModel):
    x: int
    y: int
    zone: str | None = None
    on_date: date | None = None  # override for testing event windows


class SpeciesOut(BaseModel):
    id: str
    name: str
    flavor: str
    max_skepsis: int
    weakness: str
    zones: list[str]
    event: str | None


class EncounterRollOut(BaseModel):
    species: SpeciesOut | None
    shiny: bool = False


class EncounterStateOut(BaseModel):
    species_id: str
    shiny: bool
    skepsis: int
    max_skepsis: int
    ended: bool
    outcome: str | None
    log: list[str]


class ItemAction(BaseModel):
    item_id: str


class BallAction(BaseModel):
    ball_id: str


class KodexEntryOut(BaseModel):
    species_id: str
    name: str
    caught: bool
    shiny_caught: bool
    total_caught: int
    first_caught_at: datetime | None


class InventoryOut(BaseModel):
    items: dict[str, int]
    balls: dict[str, int]


class EventOut(BaseModel):
    id: str
    name: str
    zone: str
    calendar_active: bool   # what the YAML calendar says for `on_date`
    override: bool | None   # None = follow calendar, True/False = forced
    active: bool            # effective state: override if set, else calendar


class EventOverrideIn(BaseModel):
    override: bool | None  # None clears the override
