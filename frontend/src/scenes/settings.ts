// Settings scene: shiny-boost toggle plus the event calendar override list.
// Useful for testing and for "I want to catch an OMR-Tourist outside the May
// window" play.

import { Application, Container, Graphics, Text } from "pixi.js";

import { api, type EventEntry, type GameSettings } from "../api";
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
  private settings: GameSettings | null = null;
  private cursor = 0;
  private repeatTimer = 0;

  constructor(app: Application, host: SceneHost) {
    this.app = app;
    this.host = host;
    this.view = new Container();

    const bg = new Graphics().rect(0, 0, VIEW_W, VIEW_H).fill(0x080814);
    this.view.addChild(bg);

    const title = new Text({ text: "SETTINGS", style: FONT_BIG });
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

  private rowCount() {
    return 1 + this.events.length;
  }

  private tick = () => {
    if (consume("cancel") || consume("menu")) {
      this.host.go("overworld");
      return;
    }
    const dy = isHeld("up") ? -1 : isHeld("down") ? 1 : 0;
    if (dy !== 0) {
      if (this.repeatTimer <= 0) {
        const n = this.rowCount();
        this.cursor = (this.cursor + dy + n) % n;
        this.redraw();
        this.repeatTimer = 12;
      } else {
        this.repeatTimer--;
      }
    } else {
      this.repeatTimer = 0;
    }
    if (consume("confirm")) {
      if (this.cursor === 0) {
        void this.toggleShiny();
      } else {
        void this.cycleAt(this.cursor - 1);
      }
    }
  };

  private async load() {
    try {
      const [events, settings] = await Promise.all([api.events(), api.getSettings()]);
      this.events = events;
      this.settings = settings;
    } catch (e) {
      const t = new Text({ text: `(failed to load: ${(e as Error).message})`, style: FONT });
      this.listLayer.addChild(t);
      return;
    }
    this.redraw();
  }

  private async toggleShiny() {
    if (!this.settings) return;
    try {
      this.settings = await api.setSettings(!this.settings.shiny_boost);
      this.redraw();
    } catch (err) {
      console.error("shiny toggle failed", err);
    }
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

    const shinyRow = new Container();
    shinyRow.y = 0;
    const boost = !!this.settings?.shiny_boost;
    const rate = this.settings?.shiny_rate ?? 0;
    const rateLabel = rate > 0 ? `1/${Math.round(1 / rate)}` : "?";
    const shinyName = new Text({
      text: "Shiny Boost  ·  rare-encounter rate",
      style: { ...FONT, fill: 0xffe070 },
    });
    shinyName.x = 20;
    shinyRow.addChild(shinyName);
    const shinyState = new Text({
      text: (boost ? "BOOST ON " : "off      ") + ` → ${rateLabel}`,
      style: { ...FONT_SMALL, fill: boost ? 0x70d090 : 0x90a0c0 },
    });
    shinyState.x = 360;
    shinyState.y = 4;
    shinyRow.addChild(shinyState);
    this.listLayer.addChild(shinyRow);

    const sep = new Graphics().rect(20, rowH + 4, VIEW_W - 80, 1).fill(0x303040);
    this.listLayer.addChild(sep);

    this.events.forEach((e, i) => {
      const row = new Container();
      row.y = (i + 1) * rowH + 8;

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
    const cursorY = this.cursor === 0
      ? 60 - 2
      : 60 + this.cursor * rowH + 8 - 2;
    this.cursorLine.rect(20, cursorY, VIEW_W - 40, rowH).fill(0x182838);
  }
}
