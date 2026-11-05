import * as THREE from "three";
import { COLORS } from "./config";

export type EnemyType = "charger" | "shooter" | "splitter" | "minion" | "boss";

export interface ActorModel {
  group: THREE.Group;
  body: THREE.Mesh;
  bodyMaterial: THREE.MeshStandardMaterial;
  leftLeg?: THREE.Object3D;
  rightLeg?: THREE.Object3D;
  weapon?: THREE.Object3D;
  shadow: THREE.Mesh;
}

function material(color: number, emissive = 0x000000): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, emissive, roughness: 0.68, metalness: 0.08, flatShading: true });
}
function mesh(geometry: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometry, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function blobShadow(radius: number): THREE.Mesh {
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(radius, 20), new THREE.MeshBasicMaterial({ color: 0x213a45, transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.32;
  return shadow;
}

export function createPlayerModel(): ActorModel {
  const group = new THREE.Group();
  const armor = material(COLORS.cream);
  const blue = material(COLORS.blue);
  const glow = material(COLORS.cyan, 0x176a68);
  const dark = material(0x294657);
  const body = mesh(new THREE.DodecahedronGeometry(0.83, 0), armor, 0, 1.45, 0);
  body.scale.set(1, 1.08, 0.8);
  group.add(body);
  const core = mesh(new THREE.OctahedronGeometry(0.28, 0), glow, 0, 1.5, -0.69);
  group.add(core);
  const head = mesh(new THREE.BoxGeometry(0.8, 0.55, 0.67), blue, 0, 2.25, -0.03);
  group.add(head);
  const visor = mesh(new THREE.BoxGeometry(0.55, 0.15, 0.05), glow, 0, 2.28, -0.38);
  group.add(visor);
  const antenna = mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.48, 6), dark, 0.24, 2.72, 0);
  const tip = mesh(new THREE.OctahedronGeometry(0.12), glow, 0.24, 2.99, 0);
  group.add(antenna, tip);
  const leftLeg = new THREE.Group(), rightLeg = new THREE.Group();
  for (const [leg, x] of [[leftLeg, -0.38], [rightLeg, 0.38]] as const) {
    leg.position.set(x, 0.95, 0);
    leg.add(mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.72, 6), dark, 0, -0.32, 0));
    leg.add(mesh(new THREE.BoxGeometry(0.43, 0.22, 0.67), blue, 0, -0.73, -0.1));
    group.add(leg);
  }
  const arm = mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.85, 6), armor, -0.87, 1.45, 0);
  arm.rotation.z = -0.2;
  group.add(arm);
  const weapon = new THREE.Group();
  weapon.position.set(0.86, 1.45, -0.4);
  const barrel = mesh(new THREE.CylinderGeometry(0.18, 0.25, 1.25, 8), dark);
  barrel.rotation.x = Math.PI / 2;
  const muzzle = mesh(new THREE.TorusGeometry(0.23, 0.07, 6, 12), glow, 0, 0, -0.64);
  weapon.add(barrel, muzzle);
  group.add(weapon);
  const shadow = blobShadow(0.9);
  group.add(shadow);
  return { group, body, bodyMaterial: armor, leftLeg, rightLeg, weapon, shadow };
}

export function createEnemyModel(type: EnemyType): ActorModel {
  const group = new THREE.Group();
  const colors: Record<EnemyType, number> = { charger: COLORS.orange, shooter: COLORS.purple, splitter: 0x73d067, minion: 0xa5e56b, boss: COLORS.magenta };
  const bodyMaterial = material(colors[type], type === "boss" ? 0x3c0c20 : 0x000000);
  const dark = material(0x3b3d58);
  const glow = material(type === "shooter" ? 0xf1a2ff : type === "boss" ? COLORS.gold : 0xffdf9d, type === "boss" ? 0x6b4310 : 0x2c182c);
  let body: THREE.Mesh;
  if (type === "charger") {
  const skin = material(0x8b573b);
  const armor = bodyMaterial;

  // Torse
  body = mesh(new THREE.BoxGeometry(0.78, 0.9, 0.42), armor, 0, 1.25, 0);
  group.add(body);

  // Tête
  group.add(mesh(new THREE.SphereGeometry(0.28, 12, 10), skin, 0, 1.95, 0));

  // Casque
  group.add(mesh(new THREE.SphereGeometry(0.32, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), dark, 0, 2.05, 0));

  // Visage : yeux
  const eye = material(0xffffff);
  group.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), eye, -0.1, 1.97, -0.25));
  group.add(mesh(new THREE.SphereGeometry(0.045, 8, 6), eye, 0.1, 1.97, -0.25));

  // Épaulières
  for (const side of [-1, 1]) {
    group.add(mesh(new THREE.SphereGeometry(0.25, 8, 6), glow, side * 0.48, 1.55, 0));

    // Bras
    const arm = mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.7, 8), skin, side * 0.53, 1.15, 0);
    arm.rotation.z = side * -0.18;
    group.add(arm);

    // Jambes
    const leg = mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.7, 8), dark, side * 0.22, 0.48, 0);
    group.add(leg);

    // Bottes
    group.add(mesh(new THREE.BoxGeometry(0.3, 0.2, 0.4), dark, side * 0.22, 0.15, -0.06));
  }

  // Épée
  group.add(mesh(new THREE.BoxGeometry(0.1, 0.85, 0.12), glow, 0.82, 1.35, -0.08));
  group.add(mesh(new THREE.BoxGeometry(0.35, 0.09, 0.14), dark, 0.82, 0.9, -0.08));
  group.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 8), dark, 0.82, 0.78, -0.08));
  } else if (type === "shooter") {
    body = mesh(new THREE.OctahedronGeometry(0.82, 0), bodyMaterial, 0, 1.35, 0);
    group.add(body);
    const ring = mesh(new THREE.TorusGeometry(1.03, 0.09, 6, 18), glow, 0, 1.35, 0);
    ring.rotation.x = Math.PI / 2; group.add(ring);
    group.add(mesh(new THREE.SphereGeometry(0.23, 8, 6), glow, 0, 1.35, -0.72));
  } else if (type === "splitter" || type === "minion") {
    const s = type === "minion" ? 0.6 : 1;
    body = mesh(new THREE.IcosahedronGeometry(0.75 * s, 0), bodyMaterial, 0, 0.9 * s, 0);
    group.add(body);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.18 * s, 0.65 * s, 4), glow, Math.sin(a) * 0.6 * s, 0.9 * s, Math.cos(a) * 0.6 * s);
      spike.rotation.z = Math.sin(a) * 0.8; spike.rotation.x = Math.cos(a) * -0.8; group.add(spike);
    }
  } else {
    body = mesh(new THREE.DodecahedronGeometry(1.75, 1), bodyMaterial, 0, 2.25, 0);
    body.scale.set(1, 1.15, 0.9);
    group.add(body);
    group.add(mesh(new THREE.OctahedronGeometry(0.65, 0), glow, 0, 2.3, -1.55));
    for (const side of [-1, 1]) {
      const shoulder = mesh(new THREE.OctahedronGeometry(0.85, 0), dark, side * 1.85, 2.35, 0);
      group.add(shoulder);
      const horn = mesh(new THREE.ConeGeometry(0.32, 1.7, 5), glow, side * 1.2, 4.15, 0);
      horn.rotation.z = side * -0.35; group.add(horn);
    }
    const ring = mesh(new THREE.TorusGeometry(2.35, 0.12, 8, 32), glow, 0, 2.3, 0);
    ring.rotation.x = Math.PI / 2; group.add(ring);
  }
  const shadow = blobShadow(type === "boss" ? 2 : type === "minion" ? 0.55 : 0.9);
  group.add(shadow);
  return { group, body, bodyMaterial, shadow };
}
