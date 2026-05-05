"""Spawn logic: given a zone and date, roll a (possibly null) encounter."""
import random
from datetime import date

from . import events, species

SHINY_RATE = 1 / 512
DEFAULT_RATE = 0.05  # for species with no event gating


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

    is_shiny = events.is_active(chosen.event, on) and rng.random() < SHINY_RATE
    return chosen, is_shiny


def _rate_for(s: species.Species, on: date) -> float:
    if s.event is None:
        return DEFAULT_RATE
    e = events.get_event(s.event)
    if e is None:
        return DEFAULT_RATE
    # Use the override-aware is_active so the settings menu actually moves rates.
    return e.active_rate if events.is_active(s.event, on) else e.dormant_rate
