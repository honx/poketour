// Title screen: big logo, flavor subtitle, blinking start prompt.
// Plays the ambient pad until the player commits to enter the overworld.

import { Application, Container, Graphics, Text } from "pixi.js";

import { audio } from "../audio";
import { consume } from "../input";
import { tourist as makeTouristSprite, TOURIST_PNG_IDS } from "../sprites";
import type { SceneHost } from "./scene-host";

const VIEW_W = 640;
const VIEW_H = 480;

export class Title {
  view: Container;
  private app: Application;
  private host: SceneHost;
  private prompt: Text;
  private blink = 0;

  constructor(app: Application, host: SceneHost) {
    this.app = app;
    this.host = host;
    this.view = new Container();

    // Sky-to-night gradient backdrop
    const bg = new Graphics();
    bg.rect(0, 0, VIEW_W, VIEW_H).fill(0x0a1422);
    bg.rect(0, 0, VIEW_W, 200).fill(0x1a2c44);
    bg.rect(0, 0, VIEW_W, 100).fill(0x2a4060);
    this.view.addChild(bg);

    // Faux pixel "horizon" — a few building silhouettes
    const sky = new Graphics();
    // Messehallen glass arches (stylized as triangular peaks)
    sky.poly([100, 280, 160, 220, 220, 280]).fill(0x0a1018);
    sky.poly([220, 280, 280, 230, 340, 280]).fill(0x0a1018);
    sky.poly([340, 280, 400, 215, 460, 280]).fill(0x0a1018);
    // Hochbunker block
    sky.rect(480, 200, 90, 80).fill(0x080c14);
    // Ground line
    sky.rect(0, 280, VIEW_W, 4).fill(0x000000);
    sky.rect(0, 284, VIEW_W, VIEW_H - 284).fill(0x142018);
    this.view.addChild(sky);

    // Random pair flanking the title — one regular, one shiny, never the same
    // species. Whichever side is shiny is also randomized.
    const pool = [...TOURIST_PNG_IDS];
    const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const b = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const shinyOnLeft = Math.random() < 0.5;

    const left = makeTouristSprite({ speciesId: a, shiny: shinyOnLeft, scale: 2 });
    left.x = 60;
    left.y = 300;
    this.view.addChild(left);

    const right = makeTouristSprite({ speciesId: b, shiny: !shinyOnLeft, scale: 2 });
    right.x = VIEW_W - 60 - 64;
    right.y = 300;
    this.view.addChild(right);

    // Title — fake "outline" by stacking a black copy behind a yellow one.
    const titleStyle = {
      fontFamily: "monospace",
      fontSize: 64,
      fontWeight: "bold" as const,
      fill: 0xffd64a,
    };
    const titleShadow = new Text({
      text: "POKETOUR",
      style: { ...titleStyle, fill: 0x000000 },
    });
    titleShadow.x = (VIEW_W - titleShadow.width) / 2 + 4;
    titleShadow.y = 80 + 4;
    this.view.addChild(titleShadow);

    const title = new Text({ text: "POKETOUR", style: titleStyle });
    title.x = (VIEW_W - title.width) / 2;
    title.y = 80;
    this.view.addChild(title);

    const subtitle = new Text({
      text: "— Touristen-Kodex of Karolinenviertel —",
      style: { fontFamily: "monospace", fontSize: 16, fill: 0xddddee, fontStyle: "italic" },
    });
    subtitle.x = (VIEW_W - subtitle.width) / 2;
    subtitle.y = 158;
    this.view.addChild(subtitle);

    // Start prompt
    this.prompt = new Text({
      text: "Press Z / Space / Enter to begin",
      style: { fontFamily: "monospace", fontSize: 18, fill: 0xffffff, fontWeight: "bold" },
    });
    this.prompt.x = (VIEW_W - this.prompt.width) / 2;
    this.prompt.y = 380;
    this.view.addChild(this.prompt);

    // Hint footer
    const hint = new Text({
      text: "Arrows move · Z confirm · X cancel · Enter Kodex · E Settings · R restore · M mute",
      style: { fontFamily: "monospace", fontSize: 10, fill: 0x88a0b0 },
    });
    hint.x = (VIEW_W - hint.width) / 2;
    hint.y = VIEW_H - 24;
    this.view.addChild(hint);
  }

  enter() {
    this.app.ticker.add(this.tick);
    audio.playLoop("ambient");
  }

  exit() {
    this.app.ticker.remove(this.tick);
  }

  private tick = () => {
    this.blink += 1;
    this.prompt.alpha = 0.5 + 0.5 * Math.abs(Math.sin(this.blink / 30));

    if (consume("confirm") || consume("menu")) {
      this.host.go("overworld");
    }
  };
}
