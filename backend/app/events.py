"""Hamburg event calendar — drives spawn rates and shiny eligibility."""
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import yaml

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "events.yaml"


@dataclass(frozen=True)
class EventWindow:
    start: date
    end: date

    def contains(self, d: date) -> bool:
        return self.start <= d <= self.end


@dataclass(frozen=True)
class Event:
    id: str
    name: str
    zone: str
    active_rate: float
    dormant_rate: float
    windows: tuple[EventWindow, ...]

    def is_active(self, d: date) -> bool:
        return any(w.contains(d) for w in self.windows)


_events: dict[str, Event] = {}
# User overrides set from the settings menu. None = follow the calendar,
# True = treat as active regardless of date, False = treat as dormant.
# Lives in-memory only — resets on backend restart, which is fine for MVP.
_overrides: dict[str, bool] = {}


def load() -> None:
    raw = yaml.safe_load(DATA_PATH.read_text())
    _events.clear()
    for e in raw["events"]:
        windows = tuple(
            EventWindow(start=_parse(w["start"]), end=_parse(w["end"]))
            for w in e.get("windows") or []
        )
        _events[e["id"]] = Event(
            id=e["id"],
            name=e["name"],
            zone=e["zone"],
            active_rate=float(e["active_rate"]),
            dormant_rate=float(e["dormant_rate"]),
            windows=windows,
        )


def _parse(s: str | date) -> date:
    if isinstance(s, date):
        return s
    return date.fromisoformat(s)


def get_event(event_id: str) -> Event | None:
    return _events.get(event_id)


def all_events() -> list[Event]:
    return list(_events.values())


def is_active(event_id: str | None, on: date) -> bool:
    """A null event id (species with no event gating) counts as always active.
    User overrides win over the calendar."""
    if event_id is None:
        return True
    if event_id in _overrides:
        return _overrides[event_id]
    e = _events.get(event_id)
    if e is None:
        return False
    return e.is_active(on)


def set_override(event_id: str, value: bool | None) -> None:
    """value=True/False forces active state; None clears the override."""
    if value is None:
        _overrides.pop(event_id, None)
    else:
        _overrides[event_id] = value


def get_override(event_id: str) -> bool | None:
    return _overrides.get(event_id)
