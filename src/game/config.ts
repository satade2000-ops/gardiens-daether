export const INPUT_CONFIG = {
  MOUSE_SENS_X: 0.0026,
  MOUSE_SENS_Y: 0.0022,
  INVERT_X: false,
  INVERT_Y: false,
} as const;

export const GAME_CONFIG = {
  ARENA_RADIUS: 20.5,
  PLAYER_SPEED: 7.2,
  PLAYER_HP: 100,
  PLAYER_ENERGY: 100,
  SHOT_COST: 3,
  SHOT_COOLDOWN: 0.22,
  DASH_COST: 18,
  PULSE_COST: 34,
  MAX_ENEMIES: 42,
  MAX_PLAYER_SHOTS: 48,
  MAX_ENEMY_SHOTS: 72,
  MAX_PICKUPS: 64,
  MAX_PARTICLES: 280,
  FIXED_SEED: 0xae715,
} as const;

export const QUALITY = {
  PARTICLES_HIGH: 280,
  PARTICLES_LOW: 120,
  DEGRADE_FPS: 45,
} as const;

export const COLORS = {
  sky: 0x8ed8ee,
  fog: 0x9ddde8,
  grass: 0x63b96b,
  grassLight: 0x98d86c,
  earth: 0x9a633f,
  earthDark: 0x624159,
  stone: 0x8b8ca6,
  cream: 0xffedcf,
  cyan: 0x52f0e0,
  blue: 0x287ea4,
  orange: 0xff8a4c,
  purple: 0xb06ae2,
  magenta: 0xf0568c,
  gold: 0xffce62,
} as const;

export const WAVE_TABLE = [
  { chargers: 5, shooters: 0, splitters: 0 },
  { chargers: 6, shooters: 3, splitters: 1 },
  { chargers: 7, shooters: 4, splitters: 2 },
  { chargers: 2, shooters: 2, splitters: 0, boss: true },
] as const;
