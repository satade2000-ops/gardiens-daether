const KEYMAP: Record<string, ["moveX" | "moveZ", 1 | -1]> = {
  KeyW: ["moveZ", 1], ArrowUp: ["moveZ", 1],
  KeyS: ["moveZ", -1], ArrowDown: ["moveZ", -1],
  KeyA: ["moveX", -1], ArrowLeft: ["moveX", -1],
  KeyD: ["moveX", 1], ArrowRight: ["moveX", 1],
};

export class Input {
  moveX = 0;
  moveZ = 0;
  firing = false;
  pointerX = 0;
  pointerY = 0;
  pointerActive = false;
  touchAimX = 0;
  touchAimZ = 0;
  readonly actions = new Set<string>();
  private held = new Set<string>();
  private virtualMoveX = 0;
  private virtualMoveZ = 0;
  private virtualFire = false;
  private unsubscribe: Array<() => void> = [];

  constructor(private target: HTMLCanvasElement) {
    const on = <T extends Event>(el: Window | Document | HTMLElement, type: string, fn: (e: T) => void, opts?: AddEventListenerOptions) => {
      const handler = fn as EventListener;
      el.addEventListener(type, handler, opts);
      this.unsubscribe.push(() => el.removeEventListener(type, handler, opts));
    };
    on<KeyboardEvent>(window, "keydown", (e) => {
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (KEYMAP[e.code]) this.held.add(e.code);
      this.actions.add(e.code);
      this.recomputeAxes();
    });
    on<KeyboardEvent>(window, "keyup", (e) => { this.held.delete(e.code); this.recomputeAxes(); });
    on(window, "blur", () => this.resetAll());
    on(document, "visibilitychange", () => { if (document.hidden) this.resetAll(); });
    on<PointerEvent>(target, "pointermove", (e) => {
      if (e.pointerType !== "touch") {
        const rect = target.getBoundingClientRect();
        this.pointerX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointerY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.pointerActive = true;
      }
    });
    on<PointerEvent>(target, "pointerdown", (e) => {
      if (e.pointerType !== "touch" && e.button === 0) this.firing = true;
    });
    on<PointerEvent>(window, "pointerup", (e) => { if (e.button === 0) this.firing = false; });
    on<PointerEvent>(target, "contextmenu", (e) => e.preventDefault());
    on<Event>(window, "aether-move", (e) => {
      const d = (e as CustomEvent<{ x: number; z: number }>).detail;
      this.virtualMoveX = clamp(d.x, -1, 1);
      this.virtualMoveZ = clamp(d.z, -1, 1);
      this.recomputeAxes();
    });
    on<Event>(window, "aether-aim", (e) => {
      const d = (e as CustomEvent<{ x: number; z: number; firing: boolean }>).detail;
      this.touchAimX = d.x;
      this.touchAimZ = d.z;
      this.virtualFire = d.firing;
      this.recomputeFire();
    });
    on<Event>(window, "aether-action", (e) => {
      const d = (e as CustomEvent<{ action: string }>).detail;
      this.actions.add(d.action);
    });
  }

  get isFiring(): boolean { return this.firing || this.virtualFire; }
  private recomputeFire(): void { this.firing = this.firing && this.pointerActive; }
  private recomputeAxes(): void {
    let x = this.virtualMoveX, z = this.virtualMoveZ;
    for (const code of this.held) {
      const m = KEYMAP[code];
      if (m) { if (m[0] === "moveX") x += m[1]; else z += m[1]; }
    }
    this.moveX = clamp(x, -1, 1);
    this.moveZ = clamp(z, -1, 1);
  }
  consumeAction(code: string): boolean {
    const has = this.actions.has(code);
    if (has) this.actions.delete(code);
    return has;
  }
  resetAll(): void {
    this.held.clear();
    this.virtualMoveX = this.virtualMoveZ = 0;
    this.virtualFire = this.firing = false;
    this.moveX = this.moveZ = 0;
  }
  dispose(): void {
    for (const off of this.unsubscribe) off();
    this.unsubscribe = [];
    this.actions.clear();
    this.resetAll();
  }
}

function clamp(v: number, lo: number, hi: number): number { return v < lo ? lo : v > hi ? hi : v; }
