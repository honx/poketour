"""Load species, items, and balls from data/species.yaml into in-memory registries."""
from dataclasses import dataclass
from pathlib import Path

import yaml

DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "species.yaml"


@dataclass(frozen=True)
class DialogueLine:
    player: str
    npc: str


@dataclass(frozen=True)
class Species:
    id: str
    name: str
    flavor: str
    max_skepsis: int
    flee_rate: float
    weakness: str
    zones: tuple[str, ...]
    event: str | None
    dialogue: tuple[DialogueLine, ...]


@dataclass(frozen=True)
class Item:
    id: str
    name: str
    base_damage: int


@dataclass(frozen=True)
class Ball:
    id: str
    name: str
    modifier: float


_species: dict[str, Species] = {}
_items: dict[str, Item] = {}
_balls: dict[str, Ball] = {}


def load() -> None:
    raw = yaml.safe_load(DATA_PATH.read_text())
    _species.clear()
    for s in raw["species"]:
        dialogue = tuple(
            DialogueLine(player=d["player"], npc=d["npc"])
            for d in (s.get("dialogue") or [])
        )
        _species[s["id"]] = Species(
            id=s["id"],
            name=s["name"],
            flavor=s["flavor"],
            max_skepsis=int(s["max_skepsis"]),
            flee_rate=float(s["flee_rate"]),
            weakness=s["weakness"],
            zones=tuple(s["zones"]),
            event=s.get("event"),
            dialogue=dialogue,
        )
    _items.clear()
    for i in raw["items"]:
        _items[i["id"]] = Item(id=i["id"], name=i["name"], base_damage=int(i["base_damage"]))
    _balls.clear()
    for b in raw["balls"]:
        _balls[b["id"]] = Ball(id=b["id"], name=b["name"], modifier=float(b["modifier"]))


def all_species() -> list[Species]:
    return list(_species.values())


def get_species(species_id: str) -> Species | None:
    return _species.get(species_id)


def species_for_zone(zone: str) -> list[Species]:
    return [s for s in _species.values() if zone in s.zones]


def get_item(item_id: str) -> Item | None:
    return _items.get(item_id)


def get_ball(ball_id: str) -> Ball | None:
    return _balls.get(ball_id)


def all_items() -> list[Item]:
    return list(_items.values())


def all_balls() -> list[Ball]:
    return list(_balls.values())
