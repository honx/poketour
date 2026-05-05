// Encounter / capture mechanics — ported from backend/app/encounter.py.

import { getBall, getItem, getSpecies } from "./data/species";

const SHINY_SKEPSIS_BONUS = 1.4;
const SHINY_BALL_PENALTY = 0.7;
const WEAKNESS_MULTIPLIER = 3.0;
const TALK_DAMAGE = 4;

export interface EncounterState {
  species_id: string;
  shiny: boolean;
  skepsis: number;
  max_skepsis: number;
  ended: boolean;
  outcome: "caught" | "fled" | "ran" | null;
  log: string[];
}

let _current: EncounterState | null = null;

export function start(speciesId: string, shiny: boolean): EncounterState {
  const sp = getSpecies(speciesId);
  if (!sp) throw new Error(`unknown species ${speciesId}`);
  const max = Math.floor(sp.max_skepsis * (shiny ? SHINY_SKEPSIS_BONUS : 1.0));
  _current = {
    species_id: sp.id,
    shiny,
    skepsis: max,
    max_skepsis: max,
    ended: false,
    outcome: null,
    log: [`A wild ${shiny ? "Shiny " : ""}${sp.name} appeared!`, sp.flavor],
  };
  return _current;
}

export function current(): EncounterState | null { return _current; }

function requireActive(): EncounterState {
  if (!_current || _current.ended) throw new Error("no active encounter");
  return _current;
}

export function useItem(itemId: string): EncounterState {
  const s = requireActive();
  const sp = getSpecies(s.species_id);
  const item = getItem(itemId);
  if (!sp || !item) throw new Error("invalid encounter or item");
  const mult = sp.weakness === item.id ? WEAKNESS_MULTIPLIER : 1.0;
  const dmg = Math.floor(item.base_damage * mult);
  s.skepsis = Math.max(0, s.skepsis - dmg);
  s.log.push(
    mult > 1
      ? `You offer a ${item.name}. It's super effective! Skepsis -${dmg}.`
      : `You offer a ${item.name}. Skepsis -${dmg}.`,
  );
  return s;
}

export function talk(): EncounterState {
  const s = requireActive();
  const sp = getSpecies(s.species_id);
  if (!sp) throw new Error("invalid encounter");
  s.skepsis = Math.max(0, s.skepsis - TALK_DAMAGE);
  if (sp.dialogue.length > 0) {
    const line = sp.dialogue[Math.floor(Math.random() * sp.dialogue.length)];
    s.log.push(`You: "${line.player}"`);
    s.log.push(`${sp.name}: "${line.npc}"`);
    s.log.push(`(Skepsis -${TALK_DAMAGE})`);
  } else {
    s.log.push(`You make small talk. Skepsis -${TALK_DAMAGE}.`);
  }
  if (Math.random() < sp.flee_rate) {
    s.ended = true;
    s.outcome = "fled";
    s.log.push(`The ${sp.name} got bored and wandered off!`);
  }
  return s;
}

export function throwBall(ballId: string): EncounterState {
  const s = requireActive();
  const sp = getSpecies(s.species_id);
  const ball = getBall(ballId);
  if (!sp || !ball) throw new Error("invalid encounter or ball");
  const base = 1.0 - s.skepsis / s.max_skepsis;
  let p = base * ball.modifier * (s.shiny ? SHINY_BALL_PENALTY : 1.0);
  p = Math.max(0, Math.min(1, p));
  s.log.push(`You throw a ${ball.name}...`);
  if (Math.random() < p) {
    s.ended = true;
    s.outcome = "caught";
    s.log.push(`Gotcha! ${sp.name} was added to the Kodex!`);
  } else {
    s.log.push("Oh no — they shrugged it off.");
  }
  return s;
}

export function run(): EncounterState {
  const s = requireActive();
  s.ended = true;
  s.outcome = "ran";
  s.log.push("You walked away.");
  return s;
}
