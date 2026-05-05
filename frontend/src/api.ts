// Game service layer — keeps the original async/Promise shape so scene code
// is unchanged, but everything runs in-process now (no backend, no fetch).
// Persistence goes through src/game/storage.ts (localStorage blob).

import * as enc from "./game/encounter";
import * as spawn from "./game/spawn";
import * as store from "./game/storage";
import { allEvents, calendarActive, getEvent, getOverride, isActive, setOverride } from "./game/data/events";
import { BALLS, ITEMS, SPECIES, type Species } from "./game/data/species";

export interface Player {
  id: number;
  name: string;
  x: number;
  y: number;
}

export interface SpeciesOut {
  id: string;
  name: string;
  flavor: string;
  max_skepsis: number;
  weakness: string;
  zones: string[];
  event: string | null;
}

export interface EncounterRoll {
  species: SpeciesOut | null;
  shiny: boolean;
}

export interface EncounterState {
  species_id: string;
  shiny: boolean;
  skepsis: number;
  max_skepsis: number;
  ended: boolean;
  outcome: "caught" | "fled" | "ran" | null;
  log: string[];
}

export interface KodexEntry {
  species_id: string;
  name: string;
  caught: boolean;
  shiny_caught: boolean;
  total_caught: number;
  first_caught_at: string | null;
}

export interface Inventory {
  items: Record<string, number>;
  balls: Record<string, number>;
}

export interface EventEntry {
  id: string;
  name: string;
  zone: string;
  calendar_active: boolean;
  override: boolean | null;
  active: boolean;
}

export interface GameSettings {
  shiny_boost: boolean;
  shiny_rate: number;
}

// Boot: load any saved state on first import.
store.load();
spawn.setShinyBoost(store.get().shiny_boost);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function speciesOut(s: Species): SpeciesOut {
  return {
    id: s.id,
    name: s.name,
    flavor: s.flavor,
    max_skepsis: s.max_skepsis,
    weakness: s.weakness,
    zones: [...s.zones],
    event: s.event,
  };
}

function snapshotInventory(): Inventory {
  const s = store.get();
  return {
    items: { ...s.inventory.items },
    balls: { ...s.inventory.balls },
  };
}

function snapshotEncounter(s: enc.EncounterState): EncounterState {
  return { ...s, log: [...s.log] };
}

export const api = {
  health: async () => ({ ok: true, species: SPECIES.length, events: allEvents().length }),

  player: async (): Promise<Player> => {
    const s = store.get();
    return { ...s.player };
  },

  step: async (x: number, y: number, zone: string | null, on_date?: string): Promise<EncounterRoll> => {
    const s = store.get();
    s.player.x = x;
    s.player.y = y;
    store.save();
    if (!zone) return { species: null, shiny: false };
    const rolled = spawn.rollEncounter(zone, on_date ?? todayIso());
    if (!rolled) return { species: null, shiny: false };
    const [sp, shiny] = rolled;
    enc.start(sp.id, shiny);
    return { species: speciesOut(sp), shiny };
  },

  encounter: async (): Promise<EncounterState | null> => {
    const c = enc.current();
    return c ? snapshotEncounter(c) : null;
  },

  useItem: async (item_id: string): Promise<EncounterState> => {
    const inv = store.get().inventory.items;
    if ((inv[item_id] ?? 0) <= 0) throw new Error(`no ${item_id} in inventory`);
    const s = enc.useItem(item_id);
    inv[item_id] = (inv[item_id] ?? 0) - 1;
    store.save();
    return snapshotEncounter(s);
  },

  talk: async (): Promise<EncounterState> => snapshotEncounter(enc.talk()),

  throwBall: async (ball_id: string): Promise<EncounterState> => {
    const inv = store.get().inventory.balls;
    if ((inv[ball_id] ?? 0) <= 0) throw new Error(`no ${ball_id} in inventory`);
    inv[ball_id] = (inv[ball_id] ?? 0) - 1;
    let s: enc.EncounterState;
    try {
      s = enc.throwBall(ball_id);
    } catch (e) {
      inv[ball_id] = (inv[ball_id] ?? 0) + 1;
      throw e;
    }
    const at = new Date().toISOString();
    store.recordCapture({
      at, species_id: s.species_id, shiny: s.shiny, ball_id,
      success: s.outcome === "caught",
    });
    if (s.outcome === "caught") store.recordKodexCatch(s.species_id, s.shiny, at);
    store.save();
    return snapshotEncounter(s);
  },

  run: async (): Promise<EncounterState> => snapshotEncounter(enc.run()),

  kodex: async (): Promise<KodexEntry[]> => {
    const k = store.get().kodex;
    return SPECIES.map((sp) => {
      const e = k[sp.id];
      return {
        species_id: sp.id,
        name: sp.name,
        caught: !!e && e.total_caught > 0,
        shiny_caught: !!e && !!e.shiny_caught_at,
        total_caught: e?.total_caught ?? 0,
        first_caught_at: e?.first_caught_at ?? null,
      };
    });
  },

  inventory: async (): Promise<Inventory> => snapshotInventory(),

  reset: async (): Promise<Inventory> => {
    store.resetInventory();
    // End any active encounter so it can't be re-used after reset.
    const cur = enc.current();
    if (cur && !cur.ended) enc.run();
    return snapshotInventory();
  },

  events: async (): Promise<EventEntry[]> => {
    const today = todayIso();
    return allEvents().map((e) => ({
      id: e.id,
      name: e.name,
      zone: e.zone,
      calendar_active: calendarActive(e.id, today),
      override: getOverride(e.id),
      active: isActive(e.id, today),
    }));
  },

  setEventOverride: async (event_id: string, override: boolean | null): Promise<EventEntry> => {
    const e = getEvent(event_id);
    if (!e) throw new Error(`unknown event ${event_id}`);
    setOverride(event_id, override);
    const today = todayIso();
    const s = store.get();
    s.event_overrides = (await import("./game/data/events")).dumpOverrides();
    store.save();
    return {
      id: e.id, name: e.name, zone: e.zone,
      calendar_active: calendarActive(e.id, today),
      override: getOverride(e.id),
      active: isActive(e.id, today),
    };
  },

  getSettings: async (): Promise<GameSettings> => ({
    shiny_boost: spawn.getShinyBoost(),
    shiny_rate: spawn.currentShinyRate(),
  }),

  setSettings: async (shiny_boost: boolean): Promise<GameSettings> => {
    spawn.setShinyBoost(shiny_boost);
    store.get().shiny_boost = shiny_boost;
    store.save();
    return { shiny_boost: spawn.getShinyBoost(), shiny_rate: spawn.currentShinyRate() };
  },
};

// Re-exported for any caller that needs the raw item/ball lists (sprites etc.)
export { ITEMS, BALLS, SPECIES };
