import type { GameState } from "./state";

export interface Vec3 { x: number; y: number; z: number; }

export type UpgradeId = "damage" | "rapid" | "vitality" | "speed" | "pulse" | "magnet" | "repair";

export interface UpgradeChoice {
  id: UpgradeId;
  name: string;
  description: string;
  cost: number;
  icon: string;
}

export interface GameSnapshot {
  state: GameState;
  hp: number;
  maxHp: number;
  energy: number;
  maxEnergy: number;
  wave: number;
  score: number;
  combo: number;
  shards: number;
  kills: number;
  elapsed: number;
  enemies: number;
  bossHp: number;
  bossMaxHp: number;
  choices: UpgradeChoice[];
  muted: boolean;
  fps: number;
  drawCalls: number;
  runId: number;
  announcement: string;
  touch: boolean;
}

export interface Poolable {
  alive: boolean;
  reset(): void;
}

export class Pool<T extends Poolable> {
  protected items: T[] = [];
  constructor(factory: () => T, size: number) {
    for (let i = 0; i < size; i++) this.items.push(factory());
  }
  obtain(): T | null {
    for (const it of this.items) {
      if (!it.alive) { it.alive = true; it.reset(); return it; }
    }
    return null;
  }
  each(fn: (it: T) => void): void {
    for (const it of this.items) if (it.alive) fn(it);
  }
  clear(): void {
    for (const it of this.items) { it.alive = false; it.reset(); }
  }
}
