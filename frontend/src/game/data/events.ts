// Ported from backend/data/events.yaml. Hamburg event calendar.
//
// Dates are ISO YYYY-MM-DD strings. is_active() does plain string comparison
// (lexicographic ordering matches calendar ordering for ISO dates).

export interface EventWindow {
  start: string;
  end: string;
}

export interface GameEvent {
  id: string;
  name: string;
  zone: string;
  active_rate: number;
  dormant_rate: number;
  windows: EventWindow[];
}

export const EVENTS: GameEvent[] = [
  {
    id: "hamburger_dom",
    name: "Hamburger Dom",
    zone: "heiligengeistfeld",
    active_rate: 0.20,
    dormant_rate: 0.005,
    windows: [
      { start: "2026-03-20", end: "2026-04-19" },
      { start: "2026-07-24", end: "2026-08-23" },
      { start: "2026-11-06", end: "2026-12-06" },
    ],
  },
  {
    id: "omr",
    name: "OMR Festival",
    zone: "messehallen",
    active_rate: 0.30,
    dormant_rate: 0.002,
    windows: [{ start: "2026-05-05", end: "2026-05-07" }],
  },
  {
    id: "internorga",
    name: "Internorga",
    zone: "messehallen",
    active_rate: 0.30,
    dormant_rate: 0.002,
    windows: [{ start: "2026-03-13", end: "2026-03-17" }],
  },
  {
    id: "hanseboot",
    name: "Hanseboot",
    zone: "messehallen",
    active_rate: 0.20,
    dormant_rate: 0.001,
    windows: [],
  },
  {
    id: "reeperbahn_festival",
    name: "Reeperbahn Festival",
    zone: "marktstrasse",
    active_rate: 0.25,
    dormant_rate: 0.05,
    windows: [{ start: "2026-09-23", end: "2026-09-26" }],
  },
  {
    id: "stadium_match",
    name: "Stadium match day",
    zone: "millerntor",
    active_rate: 0.30,
    dormant_rate: 0.02,
    windows: [
      { start: "2026-05-09", end: "2026-05-09" },
      { start: "2026-05-16", end: "2026-05-16" },
    ],
  },
  {
    id: "cruise_day",
    name: "Cruise ship day-tripper window",
    zone: "marktstrasse",
    active_rate: 0.10,
    dormant_rate: 0.03,
    windows: [{ start: "2026-05-01", end: "2026-09-30" }],
  },
  {
    id: "fischmarkt_sunday",
    name: "Fischmarkt Sunday",
    zone: "karolinenstrasse",
    active_rate: 0.15,
    dormant_rate: 0.01,
    windows: [
      { start: "2026-05-10", end: "2026-05-10" },
      { start: "2026-05-17", end: "2026-05-17" },
    ],
  },
  {
    id: "hafengeburtstag",
    name: "Hafengeburtstag",
    zone: "marktstrasse",
    active_rate: 0.20,
    dormant_rate: 0.01,
    windows: [{ start: "2026-05-08", end: "2026-05-10" }],
  },
];

const _eventById = new Map(EVENTS.map((e) => [e.id, e]));

// User overrides — None=follow calendar, true/false=force. Lives in memory and
// in localStorage so it survives reloads (saved alongside player state in
// storage.ts).
const _overrides = new Map<string, boolean>();

export function loadOverrides(saved: Record<string, boolean>): void {
  _overrides.clear();
  for (const [k, v] of Object.entries(saved)) _overrides.set(k, v);
}

export function dumpOverrides(): Record<string, boolean> {
  return Object.fromEntries(_overrides);
}

export function getEvent(id: string): GameEvent | undefined { return _eventById.get(id); }

export function allEvents(): GameEvent[] { return EVENTS; }

function eventWindowContains(e: GameEvent, isoDate: string): boolean {
  return e.windows.some((w) => w.start <= isoDate && isoDate <= w.end);
}

export function isActive(eventId: string | null, isoDate: string): boolean {
  if (eventId === null) return true;
  if (_overrides.has(eventId)) return _overrides.get(eventId)!;
  const e = _eventById.get(eventId);
  if (!e) return false;
  return eventWindowContains(e, isoDate);
}

export function calendarActive(eventId: string, isoDate: string): boolean {
  const e = _eventById.get(eventId);
  return e ? eventWindowContains(e, isoDate) : false;
}

export function setOverride(eventId: string, value: boolean | null): void {
  if (value === null) _overrides.delete(eventId);
  else _overrides.set(eventId, value);
}

export function getOverride(eventId: string): boolean | null {
  return _overrides.has(eventId) ? _overrides.get(eventId)! : null;
}
