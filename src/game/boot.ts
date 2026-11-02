import { AetherGame } from "./AetherGame";
import type { GameSnapshot } from "./types";

let session: AetherGame | null = null;

export function startGame(canvas: HTMLCanvasElement, onSnapshot: (snapshot: GameSnapshot) => void): AetherGame {
  stopGame();
  session = new AetherGame(canvas, onSnapshot);
  return session;
}

export function stopGame(): void {
  session?.dispose();
  session = null;
}
