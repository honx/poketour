// Single-blob localStorage persistence — replaces the SQLite layer for the
// client-side build. Schema is forgiving on read (missing keys → defaults),
// strict on write (we always dump the full SaveFile).

import { dumpOverrides, loadOverrides } from "./data/events";

const KEY = "poketour:save:v1";

export interface KodexRecord {
  species_id: string;
  first_caught_at: string | null;  // ISO datetime
  shiny_caught_at: string | null;
  total_caught: number;
}

export interface CaptureRecord {
  at: string;
  species_id: string;
  shiny: boolean;
  ball_id: string;
  success: boolean;
}

export interface SaveFile {
  player: { id: number; name: string; x: number; y: number };
  inventory: { items: Record<string, number>; balls: Record<string, number> };
  kodex: Record<string, KodexRecord>;
  captures: CaptureRecord[];
  shiny_boost: boolean;
  event_overrides: Record<string, boolean>;
}

export const STARTER_INVENTORY = {
  items: {
    bratwurst: 3,
    lebkuchenherz: 3,
    astra_bier: 3,
    probierhaeppchen: 2,
    visitenkarte: 2,
  } as Record<string, number>,
  balls: {
    touri_ball: 10,
    premium_ball: 3,
    hanse_ball: 1,
  } as Record<string, number>,
};

function defaultSave(): SaveFile {
  return {
    player: { id: 1, name: "Trainer", x: 10, y: 20 },
    inventory: { items: { ...STARTER_INVENTORY.items }, balls: { ...STARTER_INVENTORY.balls } },
    kodex: {},
    captures: [],
    shiny_boost: false,
    event_overrides: {},
  };
}

let _save: SaveFile = defaultSave();

export function load(): void {
  if (typeof localStorage === "undefined") return;
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    _save = defaultSave();
    return;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<SaveFile>;
    const def = defaultSave();
    _save = {
      player: { ...def.player, ...(parsed.player ?? {}) },
      inventory: {
        items: { ...def.inventory.items, ...(parsed.inventory?.items ?? {}) },
        balls: { ...def.inventory.balls, ...(parsed.inventory?.balls ?? {}) },
      },
      kodex: parsed.kodex ?? {},
      captures: parsed.captures ?? [],
      shiny_boost: parsed.shiny_boost ?? false,
      event_overrides: parsed.event_overrides ?? {},
    };
  } catch {
    _save = defaultSave();
  }
  loadOverrides(_save.event_overrides);
}

export function save(): void {
  if (typeof localStorage === "undefined") return;
  _save.event_overrides = dumpOverrides();
  localStorage.setItem(KEY, JSON.stringify(_save));
}

export function get(): SaveFile { return _save; }

export function resetInventory(): void {
  _save.inventory.items = { ...STARTER_INVENTORY.items };
  _save.inventory.balls = { ...STARTER_INVENTORY.balls };
  save();
}

export function recordCapture(rec: CaptureRecord): void {
  _save.captures.push(rec);
}

export function recordKodexCatch(species_id: string, shiny: boolean, atIso: string): void {
  const existing = _save.kodex[species_id];
  if (!existing) {
    _save.kodex[species_id] = {
      species_id,
      first_caught_at: atIso,
      shiny_caught_at: shiny ? atIso : null,
      total_caught: 1,
    };
  } else {
    existing.total_caught += 1;
    if (shiny && !existing.shiny_caught_at) existing.shiny_caught_at = atIso;
  }
}
