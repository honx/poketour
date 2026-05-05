"""Encounter / capture mechanics — the persuasion mini-game.

Encounter state is held in-memory for MVP (single player). Each new encounter
overwrites the previous one. Re-enter the overworld on capture/flee/run.
"""
from __future__ import annotations

import random
from dataclasses import dataclass, field

from . import species

SHINY_SKEPSIS_BONUS = 1.4  # shinies are 40% harder to capture
SHINY_BALL_PENALTY = 0.7  # and ball rolls are reduced
WEAKNESS_MULTIPLIER = 3.0
TALK_DAMAGE = 4


@dataclass
class EncounterState:
    species_id: str
    shiny: bool
    skepsis: int
    max_skepsis: int
    ended: bool = False
    outcome: str | None = None  # "caught" | "fled" | "ran"
    log: list[str] = field(default_factory=list)


_current: EncounterState | None = None
_rng = random.Random()


def start(species_id: str, shiny: bool) -> EncounterState:
    global _current
    sp = species.get_species(species_id)
    if sp is None:
        raise ValueError(f"unknown species {species_id}")
    max_skep = int(sp.max_skepsis * (SHINY_SKEPSIS_BONUS if shiny else 1.0))
    _current = EncounterState(
        species_id=sp.id,
        shiny=shiny,
        skepsis=max_skep,
        max_skepsis=max_skep,
        log=[f"A wild {'Shiny ' if shiny else ''}{sp.name} appeared!", sp.flavor],
    )
    return _current


def current() -> EncounterState | None:
    return _current


def use_item(item_id: str) -> EncounterState:
    s = _require_active()
    sp = species.get_species(s.species_id)
    item = species.get_item(item_id)
    if sp is None or item is None:
        raise ValueError("invalid encounter or item")
    mult = WEAKNESS_MULTIPLIER if sp.weakness == item.id else 1.0
    dmg = int(item.base_damage * mult)
    s.skepsis = max(0, s.skepsis - dmg)
    if mult > 1:
        s.log.append(f"You offer a {item.name}. It's super effective! Skepsis -{dmg}.")
    else:
        s.log.append(f"You offer a {item.name}. Skepsis -{dmg}.")
    return s


def talk() -> EncounterState:
    s = _require_active()
    sp = species.get_species(s.species_id)
    if sp is None:
        raise ValueError("invalid encounter")
    s.skepsis = max(0, s.skepsis - TALK_DAMAGE)
    if sp.dialogue:
        line = _rng.choice(sp.dialogue)
        s.log.append(f"You: \"{line.player}\"")
        s.log.append(f"{sp.name}: \"{line.npc}\"")
        s.log.append(f"(Skepsis -{TALK_DAMAGE})")
    else:
        s.log.append(f"You make small talk. Skepsis -{TALK_DAMAGE}.")
    if _rng.random() < sp.flee_rate:
        s.ended = True
        s.outcome = "fled"
        s.log.append(f"The {sp.name} got bored and wandered off!")
    return s


def throw_ball(ball_id: str) -> EncounterState:
    s = _require_active()
    sp = species.get_species(s.species_id)
    ball = species.get_ball(ball_id)
    if sp is None or ball is None:
        raise ValueError("invalid encounter or ball")
    base = 1.0 - (s.skepsis / s.max_skepsis)
    p = base * ball.modifier * (SHINY_BALL_PENALTY if s.shiny else 1.0)
    p = max(0.0, min(1.0, p))
    s.log.append(f"You throw a {ball.name}...")
    if _rng.random() < p:
        s.ended = True
        s.outcome = "caught"
        s.log.append(f"Gotcha! {sp.name} was added to the Kodex!")
    else:
        s.log.append("Oh no — they shrugged it off.")
    return s


def run() -> EncounterState:
    s = _require_active()
    s.ended = True
    s.outcome = "ran"
    s.log.append("You walked away.")
    return s


def _require_active() -> EncounterState:
    if _current is None or _current.ended:
        raise ValueError("no active encounter")
    return _current
