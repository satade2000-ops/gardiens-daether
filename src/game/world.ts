import * as THREE from "three";
import { COLORS, GAME_CONFIG } from "./config";

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface World {
  root: THREE.Group;
  portal: THREE.Group;
  crystals: THREE.Group;
  update: (time: number) => void;
}

export function createWorld(scene: THREE.Scene): World {
  const random = rng(GAME_CONFIG.FIXED_SEED);
  const root = new THREE.Group();
  scene.add(root);
  const mat = (color: number, roughness = 0.9, emissive = 0x000000) => new THREE.MeshStandardMaterial({ color, roughness, flatShading: true, emissive });
  const earth = mat(COLORS.earth);
  const earthDark = mat(COLORS.earthDark);
  const grass = mat(COLORS.grass);
  const stone = mat(COLORS.stone);
  const cyan = mat(COLORS.cyan, 0.35, 0x123d3c);

  const island = new THREE.Mesh(new THREE.CylinderGeometry(22, 13, 5.5, 40, 3), earth);
  island.position.y = -2.85;
  island.receiveShadow = true;
  root.add(island);
  const underside = new THREE.Mesh(new THREE.ConeGeometry(13, 12, 32, 3), earthDark);
  underside.rotation.x = Math.PI;
  underside.position.y = -11.2;
  root.add(underside);
  const top = new THREE.Mesh(new THREE.CylinderGeometry(22.05, 21.7, 0.45, 48), grass);
  top.position.y = 0.05;
  top.receiveShadow = true;
  root.add(top);
const extendedGround = new THREE.Mesh(
  new THREE.PlaneGeometry(220, 220),
  grass
);
extendedGround.rotation.x = -Math.PI / 2;
extendedGround.position.y = 0.275;
extendedGround.receiveShadow = true;
root.add(extendedGround);
  const pathMat = mat(0xd6c797);
  const path = new THREE.Mesh(new THREE.RingGeometry(5.5, 6.15, 48), pathMat);
  path.rotation.x = -Math.PI / 2;
  path.position.y = 0.3;
  path.receiveShadow = true;
  root.add(path);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.16, 0.8), pathMat);
    slab.position.set(Math.sin(a) * 5.82, 0.35, Math.cos(a) * 5.82);
    slab.rotation.y = a;
    slab.receiveShadow = true;
    root.add(slab);
  }

  const dummy = new THREE.Object3D();
  const treeCount = 34;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.28, 1.7, 6), mat(0x78513c), treeCount);
  const crowns = new THREE.InstancedMesh(new THREE.ConeGeometry(1.15, 3.4, 7), mat(0x2f9270), treeCount);
  // Small instanced scenery keeps its contact lighting without a separate
  // instanced depth pass (unreliable on software WebGL and costly on mobile).
  trunks.castShadow = crowns.castShadow = false;
  for (let i = 0; i < treeCount; i++) {
    const a = random() * Math.PI * 2;
    const r = 15 + random() * 5.2;
    const s = 0.72 + random() * 0.65;
    const x = Math.sin(a) * r, z = Math.cos(a) * r;
    dummy.position.set(x, 0.95 * s, z); dummy.scale.setScalar(s); dummy.rotation.y = random() * 6.28; dummy.updateMatrix();
    trunks.setMatrixAt(i, dummy.matrix);
    dummy.position.y = 3.1 * s; dummy.rotation.y += random(); dummy.updateMatrix();
    crowns.setMatrixAt(i, dummy.matrix);
  }
  root.add(trunks, crowns);

  const rockCount = 40;
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.75, 0), stone, rockCount);
  rocks.castShadow = false;
  rocks.receiveShadow = true;
  for (let i = 0; i < rockCount; i++) {
    const a = random() * Math.PI * 2, r = 13 + random() * 8;
    dummy.position.set(Math.sin(a) * r, 0.35, Math.cos(a) * r);
    dummy.rotation.set(random(), random() * 6.28, random());
    dummy.scale.set(0.35 + random(), 0.3 + random() * 0.6, 0.4 + random()); dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  root.add(rocks);

  const grassCount = 100;
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.18, 0.8, 3), mat(COLORS.grassLight), grassCount);
  for (let i = 0; i < grassCount; i++) {
    const a = random() * Math.PI * 2, r = 7 + random() * 13;
    dummy.position.set(Math.sin(a) * r, 0.55, Math.cos(a) * r);
    dummy.rotation.set(0, random() * 6.28, (random() - 0.5) * 0.3);
    dummy.scale.setScalar(0.6 + random() * 0.8); dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
  }
  root.add(tufts);

  const crystals = new THREE.Group();
  for (let cluster = 0; cluster < 7; cluster++) {
    const a = cluster * 2.4 + 0.5, r = 10.5 + (cluster % 3) * 2.4;
    const group = new THREE.Group();
    group.position.set(Math.sin(a) * r, 0.35, Math.cos(a) * r);
    for (let j = 0; j < 4; j++) {
      const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.45 + random() * 0.35, 0), cyan);
      crystal.scale.y = 1.8 + random() * 1.7;
      crystal.position.set((random() - 0.5) * 1.2, crystal.scale.y * 0.35, (random() - 0.5) * 1.2);
      crystal.rotation.y = random() * 6.28;
      crystal.castShadow = true;
      group.add(crystal);
    }
    crystals.add(group);
  }
  root.add(crystals);

  const portal = new THREE.Group();
  portal.position.set(0, 0.3, -16.8);
  for (const side of [-1, 1]) {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1.25, 5.5, 1.25), stone);
    pillar.position.set(side * 2.4, 2.75, 0);
    pillar.rotation.z = side * -0.06;
    pillar.castShadow = pillar.receiveShadow = true;
    portal.add(pillar);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 1.7), pathMat);
    cap.position.set(side * 2.4, 5.45, 0); cap.castShadow = true; portal.add(cap);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(6.2, 1, 1.4), stone);
  lintel.position.y = 5.55; lintel.castShadow = true; portal.add(lintel);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.13, 8, 32), cyan);
  ring.position.y = 2.8; portal.add(ring);
  const inner = new THREE.Mesh(new THREE.CircleGeometry(1.48, 32), new THREE.MeshBasicMaterial({ color: 0x5de8e0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }));
  inner.position.y = 2.8; inner.position.z = 0.03; portal.add(inner);
  root.add(portal);

  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    const far = new THREE.Group();
    const size = 2.5 + random() * 4;
    const mass = new THREE.Mesh(new THREE.ConeGeometry(size, size * 2.2, 7), earthDark);
    mass.rotation.x = Math.PI;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(size, size * 0.85, 0.45, 7), grass);
    cap.position.y = size * 1.1;
    far.add(mass, cap);
    far.position.set(Math.sin(a) * (48 + random() * 30), -5 + random() * 14, Math.cos(a) * (48 + random() * 30));
    far.userData.phase = random() * 6.28;
    root.add(far);
  }

  return {
    root, portal, crystals,
    update(time: number) {
      ring.rotation.z = time * 0.45;
      inner.material.opacity = 0.13 + Math.sin(time * 2) * 0.045;
      crystals.children.forEach((g, i) => { g.rotation.y = Math.sin(time * 0.35 + i) * 0.08; });
      for (let i = root.children.length - 9; i < root.children.length; i++) {
        const far = root.children[i];
        far.position.y += Math.sin(time * 0.4 + far.userData.phase) * 0.0015;
      }
    },
  };
}
