"""Spawn logic: given a zone and date, roll a (possibly null) encounter."""
import random
from datetime import date

from . import events, species

# Default shiny rate is 1/64 — much more discoverable than the classic-Pokémon
# 1/512 / 1/4096, and calibrated for short play sessions in a single zone.
# Players can toggle a "shiny boost" in the settings menu to push it to 1/16
# for testing / casual play.
BASE_SHINY_RATE = 1 / 64
BOOST_SHINY_RATE = 1 / 16
DEFAULT_RATE = 0.05  # for species with no event gating

_shiny_boost = False


def get_shiny_boost() -> bool:
    return _shiny_boost


def set_shiny_boost(value: bool) -> None:
    global _shiny_boost
    _shiny_boost = bool(value)


def current_shiny_rate() -> float:
    return BOOST_SHINY_RATE if _shiny_boost else BASE_SHINY_RATE


def roll_encounter(zone: str, on: date, rng: random.Random | None = None) -> tuple[species.Species, bool] | None:
    """
    Returns (Species, is_shiny) if an encounter triggers, else None.

    Each candidate species in the zone contributes its current rate. If multiple species
    fire on the same step (rare), pick one weighted by rate.
    """
    rng = rng or random.Random()
    candidates: list[tuple[species.Species, float]] = []
    for s in species.species_for_zone(zone):
        rate = _rate_for(s, on)
        if rate <= 0:
            continue
        if rng.random() < rate:
            candidates.append((s, rate))

    if not candidates:
        return None

    # Weighted pick among species that triggered
    total = sum(r for _, r in candidates)
    pick = rng.uniform(0, total)
    acc = 0.0
    for s, r in candidates:
        acc += r
        if pick <= acc:
            chosen = s
            break
    else:
        chosen = candidates[-1][0]

    is_shiny = events.is_active(chosen.event, on) and rng.random() < current_shiny_rate()
    return chosen, is_shiny


def _rate_for(s: species.Species, on: date) -> float:
    if s.event is None:
        return DEFAULT_RATE
    e = events.get_event(s.event)
    if e is None:
        return DEFAULT_RATE
    # Use the override-aware is_active so the settings menu actually moves rates.
    return e.active_rate if events.is_active(s.event, on) else e.dormant_rate
