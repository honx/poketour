// Settings scene: list every event in the calendar with its current state and
// let the player force it active/dormant. Useful for testing and for "I want
// to catch an OMR-Tourist outside the May window" play.

import { Application, Container, Graphics, Text } from "pixi.js";

import { api, type EventEntry } from "../api";
import { audio } from "../audio";
import { consume, isHeld } from "../input";
import type { SceneHost } from "./scene-host";

const VIEW_W = 640;
const VIEW_H = 480;
const FONT = { fontFamily: "monospace", fontSize: 14, fill: 0xffffff } as const;
const FONT_SMALL = { fontFamily: "monospace", fontSize: 11, fill: 0xddddee } as const;
const FONT_BIG = { fontFamily: "monospace", fontSize: 22, fill: 0xffffff, fontWeight: "bold" } as const;

const STATES: Array<{ override: boolean | null; label: string; color: number }> = [
  { override: null,  label: "calendar", color: 0x90a0c0 },
  { override: true,  label: "FORCED ON", color: 0x70d090 },
  { override: false, label: "forced off", color: 0xd07070 },
];

export class Settings {
  view: Container;
  private app: Application;
  private host: SceneHost;
  private listLayer: Container;
  private cursorLine: Graphics;
  private events: EventEntry[] = [];
  private cursor = 0;
  private repeatTimer = 0;

  constructor(app: Application, host: SceneHost) {
    this.app = app;
    this.host = host;
    this.view = new Container();

    const bg = new Graphics().rect(0, 0, VIEW_W, VIEW_H).fill(0x080814);
    this.view.addChild(bg);

    const title = new Text({ text: "SETTINGS · EVENTS", style: FONT_BIG });
    title.x = 20;
    title.y = 12;
    this.view.addChild(title);

    const hint = new Text({
      text: "↑/↓ select   Z/Space cycle   X/Esc close",
      style: FONT_SMALL,
    });
    hint.x = VIEW_W - 320;
    hint.y = 22;
    this.view.addChild(hint);

    this.cursorLine = new Graphics();
    this.view.addChild(this.cursorLine);

    this.listLayer = new Container();
    this.listLayer.x = 20;
    this.listLayer.y = 60;
    this.view.addChild(this.listLayer);

    void this.load();
  }

  enter() {
    this.app.ticker.add(this.tick);
    audio.playLoop("ambient");
  }

  exit() {
    this.app.ticker.remove(this.tick);
  }

  private tick = () => {
    if (consume("cancel") || consume("menu")) {
      this.host.go("overworld");
      return;
    }
    // Cursor with light auto-repeat for held keys.
    const dy = isHeld("up") ? -1 : isHeld("down") ? 1 : 0;
    if (dy !== 0) {
      if (this.repeatTimer <= 0) {
        this.cursor = (this.cursor + dy + this.events.length) % this.events.length;
        this.redraw();
        this.repeatTimer = 12;
      } else {
        this.repeatTimer--;
      }
    } else {
      this.repeatTimer = 0;
    }
    if (consume("confirm")) {
      void this.cycleAt(this.cursor);
    }
  };

  private async load() {
    try {
      this.events = await api.events();
    } catch (e) {
      const t = new Text({ text: `(failed to load events: ${(e as Error).message})`, style: FONT });
      this.listLayer.addChild(t);
      return;
    }
    this.redraw();
  }

  private async cycleAt(i: number) {
    const e = this.events[i];
    if (!e) return;
    const idx = STATES.findIndex((s) => s.override === e.override);
    const next = STATES[(idx + 1) % STATES.length];
    try {
      const updated = await api.setEventOverride(e.id, next.override);
      this.events[i] = updated;
      this.redraw();
    } catch (err) {
      console.error("override failed", err);
    }
  }

  private redraw() {
    this.listLayer.removeChildren();
    const rowH = 32;
    this.events.forEach((e, i) => {
      const row = new Container();
      row.y = i * rowH;

      const stateInfo = STATES.find((s) => s.override === e.override) ?? STATES[0];

      const name = new Text({
        text: `${e.name}  ·  ${e.zone}`,
        style: { ...FONT, fill: e.active ? 0xffffff : 0x808090 },
      });
      name.x = 20;
      row.addChild(name);

      const stateText = new Text({
        text: stateInfo.label.padEnd(10) + (e.active ? "  → ACTIVE" : "  → dormant"),
        style: { ...FONT_SMALL, fill: stateInfo.color },
      });
      stateText.x = 360;
      stateText.y = 4;
      row.addChild(stateText);

      this.listLayer.addChild(row);
    });

    this.cursorLine.clear();
    this.cursorLine.rect(20, 60 + this.cursor * rowH - 2, VIEW_W - 40, rowH).fill(0x182838);
  }
}
