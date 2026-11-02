export type GameState = "title" | "playing" | "paused" | "upgrade" | "victory" | "gameover";

const TRANSITIONS: Record<GameState, readonly GameState[]> = {
  title: ["playing"],
  playing: ["paused", "upgrade", "victory", "gameover", "title"],
  paused: ["playing", "title"],
  upgrade: ["playing", "title"],
  victory: ["playing", "title"],
  gameover: ["playing", "title"],
};

export class GameStateMachine {
  private _state: GameState = "title";
  private listeners = new Set<(s: GameState, prev: GameState) => void>();

  get state(): GameState { return this._state; }
  is(...states: GameState[]): boolean { return states.includes(this._state); }

  transition(next: GameState): void {
    const prev = this._state;
    if (prev === next) return;
    if (!TRANSITIONS[prev].includes(next)) return;
    this._state = next;
    for (const fn of this.listeners) fn(next, prev);
  }

  onChange(fn: (s: GameState, prev: GameState) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}
