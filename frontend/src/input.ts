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

  attachTouchControls();
}

// ---- on-screen touch controls --------------------------------------------
// Buttons in index.html carry data-key="up|down|left|right|confirm|cancel|
// menu|settings|reset". Pointer events feed into the same held/justPressed
// sets so scene code can't tell touch from keyboard.

function pressKey(k: Key) {
  audio.unlock();
  if (!held.has(k)) justPressed.add(k);
  held.add(k);
}

function releaseKey(k: Key) {
  held.delete(k);
}

function attachTouchControls() {
  // Track which pointer is currently on which button so dragging off cancels
  // and dragging onto another (within the dpad) re-presses cleanly.
  const pointerKey = new Map<number, Key>();

  const dpadKeys = new Set<Key>(["up", "down", "left", "right"]);

  const setActive = (k: Key, on: boolean) => {
    document.querySelectorAll<HTMLElement>(`.tc-btn[data-key="${k}"]`).forEach((el) => {
      el.classList.toggle("active", on);
    });
  };

  const buttons = document.querySelectorAll<HTMLElement>(".tc-btn[data-key]");
  buttons.forEach((btn) => {
    const k = btn.dataset.key as Key | undefined;
    if (!k) return;

    btn.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      btn.setPointerCapture(e.pointerId);
      pointerKey.set(e.pointerId, k);
      setActive(k, true);
      pressKey(k);
    });

    // Pointermove fires on the captured button even after the finger drifts
    // off — that's how we get swipe-between-dpad-buttons. We hit-test the
    // current pointer position against any dpad button and swap the held key.
    btn.addEventListener("pointermove", (e) => {
      const cur = pointerKey.get(e.pointerId);
      if (!cur || !dpadKeys.has(cur)) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      const next = target?.closest<HTMLElement>(".tc-btn[data-key]");
      const nextKey = next?.dataset.key as Key | undefined;
      if (!nextKey || !dpadKeys.has(nextKey) || nextKey === cur) return;
      releaseKey(cur);
      setActive(cur, false);
      pressKey(nextKey);
      setActive(nextKey, true);
      pointerKey.set(e.pointerId, nextKey);
    });

    const end = (e: PointerEvent) => {
      const cur = pointerKey.get(e.pointerId);
      if (cur) {
        releaseKey(cur);
        setActive(cur, false);
        pointerKey.delete(e.pointerId);
      }
    };
    btn.addEventListener("pointerup", end);
    btn.addEventListener("pointercancel", end);

    // Long-press context menu would interrupt holds; suppress.
    btn.addEventListener("contextmenu", (e) => e.preventDefault());
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
