import * as THREE from "three";
import { GAME_CONFIG } from "./config";

export class ParticleSystem {
  readonly points: THREE.Points;
  private positions = new Float32Array(GAME_CONFIG.MAX_PARTICLES * 3);
  private colors = new Float32Array(GAME_CONFIG.MAX_PARTICLES * 3);
  private velocities = new Float32Array(GAME_CONFIG.MAX_PARTICLES * 3);
  private life = new Float32Array(GAME_CONFIG.MAX_PARTICLES);
  private cursor = 0;
  private color = new THREE.Color();

  constructor(scene: THREE.Scene) {
    for (let i = 0; i < GAME_CONFIG.MAX_PARTICLES; i++) this.positions[i * 3 + 1] = -100;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(this.positions, 3).setUsage(THREE.DynamicDrawUsage));
    geometry.setAttribute("color", new THREE.BufferAttribute(this.colors, 3).setUsage(THREE.DynamicDrawUsage));
    const material = new THREE.PointsMaterial({ size: 0.24, vertexColors: true, transparent: true, opacity: 0.9, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(geometry, material);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  emit(x: number, y: number, z: number, color: number, count: number, speed = 4, random: () => number): void {
    this.color.setHex(color);
    for (let n = 0; n < count; n++) {
      const i = this.cursor++ % GAME_CONFIG.MAX_PARTICLES;
      const p = i * 3, a = random() * Math.PI * 2, s = speed * (0.35 + random() * 0.65);
      this.positions[p] = x; this.positions[p + 1] = y; this.positions[p + 2] = z;
      this.velocities[p] = Math.sin(a) * s;
      this.velocities[p + 1] = 1.5 + random() * speed * 0.8;
      this.velocities[p + 2] = Math.cos(a) * s;
      this.colors[p] = this.color.r; this.colors[p + 1] = this.color.g; this.colors[p + 2] = this.color.b;
      this.life[i] = 0.45 + random() * 0.55;
    }
  }

  update(dt: number): void {
    for (let i = 0; i < GAME_CONFIG.MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const p = i * 3;
      if (this.life[i] <= 0) { this.positions[p + 1] = -100; continue; }
      this.velocities[p + 1] -= 9 * dt;
      this.positions[p] += this.velocities[p] * dt;
      this.positions[p + 1] += this.velocities[p + 1] * dt;
      this.positions[p + 2] += this.velocities[p + 2] * dt;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  clear(): void {
    this.life.fill(0);
    for (let i = 0; i < GAME_CONFIG.MAX_PARTICLES; i++) this.positions[i * 3 + 1] = -100;
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}
