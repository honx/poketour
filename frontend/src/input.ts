// Keyboard input. Tracks held keys + emits "pressed-this-frame" via consume().

import { audio } from "./audio";

export type Key =
  | "up" | "down" | "left" | "right"
  | "confirm" | "cancel" | "menu"
  | "reset" | "settings" | "mute";

const map: Record<string, Key> = {
  ArrowUp: "up", w: "up", W: "up",
  ArrowDown: "down", s: "down", S: "down",
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
  z: "confirm", Z: "confirm", " ": "confirm", Enter: "menu",
  x: "cancel", X: "cancel", Escape: "cancel",
  r: "reset", R: "reset",
  e: "settings", E: "settings",
  m: "mute", M: "mute",
};

const held = new Set<Key>();
const justPressed = new Set<Key>();

export function attachInput() {
  window.addEventListener("keydown", (e) => {
    const k = map[e.key];
    if (!k) return;
    // Browsers gate WebAudio behind a user gesture — unlock on first key.
    audio.unlock();
    if (!held.has(k)) justPressed.add(k);
    held.add(k);
    if (k === "menu" || k === "confirm" || k === "cancel") e.preventDefault();
  });
  window.addEventListener("keyup", (e) => {
    const k = map[e.key];
    if (!k) return;
    held.delete(k);
  });
}

export function isHeld(k: Key): boolean {
  return held.has(k);
}

export function consume(k: Key): boolean {
  const had = justPressed.has(k);
  justPressed.delete(k);
  return had;
}

export function clearJustPressed() {
  justPressed.clear();
}
