// Backend client. Vite dev server proxies /api/* → http://localhost:8765/*

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${path}: HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

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

export const api = {
  health: () => request<{ ok: boolean; species: number; events: number }>("/healthz"),
  player: () => request<Player>("/player", { method: "POST" }),
  step: (x: number, y: number, zone: string | null, on_date?: string) =>
    request<EncounterRoll>("/step", {
      method: "POST",
      body: JSON.stringify({ x, y, zone, on_date }),
    }),
  encounter: () => request<EncounterState | null>("/encounter"),
  useItem: (item_id: string) =>
    request<EncounterState>("/encounter/item", {
      method: "POST",
      body: JSON.stringify({ item_id }),
    }),
  talk: () => request<EncounterState>("/encounter/talk", { method: "POST" }),
  throwBall: (ball_id: string) =>
    request<EncounterState>("/encounter/throw", {
      method: "POST",
      body: JSON.stringify({ ball_id }),
    }),
  run: () => request<EncounterState>("/encounter/run", { method: "POST" }),
  kodex: () => request<KodexEntry[]>("/kodex"),
  inventory: () => request<Inventory>("/inventory"),
  reset: () => request<Inventory>("/player/reset", { method: "POST" }),
  events: () => request<EventEntry[]>("/events"),
  setEventOverride: (event_id: string, override: boolean | null) =>
    request<EventEntry>(`/events/${event_id}`, {
      method: "POST",
      body: JSON.stringify({ override }),
    }),
  getSettings: () => request<GameSettings>("/settings"),
  setSettings: (shiny_boost: boolean) =>
    request<GameSettings>("/settings", {
      method: "POST",
      body: JSON.stringify({ shiny_boost }),
    }),
};

export interface GameSettings {
  shiny_boost: boolean;
  shiny_rate: number;
}

export interface EventEntry {
  id: string;
  name: string;
  zone: string;
  calendar_active: boolean;
  override: boolean | null;
  active: boolean;
}
