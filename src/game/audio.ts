export type SfxId =
  | "shot" | "dash" | "pulse" | "hit" | "hurt"
| "pickup" | "ui" | "explosion" | "win" | "lose" | "wave" | "footstep";

export type MusicTrack = "menu" | "exploration" | "combat";

const MUTE_KEY = "aether.muted";

const MUSIC_FILES: Record<MusicTrack, string> = {
  menu: "/assets/audio/Aether_04_Menu_Orchestral.wav",
  combat: "/assets/audio/Aether_05_Combat_Orchestral.wav",
  exploration: "/assets/audio/Aether_06_Exploration_Orchestral.wav",
};

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeMuted(value: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, value ? "1" : "0");
  } catch {
    // Session-only
  }
}

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: HTMLAudioElement | null = null;
  private currentTrack: MusicTrack | null = null;
  private disposed = false;

  muted = false;

  private readonly unlock = () => {
    this.ensureCtx();
    this.detachUnlock();
    if (this.music && !this.muted) {
      void this.music.play().catch(() => {});
    }
  };

  constructor() {
    this.muted = readMuted();
    window.addEventListener("pointerdown", this.unlock);
    window.addEventListener("keydown", this.unlock);
  }

  private detachUnlock(): void {
    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("keydown", this.unlock);
  }

  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.42;
      this.master.connect(this.ctx.destination);
    }

    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  playMusic(track: MusicTrack): void {
    if (this.disposed) return;
    if (this.currentTrack === track && this.music) return;

    this.currentTrack = track;

    if (this.music) {
      this.music.pause();
      this.music.currentTime = 0;
    }

    this.music = new Audio(MUSIC_FILES[track]);
    this.music.loop = true;
    this.music.volume = 0.55;

    if (!this.muted) {
      void this.music.play().catch(() => {});
    }
  }

  stopMusic(): void {
    if (this.music) {
      this.music.pause();
      this.music.currentTime = 0;
    }
    this.music = null;
    this.currentTrack = null;
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    writeMuted(this.muted);

    if (this.master) {
      this.master.gain.value = this.muted ? 0 : 0.42;
    }

    if (this.music) {
      if (this.muted) {
        this.music.pause();
      } else {
        void this.music.play().catch(() => {});
      }
    }

    return this.muted;
  }

  update(_dt: number, _intensity: number): void {
    // La musique est maintenant lue depuis les fichiers orchestraux.
  }

  private tone(
    type: OscillatorType,
    f0: number,
    f1: number,
    dur: number,
    gain: number
  ): void {
    if (!this.ctx || !this.master) return;

    const time = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(f0, time);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), time + dur);

    env.gain.setValueAtTime(gain, time);
    env.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(env).connect(this.master);
    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  sfx(id: SfxId): void {
    if (this.disposed || this.muted) return;

    this.ensureCtx();

    const spec: Record<
      SfxId,
      [OscillatorType, number, number, number, number]
    > = {
      shot: ["square", 480, 190, 0.09, 0.09],
      dash: ["sawtooth", 170, 620, 0.16, 0.12],
      pulse: ["sine", 120, 720, 0.35, 0.18],
      hit: ["square", 180, 80, 0.08, 0.13],
      hurt: ["sawtooth", 140, 55, 0.22, 0.18],
      pickup: ["sine", 660, 1180, 0.12, 0.12],
      ui: ["sine", 440, 620, 0.07, 0.1],
      explosion: ["sawtooth", 110, 28, 0.38, 0.2],
      win: ["sine", 523, 1046, 0.65, 0.2],
      lose: ["sawtooth", 220, 55, 0.65, 0.18],
  wave: ["triangle", 260, 780, 0.35, 0.16],
footstep: ["triangle", 95, 45, 0.055, 0.07],
    };

    this.tone(...spec[id]);
  }

  dispose(): void {
    if (this.disposed) return;

    this.disposed = true;
    this.detachUnlock();
    this.stopMusic();

    this.master?.disconnect();
    this.master = null;

    const context = this.ctx;
    this.ctx = null;

    if (context && context.state !== "closed") {
      void context.close();
    }
  }
}
