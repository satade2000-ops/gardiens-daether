import * as THREE from "three";
import { AudioSystem } from "./audio";
import { COLORS, GAME_CONFIG, QUALITY, WAVE_TABLE } from "./config";
import { ParticleSystem } from "./effects";
import { GameLoop } from "./engine";
import { Input } from "./input";
import { createEnemyModel, createPlayerModel, type ActorModel, type EnemyType } from "./models";
import { GameStateMachine, type GameState } from "./state";
import type { GameSnapshot, UpgradeChoice, UpgradeId } from "./types";
import { createWorld, type World } from "./world";

interface Projectile {
  alive: boolean;
  mesh: THREE.Mesh;
  vx: number;
  vz: number;
  life: number;
  damage: number;
  radius: number;
  hostile: boolean;
}
interface Enemy {
  alive: boolean;
  type: EnemyType;
  model: ActorModel;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  cooldown: number;
  hitCooldown: number;
  state: number;
  stateTime: number;
  flash: number;
  vx: number;
  vz: number;
}
interface Pickup {
  alive: boolean;
  mesh: THREE.Mesh;
  vx: number;
  vz: number;
  life: number;
  value: number;
}

const UPGRADES: Record<Exclude<UpgradeId, "repair">, Omit<UpgradeChoice, "cost">> = {
  damage: { id: "damage", name: "Canon surchargé", description: "+30 % de dégâts des tirs", icon: "✦" },
  rapid: { id: "rapid", name: "Cadence flux", description: "+22 % de cadence de tir", icon: "≋" },
  vitality: { id: "vitality", name: "Blindage vivant", description: "+25 PV max et soin complet", icon: "♥" },
  speed: { id: "speed", name: "Propulseurs jumeaux", description: "+12 % de vitesse et dash -15 %", icon: "➜" },
  pulse: { id: "pulse", name: "Impulsion amplifiée", description: "+35 % de rayon et de dégâts", icon: "◎" },
  magnet: { id: "magnet", name: "Aimant à éclats", description: "+70 % de portée d’attraction", icon: "◇" },
};
const TMP_VEC = new THREE.Vector3();
const TMP_VEC2 = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

export class AetherGame {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(46, 1, 0.1, 260);
  private world: World;
  private input: Input;
  private audio = new AudioSystem();
  private particles: ParticleSystem;
  private machine = new GameStateMachine();
  private loop: GameLoop;
  private player: ActorModel;
  private enemies: Enemy[] = [];
  private playerShots: Projectile[] = [];
  private enemyShots: Projectile[] = [];
  private pickups: Pickup[] = [];
  private pendingSpawns: EnemyType[] = [];
  private spawnTimer = 0;
  private random: () => number;
  private raycaster = new THREE.Raycaster();
  private aimPlane = new THREE.Plane(UP, -0.3);
  private pointer = new THREE.Vector2();
  private aimX = 0;
  private aimZ = -1;
  private px = 0;
  private pz = 4;
  private hp: number = GAME_CONFIG.PLAYER_HP;
  private maxHp: number = GAME_CONFIG.PLAYER_HP;
  private energy: number = GAME_CONFIG.PLAYER_ENERGY;
  private shotCooldown = 0;
  private dashCooldown = 0;
  private dashTime = 0;
  private dashX = 0;
  private dashZ = -1;
  private pulseCooldown = 0;
  private invulnerable = 0;
  private wave = 1;
  private score = 0;
  private shards = 0;
  private kills = 0;
  private combo = 1;
  private comboTimer = 0;
  private elapsed = 0;
  private runId = 0;
  private choices: UpgradeChoice[] = [];
  private announcement = "";
  private announcementTimer = 0;
  private damageLevel = 0;
  private rapidLevel = 0;
  private speedLevel = 0;
  private pulseLevel = 0;
  private magnetLevel = 0;
  private movePhase = 0;
  private recoil = 0;
  private shake = 0;
  private visualTime = 0;
  private snapshotTimer = 0;
  private lastFrameTime = 0;
  private fps = 60;
  private lowFpsTime = 0;
  private degraded = false;
  private stopped = false;
  private boss: Enemy | null = null;

  constructor(private canvas: HTMLCanvasElement, private onSnapshot: (snapshot: GameSnapshot) => void) {
    this.random = this.seededRandom(GAME_CONFIG.FIXED_SEED);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, matchMedia("(pointer: coarse)").matches ? 1.25 : 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.fog, 42, 115);
    this.camera.position.set(0, 19, 20);
    this.camera.lookAt(0, 1, 0);
    this.addLights();
    this.world = createWorld(this.scene);
    this.player = createPlayerModel();
    this.scene.add(this.player.group);
    this.particles = new ParticleSystem(this.scene);
    this.createPools();
    this.input = new Input(canvas);
    this.loadCannonAsset();
    this.resize();
    window.addEventListener("resize", this.resize);
    this.loop = new GameLoop({ update: (dt) => this.update(dt), render: () => this.render() });
    this.machine.onChange(() => this.emitSnapshot());
    this.loop.start();
    this.installDebugHooks();
  }

  private seededRandom(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  private addLights(): void {
    const hemi = new THREE.HemisphereLight(0xc9f3ff, 0x665077, 2.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffe1ae, 3.2);
    sun.position.set(-18, 30, 14);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1536, 1536);
    sun.shadow.camera.left = -26; sun.shadow.camera.right = 26;
    sun.shadow.camera.top = 26; sun.shadow.camera.bottom = -26;
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 70;
    sun.shadow.normalBias = 0.035;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x8fb9ff, 1.1);
    fill.position.set(18, 10, -16);
    this.scene.add(fill);
  }

  private createPools(): void {
    const friendlyMat = new THREE.MeshBasicMaterial({ color: COLORS.cyan });
    const hostileMat = new THREE.MeshBasicMaterial({ color: 0xff6c88 });
    const friendlyGeo = new THREE.SphereGeometry(0.17, 7, 5);
    const hostileGeo = new THREE.OctahedronGeometry(0.22, 0);
    for (let i = 0; i < GAME_CONFIG.MAX_PLAYER_SHOTS; i++) {
      const mesh = new THREE.Mesh(friendlyGeo, friendlyMat);
      mesh.visible = false; this.scene.add(mesh);
      this.playerShots.push({ alive: false, mesh, vx: 0, vz: 0, life: 0, damage: 0, radius: 0.25, hostile: false });
    }
    for (let i = 0; i < GAME_CONFIG.MAX_ENEMY_SHOTS; i++) {
      const mesh = new THREE.Mesh(hostileGeo, hostileMat);
      mesh.visible = false; this.scene.add(mesh);
      this.enemyShots.push({ alive: false, mesh, vx: 0, vz: 0, life: 0, damage: 0, radius: 0.3, hostile: true });
    }
    const pickupGeo = new THREE.OctahedronGeometry(0.25, 0);
    const pickupMat = new THREE.MeshStandardMaterial({ color: COLORS.gold, emissive: 0x6d470c, roughness: 0.35 });
    for (let i = 0; i < GAME_CONFIG.MAX_PICKUPS; i++) {
      const mesh = new THREE.Mesh(pickupGeo, pickupMat);
      mesh.visible = false; this.scene.add(mesh);
      this.pickups.push({ alive: false, mesh, vx: 0, vz: 0, life: 0, value: 1 });
    }
  }

  private async loadCannonAsset(): Promise<void> {
    try {
      const path = "/assets/cannon/asset.mjs";
      const nativeImport = new Function("specifier", "return import(specifier)") as (specifier: string) => Promise<{ createAsset: (three: typeof THREE, options: object) => Promise<THREE.Group> }>;
      const mod = await nativeImport(path);
      const root = await mod.createAsset(THREE, { states: "lazy", sharedResources: true });
      root.traverse((node) => { if (node instanceof THREE.Mesh) node.castShadow = false; });
      root.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(root);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const scale = 1.5 / Math.max(size.x, size.y, size.z, 0.001);
      const placement = new THREE.Group();
      placement.add(root);
      root.scale.multiplyScalar(scale);
      root.position.sub(center.clone().multiplyScalar(scale));
      placement.rotation.y = Math.PI / 2;
      if (this.player.weapon) {
        for (const child of this.player.weapon.children) child.visible = false;
        this.player.weapon.add(placement);
      }
    } catch {
      // The procedural cannon remains visible if the optional display asset cannot load.
    }
  }

  start(): void {
    if (this.machine.state === "title" || this.machine.is("victory", "gameover")) this.resetRun();
    else if (this.machine.state === "paused") this.resume();
  }

  private resetRun(): void {
    this.clearActors();
    this.random = this.seededRandom(GAME_CONFIG.FIXED_SEED + this.runId * 977);
    this.runId++;
    this.px = 0; this.pz = 4;
    this.maxHp = GAME_CONFIG.PLAYER_HP; this.hp = this.maxHp;
    this.energy = GAME_CONFIG.PLAYER_ENERGY;
    this.wave = 1; this.score = 0; this.shards = 0; this.kills = 0;
    this.combo = 1; this.comboTimer = 0; this.elapsed = 0;
    this.damageLevel = this.rapidLevel = this.speedLevel = this.pulseLevel = this.magnetLevel = 0;
    this.shotCooldown = this.dashCooldown = this.dashTime = this.pulseCooldown = this.invulnerable = 0;
    this.choices = [];
    this.machine.transition("playing");
    this.startWave(1);
  }

  restart(): void { if (this.machine.state !== "title") this.resetRun(); }
  pause(): void { if (this.machine.state === "playing") { this.input.resetAll(); this.machine.transition("paused"); } }
  resume(): void { if (this.machine.state === "paused") this.machine.transition("playing"); }
  togglePause(): void { if (this.machine.state === "playing") this.pause(); else if (this.machine.state === "paused") this.resume(); }
  toTitle(): void {
    if (!this.machine.is("playing", "paused", "upgrade", "victory", "gameover")) return;
    this.clearActors();
    this.machine.transition("title");
  }
  toggleMute(): void { this.audio.toggleMute(); this.emitSnapshot(); }

  private startWave(number: number): void {
    this.wave = number;
    this.pendingSpawns.length = 0;
    const spec = WAVE_TABLE[number - 1];
    for (let i = 0; i < spec.chargers; i++) this.pendingSpawns.push("charger");
    for (let i = 0; i < spec.shooters; i++) this.pendingSpawns.push("shooter");
    for (let i = 0; i < spec.splitters; i++) this.pendingSpawns.push("splitter");
    if ("boss" in spec && spec.boss) this.pendingSpawns.unshift("boss");
    for (let i = this.pendingSpawns.length - 1; i > 1; i--) {
      const j = 1 + Math.floor(this.random() * i);
      [this.pendingSpawns[i], this.pendingSpawns[j]] = [this.pendingSpawns[j], this.pendingSpawns[i]];
    }
    this.spawnTimer = 0.25;
    this.announce(number === 4 ? "LE GARDIEN CORROMPU S’ÉVEILLE" : `VAGUE ${number} — PRÉPAREZ-VOUS`, 2.4);
    this.audio.sfx("wave");
  }

  private update(dt: number): void {
    if (this.stopped) return;
    this.visualTime += dt;
    this.world.update(this.visualTime);
    this.handleGlobalInput();
    this.announcementTimer = Math.max(0, this.announcementTimer - dt);
    if (this.announcementTimer === 0) this.announcement = "";
    this.particles.update(dt);
    this.audio.update(dt, this.machine.state === "playing" ? Math.min(1, this.enemies.length / 10 + 0.2) : 0.1);
    if (this.machine.state !== "playing") {
      this.snapshotTimer -= dt;
      if (this.snapshotTimer <= 0) { this.emitSnapshot(); this.snapshotTimer = 0.15; }
      return;
    }

    this.elapsed += dt;
    this.energy = Math.min(GAME_CONFIG.PLAYER_ENERGY, this.energy + 17 * dt);
    this.shotCooldown -= dt; this.dashCooldown -= dt; this.pulseCooldown -= dt; this.invulnerable -= dt;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 1;
    this.recoil = Math.max(0, this.recoil - dt * 7);
    this.shake = Math.max(0, this.shake - dt * 3.5);
    this.updateAim();
    this.updatePlayer(dt);
    this.updateSpawning(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updatePickups(dt);
    this.checkWaveComplete();
    this.snapshotTimer -= dt;
    if (this.snapshotTimer <= 0) { this.emitSnapshot(); this.snapshotTimer = 0.1; }
  }

  private handleGlobalInput(): void {
    if (this.input.consumeAction("KeyM")) this.toggleMute();
    if (this.machine.state === "title") {
      if (this.input.consumeAction("Space") || this.input.consumeAction("Enter")) this.start();
      return;
    }
    if (this.machine.is("victory", "gameover")) {
      if (this.input.consumeAction("Space") || this.input.consumeAction("Enter")) this.start();
      if (this.input.consumeAction("Escape")) this.toTitle();
      return;
    }
    if (this.input.consumeAction("Escape") || this.input.consumeAction("KeyP")) { this.togglePause(); return; }
    if (this.machine.state === "paused") {
      if (this.input.consumeAction("Space")) this.resume();
      return;
    }
    if (this.machine.state === "upgrade") {
      if (this.input.consumeAction("Digit1")) this.chooseUpgrade(0);
      if (this.input.consumeAction("Digit2")) this.chooseUpgrade(1);
      if (this.input.consumeAction("Digit3")) this.chooseUpgrade(2);
    }
  }

  private updateAim(): void {
    if (Math.hypot(this.input.touchAimX, this.input.touchAimZ) > 0.15) {
      this.aimX = this.input.touchAimX; this.aimZ = this.input.touchAimZ;
    } else if (this.input.pointerActive) {
      this.pointer.set(this.input.pointerX, this.input.pointerY);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      if (this.raycaster.ray.intersectPlane(this.aimPlane, TMP_VEC)) {
        const dx = TMP_VEC.x - this.px, dz = TMP_VEC.z - this.pz;
        const len = Math.hypot(dx, dz);
        if (len > 0.1) { this.aimX = dx / len; this.aimZ = dz / len; }
      }
    }
  }

  private updatePlayer(dt: number): void {
    let mx = this.input.moveX, mz = -this.input.moveZ;
    const len = Math.hypot(mx, mz);
    if (len > 1) { mx /= len; mz /= len; }
    if ((this.input.consumeAction("Space") || this.input.consumeAction("ShiftLeft") || this.input.consumeAction("ShiftRight") || this.input.consumeAction("dash")) && this.dashCooldown <= 0 && this.energy >= GAME_CONFIG.DASH_COST) {
      this.energy -= GAME_CONFIG.DASH_COST;
      this.dashTime = 0.2;
      this.dashCooldown = 1.15 * Math.pow(0.85, this.speedLevel);
      this.invulnerable = 0.34;
      this.dashX = len > 0.15 ? mx / Math.max(len, 0.001) : this.aimX;
      this.dashZ = len > 0.15 ? mz / Math.max(len, 0.001) : this.aimZ;
      this.audio.sfx("dash");
      this.particles.emit(this.px, 0.7, this.pz, COLORS.cyan, 12, 3, this.random);
    }
    const speed = GAME_CONFIG.PLAYER_SPEED * (1 + this.speedLevel * 0.12);
    if (this.dashTime > 0) {
      this.dashTime -= dt;
      this.px += this.dashX * 23 * dt; this.pz += this.dashZ * 23 * dt;
      if (this.dashTime > 0.05) this.particles.emit(this.px, 0.45, this.pz, COLORS.cyan, 1, 0.8, this.random);
    } else {
      this.px += mx * speed * dt; this.pz += mz * speed * dt;
    }
    const radius = Math.hypot(this.px, this.pz);
    if (radius > GAME_CONFIG.ARENA_RADIUS) { this.px *= GAME_CONFIG.ARENA_RADIUS / radius; this.pz *= GAME_CONFIG.ARENA_RADIUS / radius; }
    this.movePhase += dt * Math.hypot(mx, mz) * speed * 1.4;
    if ((this.input.consumeAction("KeyE") || this.input.consumeAction("pulse")) && this.pulseCooldown <= 0 && this.energy >= GAME_CONFIG.PULSE_COST) {
      this.energy -= GAME_CONFIG.PULSE_COST;
      this.pulseCooldown = 3.2;
      const pulseRadius = 5 * (1 + this.pulseLevel * 0.35);
      const damage = 38 * (1 + this.pulseLevel * 0.35);
      for (const enemy of this.enemies) {
        const dx = enemy.model.group.position.x - this.px, dz = enemy.model.group.position.z - this.pz;
        const dist = Math.hypot(dx, dz);
        if (dist < pulseRadius) {
          this.damageEnemy(enemy, damage);
          if (enemy.alive && dist > 0.01) { enemy.model.group.position.x += (dx / dist) * 2; enemy.model.group.position.z += (dz / dist) * 2; }
        }
      }
      for (const shot of this.enemyShots) {
        if (shot.alive && Math.hypot(shot.mesh.position.x - this.px, shot.mesh.position.z - this.pz) < pulseRadius) this.deactivateShot(shot);
      }
      this.particles.emit(this.px, 0.8, this.pz, COLORS.cyan, 42, 9, this.random);
      this.audio.sfx("pulse"); this.shake = 0.4;
    }
    if (this.input.isFiring && this.shotCooldown <= 0 && this.energy >= GAME_CONFIG.SHOT_COST) {
      this.energy -= GAME_CONFIG.SHOT_COST;
      this.shotCooldown = GAME_CONFIG.SHOT_COOLDOWN * Math.pow(0.78, this.rapidLevel);
      this.spawnProjectile(this.playerShots, this.px + this.aimX * 1.25, 1.35, this.pz + this.aimZ * 1.25, this.aimX * 19, this.aimZ * 19, 18 * (1 + this.damageLevel * 0.3));
      this.recoil = 1;
      this.audio.sfx("shot");
    }
  }

  private updateSpawning(dt: number): void {
    if (this.pendingSpawns.length === 0) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer > 0 || this.enemies.length >= GAME_CONFIG.MAX_ENEMIES) return;
    const type = this.pendingSpawns.shift()!;
    const a = this.random() * Math.PI * 2;
    const r = type === "boss" ? 12 : 16 + this.random() * 3;
    this.spawnEnemy(type, Math.sin(a) * r, Math.cos(a) * r);
    this.spawnTimer = type === "boss" ? 1.2 : 0.5;
  }

  private spawnEnemy(type: EnemyType, x: number, z: number): Enemy | null {
    if (this.enemies.length >= GAME_CONFIG.MAX_ENEMIES) return null;
    const model = createEnemyModel(type);
    model.group.position.set(x, 0, z);
    this.scene.add(model.group);
    const stats: Record<EnemyType, [hp: number, speed: number, radius: number]> = {
      charger: [54 + this.wave * 8, 3.5, 0.85], shooter: [46 + this.wave * 7, 2.6, 0.85],
      splitter: [72 + this.wave * 8, 2.8, 0.9], minion: [20, 4.8, 0.48], boss: [680, 2.2, 1.9],
    };
    const [hp, speed, radius] = stats[type];
    const enemy: Enemy = { alive: true, type, model, hp, maxHp: hp, speed, radius, cooldown: 0.8 + this.random(), hitCooldown: 0, state: 0, stateTime: 0, flash: 0, vx: 0, vz: 0 };
    this.enemies.push(enemy);
    if (type === "boss") this.boss = enemy;
    this.particles.emit(x, 0.8, z, type === "boss" ? COLORS.magenta : COLORS.purple, type === "boss" ? 35 : 10, 4, this.random);
    return enemy;
  }

  private updateEnemies(dt: number): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (!enemy.alive) { this.enemies.splice(i, 1); continue; }
      const pos = enemy.model.group.position;
      const dx = this.px - pos.x, dz = this.pz - pos.z;
      const dist = Math.max(0.001, Math.hypot(dx, dz));
      const nx = dx / dist, nz = dz / dist;
      enemy.cooldown -= dt; enemy.hitCooldown -= dt; enemy.stateTime -= dt; enemy.flash -= dt;
      enemy.model.bodyMaterial.emissive.setHex(enemy.flash > 0 ? 0x772222 : enemy.type === "boss" ? 0x3c0c20 : enemy.state === 1 ? 0x551111 : 0x000000);
      let mx = 0, mz = 0;
      if (enemy.type === "charger") {
        if (enemy.state === 1) {
          if (enemy.stateTime <= 0) { enemy.state = 2; enemy.stateTime = 0.42; enemy.vx = nx * 14; enemy.vz = nz * 14; }
        } else if (enemy.state === 2) {
          mx = enemy.vx / enemy.speed; mz = enemy.vz / enemy.speed;
          if (enemy.stateTime <= 0) { enemy.state = 0; enemy.cooldown = 1.4; }
        } else {
          mx = nx; mz = nz;
          if (dist < 5 && enemy.cooldown <= 0) { enemy.state = 1; enemy.stateTime = 0.6; }
        }
      } else if (enemy.type === "shooter") {
        if (enemy.state === 1) {
          if (enemy.stateTime <= 0) {
            this.spawnProjectile(this.enemyShots, pos.x + nx, 1.25, pos.z + nz, nx * 8.5, nz * 8.5, 12);
            enemy.state = 0; enemy.cooldown = 1.8 + this.random() * 0.5;
          }
        } else {
          const forward = dist > 11 ? 1 : dist < 7 ? -0.8 : 0;
          mx = nx * forward + nz * 0.55; mz = nz * forward - nx * 0.55;
          if (enemy.cooldown <= 0 && dist < 17) { enemy.state = 1; enemy.stateTime = 0.5; }
        }
      } else if (enemy.type === "boss") {
        const ratio = enemy.hp / enemy.maxHp;
        if (enemy.state === 1) {
          if (enemy.stateTime <= 0) {
            const count = ratio < 0.5 ? 16 : 12;
            for (let n = 0; n < count; n++) {
              const a = (n / count) * Math.PI * 2 + this.elapsed * 0.3;
              this.spawnProjectile(this.enemyShots, pos.x + Math.sin(a) * 2, 1.2, pos.z + Math.cos(a) * 2, Math.sin(a) * 7, Math.cos(a) * 7, 14);
            }
            for (let n = -1; n <= 1; n++) {
              const a = Math.atan2(nx, nz) + n * 0.17;
              this.spawnProjectile(this.enemyShots, pos.x, 1.4, pos.z, Math.sin(a) * 10, Math.cos(a) * 10, 16);
            }
            if (ratio < 0.7 && this.enemies.length < 12) { this.spawnEnemy("charger", pos.x + 3, pos.z); this.spawnEnemy("charger", pos.x - 3, pos.z); }
            this.audio.sfx("explosion"); this.shake = 0.6;
            enemy.state = 0; enemy.cooldown = ratio < 0.5 ? 1.8 : 2.5;
          }
        } else {
          const forward = dist > 8 ? 1 : dist < 5 ? -0.6 : 0;
          mx = nx * forward + nz * 0.3; mz = nz * forward - nx * 0.3;
          if (enemy.cooldown <= 0) { enemy.state = 1; enemy.stateTime = ratio < 0.5 ? 0.65 : 0.9; }
        }
      } else {
        mx = nx; mz = nz;
      }
      if (enemy.state !== 2 || enemy.type !== "charger") {
        const mLen = Math.hypot(mx, mz);
        if (mLen > 1) { mx /= mLen; mz /= mLen; }
        pos.x += mx * enemy.speed * dt; pos.z += mz * enemy.speed * dt;
      } else {
        pos.x += enemy.vx * dt; pos.z += enemy.vz * dt;
      }
      const er = Math.hypot(pos.x, pos.z);
      if (er > GAME_CONFIG.ARENA_RADIUS) { pos.x *= GAME_CONFIG.ARENA_RADIUS / er; pos.z *= GAME_CONFIG.ARENA_RADIUS / er; }
      enemy.model.group.rotation.y = Math.atan2(-nx, -nz);
      if (dist < enemy.radius + 0.75 && enemy.hitCooldown <= 0) {
        const damage = enemy.type === "boss" ? 24 : enemy.type === "minion" ? 7 : enemy.type === "charger" ? 14 : 10;
        this.hurtPlayer(damage);
        enemy.hitCooldown = 0.85;
        pos.x -= nx * 1.2; pos.z -= nz * 1.2;
      }
      if (enemy.type === "shooter") enemy.model.group.position.y = 0.2 + Math.sin(this.visualTime * 3 + i) * 0.15;
      const scale = enemy.state === 1 ? 1 + Math.sin(this.visualTime * 24) * 0.045 : 1;
      enemy.model.group.scale.setScalar(scale);
    }
  }

  private spawnProjectile(pool: Projectile[], x: number, y: number, z: number, vx: number, vz: number, damage: number): void {
    for (const shot of pool) {
      if (shot.alive) continue;
      shot.alive = true; shot.vx = vx; shot.vz = vz; shot.damage = damage; shot.life = 3.2;
      shot.mesh.position.set(x, y, z); shot.mesh.visible = true;
      return;
    }
  }

  private updateProjectiles(dt: number): void {
    for (const shot of this.playerShots) {
      if (!shot.alive) continue;
      shot.life -= dt; shot.mesh.position.x += shot.vx * dt; shot.mesh.position.z += shot.vz * dt;
      shot.mesh.rotation.y += dt * 12;
      if (shot.life <= 0 || Math.hypot(shot.mesh.position.x, shot.mesh.position.z) > 24) { this.deactivateShot(shot); continue; }
      for (const enemy of this.enemies) {
        if (!enemy.alive) continue;
        const pos = enemy.model.group.position;
        if (Math.hypot(shot.mesh.position.x - pos.x, shot.mesh.position.z - pos.z) < enemy.radius + shot.radius) {
          this.damageEnemy(enemy, shot.damage);
          this.particles.emit(shot.mesh.position.x, 1, shot.mesh.position.z, COLORS.cyan, 5, 3, this.random);
          this.deactivateShot(shot);
          break;
        }
      }
    }
    for (const shot of this.enemyShots) {
      if (!shot.alive) continue;
      shot.life -= dt; shot.mesh.position.x += shot.vx * dt; shot.mesh.position.z += shot.vz * dt;
      shot.mesh.rotation.x += dt * 8; shot.mesh.rotation.y += dt * 10;
      if (shot.life <= 0 || Math.hypot(shot.mesh.position.x, shot.mesh.position.z) > 24) { this.deactivateShot(shot); continue; }
      if (Math.hypot(shot.mesh.position.x - this.px, shot.mesh.position.z - this.pz) < 0.75 + shot.radius) {
        this.hurtPlayer(shot.damage); this.deactivateShot(shot);
      }
    }
  }

  private deactivateShot(shot: Projectile): void { shot.alive = false; shot.mesh.visible = false; }

  private damageEnemy(enemy: Enemy, amount: number): void {
    if (!enemy.alive) return;
    enemy.hp -= amount; enemy.flash = 0.1;
    this.audio.sfx("hit");
    if (enemy.hp > 0) return;
    enemy.alive = false;
    const pos = enemy.model.group.position;
    this.scene.remove(enemy.model.group);
    this.kills++;
    this.combo = Math.min(5, this.combo + 1);
    this.comboTimer = 3.2;
    const base = enemy.type === "boss" ? 2500 : enemy.type === "shooter" ? 180 : enemy.type === "splitter" ? 220 : enemy.type === "minion" ? 60 : 120;
    this.score += base * this.combo;
    const drops = enemy.type === "boss" ? 16 : enemy.type === "splitter" ? 4 : enemy.type === "minion" ? 1 : 2;
    for (let i = 0; i < drops; i++) this.spawnPickup(pos.x, pos.z, enemy.type === "boss" ? 2 : 1);
    this.particles.emit(pos.x, enemy.type === "boss" ? 2 : 1, pos.z, enemy.type === "boss" ? COLORS.gold : COLORS.orange, enemy.type === "boss" ? 60 : 16, enemy.type === "boss" ? 9 : 5, this.random);
    this.audio.sfx("explosion");
    if (enemy.type === "splitter") {
      this.spawnEnemy("minion", pos.x + 0.8, pos.z);
      this.spawnEnemy("minion", pos.x - 0.8, pos.z);
    }
    if (enemy === this.boss) this.boss = null;
  }

  private hurtPlayer(amount: number): void {
    if (this.invulnerable > 0 || this.machine.state !== "playing") return;
    this.hp -= amount; this.invulnerable = 0.65; this.shake = 0.75;
    this.combo = 1; this.comboTimer = 0;
    this.audio.sfx("hurt");
    this.particles.emit(this.px, 1.1, this.pz, COLORS.magenta, 18, 5, this.random);
    if (this.hp <= 0) { this.hp = 0; this.finish(false); }
  }

  private spawnPickup(x: number, z: number, value: number): void {
    for (const pickup of this.pickups) {
      if (pickup.alive) continue;
      const a = this.random() * Math.PI * 2;
      pickup.alive = true; pickup.value = value; pickup.life = 22;
      pickup.vx = Math.sin(a) * 2.5; pickup.vz = Math.cos(a) * 2.5;
      pickup.mesh.position.set(x, 0.8, z); pickup.mesh.visible = true;
      return;
    }
  }

  private updatePickups(dt: number): void {
    const magnet = 3 * (1 + this.magnetLevel * 0.7);
    for (const pickup of this.pickups) {
      if (!pickup.alive) continue;
      pickup.life -= dt;
      if (pickup.life <= 0) { pickup.alive = false; pickup.mesh.visible = false; continue; }
      const pos = pickup.mesh.position;
      const dx = this.px - pos.x, dz = this.pz - pos.z;
      const dist = Math.max(0.001, Math.hypot(dx, dz));
      if (dist < magnet) { pickup.vx += (dx / dist) * 35 * dt; pickup.vz += (dz / dist) * 35 * dt; }
      pickup.vx *= Math.pow(0.15, dt); pickup.vz *= Math.pow(0.15, dt);
      pos.x += pickup.vx * dt; pos.z += pickup.vz * dt;
      pos.y = 0.75 + Math.sin(this.visualTime * 5 + pos.x) * 0.18;
      pickup.mesh.rotation.y += dt * 4;
      if (dist < 1) {
        pickup.alive = false; pickup.mesh.visible = false;
        this.shards += pickup.value; this.score += 25 * pickup.value;
        this.energy = Math.min(GAME_CONFIG.PLAYER_ENERGY, this.energy + 7 * pickup.value);
        this.hp = Math.min(this.maxHp, this.hp + 0.7 * pickup.value);
        this.audio.sfx("pickup");
      }
    }
  }

  private checkWaveComplete(): void {
    if (this.pendingSpawns.length > 0 || this.enemies.length > 0 || this.machine.state !== "playing") return;
    if (this.wave >= 4) { this.finish(true); return; }
    this.choices = this.generateChoices();
    this.input.resetAll();
    this.machine.transition("upgrade");
  }

  private generateChoices(): UpgradeChoice[] {
    const ids = Object.keys(UPGRADES) as Array<Exclude<UpgradeId, "repair">>;
    const choices: UpgradeChoice[] = [];
    while (choices.length < 2) {
      const id = ids[Math.floor(this.random() * ids.length)];
      if (choices.some((c) => c.id === id)) continue;
      choices.push({ ...UPGRADES[id], cost: 3 + this.wave * 2 });
    }
    choices.push({ id: "repair", name: "Réparation gratuite", description: "Restaure 45 PV et toute l’énergie", cost: 0, icon: "+" });
    return choices;
  }

  chooseUpgrade(index: number): void {
    if (this.machine.state !== "upgrade") return;
    const choice = this.choices[index];
    if (!choice || choice.cost > this.shards) return;
    this.shards -= choice.cost;
    if (choice.id === "repair") { this.hp = Math.min(this.maxHp, this.hp + 45); this.energy = GAME_CONFIG.PLAYER_ENERGY; }
    else {
      if (choice.id === "damage") this.damageLevel++;
      if (choice.id === "rapid") this.rapidLevel++;
      if (choice.id === "speed") this.speedLevel++;
      if (choice.id === "pulse") this.pulseLevel++;
      if (choice.id === "magnet") this.magnetLevel++;
      if (choice.id === "vitality") { this.maxHp += 25; this.hp = this.maxHp; }
    }
    this.audio.sfx("ui");
    this.choices = [];
    this.machine.transition("playing");
    this.startWave(this.wave + 1);
  }

  private finish(victory: boolean): void {
    if (victory) {
      this.score += Math.round(this.hp * 12 + Math.max(0, 240 - this.elapsed) * 10);
      this.machine.transition("victory");
      this.audio.sfx("win");
      this.announce("L’ÎLE EST PURIFIÉE", 4);
    } else {
      this.machine.transition("gameover");
      this.audio.sfx("lose");
    }
    this.input.resetAll();
  }

  private announce(text: string, duration: number): void { this.announcement = text; this.announcementTimer = duration; }

  private clearActors(): void {
    for (const enemy of this.enemies) this.scene.remove(enemy.model.group);
    this.enemies.length = 0; this.pendingSpawns.length = 0; this.boss = null;
    for (const shot of [...this.playerShots, ...this.enemyShots]) this.deactivateShot(shot);
    for (const pickup of this.pickups) { pickup.alive = false; pickup.mesh.visible = false; }
    this.particles.clear();
  }

  private render(): void {
    if (this.stopped) return;
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      const instant = 1000 / Math.max(1, now - this.lastFrameTime);
      this.fps += (instant - this.fps) * 0.06;
      if (this.fps < QUALITY.DEGRADE_FPS) this.lowFpsTime += (now - this.lastFrameTime) / 1000;
      else this.lowFpsTime = Math.max(0, this.lowFpsTime - 0.05);
      if (this.lowFpsTime > 2 && !this.degraded) {
        this.degraded = true;
        this.renderer.setPixelRatio(1);
        this.renderer.shadowMap.enabled = false;
        this.resize();
      }
    }
    this.lastFrameTime = now;
    const moving = Math.hypot(this.input.moveX, this.input.moveZ);
    this.player.group.position.set(this.px, 0, this.pz);
    this.player.group.rotation.y = Math.atan2(-this.aimX, -this.aimZ);
    if (this.player.leftLeg && this.player.rightLeg) {
      this.player.leftLeg.rotation.x = Math.sin(this.movePhase) * 0.55 * moving;
      this.player.rightLeg.rotation.x = -Math.sin(this.movePhase) * 0.55 * moving;
    }
    this.player.body.position.y = 1.45 + Math.sin(this.visualTime * 3) * 0.035;
    this.player.bodyMaterial.emissive.setHex(this.invulnerable > 0 && Math.floor(this.visualTime * 20) % 2 === 0 ? 0x663344 : 0x000000);
    if (this.player.weapon) this.player.weapon.position.z = -0.4 + this.recoil * 0.16;
    const cameraTargetX = this.px * 0.55, cameraTargetZ = this.pz * 0.55;
    const shakeX = this.shake > 0 ? Math.sin(this.visualTime * 67) * this.shake * 0.18 : 0;
    const shakeZ = this.shake > 0 ? Math.cos(this.visualTime * 59) * this.shake * 0.18 : 0;
    this.camera.position.set(cameraTargetX + shakeX, 19 + this.shake * 0.2, cameraTargetZ + 20 + shakeZ);
    TMP_VEC2.set(this.px * 0.72, 1.1, this.pz * 0.72 - 1.5);
    this.camera.lookAt(TMP_VEC2);
    this.renderer.render(this.scene, this.camera);
    if (!window.__GAME_READY__) window.__GAME_READY__ = true;
  }

  private resize = (): void => {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / Math.max(1, h);
    this.camera.fov = w < 700 ? 54 : 46;
    this.camera.updateProjectionMatrix();
  };

  private emitSnapshot(): void {
    this.onSnapshot({
      state: this.machine.state, hp: Math.ceil(this.hp), maxHp: this.maxHp,
      energy: Math.floor(this.energy), maxEnergy: GAME_CONFIG.PLAYER_ENERGY,
      wave: this.wave, score: this.score, combo: this.combo, shards: this.shards,
      kills: this.kills, elapsed: this.elapsed, enemies: this.enemies.length + this.pendingSpawns.length,
      bossHp: this.boss ? Math.max(0, Math.ceil(this.boss.hp)) : 0, bossMaxHp: this.boss?.maxHp ?? 0,
      choices: this.choices, muted: this.audio.muted, fps: Math.round(this.fps),
      drawCalls: this.renderer.info.render.calls, runId: this.runId,
      announcement: this.announcement, touch: matchMedia("(pointer: coarse)").matches,
    });
  }

  private installDebugHooks(): void {
    window.__gameProbe = () => ({ x: this.px, y: 0, z: this.pz });
    window.__aetherDebug = {
      busy: () => { if (this.machine.state === "title") this.start(); for (let i = 0; i < 12; i++) this.spawnEnemy(i % 3 === 0 ? "shooter" : "charger", Math.sin(i) * 12, Math.cos(i) * 12); },
      boss: () => { if (this.machine.state === "title") this.start(); this.clearActors(); this.wave = 4; this.machine.transition("playing"); this.spawnEnemy("boss", 0, -8); },
      win: () => { if (this.machine.state === "title") this.start(); this.clearActors(); this.wave = 4; this.finish(true); },
      lose: () => { if (this.machine.state === "title") this.start(); this.hurtPlayer(10000); },
      upgrade: () => { if (this.machine.state === "title") this.start(); this.clearActors(); this.wave = Math.min(this.wave, 3); this.pendingSpawns.length = 0; this.choices = this.generateChoices(); this.machine.transition("upgrade"); },
      stats: () => ({ fps: this.fps, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, enemies: this.enemies.length, state: this.machine.state }),
    };
  }

  dispose(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.loop.stop();
    this.input.dispose(); this.audio.dispose();
    window.removeEventListener("resize", this.resize);
    this.clearActors();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
        obj.geometry.dispose();
        const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
        for (const material of materials) material.dispose();
      }
    });
    this.renderer.dispose();
    delete window.__aetherDebug;
    delete window.__gameProbe;
    window.__GAME_READY__ = false;
  }
}

declare global {
  interface Window {
    __GAME_READY__?: boolean;
    __gameProbe?: () => { x: number; y: number; z: number };
    __aetherDebug?: {
      busy: () => void; boss: () => void; win: () => void; lose: () => void; upgrade: () => void;
      stats: () => { fps: number; calls: number; triangles: number; enemies: number; state: GameState };
    };
  }
}
