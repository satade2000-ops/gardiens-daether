export type SfxId = "shot" | "dash" | "pulse" | "hit" | "hurt" | "pickup" | "ui" | "explosion" | "win" | "lose" | "wave";

const MUTE_KEY = "aether.muted";
function readMuted(): boolean { try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; } }
function writeMuted(v: boolean): void { try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch { /* session-only */ } }

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicTimer = 0;
  private musicStep = 0;
  private disposed = false;
  muted = false;
  private readonly unlock = () => { this.ensureCtx(); this.detachUnlock(); };

  constructor() {
    this.muted = readMuted();
    window.addEventListener("pointerdown", this.unlock);
    window.addEventListener("keydown", this.unlock);
  }
  private detachUnlock(): void {
    window.removeEventListener("pointerdown", this.unlock);
    window.removeEventListener("keydown", this.unlock);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.detachUnlock();
    this.master?.disconnect();
    this.master = null;
    const ctx = this.ctx;
    this.ctx = null;
    if (ctx && ctx.state !== "closed") void ctx.close();
  }
  private ensureCtx(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.42;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return this.ctx;
  }
  toggleMute(): boolean {
    this.muted = !this.muted;
    writeMuted(this.muted);
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.42;
    return this.muted;
  }
  update(dt: number, intensity: number): void {
    if (this.muted || !this.ctx || this.ctx.state !== "running") return;
    this.musicTimer -= dt;
    if (this.musicTimer > 0) return;
    const notes = [110, 146.83, 164.81, 220, 196, 164.81, 146.83, 130.81];
    this.tone("triangle", notes[this.musicStep % notes.length], notes[this.musicStep % notes.length] * 1.01, 0.32, 0.025 + intensity * 0.015);
    if (this.musicStep % 4 === 0) this.tone("sine", 55, 55, 0.5, 0.05);
    this.musicStep++;
    this.musicTimer = intensity > 0.6 ? 0.22 : 0.34;
  }
  private tone(type: OscillatorType, f0: number, f1: number, dur: number, gain: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    env.gain.setValueAtTime(gain, t);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(env).connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }
  sfx(id: SfxId): void {
    if (this.disposed || this.muted) return;
    this.ensureCtx();
    const spec: Record<SfxId, [OscillatorType, number, number, number, number]> = {
      shot: ["square", 480, 190, 0.09, 0.09], dash: ["sawtooth", 170, 620, 0.16, 0.12],
      pulse: ["sine", 120, 720, 0.35, 0.18], hit: ["square", 180, 80, 0.08, 0.13],
      hurt: ["sawtooth", 140, 55, 0.22, 0.18], pickup: ["sine", 660, 1180, 0.12, 0.12],
      ui: ["sine", 440, 620, 0.07, 0.1], explosion: ["sawtooth", 110, 28, 0.38, 0.2],
      win: ["sine", 523, 1046, 0.65, 0.2], lose: ["sawtooth", 220, 55, 0.65, 0.18],
      wave: ["triangle", 260, 780, 0.35, 0.16],
    };
    this.tone(...spec[id]);
  }
}
