// A Plus 天空之城（第三版場景）
// 一座三層的浮空城：最上層＝精神之塔、中層＝功能區圍著塔、外環＝街道住宅與預留空地；底部倒掛岩石＋樹根＋瀑布。
// 全部幾何由程式產生，不載入模型或貼圖。
// 省電：devicePixelRatio 上限 2、沒有即時陰影（假陰影圓盤）、操作後只動 ORBIT_AFTER_ACTIVITY_MS，之後停止重繪。
// 介面與前兩版相同：createIsland({ stage, onPick, onBackground }) → { select(id), setInset(right, bottom) }

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { TILES, PORTS, SATELLITES, COMPANY, ORBIT_AFTER_ACTIVITY_MS } from './data.js';

// ─────────────── 尺寸 ───────────────
const R1 = 24;                      // 島半徑
const G1 = 0.95, GH = 3.4;           // 地面／城堡高台高度
const HILL_R = 8;                    // 城堡高台半徑
const CASTLE = [0, -10], LEFT = [-12.5, -5], RIGHT = [12.5, -5], FRONT = [0, 3]; // 城堡、左（學院）、右（LINEAI）、前（練功場）
const WALL_F = 0.86, WALL_H = 1.4, GATE_HALF = 3.4; // 城牆在島緣的位置、高度、城門開口半寬
const PLOT_R = 17.5;                 // 預留空地
const PLOT_IN = 15.5;                // 空地上的功能區（往城內一點，避開城牆的城塔）
const CLOUD_Y = -17;                // 雲海高度（島的地基很深，雲海放低才露得出來）
const MT_HALF = 40;                  // 後方靠山的範圍（離正後方 ±40°，這段不蓋城牆）
const MOAT_IN = 0.885, MOAT_OUT = 0.975; // 護城河在島緣的位置（島外形的比例）
const PLAIN_TOWERS = [25, -25, 66, 112, 138, -45, -75, -105, -135]; // 城牆哨塔的方位
const BRIDGE_DEG = 90;               // 往綠佳利島的吊橋，從東側城牆出去
const COMP_POS = new THREE.Vector3(45, -0.6, 4); // 綠佳利島相對天空之城的位置（右邊）
const TW_K = 8.4;                    // 台灣經緯度 → 島面座標的倍率
const D2R = Math.PI / 180;

// ─────────────── 調色盤（米白＋金）───────────────
const PAL = {
  grass: '#8fbf6a', grass2: '#86b864', field: '#a6d07c',
  rim: '#f1e7d0', rimDark: '#e2d3b2', wall: '#ece2cc', wallDark: '#ddd0b2',
  earth: '#cfae7e', rock: ['#a8957a', '#988670', '#b3a186', '#8c7b66'],
  stone: '#f6f0e2', stoneShade: '#e9dfc8', white: '#fbf7ee',
  gold: '#b8960c', goldSoft: '#d9b84a', goldBright: '#f2d888',
  wood: '#8a6440', trunk: '#7a5636', root: '#6e5236', leaf: ['#5f9a4a', '#6aa652', '#4f8c44', '#7ab35a'],
  path: '#efe3c6', window: '#4a6178', navy: '#2f4a6d', bronze: '#b08a4a',
  houseWall: ['#f4eee2', '#efe5d2', '#f8f2e6', '#ebe0c9'], roof: ['#b8960c', '#c9784f', '#2f4a6d', '#d9b84a', '#a2593e'],
  water: '#9fd0ee',
};

// ─────────────── 小工具 ───────────────
function rng(seed) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}
const pick = (arr, r) => arr[Math.floor(r() * arr.length) % arr.length];
const _e = new THREE.Euler(), _q = new THREE.Quaternion();
function mat(x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) {
  _e.set(rx, ry, rz); _q.setFromEuler(_e);
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), _q.clone(), new THREE.Vector3(sx, sy, sz));
}
const _c = new THREE.Color();
function prep(geo, color, m) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
  if (!g.attributes.normal) g.computeVertexNormals();
  if (m) g.applyMatrix4(m);
  const n = g.attributes.position.count, a = new Float32Array(n * 3);
  _c.set(color);
  for (let i = 0; i < n; i++) { a[i * 3] = _c.r; a[i * 3 + 1] = _c.g; a[i * 3 + 2] = _c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  g.clearGroups();
  return g;
}
const G = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl6: new THREE.CylinderGeometry(0.5, 0.5, 1, 6),
  cyl8: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  cyl16: new THREE.CylinderGeometry(0.5, 0.5, 1, 16),
  cone6: new THREE.ConeGeometry(0.5, 1, 6),
  cone16: new THREE.ConeGeometry(0.5, 1, 16),
  sph: new THREE.SphereGeometry(0.5, 12, 8),
  puff: new THREE.SphereGeometry(0.5, 14, 10),
  ico: new THREE.IcosahedronGeometry(0.5, 0),
  dode: new THREE.DodecahedronGeometry(0.5, 0),
  hex: new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, false, Math.PI / 6),
};
let gableGeo = null;
function gable() { // 三角屋頂 1×1×1（屋脊沿 z）
  if (!gableGeo) {
    const s = new THREE.Shape(); s.moveTo(-0.5, 0); s.lineTo(0.5, 0); s.lineTo(0, 1); s.lineTo(-0.5, 0);
    gableGeo = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false }); gableGeo.translate(0, 0, -0.5);
  }
  return gableGeo;
}
let glowTex = null;
function getGlowTex() {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c); glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}
// 方位（度，0＝正前方 +z，往右為正）→ 平面座標
const polar = (deg, d) => [Math.sin(deg * D2R) * d, Math.cos(deg * D2R) * d];
const faceOut = (x, z) => Math.atan2(x, z);
const faceIn = (x, z) => Math.atan2(-x, -z);

// 不規則外形（有機的圓）；shape 的 y＝世界的 -z
function organic(R, seed, amp, N = 80) {
  const r = rng(seed), a = r() * 6.28, b = r() * 6.28, c = r() * 6.28;
  const pts = [];
  for (let i = 0; i < N; i++) {
    const t = i / N * Math.PI * 2;
    const rr = R * (1 + amp * (0.5 * Math.sin(3 * t + a) + 0.33 * Math.sin(5 * t + b) + 0.2 * Math.sin(8 * t + c)));
    pts.push(new THREE.Vector2(Math.sin(t) * rr, -Math.cos(t) * rr));
  }
  return pts;
}
const scaled = (pts, s, ox = 0, oz = 0) => pts.map((p) => new THREE.Vector2(p.x * s + ox, p.y * s - oz));
function slab(pts, y0, depth, bevel) {
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); g.translate(0, y0 + bevel, 0); return g;
}
function inside(pts, x, z) {
  let c = false; const py = -z;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if (((yi > py) !== (yj > py)) && (x < (xj - xi) * (py - yi) / (yj - yi) + xi)) c = !c;
  }
  return c;
}
function edgeAt(pts, deg) { // 外形在某方位的半徑（organic 的點從 0 度起、順著方位排）
  const i = Math.round((((deg % 360) + 360) % 360) / 360 * pts.length) % pts.length;
  return Math.hypot(pts[i].x, pts[i].y);
}

// ─────────────── 組件 ───────────────
class Kit {
  constructor() { this.solid = []; this.shadow = []; this.glows = []; }
  add(geo, color, m) { this.solid.push(prep(geo, color, m)); }
  shadowAt(x, z, r, y) { const g = new THREE.CircleGeometry(r, 16); g.rotateX(-Math.PI / 2); g.translate(x, y + 0.02, z); this.shadow.push(prep(g, '#000')); }
  mesh(mats) {
    const g = new THREE.Group();
    if (this.solid.length) g.add(new THREE.Mesh(mergeGeometries(this.solid), mats.solid));
    if (this.shadow.length) { const m = new THREE.Mesh(mergeGeometries(this.shadow), mats.shadow); m.renderOrder = 1; g.add(m); }
    for (const [p, s] of this.glows) { const sp = new THREE.Sprite(mats.glowSprite()); sp.position.copy(p); sp.scale.set(s, s, 1); g.add(sp); }
    return g;
  }
}
// 一棟建築的局部座標系
function B(k, x, gy, z, rot, sc = 1) {
  const base = new THREE.Matrix4().compose(new THREE.Vector3(x, gy, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rot, 0)), new THREE.Vector3(sc, sc, sc));
  const P = (geo, color, lx, ly, lz, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => k.add(geo, color, base.clone().multiply(mat(lx, ly, lz, ry, sx, sy, sz, rx, rz)));
  const L = (lx, ly, lz, s = 2) => k.glows.push([new THREE.Vector3(lx, ly, lz).applyMatrix4(base), s * sc]);
  const at = (lx, ly, lz) => new THREE.Vector3(lx, ly, lz).applyMatrix4(base);
  return { P, L, at, base };
}
function windows(P, w, d, y0, h, floors, cols) {
  for (let f = 0; f < floors; f++) {
    const y = y0 + h / floors * (f + 0.55);
    for (let c = 0; c < cols; c++) {
      const u = ((c + 0.5) / cols - 0.5) * w * 0.8;
      P(G.box, PAL.window, u, y, d / 2 + 0.01, 0, 0.22, 0.3, 0.02);
      P(G.box, PAL.window, u, y, -d / 2 - 0.01, 0, 0.22, 0.3, 0.02);
    }
  }
}

// ── 精神之塔：北邊的大城堡（本體＋兩翼＋角樓＋中央高塔）──
function buildCastle(k, gy, pos) {
  const { P, L } = B(k, pos[0], gy, pos[1], 0);
  // 本體
  P(G.box, PAL.white, 0, 2.3, 1.4, 0, 8.4, 4.6, 4.4);
  P(G.box, PAL.goldSoft, 0, 4.66, 1.4, 0, 8.6, 0.14, 4.6);
  P(gable(), PAL.gold, 0, 4.72, 1.4, Math.PI / 2, 4.6, 1.7, 8.6);
  for (let i = 0; i < 7; i++) P(G.box, PAL.window, -3.3 + i * 1.1, 2.9, 3.62, 0, 0.36, 0.9, 0.04);
  P(G.box, PAL.gold, 0, 1.5, 3.62, 0, 1.6, 2.6, 0.12);                       // 大門
  P(G.cyl16, PAL.gold, 0, 2.8, 3.64, 0, 1.6, 0.14, 1.6, Math.PI / 2);
  // 兩翼
  for (const s of [-1, 1]) {
    P(G.box, PAL.stone, s * 5.6, 1.7, 2.0, 0, 3.0, 3.4, 3.4);
    P(gable(), PAL.gold, s * 5.6, 3.4, 2.0, 0, 3.2, 1.3, 3.6);
    P(G.box, PAL.window, s * 5.6, 2.0, 3.72, 0, 0.4, 0.8, 0.04);
  }
  // 角樓（金色尖頂）
  const turret = (x, z, h, r) => {
    P(G.cyl16, PAL.white, x, h / 2, z, 0, r * 2, h, r * 2);
    P(G.cyl16, PAL.goldSoft, x, h + 0.06, z, 0, r * 2.25, 0.14, r * 2.25);
    P(G.cone16, PAL.gold, x, h + r * 1.6, z, 0, r * 2.6, r * 3.2, r * 2.6);
    P(G.box, PAL.window, x, h * 0.66, z + r + 0.01, 0, 0.26, 0.5, 0.04);
    L(x, h + r * 3.3, z, 1.2);
  };
  turret(-4.3, 3.6, 6.2, 0.8); turret(4.3, 3.6, 6.2, 0.8);
  turret(-7.4, 3.4, 4.6, 0.65); turret(7.4, 3.4, 4.6, 0.65);
  turret(-3.4, -0.9, 7.6, 0.75); turret(3.4, -0.9, 7.6, 0.75);
  // 中央高塔
  P(G.cyl16, PAL.white, 0, 5.0, -0.6, 0, 3.8, 10.0, 3.8);
  P(G.cyl16, PAL.goldSoft, 0, 10.05, -0.6, 0, 4.1, 0.18, 4.1);
  P(G.cyl16, PAL.stone, 0, 10.3, -0.6, 0, 3.4, 0.3, 3.4);
  P(G.cyl16, PAL.white, 0, 12.2, -0.6, 0, 2.6, 3.6, 2.6);
  P(G.cyl16, PAL.goldSoft, 0, 14.05, -0.6, 0, 2.8, 0.16, 2.8);
  P(G.cyl16, PAL.white, 0, 15.1, -0.6, 0, 1.8, 2.0, 1.8);
  P(G.cone16, PAL.gold, 0, 18.4, -0.6, 0, 2.5, 4.8, 2.5);
  P(G.sph, PAL.goldBright, 0, 21.0, -0.6, 0, 0.55, 0.55, 0.55);
  P(G.cyl8, '#5a5348', 0, 21.8, -0.6, 0, 0.06, 1.4, 0.06);
  P(G.box, PAL.gold, 0.4, 22.2, -0.6, 0, 0.8, 0.45, 0.04);
  L(0, 21.0, -0.6, 5);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * Math.PI * 2 + Math.PI / 6;
    P(G.box, PAL.window, Math.sin(a) * 1.92, 8.4, -0.6 + Math.cos(a) * 1.92, a, 0.32, 0.8, 0.04);
    P(G.box, PAL.window, Math.sin(a) * 1.32, 12.5, -0.6 + Math.cos(a) * 1.32, a, 0.26, 0.6, 0.04);
  }
  k.shadowAt(pos[0] + 0.4, pos[1] + 1.2, 5.6, gy);
  return 23;
}

// ── 環球致富學院：學院大樓＋鐘樓＋前排三間教室（公司｜商品｜制度）──
function buildAcademy(k, x, gy, z, rot) {
  const { P, L, at } = B(k, x, gy, z, rot);
  P(G.box, PAL.white, 0, 1.1, -1.0, 0, 5.4, 2.2, 2.6);
  P(gable(), PAL.navy, 0, 2.2, -1.0, Math.PI / 2, 2.9, 1.1, 5.7);
  windows(P, 5.4, 2.6, 0, 2.2, 2, 6);
  P(G.box, PAL.stone, 0, 2.6, -0.6, 0, 1.3, 5.2, 1.3);
  P(G.cyl16, PAL.goldBright, 0, 4.2, 0.07, 0, 0.9, 0.06, 0.9, Math.PI / 2);
  P(G.box, '#3a3a44', 0, 4.2, 0.11, 0, 0.05, 0.36, 0.02);
  P(G.box, PAL.goldSoft, 0, 5.25, -0.6, 0, 1.45, 0.14, 1.45);
  P(new THREE.ConeGeometry(0.5, 1, 4), PAL.navy, 0, 6.05, -0.6, Math.PI / 4, 1.8, 1.5, 1.8);
  P(G.sph, PAL.goldBright, 0, 6.9, -0.6, 0, 0.28, 0.28, 0.28);
  L(0, 4.2, 0.2, 1.6);
  const rooms = [];
  [['#b8960c', -2.7], ['#6aa652', 0], ['#2f4a6d', 2.7]].forEach(([roof, rx]) => {
    P(G.box, PAL.stone, rx, 0.8, 2.3, 0, 2.2, 1.6, 1.9);
    P(gable(), roof, rx, 1.6, 2.3, Math.PI / 2, 2.1, 0.8, 2.4);
    P(G.box, PAL.gold, rx, 0.55, 3.26, 0, 0.5, 1.0, 0.04);
    P(G.box, PAL.window, rx - 0.65, 0.95, 3.26, 0, 0.34, 0.4, 0.02);
    P(G.box, PAL.window, rx + 0.65, 0.95, 3.26, 0, 0.34, 0.4, 0.02);
    rooms.push(at(rx, 2.6, 2.3));
  });
  P(G.box, PAL.path, 0, 0.04, 4.0, 0, 8.0, 0.06, 1.2);
  k.shadowAt(x, z, 3.6, gy);
  return { h: 7.4, rooms };
}

// ── LINEAI 顧問：魔法塔頂著一顆會發光轉動的水晶球 ──
function buildMagic(k, x, gy, z, rot, mats) {
  const { P, L } = B(k, x, gy, z, rot);
  P(G.cyl16, PAL.stoneShade, 0, 0.2, 0, 0, 5.6, 0.4, 5.6);
  P(G.cyl16, '#cfc6f0', 0, 0.42, 0, 0, 4.6, 0.06, 4.6);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; P(G.cone6, '#3b3f86', Math.sin(a) * 2.4, 1.1, Math.cos(a) * 2.4, 0, 0.45, 1.4, 0.45); }
  const segs = [[1.25, 1.05, 2.2], [1.0, 0.82, 2.2], [0.78, 0.6, 2.0], [0.58, 0.45, 1.6]];
  let y = 0.4;
  segs.forEach(([r0, r1, h], i) => {
    P(new THREE.CylinderGeometry(r1, r0, h, 12), i % 2 ? '#454c9a' : '#34407a', 0, y + h / 2, 0);
    y += h; P(G.cyl16, PAL.goldSoft, 0, y, 0, 0, r1 * 2 + 0.25, 0.14, r1 * 2 + 0.25);
  });
  for (let i = 0; i < 4; i++) { const a = i / 4 * Math.PI * 2 + 0.4; P(G.box, PAL.gold, Math.sin(a) * 0.55, y + 0.6, Math.cos(a) * 0.55, a, 0.12, 1.4, 0.12, 0.45); }
  // 旁邊的小圖書館（紫色圓頂）
  P(G.cyl16, PAL.stone, -3.2, 0.9, 1.6, 0, 2.4, 1.8, 2.4);
  P(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#6b5fb5', -3.2, 1.8, 1.6, 0, 2.5, 2.2, 2.5);
  P(G.box, PAL.gold, -3.2, 0.55, 2.81, 0, 0.5, 1.0, 0.04);
  // 會動的部分（水晶球、繞著飛的水晶、魔法環）
  const orbY = y + 1.6;
  const orb = new THREE.Group();
  orb.add(new THREE.Mesh(new THREE.SphereGeometry(1.25, 24, 16), mats.orb));
  orb.add(new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), mats.orbCore));
  const crystals = new THREE.Group();
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), i % 2 ? mats.crystalA : mats.crystalB);
    const a = i / 5 * Math.PI * 2; c.position.set(Math.cos(a) * 2.2, Math.sin(a * 2) * 0.4, Math.sin(a) * 2.2); c.scale.y = 1.6; crystals.add(c);
  }
  const rings = [3.0, 5.4].map((ry, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(1.9 - i * 0.4, 0.05, 6, 40), mats.rune); m.position.y = ry; m.rotation.x = Math.PI / 2 + (i ? -0.25 : 0.25); return m; });
  const holder = new THREE.Group(); holder.position.set(x, gy, z); holder.rotation.y = rot;
  orb.position.y = orbY; crystals.position.y = orbY; holder.add(orb, crystals, ...rings);
  const halo = new THREE.Sprite(mats.orbGlow()); halo.scale.set(9, 9, 1); halo.position.y = orbY; holder.add(halo);
  L(-3.2, 2.9, 1.6, 1.4);
  k.shadowAt(x, z, 3, gy);
  return { h: orbY + 1.6, holder, orb, crystals, rings, halo, orbY };
}

// ── 實戰班：練功場（木人樁、箭靶、兵器架、旗、涼亭）──
function buildDojo(k, x, gy, z, rot) {
  const { P } = B(k, x, gy, z, rot);
  P(G.box, '#dcc59a', 0, 0.05, 0, 0, 9.4, 0.1, 5.8);
  for (let i = 0; i < 11; i++) for (const s of [-1, 1]) P(G.box, PAL.wood, -4.7 + i * 0.94, 0.35, s * 2.9, 0, 0.1, 0.6, 0.1);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) if (Math.abs(i - 2.5) > 1) P(G.box, PAL.wood, s * 4.7, 0.35, -2.9 + i * 1.16, 0, 0.1, 0.6, 0.1);
  for (const s of [-1, 1]) { P(G.box, PAL.wood, 0, 0.55, s * 2.9, 0, 9.4, 0.07, 0.07); }
  for (let i = 0; i < 4; i++) { // 木人樁
    const dx = -2.6 + i * 1.7;
    P(G.cyl8, '#9a6e45', dx, 0.85, -0.6, 0, 0.24, 1.6, 0.24);
    P(G.box, '#9a6e45', dx, 1.2, -0.6, 0, 1.0, 0.12, 0.12);
    P(G.sph, '#d9b36a', dx, 1.85, -0.6, 0, 0.42, 0.42, 0.42);
  }
  for (const s of [-1, 1]) { // 箭靶
    const tx = s * 3.4, tz = -2.0;
    P(G.cyl6, PAL.wood, tx, 0.7, tz - 0.2, 0, 0.08, 1.4, 0.08, 0.3);
    [['#ffffff', 1.1], ['#c9784f', 0.8], ['#ffffff', 0.5], ['#d9b84a', 0.25]].forEach(([c, d], j) => P(G.cyl16, c, tx, 1.1, tz + j * 0.012, 0, d, 0.06, d, Math.PI / 2));
  }
  P(G.box, PAL.wood, 1.2, 0.9, 1.9, 0, 2.2, 0.1, 0.1); P(G.box, PAL.wood, 1.2, 0.4, 1.9, 0, 2.2, 0.1, 0.1); // 兵器架
  for (let i = 0; i < 4; i++) { P(G.cyl6, '#7a5636', 0.4 + i * 0.5, 1.0, 1.95, 0, 0.05, 2.0, 0.05, -0.12); P(G.cone6, '#c0c4cc', 0.4 + i * 0.5 - 0.12, 2.05, 1.95, 0, 0.14, 0.3, 0.14); }
  for (const s of [-1, 1]) { P(G.cyl6, '#5a5348', s * 4.2, 1.6, 2.5, 0, 0.07, 3.2, 0.07); P(G.box, s < 0 ? '#c9784f' : PAL.gold, s * 4.2 + 0.4, 2.85, 2.5, 0, 0.8, 0.5, 0.04); }
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P(G.cyl6, '#a2593e', -3.6 + a * 0.7, 0.9, 1.3 + b * 0.6, 0, 0.1, 1.8, 0.1); // 涼亭
  P(new THREE.ConeGeometry(0.5, 1, 4), '#a2593e', -3.6, 2.2, 1.3, Math.PI / 4, 2.6, 0.9, 2.2);
  return 3.4;
}

// ── 城門＋英雄殿（城門上方的大獎盃）──
function buildGate(k, x, gy, z, rot) {
  const { P, L } = B(k, x, gy, z, rot);
  for (const s of [-1, 1]) {
    P(G.cyl16, PAL.white, s * 3.3, 2.9, 0, 0, 2.8, 5.8, 2.8);
    P(G.cyl16, PAL.stone, s * 3.3, 5.9, 0, 0, 3.2, 0.3, 3.2);
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; P(G.box, PAL.stone, s * 3.3 + Math.sin(a) * 1.45, 6.25, Math.cos(a) * 1.45, a, 0.45, 0.4, 0.3); }
    P(G.cone16, PAL.gold, s * 3.3, 7.9, 0, 0, 3.2, 3.2, 3.2);
    P(G.box, PAL.window, s * 3.3, 3.6, 1.41, 0, 0.3, 0.7, 0.04);
    L(s * 3.3, 9.6, 0, 1.2);
  }
  P(G.box, PAL.white, 0, 4.4, 0, 0, 4.0, 2.2, 2.2);                 // 門樓
  P(G.box, PAL.goldSoft, 0, 5.55, 0, 0, 4.2, 0.14, 2.4);
  for (const s of [-1, 1]) P(new THREE.TorusGeometry(1.3, 0.14, 6, 20, Math.PI), PAL.gold, 0, 2.0, s * 1.12); // 金色拱框（門洞保持空的）
  for (const s of [-1, 1]) P(G.box, PAL.gold, s * 0.75, 1.45, 0.9, s * -0.5, 1.1, 2.8, 0.1);   // 半開的金門
  P(G.box, PAL.stone, 0, 5.9, 0, 0, 2.0, 0.6, 1.6);                 // 獎盃台座
  const prof = [[0, 0], [0.7, 0], [0.7, 0.2], [0.24, 0.34], [0.18, 1.0], [0.3, 1.25], [1.0, 1.6], [1.15, 2.7], [1.04, 2.75], [0.88, 1.8], [0, 1.6]].map(([a, b]) => new THREE.Vector2(a, b));
  P(new THREE.LatheGeometry(prof, 18), PAL.goldBright, 0, 6.2, 0);
  for (const s of [-1, 1]) P(new THREE.TorusGeometry(0.42, 0.08, 6, 12, Math.PI), PAL.gold, s * 1.12, 8.0, 0, 0, 1, 1, 1, 0, s * -Math.PI / 2);
  L(0, 8.0, 0, 4);
  return 10.2;
}

// ── 健康檢查站：白色圓頂主樓＋門前發光的大儀表 ──
function buildClinic(k, x, gy, z, rot) {
  const { P, L } = B(k, x, gy, z, rot);
  P(G.cyl16, PAL.stoneShade, 0, 0.12, 0, 0, 5.4, 0.24, 5.4);
  P(G.cyl16, PAL.white, 0, 1.25, -0.4, 0, 3.8, 2.1, 3.8);
  P(G.cyl16, PAL.goldSoft, 0, 2.33, -0.4, 0, 4.0, 0.12, 4.0);
  P(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), '#cfeae2', 0, 2.38, -0.4, 0, 3.7, 2.6, 3.7);
  P(G.sph, PAL.goldBright, 0, 3.75, -0.4, 0, 0.3, 0.3, 0.3);
  P(G.box, PAL.gold, 0, 0.75, 1.48, 0, 0.9, 1.3, 0.1);
  for (const a of [-0.9, 0.9]) P(G.box, PAL.window, Math.sin(a) * 1.92, 1.4, -0.4 + Math.cos(a) * 1.92, a, 0.4, 0.6, 0.04);
  // 門前的大儀表：白色錶盤＋綠黃橘刻度＋金色指針
  P(G.cyl8, '#5a5348', 1.7, 0.8, 1.6, 0, 0.14, 1.6, 0.14);
  P(G.cyl16, PAL.white, 1.7, 2.1, 1.6, 0, 1.6, 0.14, 1.6, Math.PI / 2);
  P(G.cyl16, PAL.goldSoft, 1.7, 2.1, 1.56, 0, 1.75, 0.08, 1.75, Math.PI / 2);
  ['#7ab35a', '#7ab35a', '#e8c766', '#e8c766', '#d9926a'].forEach((c, j) => {
    const a = Math.PI * (0.85 - j * 0.175); P(G.box, c, 1.7 + Math.cos(a) * 0.58, 2.1 + Math.sin(a) * 0.58, 1.69, 0, 0.22, 0.1, 0.03, 0, a + Math.PI / 2);
  });
  P(G.box, PAL.gold, 1.7 + 0.2, 2.1 + 0.2, 1.72, 0, 0.06, 0.62, 0.03, 0, -Math.PI / 4);
  P(G.cyl8, PAL.gold, 1.7, 2.1, 1.72, 0, 0.14, 0.04, 0.14, Math.PI / 2);
  L(1.7, 2.1, 1.8, 2.2);
  k.shadowAt(x, z, 2.8, gy);
  return 4.4;
}
// ── 雷達站：控制室＋鐵架塔＋會轉的大碟型天線 ──
function buildRadar(k, x, gy, z, rot, mats) {
  const { P, L } = B(k, x, gy, z, rot);
  P(G.box, PAL.stoneShade, 0, 0.1, 0, 0, 6.0, 0.2, 4.6);
  P(G.box, PAL.white, -1.5, 0.85, 0.6, 0, 2.6, 1.5, 2.0);
  P(G.box, PAL.navy, -1.5, 1.66, 0.6, 0, 2.8, 0.12, 2.2);
  for (let c = 0; c < 3; c++) P(G.box, '#6fb3df', -2.3 + c * 0.8, 1.0, 1.61, 0, 0.5, 0.45, 0.02);
  P(G.box, PAL.gold, -1.5, 0.55, 1.61, 0, 0.5, 0.9, 0.03);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P(G.cyl6, '#9aa4ad', 1.3 + a * 0.55, 2.0, -0.6 + b * 0.55, 0, 0.1, 4.0, 0.1, b * -0.1, a * 0.1);
  for (const y of [1.0, 2.0, 3.0]) P(G.box, '#9aa4ad', 1.3, y, -0.6, 0, 1.2 - y * 0.12, 0.06, 1.2 - y * 0.12);
  P(G.cyl16, PAL.goldSoft, 1.3, 4.0, -0.6, 0, 1.1, 0.16, 1.1);
  L(1.3, 4.1, -0.6, 1.4);
  const parts = [
    prep(new THREE.SphereGeometry(1.7, 18, 8, 0, Math.PI * 2, 0, Math.PI / 3), '#eef2f4', mat(0, 0.2, 0, 0, 1, 1, 1, Math.PI * 0.62)),
    prep(G.cyl8, PAL.gold, mat(0, 0.9, 0.5, 0, 0.08, 1.4, 0.08, Math.PI * 0.12)),
    prep(G.sph, PAL.goldBright, mat(0, 1.55, 0.72, 0, 0.22, 0.22, 0.22)),
    prep(G.cyl8, '#9aa4ad', mat(0, -0.15, 0, 0, 0.3, 0.6, 0.3)),
  ];
  const dish = new THREE.Mesh(mergeGeometries(parts), mats.solid);
  const holder = new THREE.Group(); holder.position.set(x, gy, z); holder.rotation.y = rot;
  const pivot = new THREE.Group(); pivot.position.set(1.3, 4.45, -0.6); pivot.add(dish); holder.add(pivot);
  k.shadowAt(x, z, 3.2, gy);
  return { h: 6.8, holder, pivot };
}

// ── 地區沙龍：城牆上比較大的沙龍塔（陽台＋金頂＋小旗）──
function buildSalon(k, x, z) {
  const { P, L } = B(k, x, G1, z, faceIn(x, z));
  P(G.cyl16, PAL.white, 0, 2.3, 0, 0, 3.0, 4.6, 3.0);
  P(G.cyl16, PAL.goldSoft, 0, 3.3, 0, 0, 3.15, 0.14, 3.15);
  P(G.cyl16, PAL.stone, 0, 4.7, 0, 0, 3.6, 0.3, 3.6);
  for (let j = 0; j < 8; j++) { const a = j / 8 * Math.PI * 2; P(G.box, PAL.stone, Math.sin(a) * 1.65, 5.05, Math.cos(a) * 1.65, a, 0.5, 0.4, 0.3); }
  P(G.cyl16, PAL.white, 0, 5.6, 0, 0, 2.2, 1.6, 2.2);
  P(G.cone16, PAL.gold, 0, 7.5, 0, 0, 2.9, 2.6, 2.9);
  P(G.cyl8, '#5a5348', 0, 9.2, 0, 0, 0.05, 0.9, 0.05);
  P(G.box, PAL.gold, 0.32, 9.45, 0, 0, 0.6, 0.34, 0.04);
  P(G.box, PAL.gold, 0, 0.9, 1.51, 0, 0.8, 1.6, 0.08);
  for (const y of [2.3, 3.9]) for (const a of [-0.6, 0.6]) P(G.box, PAL.window, Math.sin(a) * 1.51, y, Math.cos(a) * 1.51, a, 0.32, 0.5, 0.04);
  L(0, 2.3, 1.7, 1.6); L(0, 9.0, 0, 1.2);
  return 9.6;
}
function buildPlainTower(k, x, z) {
  k.add(G.cyl16, PAL.white, mat(x, G1 + 1.7, z, 0, 2.2, 3.4, 2.2));
  k.add(G.cyl16, PAL.stone, mat(x, G1 + 3.5, z, 0, 2.5, 0.25, 2.5));
  for (let j = 0; j < 6; j++) { const a = j / 6 * Math.PI * 2; k.add(G.box, PAL.stone, mat(x + Math.sin(a) * 1.15, G1 + 3.8, z + Math.cos(a) * 1.15, a, 0.4, 0.35, 0.28)); }
  k.add(G.cone16, PAL.gold, mat(x, G1 + 5.1, z, 0, 2.5, 2.4, 2.5));
  k.glows.push([new THREE.Vector3(x, G1 + 6.4, z), 1.0]);
}
// ── 靠山：城堡後方一排山（岩石山身＋綠色山腳＋雪頂）──
function buildMountains(k, r, p1) {
  const peaks = [];
  for (let j = -3; j <= 3; j++) {
    const a = 180 + j * 12 + (r() - 0.5) * 4, d = 21.5 + (Math.abs(j) % 2) * 2.2 + r() * 0.8;
    const [x, z] = polar(a, d), h = 19 - Math.abs(j) * 2.6 + r() * 1.5, rad = 6.2 - Math.abs(j) * 0.35;
    k.add(new THREE.ConeGeometry(rad, h, 7), pick(PAL.rock, r), mat(x, G1 - 0.6 + h / 2, z, r() * 3));
    k.add(new THREE.ConeGeometry(rad * 1.12, h * 0.42, 7), j % 2 ? '#7fae5a' : '#86b864', mat(x, G1 - 0.6 + h * 0.21, z, r() * 3));
    k.add(new THREE.ConeGeometry(rad * 0.3, h * 0.28, 7), '#ffffff', mat(x, G1 - 0.6 + h * 0.86, z, r() * 3));
    for (let t = 0; t < 3; t++) { const [tx, tz] = polar(a + (r() - 0.5) * 18, d - rad * 0.9 - r() * 1.2); tree(k, tx, G1, tz, r); }
    peaks.push({ x, z, r: rad });
  }
  // 山底下多一塊岩盤撐住（山比島緣更外面）
  const shelf = organic(10, 77, 0.08).map((p) => new THREE.Vector2(p.x, p.y + 23));
  k.add(slab(shelf, -2.2, 2.6, 0.3), PAL.rimDark);
  k.add(new THREE.ConeGeometry(9, 14, 7), PAL.rock[2], mat(0, -9.5, -23, 0.4, 1, 1, 1, Math.PI));
  return peaks;
}
// ── 彩虹：鏡頭放低時才出現（半圓環，顏色由外紅到內紫）──
function buildRainbow() {
  const geo = new THREE.RingGeometry(50, 80, 96, 1, 0, Math.PI);
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide,
    uniforms: { uOpacity: { value: 0 } },
    vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uOpacity; varying vec3 vP;
      vec3 hsv(float h){ vec3 k = clamp(abs(mod(h*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0); return k; }
      void main(){
        float t = (length(vP.xy) - 50.0) / 30.0;            // 0 內圈 → 1 外圈
        vec3 col = hsv(0.78 * (1.0 - smoothstep(0.2, 0.8, t))); // 外紅 → 內紫，中段才有顏色
        float edge = smoothstep(0.0, 0.4, t) * smoothstep(1.0, 0.6, t); // 邊緣很寬地淡出＝光暈
        float ends = smoothstep(0.0, 28.0, vP.y);            // 兩端漸隱
        gl_FragColor = vec4(mix(col, vec3(1.0), 0.45), uOpacity * edge * ends);
      }`,
  });
  const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = -4; mesh.frustumCulled = false;
  return mesh;
}


// ─────────────── 綠佳利島（公司）：台灣輪廓的浮島 ───────────────
const TW_OUTLINE = [[121.53, 25.30], [121.75, 25.16], [121.93, 25.02], [121.83, 24.85], [121.86, 24.60], [121.72, 24.30], [121.62, 24.00], [121.48, 23.50],
  [121.38, 23.10], [121.18, 22.78], [120.95, 22.40], [120.85, 21.92], [120.73, 22.00], [120.62, 22.30], [120.42, 22.50], [120.27, 22.60], [120.15, 22.90],
  [120.08, 23.05], [120.12, 23.40], [120.18, 23.70], [120.33, 24.05], [120.52, 24.30], [120.70, 24.60], [120.90, 24.85], [121.05, 25.03], [121.25, 25.12], [121.42, 25.22]];
const twXZ = (lon, lat) => [(lon - 120.95) * TW_K, -(lat - 23.6) * TW_K];
function buildCompany(mats) {
  const r = rng(707);
  const g = new THREE.Group(); g.position.copy(COMP_POS);
  const k = new Kit();
  const pts = TW_OUTLINE.map(([lo, la]) => { const [x, z] = twXZ(lo, la); return new THREE.Vector2(x, -z); });
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length, cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const around = (f, ox = 0, oz = 0) => pts.map((p) => new THREE.Vector2(cx + (p.x - cx) * f + ox, cy + (p.y - cy) * f - oz));
  k.add(slab(around(1.06), -1.2, 1.1, 0.3), PAL.rimDark);
  k.add(slab(around(1.03), -0.9, 0.95, 0.28), PAL.rim);
  k.add(slab(pts, -0.2, 0.55, 0.3), PAL.grass);
  [[0.92, PAL.earth], [0.8, PAL.rock[0]], [0.64, PAL.rock[1]], [0.46, PAL.rock[2]], [0.28, PAL.rock[3]]]
    .forEach(([f, col], i) => k.add(slab(around(f, (r() - 0.5) * 0.8, (r() - 0.5) * 0.8), -1.2 - (i + 1) * 1.4, 1.3, 0.3), col));
  k.add(new THREE.ConeGeometry(2.6, 6, 7), PAL.rock[1], mat(cx, -11, -cy, 0.3, 1, 1, 1, Math.PI));
  for (let i = 0; i < 22; i++) { const p = pts[i % pts.length], len = 1.5 + r() * 3; k.add(G.cyl6, PAL.root, mat(cx + (p.x - cx) * 0.85, -1.4 - len / 2, -(cy + (p.y - cy) * 0.85), 0, 0.1, len, 0.1)); }
  const placed = [];
  const spots = COMPANY.buildings.map((b) => { const [x, z] = twXZ(b.lon, b.lat); return { x, z }; });
  // 中央山脈：沿著台灣中間偏東一排小山（避開建築）
  for (let t = 0; t <= 1; t += 0.09) {
    const lon = 121.33 - t * 0.5, lat = 24.55 - t * 1.85, [x, z] = twXZ(lon, lat);
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 1.6)) continue;
    const h = 1.6 + Math.sin(t * Math.PI) * 2.2 + r() * 0.6, rad = 1.1 + r() * 0.4;
    k.add(new THREE.ConeGeometry(rad, h, 6), t > 0.25 && t < 0.75 ? PAL.rock[0] : '#7fae5a', mat(x, G1 + h / 2 - 0.2, z, r() * 3));
    placed.push({ x, z, r: rad });
  }
  const out = { group: g, buildings: [], salons: [] };
  for (const b of COMPANY.buildings) {
    const [x, z] = twXZ(b.lon, b.lat), h = COMPANY_KIT[b.kind](k, x, z);
    placed.push({ x, z, r: 1.4 }); out.buildings.push({ def: b, x, z, h });
  }
  let n = 0, tries = 0;
  while (n < 45 && tries++ < 1500) {
    const p = pts[Math.floor(r() * pts.length)], f = r() * 0.85, x = cx + (p.x - cx) * f, z = -(cy + (p.y - cy) * f);
    if (!inside(pts, x, z) || !placed.every((q) => Math.hypot(q.x - x, q.z - z) > q.r + 0.5)) continue;
    const s0 = 0.55 + r() * 0.3; k.add(G.cyl6, PAL.trunk, mat(x, G1 + 0.2 * s0, z, 0, 0.14 * s0, 0.4 * s0, 0.14 * s0));
    k.add(G.ico, pick(PAL.leaf, r), mat(x, G1 + 0.75 * s0, z, r() * 3, 0.9 * s0, 0.8 * s0, 0.9 * s0));
    placed.push({ x, z, r: 0.35 }); n++;
  }
  out.westCoast = new THREE.Vector3(...((c) => [c[0], G1 + 0.1, c[1]])(twXZ(120.36, 24.08)));
  out.center = new THREE.Vector3(...((c) => [c[0], G1, c[1]])(twXZ(120.95, 23.75)));
  g.add(k.mesh(mats));
  return out;
}
function buildSalonHouse(k, x, z, big) {
  const { P, L } = B(k, x, G1, z, -0.4, big ? 1.25 : 1);
  P(G.box, PAL.white, 0, 0.7, 0, 0, 1.6, 1.4, 1.3);
  P(gable(), PAL.gold, 0, 1.4, 0, Math.PI / 2, 1.5, 0.75, 1.8);
  P(G.box, PAL.gold, 0, 0.45, 0.66, 0, 0.42, 0.85, 0.04);
  P(G.box, PAL.goldBright, 0, 1.15, 0.67, 0, 1.0, 0.24, 0.03);
  P(G.cyl6, '#5a5348', 0.7, 2.0, -0.4, 0, 0.04, 1.4, 0.04);
  P(G.box, PAL.gold, 0.92, 2.5, -0.4, 0, 0.42, 0.26, 0.03);
  L(0, 1.15, 0.8, 1.0);
  return (big ? 2.9 : 2.4) * (big ? 1.25 : 1);
}
const COMPANY_KIT = {
  hq(k, x, z) { // 公司總部：新光摩天大樓（下面新光三越裙樓＋玫瑰色主塔＋階梯式尖頂）
    const sc = 0.78, { P, L } = B(k, x, G1, z, -0.3, sc);
    const rose = '#e3c3b4', roseDark = '#c99f92', crown = '#a86f6e', glass = '#6f9fd8', granite = '#5a4136';
    // 新光三越裙樓：三段往上內縮
    P(G.box, granite, 0, 0.35, 0.3, 0, 5.6, 0.7, 4.4);                 // 一樓深褐石材
    P(G.box, PAL.goldBright, 0, 0.55, 2.52, 0, 2.2, 0.22, 0.04);        // 新光三越招牌
    P(G.box, '#2e3540', 0, 0.3, 2.52, 0, 1.4, 0.45, 0.03);              // 入口
    [[5.4, 4.2, 0.7, 2.0], [4.8, 3.8, 2.7, 1.1], [4.1, 3.3, 3.8, 0.8]].forEach(([w, d, y0, h], t) => {
      P(G.box, t % 2 ? roseDark : rose, 0, y0 + h / 2, 0.3, 0, w, h, d);
      for (let j = 1; j < h / 0.3; j++) P(G.box, roseDark, 0, y0 + j * 0.3, 0.3, 0, w + 0.02, 0.03, d + 0.02); // 橫向條紋
    });
    for (let i = 0; i < 6; i++) P(G.box, glass, -1.3 + i * 0.5, 1.0 + i * 0.5, 2.42, 0, 0.9, 0.16, 0.03); // 斜向藍色窗帶
    P(G.cyl16, PAL.gold, 0.9, 2.6, 2.43, 0, 0.5, 0.05, 0.5, Math.PI / 2); // 金色標誌
    // 主塔：細長方柱＋正面橫向藍玻璃窗帶
    const tw = 2.5, td = 2.0, ty0 = 4.6, th = 11.0;
    P(G.box, rose, 0, ty0 + th / 2, -0.3, 0, tw, th, td);
    for (let j = 0; j < th / 0.34; j++) {
      const y = ty0 + 0.2 + j * 0.34;
      P(G.box, glass, 0, y, -0.3 + td / 2 + 0.01, 0, tw * 0.62, 0.13, 0.03);
      P(G.box, roseDark, 0, y, -0.3 - td / 2 - 0.01, 0, tw * 0.9, 0.1, 0.03);
      for (const s of [-1, 1]) P(G.box, roseDark, s * (tw / 2 + 0.01), y, -0.3, 0, 0.03, 0.1, td * 0.9);
    }
    // 階梯式尖頂
    let y = ty0 + th;
    [[2.3, 1.85, 0.55], [2.0, 1.6, 0.5], [1.6, 1.3, 0.45], [1.15, 0.95, 0.4]].forEach(([w, d, h]) => { P(G.box, crown, 0, y + h / 2, -0.3, 0, w, h, d); y += h; });
    P(new THREE.ConeGeometry(0.5, 1, 4), crown, 0, y + 0.35, -0.3, Math.PI / 4, 1.2, 0.7, 1.0);
    P(G.cyl6, '#9aa4ad', 0, y + 1.2, -0.3, 0, 0.05, 1.2, 0.05);
    L(0, y + 1.8, -0.3, 1.2);
    return (y + 1.9) * sc;
  },

  screen(k, x, z) { // 官方社群：大螢幕看板（FB 藍、YouTube 紅）
    const { P, L } = B(k, x, G1, z, -0.5);
    for (const s of [-1, 1]) P(G.box, '#5a5348', s * 1.1, 1.3, 0, 0, 0.14, 2.6, 0.14);
    P(G.box, '#2a2a33', 0, 2.5, 0, 0, 2.7, 1.5, 0.16);
    P(G.box, '#1877f2', -0.62, 2.5, 0.09, 0, 1.15, 1.2, 0.02);
    P(G.box, '#ff2d2d', 0.62, 2.5, 0.09, 0, 1.15, 1.2, 0.02);
    P(new THREE.ConeGeometry(0.22, 0.4, 3), '#ffffff', 0.66, 2.5, 0.11, 0, 1, 1, 1, Math.PI / 2, -Math.PI / 2);
    L(0, 2.5, 0.3, 2);
    return 3.6;
  },
  signal(k, x, z) { // APP：山頂訊號塔
    const { P, L } = B(k, x, G1, z, 0);
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P(G.cyl6, '#9aa4ad', a * 0.4, 2.4, b * 0.4, 0, 0.08, 4.8, 0.08, b * -0.07, a * 0.07);
    for (const y of [1.2, 2.4, 3.6]) P(G.box, '#9aa4ad', 0, y, 0, 0, 0.85 - y * 0.08, 0.05, 0.85 - y * 0.08);
    P(G.box, PAL.white, 0, 5.2, 0, 0, 0.7, 1.2, 0.12);       // 手機造型的面板
    P(G.box, '#6fb3df', 0, 5.25, 0.07, 0, 0.56, 0.9, 0.02);
    P(G.sph, PAL.goldBright, 0, 6.1, 0, 0, 0.26, 0.26, 0.26);
    L(0, 6.1, 0, 1.8);
    return 6.6;
  },
  gate(k, x, z) { // NDS：會員之門（金色拱門）
    const { P, L } = B(k, x, G1, z, -0.6);
    for (const s of [-1, 1]) P(G.box, PAL.white, s * 1.0, 1.0, 0, 0, 0.4, 2.0, 0.4);
    P(new THREE.TorusGeometry(1.0, 0.16, 6, 20, Math.PI), PAL.gold, 0, 2.0, 0);
    P(G.box, PAL.goldBright, 0, 3.25, 0, 0, 1.2, 0.36, 0.08);
    P(G.box, '#cfe6ee', 0, 1.0, 0, 0, 1.5, 1.9, 0.04);
    L(0, 2.6, 0.2, 1.6);
    return 3.8;
  },
  library(k, x, z) { // 宣傳品資料館：小型石柱館
    const { P } = B(k, x, G1, z, 0.3);
    P(G.box, PAL.stoneShade, 0, 0.12, 0, 0, 2.6, 0.24, 1.9);
    P(G.box, PAL.white, 0, 0.9, -0.2, 0, 2.2, 1.3, 1.3);
    for (let i = 0; i < 4; i++) P(G.cyl8, PAL.white, -0.9 + i * 0.6, 0.9, 0.6, 0, 0.16, 1.3, 0.16);
    P(G.box, PAL.stone, 0, 1.62, 0.1, 0, 2.5, 0.14, 1.8);
    P(gable(), PAL.navy, 0, 1.69, 0.1, Math.PI / 2, 1.8, 0.6, 2.5);
    P(G.box, PAL.gold, 0, 0.55, 0.46, 0, 0.5, 0.8, 0.04);
    return 2.9;
  },
};
// 吊橋：兩端之間一片片木板，中間微微下垂，兩側繩索
function buildBridge(k, a, b) {
  const n = 30, side = new THREE.Vector3().subVectors(b, a).setY(0).normalize(), perp = new THREE.Vector3(-side.z, 0, side.x);
  const pt = (t) => new THREE.Vector3().lerpVectors(a, b, t).add(new THREE.Vector3(0, -Math.sin(t * Math.PI) * 1.2, 0));
  const ang = Math.atan2(b.x - a.x, b.z - a.z), len = a.distanceTo(b) / n;
  for (let i = 0; i < n; i++) {
    const p = pt((i + 0.5) / n);
    k.add(G.box, i % 2 ? PAL.wood : '#9a6e45', mat(p.x, p.y, p.z, ang, 2.0, 0.12, len * 0.9));
  }
  for (const s of [-1, 1]) for (let i = 0; i < n; i++) {
    const p0 = pt(i / n).addScaledVector(perp, s * 1.0), p1 = pt((i + 1) / n).addScaledVector(perp, s * 1.0);
    const m = p0.clone().add(p1).multiplyScalar(0.5); m.y += 0.8;
    k.add(G.box, '#7a5636', mat(m.x, m.y, m.z, ang, 0.06, 0.06, p0.distanceTo(p1) + 0.02, Math.atan2(p1.y - p0.y, len) * -1));
    if (i % 5 === 0) k.add(G.cyl6, '#5a5348', mat(p0.x, p0.y + 0.4, p0.z, 0, 0.06, 0.8, 0.06));
  }
}


function house(k, x, gy, z, rot, r, big) {
  const { P } = B(k, x, gy, z, rot);
  const w = (big ? 1.8 : 1.3) + r() * 0.4, d = 1.15 + r() * 0.3, h = (big ? 1.4 : 0.95) + r() * 0.5;
  P(G.box, pick(PAL.houseWall, r), 0, h / 2, 0, 0, w, h, d);
  P(gable(), pick(PAL.roof, r), 0, h, 0, Math.PI / 2, d + 0.2, 0.7, w + 0.2);
  P(G.box, PAL.wood, 0, 0.3, d / 2 + 0.01, 0, 0.3, 0.6, 0.04);
  for (const s of [-1, 1]) P(G.box, PAL.window, s * w * 0.28, h * 0.6, d / 2 + 0.01, 0, 0.24, 0.28, 0.02);
  k.shadowAt(x + 0.2, z + 0.15, Math.max(w, d) * 0.72, gy);
  return Math.max(w, d) * 0.7;
}
function tree(k, x, gy, z, r) {
  const s = 0.75 + r() * 0.5;
  k.add(G.cyl6, PAL.trunk, mat(x, gy + 0.3 * s, z, 0, 0.18 * s, 0.6 * s, 0.18 * s));
  if (r() < 0.45) {
    k.add(G.cone6, pick(PAL.leaf, r), mat(x, gy + 1.0 * s, z, r() * 3, 1.1 * s, 1.1 * s, 1.1 * s));
    k.add(G.cone6, pick(PAL.leaf, r), mat(x, gy + 1.6 * s, z, r() * 3, 0.8 * s, 0.9 * s, 0.8 * s));
  } else {
    k.add(G.ico, pick(PAL.leaf, r), mat(x, gy + 1.05 * s, z, r() * 3, 1.15 * s, 1.0 * s, 1.15 * s));
  }
  k.shadowAt(x + 0.15, z + 0.1, 0.5 * s, gy);
}
function lampPost(k, x, gy, z) {
  k.add(G.cyl6, '#5a5348', mat(x, gy + 0.6, z, 0, 0.07, 1.2, 0.07));
  k.add(G.sph, PAL.goldBright, mat(x, gy + 1.25, z, 0, 0.22, 0.22, 0.22));
}
function ringBand(k, r0, r1, y, color) {
  const g = new THREE.RingGeometry(r0, r1, 72, 1); g.rotateX(-Math.PI / 2); k.add(g, color, mat(0, y, 0));
}
function strip(k, deg, d0, d1, w, y, color) { // 朝塔的直線小路
  const [x0, z0] = polar(deg, d0), [x1, z1] = polar(deg, d1);
  k.add(G.box, color, mat((x0 + x1) / 2, y, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0), w, 0.06, Math.hypot(x1 - x0, z1 - z0)));
}
function stairs(k, deg, d0, d1, y0, y1, w) { // 兩層之間的階梯（d0 在高處）
  const n = 6;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, [x, z] = polar(deg, d0 + (d1 - d0) * t);
    const y = y1 - (y1 - y0) * t;
    k.add(G.box, i % 2 ? PAL.stone : PAL.stoneShade, mat(x, (y + y0 - 0.6) / 2, z, deg * D2R, w, y - y0 + 0.6, (d1 - d0) / n + 0.05));
  }
}

function buildSatellite(mats) {
  const k = new Kit();
  k.add(G.box, PAL.goldSoft, mat(0, 0, 0, 0, 0.55, 0.55, 0.55));
  for (const s of [-1, 1]) {
    k.add(G.cyl6, '#8a8a86', mat(s * 0.45, 0, 0, 0, 0.05, 0.35, 0.05, 0, Math.PI / 2));
    k.add(G.box, PAL.navy, mat(s * 1.05, 0, 0, 0, 0.9, 0.04, 0.5));
  }
  k.add(G.cone6, '#f4eee2', mat(0, 0.45, 0, 0, 0.3, 0.3, 0.3, Math.PI));
  const g = k.mesh(mats); g.scale.setScalar(1.3); return g;
}
function buildCloud(mats, seed, flat, puffs) {
  const r = rng(seed); const parts = [];
  const n = puffs || 4 + Math.floor(r() * 4);
  for (let i = 0; i < n; i++) parts.push(prep(G.puff, '#ffffff', mat((i - n / 2) * 1.5 + r(), r() * (flat ? 0.2 : 0.7), (r() - 0.5) * 1.8, r() * 3, 2.4 + r() * 1.8, (flat ? 1.0 : 1.5) + r() * 0.6, 2.2 + r())));
  return new THREE.Mesh(mergeGeometries(parts), mats.cloud);
}
function buildSky() {
  const m = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { uTop: { value: new THREE.Color('#3a7bc8') }, uHorizon: { value: new THREE.Color('#b7d4ee') }, uSunDir: { value: new THREE.Vector3(-0.55, 0.42, -0.7).normalize() }, uSunCol: { value: new THREE.Color('#ffd47a') } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uTop,uHorizon,uSunCol,uSunDir; varying vec3 vDir;
      void main(){ float h = vDir.y; vec3 c = mix(uHorizon, uTop, pow(clamp(h*1.5,0.0,1.0), 0.65));
        float s = max(dot(normalize(vDir), uSunDir), 0.0); c += uSunCol * (pow(s, 5.0)*0.35 + pow(s, 300.0)*0.9);
        gl_FragColor = vec4(c,1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), m); mesh.renderOrder = -10; mesh.frustumCulled = false;
  return mesh;
}
function buildCloudSea(y) {
  const geo = new THREE.PlaneGeometry(2400, 2400, 1, 1); geo.rotateX(-Math.PI / 2);
  const m = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uHi: { value: new THREE.Color('#ffffff') }, uLo: { value: new THREE.Color('#cddcee') }, uHorizon: { value: new THREE.Color('#b7d4ee') }, uSun: { value: new THREE.Color('#ffe3a6') } },
    vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; uniform vec3 uHi,uLo,uHorizon,uSun,uCam; varying vec3 vW;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float vn(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
      float fbm(vec2 p){ float t=uTime*0.02; return vn(p*0.05+vec2(t,t*0.6))*0.55 + vn(p*0.11-vec2(t*0.8,t*0.3))*0.3 + vn(p*0.27+vec2(t*1.3,-t))*0.15; }
      void main(){
        float n = fbm(vW.xz);
        vec3 col = mix(uLo, uHi, smoothstep(0.32, 0.72, n));
        col = mix(col, uSun, smoothstep(0.62, 0.9, n) * 0.25);
        float d = length(uCam.xz - vW.xz);
        col = mix(col, uHorizon, smoothstep(60.0, 420.0, d));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, m); mesh.position.y = y; mesh.renderOrder = -5;
  return mesh;
}
// 瀑布：從外環邊緣一路流進雲海（往下捲動的水紋）
function buildWaterfall(x, z, rot, top, bottom, w) {
  const h = top - bottom;
  const geo = new THREE.PlaneGeometry(w, h, 1, 10); geo.translate(0, -h / 2, 0);
  const pos = geo.attributes.position; // 越往下越往外彎、越寬
  for (let i = 0; i < pos.count; i++) { const t = Math.min(1, Math.max(0, -pos.getY(i) / h)); pos.setZ(i, Math.pow(t, 0.6) * 2.4); pos.setX(i, pos.getX(i) * (1 + t * 0.7)); }
  geo.computeVertexNormals();
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uTime: { value: 0 }, uCols: { value: Math.max(14, w * 4) } }, // 水紋條數跟著寬度，寬瀑布才不會變馬賽克
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform float uTime; uniform float uCols; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      void main(){
        float y = vUv.y * 10.0 + uTime * 1.6;
        float s = hash(vec2(floor(vUv.x * uCols), floor(y)));
        vec3 col = mix(vec3(0.66,0.84,0.95), vec3(1.0), step(0.5, s) * 0.85);
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        float a = edge * mix(0.12, 0.92, smoothstep(0.0, 0.45, vUv.y));
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(geo, m); mesh.position.set(x, top, z); mesh.rotation.y = rot;
  return mesh;
}

// ─────────────── 整座城（城堡版）───────────────
function stripLine(k, x0, z0, x1, z1, w, y, color) {
  k.add(G.box, color, mat((x0 + x1) / 2, y, (z0 + z1) / 2, Math.atan2(x1 - x0, z1 - z0), w, 0.06, Math.hypot(x1 - x0, z1 - z0)));
}
function stairsLine(k, x, z0, z1, y0, y1, w) { // 沿 z 方向的階梯（z0 在高處）
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, y = y1 - (y1 - y0) * t;
    k.add(G.box, i % 2 ? PAL.stone : PAL.stoneShade, mat(x, (y + y0 - 0.6) / 2, z0 + (z1 - z0) * t, 0, w, y - y0 + 0.6, Math.abs(z1 - z0) / n + 0.05));
  }
}
function buildCity(mats) {
  const r = rng(2026);
  const city = new THREE.Group();
  const k = new Kit();
  const p1 = organic(R1, 11, 0.06);

  // 島面
  k.add(slab(p1, -1.3, 1.25, 0.32), PAL.rimDark);
  k.add(slab(scaled(p1, 0.985), -1.0, 1.05, 0.3), PAL.rim);
  const grass1 = scaled(p1, 0.88);
  k.add(slab(grass1, -0.2, 0.55, 0.3), PAL.grass);
  // 底部：一層層往下收的岩石＋尖錐＋垂吊碎石＋樹根
  [[0.97, PAL.earth], [0.92, PAL.earth], [0.84, PAL.rock[0]], [0.74, PAL.rock[1]], [0.62, PAL.rock[2]], [0.49, PAL.rock[3]], [0.35, PAL.rock[1]], [0.22, PAL.rock[0]]]
    .forEach(([f, col], i) => k.add(slab(scaled(p1, f, (r() - 0.5) * 2.0, (r() - 0.5) * 2.0), -1.3 - (i + 1) * 1.75, 1.6, 0.35), col)); // 地基土方：一層層往下收
  k.add(new THREE.ConeGeometry(R1 * 0.26, 9, 7), PAL.rock[1], mat(0.5, -20.0, -0.4, 0.3, 1, 1, 1, Math.PI));
  for (let i = 0; i < 14; i++) { const [x, z] = polar(r() * 360, R1 * (0.3 + r() * 0.5)), q = 0.8 + r() * 1.2; k.add(G.dode, pick(PAL.rock, r), mat(x, -4 - r() * 12, z, r() * 3, q, q * 1.5, q)); }
  for (let i = 0; i < 46; i++) {
    const a = r() * 360, [x, z] = polar(a, edgeAt(p1, a) * (0.8 + r() * 0.14)), len = 2 + r() * 5;
    k.add(G.cyl6, PAL.root, mat(x, -1.5 - len / 2, z, 0, 0.12, len, 0.12, (r() - 0.5) * 0.3, (r() - 0.5) * 0.3));
  }

  const placed = []; // 已占用 {x,z,r}
  const free = (x, z, rad) => placed.every((p) => Math.hypot(p.x - x, p.z - z) > p.r + rad);
  const lineBlock = (x0, z0, x1, z1, rad) => { const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.9); for (let i = 0; i <= n; i++) placed.push({ x: x0 + (x1 - x0) * i / n, z: z0 + (z1 - z0) * i / n, r: rad }); };

  // ── 城牆（沿島邊一圈，正前方留城門、後方靠山不蓋）──
  const wall = scaled(p1, WALL_F);
  const gateZ = Math.hypot(wall[0].x, wall[0].y);
  for (let i = 0; i < wall.length; i++) {
    const a = wall[i], b = wall[(i + 1) % wall.length];
    const ax = a.x, az = -a.y, bx = b.x, bz = -b.y, mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if (mz > 0 && Math.abs(mx) < GATE_HALF) continue;                         // 城門開口
    if (Math.abs(Math.atan2(mx, mz) / D2R) > 180 - MT_HALF) continue;        // 靠山
    if (Math.abs(Math.atan2(mx, mz) / D2R - BRIDGE_DEG) < 4) continue;        // 往綠佳利島的吊橋出口
    const len = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az);
    k.add(G.box, PAL.wall, mat(mx, G1 + WALL_H / 2, mz, ang, 0.6, WALL_H, len + 0.06));
    k.add(G.box, PAL.wallDark, mat(mx, G1 + WALL_H + 0.04, mz, ang, 0.8, 0.08, len + 0.06));
    if (i % 2 === 0) k.add(G.box, PAL.wall, mat(mx, G1 + WALL_H + 0.3, mz, ang, 0.7, 0.45, 0.55)); // 城垛
    placed.push({ x: mx, z: mz, r: 1.1 });
  }
  const onWall = (deg) => polar(deg, edgeAt(p1, deg) * WALL_F);
  for (const deg of PLAIN_TOWERS) { const [x, z] = onWall(deg); buildPlainTower(k, x, z); placed.push({ x, z, r: 1.8 }); }
  const bridgeFrom = new THREE.Vector3(...((p) => [p[0], G1 + 0.1, p[1]])(onWall(BRIDGE_DEG)));

  // ── 靠山 ──
  for (const pk of buildMountains(k, r, p1)) placed.push(pk);

  // ── 護城河＋城門前吊橋 ──
  const moatShape = new THREE.Shape(scaled(p1, MOAT_OUT));
  moatShape.holes.push(new THREE.Path(scaled(p1, MOAT_IN).reverse()));
  const moatGeo = new THREE.ExtrudeGeometry(moatShape, { depth: 0.12, bevelEnabled: false, curveSegments: 1 });
  moatGeo.rotateX(-Math.PI / 2); moatGeo.translate(0, 0.66, 0);
  const moat = new THREE.Mesh(moatGeo, mats.water); city.add(moat);
  const edge0 = edgeAt(p1, 0) * MOAT_OUT;
  stripLine(k, 0, gateZ + 0.6, 0, edge0 + 0.6, 3.6, 0.92, PAL.wood);
  for (const s of [-1, 1]) {
    k.add(G.box, '#7a5636', mat(s * 1.85, 1.25, (gateZ + edge0) / 2 + 0.6, 0, 0.12, 0.6, edge0 - gateZ));
    for (const zz of [gateZ + 0.8, edge0 + 0.3]) k.add(G.cyl6, '#5a5348', mat(s * 1.85, 1.3, zz, 0, 0.16, 1.0, 0.16));
  }


  // ── 城門＋英雄殿 ──
  const gate = { x: 0, z: gateZ, h: buildGate(k, 0, G1, gateZ, 0) };
  placed.push({ x: 0, z: gateZ, r: 4.6 });

  // ── 北邊高台＋精神之塔 ──
  const hill = organic(HILL_R, 51, 0.05).map((p) => new THREE.Vector2(p.x + CASTLE[0], p.y - CASTLE[1]));
  k.add(slab(hill, 0.4, 2.4, 0.2), PAL.wall);
  k.add(slab(hill.map((p) => new THREE.Vector2(CASTLE[0] + (p.x - CASTLE[0]) * 0.95, -CASTLE[1] + (p.y + CASTLE[1]) * 0.95)), 2.6, 0.4, 0.2), PAL.grass2);
  const hillFront = CASTLE[1] + edgeAt(organic(HILL_R, 51, 0.05), 0);
  const castleH = (() => { const { P } = B(k, CASTLE[0], GH, CASTLE[1], 0); P(G.hex, PAL.gold, 0, 0.03, 3.6, 0, 6.0, 0.06, 6.0); P(G.hex, PAL.stone, 0, 0.07, 3.6, 0, 5.4, 0.06, 5.4); return 0; })()
    + buildCastle(k, GH, CASTLE);
  stairsLine(k, 0, hillFront - 1.2, hillFront + 1.6, G1, GH, 3.0);
  placed.push({ x: CASTLE[0], z: CASTLE[1], r: HILL_R + 0.6 });
  lineBlock(0, hillFront - 1, 0, hillFront + 2, 2);

  // ── 學院（左）、魔法塔（右）、練功場（前）──
  const academy = buildAcademy(k, LEFT[0], G1, LEFT[1], 0.35);
  placed.push({ x: LEFT[0], z: LEFT[1] + 0.8, r: 5.2 });
  const magic = buildMagic(k, RIGHT[0], G1, RIGHT[1], -0.35, mats);
  city.add(magic.holder);
  placed.push({ x: RIGHT[0], z: RIGHT[1], r: 4.4 });
  const dojoH = buildDojo(k, FRONT[0], G1, FRONT[1], 0);
  placed.push({ x: FRONT[0] - 2.4, z: FRONT[1], r: 3.6 }, { x: FRONT[0] + 2.4, z: FRONT[1], r: 3.6 });

  // ── 主街道（城門 → 練功場 → 城堡）＋橫街 ──
  stripLine(k, 0, gateZ - 1, 0, FRONT[1] + 3.2, 2.6, G1 + 0.03, PAL.path);
  stripLine(k, 0, FRONT[1] - 3.2, 0, hillFront + 1.6, 2.6, G1 + 0.03, PAL.path);
  lineBlock(0, gateZ - 1, 0, FRONT[1] + 3.2, 1.8);
  const crossZ = FRONT[1] + 7.5;
  stripLine(k, -8.5, crossZ, 8.5, crossZ, 2.0, G1 + 0.035, PAL.path);
  lineBlock(-8.5, crossZ, 8.5, crossZ, 1.5);
  stripLine(k, LEFT[0] + 1, LEFT[1] + 4.6, -4.8, FRONT[1], 1.6, G1 + 0.03, PAL.path);
  stripLine(k, RIGHT[0] - 1, RIGHT[1] + 3, 4.8, FRONT[1], 1.6, G1 + 0.03, PAL.path);
  lineBlock(LEFT[0] + 1, LEFT[1] + 4.6, -4.8, FRONT[1], 1.2);
  lineBlock(RIGHT[0] - 1, RIGHT[1] + 3, 4.8, FRONT[1], 1.2);
  for (let z = FRONT[1] + 4; z < gateZ - 2; z += 3) for (const s of [-1, 1]) { lampPost(k, s * 1.7, G1, z); placed.push({ x: s * 1.7, z, r: 0.3 }); }

  // ── 瀑布：Randoph 2026-11-06 取消（要加回來，在下面的清單填 [方位, 寬度]）──
  const waterfalls = [];
  for (const [deg, w] of []) {
    const e = edgeAt(p1, deg) * 0.985, [x, z] = polar(deg, e);
    const mesh = buildWaterfall(x, z, deg * D2R, 0.78, CLOUD_Y + 0.5, w);
    city.add(mesh); waterfalls.push({ mesh, x, z, deg });
  }


  // ── 預留空地（城牆內，圍籬）──
  TILES.filter((t) => t.status === 'reserved').forEach((t) => {
    const [x, z] = polar(t.angle, PLOT_R);
    const { P } = B(k, x, G1, z, faceIn(x, z));
    P(G.box, PAL.path, 0, 0.04, 0, 0, 3.4, 0.08, 2.6);
    for (let i = 0; i < 7; i++) for (const s of [-1, 1]) P(G.box, PAL.wood, -1.7 + i * 0.57, 0.3, s * 1.3, 0, 0.08, 0.5, 0.08);
    for (let i = 0; i < 5; i++) for (const s of [-1, 1]) P(G.box, PAL.wood, s * 1.7, 0.3, -1.3 + i * 0.65, 0, 0.08, 0.5, 0.08);
    for (const s of [-1, 1]) { P(G.box, PAL.wood, 0, 0.42, s * 1.3, 0, 3.4, 0.06, 0.06); P(G.box, PAL.wood, s * 1.7, 0.42, 0, 0, 0.06, 0.06, 2.6); }
    placed.push({ x, z, r: 2.4 });
  });

  // ── 城牆內空地上的功能區（spot: 'plot'）──
  const plotSpots = {}; let radar = null;
  TILES.filter((t) => t.spot === 'plot' && t.status !== 'reserved').forEach((t) => {
    const [x, z] = polar(t.angle, PLOT_IN), rot = faceIn(x, z);
    let h;
    if (t.landmark === 'radar') { radar = buildRadar(k, x, G1, z, rot, mats); city.add(radar.holder); h = radar.h; }
    else h = buildClinic(k, x, G1, z, rot);
    placed.push({ x, z, r: 3.4 });
    plotSpots[t.id] = { x, z, gy: G1, h, focusY: 2, focusR: 8.5, hit: [3.4, 8], viewAz: Math.atan2(-x, -z) }; // 鏡頭從城中央往外看
  });

  // ── 住宅：主街兩側先排，再沿橫街、其他空地 ──
  const inWall = (x, z) => inside(scaled(p1, WALL_F - 0.05), x, z);
  for (let z = FRONT[1] + 4.2; z < gateZ - 3.5; z += 2.3) for (const s of [-1, 1]) {
    const x = s * 3.6; if (free(x, z, 1.0)) placed.push({ x, z, r: house(k, x, G1, z, s * -Math.PI / 2, r, r() < 0.3) });
  }
  for (let x = -8; x <= 8; x += 2.4) for (const s of [-1, 1]) {
    const z = crossZ + s * 2.1; if (inWall(x, z) && free(x, z, 1.0)) placed.push({ x, z, r: house(k, x, G1, z, s > 0 ? Math.PI : 0, r, false) });
  }
  let n = 0, tries = 0;
  while (n < 22 && tries++ < 1500) {
    const [x, z] = polar(r() * 360, 6 + r() * (R1 * WALL_F - 8));
    if (!inWall(x, z) || !free(x, z, 1.2)) continue;
    placed.push({ x, z, r: house(k, x, G1, z, faceIn(x, z) + (r() - 0.5) * 0.6, r, r() < 0.25) }); n++;
  }
  // 樹：城牆內補滿＋城牆外一圈
  n = 0; tries = 0;
  while (n < 150 && tries++ < 5000) {
    const out = false, [x, z] = polar(r() * 360, out ? R1 * (WALL_F + 0.03) + r() * R1 * 0.03 : 3 + r() * (R1 * WALL_F - 4));
    if (out ? !inside(grass1, x, z) || inWall(x, z) : !inWall(x, z)) continue;
    if (!free(x, z, 0.5)) continue;
    tree(k, x, G1, z, r); placed.push({ x, z, r: 0.45 }); n++;
  }

  city.add(k.mesh(mats));
  return {
    city, waterfalls, magic, radar, bridgeFrom,
    spots: {
      castle: { x: CASTLE[0], z: CASTLE[1], gy: GH, h: castleH, focusY: 9, focusR: 16, hit: [HILL_R * 0.8, 24] },
      left: { x: LEFT[0], z: LEFT[1], gy: G1, h: academy.h, focusY: 2.5, focusR: 9.5, hit: [5, 9], rooms: academy.rooms },
      right: { x: RIGHT[0], z: RIGHT[1], gy: G1, h: magic.h, focusY: 4, focusR: 10, hit: [3.6, 14] },
      front: { x: FRONT[0], z: FRONT[1], gy: G1, h: dojoH, focusY: 1.5, focusR: 9.5, hit: [5, 5], labelAt: [4.2, -2.2] },
      gate: { x: gate.x, z: gate.z, gy: G1, h: gate.h, focusY: 5, focusR: 9, hit: [4.5, 11] },
      ...plotSpots,
    },
  };
}

// ─────────────── 主場景 ───────────────
export function createIsland({ stage, onPick, onBackground }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  stage.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog('#b7d4ee', 160, 520);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 4000);
  scene.add(new THREE.HemisphereLight('#fff4dc', '#c6d2e2', 1.25));
  const sun = new THREE.DirectionalLight('#ffe9c2', 2.5);
  sun.position.set(-55, 42, 30); scene.add(sun);

  const glow = getGlowTex();
  const mats = {
    solid: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.86, metalness: 0 }),
    shadow: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    cloud: new THREE.MeshLambertMaterial({ color: '#ffffff', emissive: '#fff6ea', emissiveIntensity: 0.45, transparent: true, opacity: 0.96 }),
    ring: new THREE.MeshBasicMaterial({ color: '#f2d888', transparent: true, opacity: 0, depthWrite: false }),
    water: new THREE.MeshStandardMaterial({ color: '#86c5ea', roughness: 0.2, metalness: 0.1, emissive: '#2f6f9a', emissiveIntensity: 0.12 }),
    orb: new THREE.MeshStandardMaterial({ color: '#9fe6ff', emissive: '#5fc8ff', emissiveIntensity: 1.1, roughness: 0.15, transparent: true, opacity: 0.78 }),
    orbCore: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
    crystalA: new THREE.MeshBasicMaterial({ color: '#c9b6ff' }),
    crystalB: new THREE.MeshBasicMaterial({ color: '#8fe3ff' }),
    rune: new THREE.MeshBasicMaterial({ color: '#f2d888', transparent: true, opacity: 0.85 }),
    orbGlow: () => new THREE.SpriteMaterial({ map: glow, color: '#9fd8ff', transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }),
    glowSprite: () => new THREE.SpriteMaterial({ map: glow, color: '#ffd98a', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
  };

  scene.add(buildSky());
  const cloudSea = buildCloudSea(CLOUD_Y); scene.add(cloudSea);

  // 物件清單：每個可點的東西都有 hit、label、object（標籤位置＝object 的世界座標＋offset）
  const entries = [];
  const pickables = [];
  const labelLayer = document.createElement('div');
  labelLayer.className = 'labels';
  stage.appendChild(labelLayer);
  function makeLabel(item, kind, className, text, link) {
    const el = document.createElement(link ? 'a' : 'button');
    el.className = `label ${className}`;
    el.textContent = text;
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
    if (link) { el.href = link; el.target = '_blank'; el.rel = 'noopener'; }
    else { el.type = 'button'; el.addEventListener('click', () => onPick(kind, item.id)); }
    labelLayer.appendChild(el);
    return el;
  }
  function addHit(object, geometry, entry) {
    const hit = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
    hit.visible = false; hit.userData.entry = entry; object.add(hit); pickables.push(hit);
  }

  // ── 城 ──
  const built = buildCity(mats);
  const city = built.city; scene.add(city);
  const floaters = [{ obj: city, baseY: 0, amp: 0.25, ph: 0, sp: 0.35 }];

  for (const tile of TILES.filter((t) => t.status !== 'reserved')) {
    const s = built.spots[tile.spot === 'plot' ? tile.id : tile.spot]; if (!s) continue;
    const anchor = new THREE.Object3D(); anchor.position.set(s.x, s.gy, s.z); city.add(anchor);
    const home = tile.status === 'full';
    const entry = { kind: 'tile', id: tile.id, object: anchor, offset: new THREE.Vector3(...(s.labelAt ? [s.labelAt[0], s.h + 0.6, s.labelAt[1]] : [0, s.h + 0.6, 0])), home, focusY: s.focusY, focusR: s.focusR,
      viewAz: s.viewAz, label: makeLabel(tile, 'tile', home ? 'label-home' : 'label-tile', tile.name) };
    if (!home) { // 選到時地上的金色光圈
      const ring = new THREE.Mesh(new THREE.RingGeometry(s.hit[0], s.hit[0] + 0.4, 48).rotateX(-Math.PI / 2), mats.ring.clone());
      ring.position.y = 0.08; anchor.add(ring); entry.ring = ring;
    }
    entries.push(entry);
    addHit(anchor, new THREE.CylinderGeometry(s.hit[0], s.hit[0], s.hit[1], 12).translate(0, s.hit[1] / 2 - 0.5, 0), entry);
    // 建築裡的教室名牌：只在選到這一區時出現，點了一樣開這一區的卡片
    (s.rooms || []).forEach((p, i) => {
      const a = new THREE.Object3D(); a.position.copy(p); city.add(a);
      entries.push({ kind: 'room', id: `${tile.id}-room-${i}`, parent: tile.id, object: a, offset: new THREE.Vector3(),
        label: makeLabel(tile, 'tile', 'label-room', tile.rooms[i]) });
    });
  }

  // ── 綠佳利島（公司）＋吊橋 ──
  const comp = buildCompany(mats); city.add(comp.group);
  { const kb = new Kit(); buildBridge(kb, built.bridgeFrom, comp.westCoast.clone().add(COMP_POS)); city.add(kb.mesh(mats)); }
  const compAnchor = (p) => { const a = new THREE.Object3D(); a.position.copy(p); comp.group.add(a); return a; };
  {
    const entry = { kind: 'company', id: COMPANY.id, island: true, object: compAnchor(comp.center), offset: new THREE.Vector3(0, 9.5, 0), focusY: 2, focusR: 15,
      label: makeLabel(COMPANY, 'company', 'label-tile label-company', COMPANY.name) };
    entries.push(entry);
  }
  for (const b of comp.buildings) {
    const entry = { kind: 'company', id: b.def.id, object: compAnchor(new THREE.Vector3(b.x, G1, b.z)), offset: new THREE.Vector3(0, b.h + 0.3, 0), focusY: b.h * 0.45, focusR: Math.max(7, b.h * 0.95), // 鏡頭依建築高度拉遠
      label: makeLabel(b.def, 'company', 'label-tile', b.def.name) };
    entries.push(entry);
    addHit(entry.object, new THREE.CylinderGeometry(1.4, 1.4, b.h + 1, 10).translate(0, (b.h + 1) / 2 - 0.5, 0), entry);
  }

  const fitR = R1 + 6.5;
  // ── 彩虹（城的後方，鏡頭放低才出現）──
  const rainbow = buildRainbow(); scene.add(rainbow);


  // ── 衛星（高空）──
  const satR = R1 * 0.95, satY = 21;
  const satellites = SATELLITES.map((sat) => {
    const mesh = buildSatellite(mats); scene.add(mesh);
    const entry = { kind: 'satellite', id: sat.id, object: mesh, link: sat.link, offset: new THREE.Vector3(0, 0.9, 0), phase: sat.phase,
      label: makeLabel(sat, 'satellite', 'label-sat', `🛰️ ${sat.name}`, sat.link) };
    entries.push(entry);
    addHit(mesh, new THREE.SphereGeometry(1.4, 8, 6), entry);
    return entry;
  });
  let orbitAngle = 0;
  function placeSatellites() {
    for (const sat of satellites) {
      const a = orbitAngle + sat.phase;
      sat.object.position.set(Math.cos(a) * satR, satY + Math.sin(a * 2) * 0.8, Math.sin(a) * satR * 0.7);
      sat.object.rotation.y = -a;
    }
  }

  // ── 雲：雲海上的雲、城旁邊飄過的雲 ──
  const clouds = [];
  for (let i = 0; i < 18; i++) {
    const low = i < 11, c = buildCloud(mats, 900 + i * 13, low);
    const R = low ? fitR * (0.7 + (i % 4) * 0.35) : fitR * (1.05 + (i % 3) * 0.35);
    c.userData = { a: i / 18 * Math.PI * 2 + (i % 3), R, sp: (low ? 0.01 : 0.006) * (i % 2 ? 1 : -1) };
    c.position.y = low ? CLOUD_Y + 0.1 : -2 + (i % 4) * 4;
    c.scale.set(low ? 2.6 + (i % 3) * 0.6 : 1.8, low ? 0.9 : 1.1, low ? 2.6 + (i % 3) * 0.6 : 1.8);
    scene.add(c); clouds.push(c);
  }
  // 島周圍一圈雲：離島遠一點、放在雲海上方，露出島的地基
  for (let i = 0; i < 14; i++) {
    const c = buildCloud(mats, 1400 + i * 7, false, 7 + (i % 3));
    const R = R1 * (1.2 + (i % 3) * 0.2);
    c.userData = { a: i / 14 * Math.PI * 2 + 0.2, R, zf: 1, sp: 0.004 * (i % 2 ? 1 : -1) };
    c.position.y = CLOUD_Y + 2.5 + (i % 3) * 1.5;
    c.scale.set(1.7 + (i % 3) * 0.3, 1.1, 1.7 + (i % 3) * 0.3);
    scene.add(c); clouds.push(c);
  }
  function placeClouds() { for (const c of clouds) { const u = c.userData; c.position.x = Math.cos(u.a) * u.R; c.position.z = Math.sin(u.a) * u.R * (u.zf || 0.85); } }
  // 瀑布底下的水霧
  const mist = built.waterfalls.map((w) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#ffffff', transparent: true, opacity: 0.6, depthWrite: false }));
    const [mx, mz] = polar(w.deg, Math.hypot(w.x, w.z) + 3.2);
    sp.position.set(mx, CLOUD_Y + 1.2, mz); sp.scale.set(7, 4, 1); city.add(sp); return sp;
  });


  // ── 相機與操作 ──
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.enableDamping = true; controls.dampingFactor = 0.1;
  controls.minPolarAngle = THREE.MathUtils.degToRad(18);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(82);
  controls.rotateSpeed = 0.6; controls.zoomSpeed = 0.9;
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };

  let width = 1, height = 1;
  const inset = { x: 0, y: 0, tx: 0, ty: 0 };
  const portrait = () => width < height;
  function fitDist(radius) {
    const v = THREE.MathUtils.degToRad(camera.fov);
    const hf = 2 * Math.atan(Math.tan(v / 2) * camera.aspect);
    return radius / Math.sin(Math.min(v, hf) / 2) * (portrait() ? 0.9 : 0.78);
  }
  function viewFor(target, dist, pol, az = 0) {
    const pos = new THREE.Vector3(Math.sin(pol) * Math.sin(az), Math.cos(pol), Math.sin(pol) * Math.cos(az)).multiplyScalar(dist).add(target);
    return { pos, target: target.clone() };
  }
  // 全景：側上方看過來，塔在中間、看得到底下的岩石與瀑布
  const homeView = () => viewFor(new THREE.Vector3(portrait() ? 20 : 19, portrait() ? 22 : 1, 0), fitDist(portrait() ? 40 : 44), THREE.MathUtils.degToRad(70), portrait() ? 0.5 : 0.18); // 兩座島一起入鏡
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let fly = null;
  function flyTo(v, dur = 1.4) {
    if (!dur || reducedMotion) { camera.position.copy(v.pos); controls.target.copy(v.target); controls.update(); fly = null; wake(300); return; }
    fly = { fromP: camera.position.clone(), fromT: controls.target.clone(), toP: v.pos, toT: v.target, t: 0, dur };
    wake(dur * 1000 + 300);
  }
  function applyViewOffset() { camera.setViewOffset(width, height, inset.x, inset.y, width, height); }
  let userMoved = false;
  function resize() {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, rect.width); height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    controls.minDistance = 8; controls.maxDistance = fitDist(fitR) * 1.6;
    if (!userMoved && !fly) { const v = homeView(); camera.position.copy(v.pos); controls.target.copy(v.target); }
    applyViewOffset();
    wake(600);
  }

  // ── 只在需要時重繪 ──
  let raf = null, last = 0, renderUntil = 0, animUntil = 0, T = 0;
  function wake(ms = 400) {
    renderUntil = Math.max(renderUntil, performance.now() + ms);
    if (raf === null && !document.hidden) raf = requestAnimationFrame(tick);
  }
  function activity() {
    if (!reducedMotion) animUntil = performance.now() + ORBIT_AFTER_ACTIVITY_MS;
    wake(reducedMotion ? 400 : ORBIT_AFTER_ACTIVITY_MS);
  }

  // 名牌重疊時，重要的先擺：選到的 → 精神之塔 → 功能區 → 衛星 → 停靠站；擺不下的先藏
  const prio = (e) => (e.parent ? 8 : e.label.classList.contains('is-active') ? 9 : e.home ? 4 : e.island ? 3.5 : e.kind === 'tile' ? 3 : e.kind === 'company' ? 2.5 : e.kind === 'satellite' ? 2 : 1);
  let activeId = null;
  const projected = new THREE.Vector3();
  function placeLabels() {
    const placed = [];
    for (const entry of entries.slice().sort((a, b) => prio(b) - prio(a))) {
      entry.object.localToWorld(projected.copy(entry.offset)).project(camera);
      let show = projected.z <= 1 && (!entry.parent || activeId === entry.parent);
      if (show) {
        const lw = entry.label.offsetWidth, lh = entry.label.offsetHeight, half = lw / 2 + 4;
        const x = THREE.MathUtils.clamp((projected.x + 1) / 2 * width, half, Math.max(half, width - half));
        const y = Math.max((1 - projected.y) / 2 * height, lh + 4);
        const rect = [x - lw / 2, y - lh, x + lw / 2, y];
        if (placed.some((p) => !(rect[2] < p[0] - 3 || rect[0] > p[2] + 3 || rect[3] < p[1] - 2 || rect[1] > p[3] + 2))) show = false;
        else { placed.push(rect); entry.label.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`; }
      }
      entry.label.style.visibility = show ? '' : 'hidden';
    }
  }
  function draw() {
    placeSatellites(); placeClouds();
    cloudSea.material.uniforms.uTime.value = T;
    cloudSea.material.uniforms.uCam.value.copy(camera.position);
    for (const w of built.waterfalls) w.mesh.material.uniforms.uTime.value = T;
    { // 彩虹：永遠在城的後方（相對鏡頭），鏡頭越低越清楚
      const off = camera.position.clone().sub(controls.target), az = Math.atan2(off.x, off.z);
      const phi = Math.acos(THREE.MathUtils.clamp(off.y / off.length(), -1, 1));
      rainbow.position.set(controls.target.x - Math.sin(az) * 170, CLOUD_Y - 4, controls.target.z - Math.cos(az) * 170);
      rainbow.rotation.y = az;
      const k2 = THREE.MathUtils.smoothstep(phi, 1.12, 1.36);
      rainbow.material.uniforms.uOpacity.value = 0.24 * k2; rainbow.visible = k2 > 0.01;
    }
    camera.updateMatrixWorld();
    renderer.render(scene, camera);
    placeLabels();
  }

  function tick(now) {
    raf = null;
    const dt = last ? Math.min((now - last) / 1000, 0.05) : 0;
    last = now;
    let moving = false;
    const animating = now < animUntil;
    if (animating) {
      T += dt; orbitAngle += dt * (Math.PI * 2 / 90);
      for (const c of clouds) c.userData.a += dt * c.userData.sp;
      mist.forEach((m, i) => (m.material.opacity = 0.45 + 0.15 * Math.sin(T * 1.3 + i)));
      const mg = built.magic; // 水晶球：自轉、上下浮、水晶繞著飛、魔法環反向轉
      mg.orb.rotation.y = T * 0.8; mg.orb.position.y = mg.orbY + Math.sin(T * 1.4) * 0.18;
      mg.crystals.rotation.y = -T * 0.9; mg.crystals.position.y = mg.orb.position.y;
      mg.rings[0].rotation.z = T * 0.6; mg.rings[1].rotation.z = -T * 0.8;
      mg.halo.material.opacity = 0.6 + 0.2 * Math.sin(T * 2.2);
      if (built.radar) built.radar.pivot.rotation.y = T * 0.5; // 雷達天線慢慢轉
    }
    for (const f of floaters) f.obj.position.y = f.baseY + (reducedMotion ? 0 : Math.sin(T * f.sp + f.ph) * f.amp);
    for (const e of entries) if (e.ring) { // 選到的功能區：地上的金色光圈
      const goal = e.label.classList.contains('is-active') ? 0.55 + 0.2 * Math.sin(T * 3) : 0;
      e.ring.material.opacity += (goal - e.ring.material.opacity) * Math.min(1, dt * 6);
      if (Math.abs(goal - e.ring.material.opacity) > 0.01) moving = true;
    }
    if (fly) {
      fly.t += dt / fly.dur;
      const k = fly.t >= 1 ? 1 : (fly.t < 0.5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2);
      camera.position.lerpVectors(fly.fromP, fly.toP, k); controls.target.lerpVectors(fly.fromT, fly.toT, k);
      if (fly.t >= 1) fly = null;
      moving = true;
    }
    const ease = reducedMotion ? 1 : 1 - Math.pow(0.0015, dt);
    if (Math.abs(inset.tx - inset.x) + Math.abs(inset.ty - inset.y) > 0.5) {
      inset.x += (inset.tx - inset.x) * ease; inset.y += (inset.ty - inset.y) * ease; applyViewOffset(); moving = true;
    } else if (inset.x !== inset.tx || inset.y !== inset.ty) { inset.x = inset.tx; inset.y = inset.ty; applyViewOffset(); }

    controls.update();
    draw();
    if (!moving && performance.now() >= renderUntil) last = 0;
    if (raf === null && (moving || animating || performance.now() < renderUntil)) raf = requestAnimationFrame(tick);
  }

  controls.addEventListener('change', () => wake(300));
  controls.addEventListener('start', () => { fly = null; userMoved = true; activity(); });
  renderer.domElement.addEventListener('wheel', () => { userMoved = true; activity(); }, { passive: true });

  // 點擊：拖曳超過 8px 就當作旋轉，不算點
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down = null;
  const setPointer = (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    camera.updateMatrixWorld(); raycaster.setFromCamera(pointer, camera);
  };
  renderer.domElement.addEventListener('pointerdown', (event) => { down = event.isPrimary ? { x: event.clientX, y: event.clientY } : null; activity(); });
  renderer.domElement.addEventListener('click', (event) => {
    if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 8) return;
    setPointer(event);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (!hit) { onBackground(); return; }
    const entry = hit.object.userData.entry;
    if (entry.kind === 'satellite') window.open(entry.link, '_blank', 'noopener');
    else onPick(entry.kind, entry.id);
  });
  renderer.domElement.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    setPointer(event);
    renderer.domElement.style.cursor = raycaster.intersectObjects(pickables, false).length ? 'pointer' : '';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { if (raf !== null) cancelAnimationFrame(raf); raf = null; }
    else wake(300);
  });

  new ResizeObserver(resize).observe(stage);
  resize();
  // 進場：從雲海下方往上飛到全景
  const hv = homeView();
  if (!reducedMotion) {
    const start = viewFor(new THREE.Vector3(0, -6, 0), hv.pos.distanceTo(hv.target) * 1.3, THREE.MathUtils.degToRad(86), 0.7);
    camera.position.copy(start.pos); controls.target.copy(start.target);
    flyTo(hv, 3.4);
  } else flyTo(hv, 0);
  controls.update();
  draw();
  activity();

  return {
    select(id) {
      activeId = id;
      let focus = null;
      for (const entry of entries) {
        const active = entry.id === id;
        entry.label.classList.toggle('is-active', active);
        if (active && (entry.kind === 'tile' || entry.kind === 'port' || entry.kind === 'company')) focus = entry;
      }
      if (focus) { // 鏡頭靠近選到的地方，保留目前的方向
        const off = camera.position.clone().sub(controls.target);
        const sph = new THREE.Spherical().setFromVector3(off);
        const t = focus.object.getWorldPosition(new THREE.Vector3()); t.y += focus.focusY;
        flyTo(viewFor(t, fitDist(focus.focusR), THREE.MathUtils.clamp(sph.phi, 0.85, 1.12), focus.viewAz ?? sph.theta), 1.3);
      } else if (id === null && !userMoved) flyTo(homeView(), 1.3);
      activity();
    },
    // 卡片蓋住畫面時，把城推到看得見的區域
    setInset(right, bottom) {
      inset.tx = right / 2;
      inset.ty = bottom / 2;
      wake(400);
    },
  };
}
