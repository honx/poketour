// Chiptune audio: a tiny WebAudio synth + scheduler. No external assets.
// Square/triangle leads with ADSR envelopes for the SNES-era feel.
//
// Usage:
//   audio.unlock()           — call on first user gesture (browsers require this)
//   audio.sfx("capture")     — fire a one-shot SFX
//   audio.playLoop("over")   — start a looping music track
//   audio.stopLoop()         — stop whatever's playing
//   audio.toggleMute()       — flip global mute

type Wave = "square" | "triangle" | "sawtooth" | "sine";
type Note = [pitch: number, dur: number]; // pitch = MIDI note (0 = silence/rest), dur = beats

// MIDI → Hz. 69 is A4 = 440.
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private currentLoopStop: (() => void) | null = null;
  private currentLoopName: string | null = null;

  /** Browsers block audio until a user gesture; call this on first keypress. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.18; // overall headroom
    this.master.connect(this.ctx.destination);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.18;
    return this.muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  // ---- one-shot tones --------------------------------------------------------

  // outNode lets loop voices route through a per-loop gain so we can hard-mute
  // a track without waiting for the lookahead-scheduled notes to finish.
  private blip(freq: number, dur: number, wave: Wave, gainScale = 1, t0?: number, outNode?: AudioNode): void {
    if (!this.ctx || !this.master) return;
    const t = t0 ?? this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;

    // Tight ADSR — punchy chiptune transient.
    const attack = 0.005;
    const decay = Math.min(0.08, dur * 0.3);
    const sustain = gainScale * 0.6;
    const release = 0.04;
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gainScale, t + attack);
    env.gain.linearRampToValueAtTime(sustain, t + attack + decay);
    env.gain.setValueAtTime(sustain, t + Math.max(attack + decay, dur - release));
    env.gain.linearRampToValueAtTime(0, t + dur);

    osc.connect(env).connect(outNode ?? this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  // ---- SFX presets -----------------------------------------------------------

  sfx(name: SfxName): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    switch (name) {
      case "step": {
        // subtle low blip — easy to miss but adds a sense of footing
        this.blip(hz(40), 0.04, "square", 0.3);
        break;
      }
      case "encounter": {
        // descending alarm arpeggio
        const notes = [76, 72, 67, 64];
        notes.forEach((n, i) => this.blip(hz(n), 0.09, "square", 0.9, now + i * 0.07));
        break;
      }
      case "item": {
        // bright ascending two-tone
        this.blip(hz(72), 0.06, "square", 0.7, now);
        this.blip(hz(79), 0.08, "square", 0.7, now + 0.06);
        break;
      }
      case "ball_throw": {
        // pitch sweep down (whoosh-ish)
        if (!this.master) return;
        const osc = this.ctx.createOscillator();
        const env = this.ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(hz(80), now);
        osc.frequency.exponentialRampToValueAtTime(hz(50), now + 0.25);
        env.gain.setValueAtTime(0, now);
        env.gain.linearRampToValueAtTime(0.6, now + 0.02);
        env.gain.linearRampToValueAtTime(0, now + 0.27);
        osc.connect(env).connect(this.master);
        osc.start(now);
        osc.stop(now + 0.3);
        break;
      }
      case "caught": {
        // rising fanfare
        const notes = [60, 64, 67, 72, 76];
        notes.forEach((n, i) => this.blip(hz(n), 0.12, "square", 1.0, now + i * 0.09));
        break;
      }
      case "fail": {
        // low buzz
        this.blip(hz(48), 0.18, "sawtooth", 0.7);
        this.blip(hz(46), 0.18, "sawtooth", 0.5, now + 0.08);
        break;
      }
      case "menu_move": {
        this.blip(hz(72), 0.04, "square", 0.4);
        break;
      }
      case "menu_confirm": {
        this.blip(hz(76), 0.05, "square", 0.6, now);
        this.blip(hz(83), 0.06, "square", 0.6, now + 0.05);
        break;
      }
      case "menu_cancel": {
        this.blip(hz(70), 0.05, "square", 0.5, now);
        this.blip(hz(63), 0.06, "square", 0.5, now + 0.05);
        break;
      }
    }
  }

  // ---- looping music ---------------------------------------------------------

  playLoop(name: keyof typeof TRACKS): void {
    if (!this.ctx || !this.master) return;
    if (this.currentLoopName === name) return;
    this.stopLoop();
    this.currentLoopName = name;

    const track = TRACKS[name] as { bpm: number; wave: Wave; gain: number; loop: Note[]; bass?: Note[] };
    const beat = 60 / track.bpm;
    let cancelled = false;
    let nextNoteTime = this.ctx.currentTime + 0.05;

    // Per-loop bus so we can yank the volume to 0 immediately on stop —
    // lookahead-scheduled notes silence at the bus instead of bleeding through.
    const bus = this.ctx.createGain();
    bus.gain.value = 1;
    bus.connect(this.master);

    const schedule = () => {
      if (cancelled || !this.ctx) return;
      while (nextNoteTime < this.ctx.currentTime + 0.4) {
        for (const [pitch, dur] of track.loop) {
          if (pitch > 0) this.blip(hz(pitch), dur * beat * 0.95, track.wave, track.gain, nextNoteTime, bus);
          nextNoteTime += dur * beat;
        }
        if (track.bass) {
          let bt = nextNoteTime - track.loop.reduce((a, [, d]) => a + d, 0) * beat;
          for (const [pitch, dur] of track.bass) {
            if (pitch > 0) this.blip(hz(pitch), dur * beat * 0.95, "triangle", track.gain * 0.9, bt, bus);
            bt += dur * beat;
          }
        }
      }
      setTimeout(schedule, 100);
    };
    schedule();

    this.currentLoopStop = () => {
      cancelled = true;
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      // Quick fade (40ms) sounds smoother than a hard cut and avoids clicks.
      bus.gain.cancelScheduledValues(t);
      bus.gain.setValueAtTime(bus.gain.value, t);
      bus.gain.linearRampToValueAtTime(0, t + 0.04);
      // Disconnect after the lookahead window so the GC can collect the bus.
      setTimeout(() => bus.disconnect(), 600);
    };
  }

  stopLoop(): void {
    if (this.currentLoopStop) this.currentLoopStop();
    this.currentLoopStop = null;
    this.currentLoopName = null;
  }
}

export type SfxName =
  | "step" | "encounter" | "item" | "ball_throw" | "caught" | "fail"
  | "menu_move" | "menu_confirm" | "menu_cancel";

// ---- track definitions -----------------------------------------------------
// Pitch numbers are MIDI: 60=C4, 62=D4, 64=E4, 65=F4, 67=G4, 69=A4, 71=B4, 72=C5
// Durations are in beats (1 = quarter, 0.5 = eighth).
// 0 means rest.

const TRACKS = {
  // Overworld — bright C major, walking-pace, two voices
  over: {
    bpm: 132,
    wave: "square" as Wave,
    gain: 0.55,
    loop: [
      [72, 0.5], [76, 0.5], [79, 0.5], [76, 0.5],
      [74, 0.5], [77, 0.5], [74, 0.5], [72, 0.5],
      [71, 0.5], [74, 0.5], [77, 0.5], [74, 0.5],
      [72, 1.0], [0, 1.0],

      [76, 0.5], [79, 0.5], [83, 0.5], [79, 0.5],
      [77, 0.5], [76, 0.5], [74, 0.5], [72, 0.5],
      [69, 0.5], [72, 0.5], [76, 0.5], [72, 0.5],
      [67, 1.0], [0, 1.0],
    ] as Note[],
    bass: [
      [48, 1], [55, 1], [52, 1], [55, 1],
      [50, 1], [57, 1], [53, 1], [55, 1],
      [48, 1], [55, 1], [52, 1], [55, 1],
      [48, 2], [55, 2],

      [52, 1], [59, 1], [55, 1], [59, 1],
      [53, 1], [60, 1], [57, 1], [60, 1],
      [45, 1], [52, 1], [48, 1], [52, 1],
      [43, 2], [55, 2],
    ] as Note[],
  },

  // Encounter — minor key tension, faster
  battle: {
    bpm: 156,
    wave: "square" as Wave,
    gain: 0.6,
    loop: [
      [69, 0.25], [72, 0.25], [76, 0.25], [72, 0.25],
      [69, 0.25], [72, 0.25], [76, 0.25], [79, 0.25],
      [77, 0.25], [76, 0.25], [74, 0.25], [72, 0.25],
      [71, 0.5], [69, 0.5],

      [68, 0.25], [71, 0.25], [74, 0.25], [71, 0.25],
      [68, 0.25], [71, 0.25], [74, 0.25], [77, 0.25],
      [76, 0.25], [74, 0.25], [72, 0.25], [71, 0.25],
      [69, 1.0],
    ] as Note[],
    bass: [
      [45, 0.5], [45, 0.5], [45, 0.5], [45, 0.5],
      [45, 0.5], [45, 0.5], [45, 0.5], [45, 0.5],
      [50, 0.5], [50, 0.5], [50, 0.5], [50, 0.5],
      [45, 1.0], [45, 1.0],

      [44, 0.5], [44, 0.5], [44, 0.5], [44, 0.5],
      [44, 0.5], [44, 0.5], [44, 0.5], [44, 0.5],
      [50, 0.5], [50, 0.5], [50, 0.5], [50, 0.5],
      [45, 2.0],
    ] as Note[],
  },

  // Kodex / settings — slow ambient pad
  ambient: {
    bpm: 96,
    wave: "triangle" as Wave,
    gain: 0.4,
    loop: [
      [72, 2], [76, 2], [79, 2], [76, 2],
      [74, 2], [77, 2], [72, 2], [67, 2],
    ] as Note[],
  },
} as const;

export const audio = new Audio();
