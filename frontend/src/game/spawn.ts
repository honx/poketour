// Spawn logic — ported from backend/app/spawn.py.

import { getEvent, isActive } from "./data/events";
import { speciesForZone, type Species } from "./data/species";

export const BASE_SHINY_RATE = 1 / 64;
export const BOOST_SHINY_RATE = 1 / 16;
export const DEFAULT_RATE = 0.05;
export const ENCOUNTER_RATE_MULTIPLIER = 0.5;

let _shinyBoost = false;

export function getShinyBoost(): boolean { return _shinyBoost; }
export function setShinyBoost(value: boolean): void { _shinyBoost = !!value; }
export function currentShinyRate(): number {
  return _shinyBoost ? BOOST_SHINY_RATE : BASE_SHINY_RATE;
}

function rateFor(s: Species, isoDate: string): number {
  if (s.event === null) return DEFAULT_RATE * ENCOUNTER_RATE_MULTIPLIER;
  const e = getEvent(s.event);
  if (!e) return DEFAULT_RATE * ENCOUNTER_RATE_MULTIPLIER;
  const base = isActive(s.event, isoDate) ? e.active_rate : e.dormant_rate;
  return base * ENCOUNTER_RATE_MULTIPLIER;
}

/** Returns [Species, isShiny] if an encounter triggers, else null. */
export function rollEncounter(zone: string, isoDate: string): [Species, boolean] | null {
  const candidates: Array<[Species, number]> = [];
  for (const s of speciesForZone(zone)) {
    const rate = rateFor(s, isoDate);
    if (rate <= 0) continue;
    if (Math.random() < rate) candidates.push([s, rate]);
  }
  if (candidates.length === 0) return null;

  const total = candidates.reduce((a, [, r]) => a + r, 0);
  let pick = Math.random() * total;
  let chosen = candidates[candidates.length - 1][0];
  for (const [s, r] of candidates) {
    pick -= r;
    if (pick <= 0) { chosen = s; break; }
  }

  const shiny = isActive(chosen.event, isoDate) && Math.random() < currentShinyRate();
  return [chosen, shiny];
}
