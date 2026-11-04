// Generador del pixel art del hero: 6 poses (fondo transparente) + escena
// "escritorio con vistas a la Alhambra" + las 6 poses sobre esa escena.
// Uso: node tools/pixelart.js   → escribe PNG en img/pixel/
// Sin dependencias: dibuja en una rejilla y codifica el PNG a mano.

const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

/* ---------- paleta (la de css/styles.css + tonos de apoyo) ---------- */
const C = {
  K: '#0d0d0d', W: '#ffffff', SURF: '#f3f3f1', FAINT: '#d4d4d4', SOFT: '#a9a9a6',
  LIME: '#cdf04a', ORANGE: '#ff6a2b', COBALT: '#3b55f6', PINK: '#ff9ccb', COBALT_T: '#e8ecff',
  HAIR: '#2a1c15', HAIR_HI: '#4e3528',
  SKIN: '#f0bf96', SKIN_SH: '#d4956c', BAGS: '#c98fa6',
  EYE: '#1a120e', MOUTH: '#a8473a',
  POLO: '#1f1f1f', POLO_RIB: '#2c2c2c',
  JEANS: '#2c3fb8', JEANS_SH: '#22308c',
  CASE: '#262626', CASE_HI: '#3a3a3a', COFFEE: '#5a3a28',
};

/* ---------- capa de píxeles ---------- */
class Layer {
  constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); }
  set(x, y, c) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.p[y * this.w + x] = c;
  }
  get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? null : this.p[y * this.w + x]; }
  px(list, c) { for (const [x, y] of list) this.set(x, y, c); return this; }
  rect(x, y, w, h, c) { for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c); return this; }
  hline(x1, x2, y, c) { for (let i = x1; i <= x2; i++) this.set(i, y, c); return this; }
  vline(x, y1, y2, c) { for (let j = y1; j <= y2; j++) this.set(x, j, c); return this; }
  ellipse(cx, cy, rx, ry, c, filter) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1 && (!filter || filter(x, y))) this.set(x, y, c);
      }
    return this;
  }
  capsule(x1, y1, x2, y2, r, c) {
    const vx = x2 - x1, vy = y2 - y1, len2 = vx * vx + vy * vy || 1;
    for (let y = Math.floor(Math.min(y1, y2) - r); y <= Math.ceil(Math.max(y1, y2) + r); y++)
      for (let x = Math.floor(Math.min(x1, x2) - r); x <= Math.ceil(Math.max(x1, x2) + r); x++) {
        let t = ((x - x1) * vx + (y - y1) * vy) / len2; t = Math.max(0, Math.min(1, t));
        const dx = x - (x1 + t * vx), dy = y - (y1 + t * vy);
        if (dx * dx + dy * dy <= r * r) this.set(x, y, c);
      }
    return this;
  }
  path(pts, r, c) { for (let i = 0; i < pts.length - 1; i++) this.capsule(...pts[i], ...pts[i + 1], r, c); return this; }
  poly(pts, c) {
    const ys = pts.map(p => p[1]), xs = pts.map(p => p[0]);
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
        let inside = false;
        for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
          const [xi, yi] = pts[i], [xj, yj] = pts[j];
          if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
        }
        if (inside) this.set(x, y, c);
      }
    return this;
  }
  // stamp de texto ASCII: cada carácter del mapa → color ('.' o ' ' = vacío)
  ascii(x, y, rows, map) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => { if (map[ch]) this.set(x + i, y + j, map[ch]); }));
    return this;
  }
  // contorno de 1 px (vecindad 4) alrededor de lo pintado
  outlined(c = C.K) {
    const o = new Layer(this.w, this.h); o.p = this.p.slice();
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) o.set(x, y, c);
    }
    return o;
  }
  draw(other, dx = 0, dy = 0) {
    for (let y = 0; y < other.h; y++) for (let x = 0; x < other.w; x++) {
      const c = other.p[y * other.w + x]; if (c) this.set(x + dx, y + dy, c);
    }
    return this;
  }
}

// dibuja una pieza: relleno → contorno → detalles sin contorno
function part(canvas, fill, details) {
  const L = new Layer(canvas.w, canvas.h); fill(L);
  const O = L.outlined(); if (details) details(O, L);
  canvas.draw(O); return O;
}

/* ---------- PNG ---------- */
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function toPNG(layer, scale, file) {
  const W = layer.w * scale, H = layer.h * scale;
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const c = layer.p[Math.floor(y / scale) * layer.w + Math.floor(x / scale)];
      const o = y * (W * 4 + 1) + 1 + x * 4;
      if (c) { raw[o] = parseInt(c.slice(1, 3), 16); raw[o + 1] = parseInt(c.slice(3, 5), 16); raw[o + 2] = parseInt(c.slice(5, 7), 16); raw[o + 3] = 255; }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, png);
}

/* ---------- personaje (64×64, centrado en x = 32) ---------- */
const S = 64;

function drawLegs(cv) {
  part(cv, L => {
    L.rect(25, 46, 15, 3, C.JEANS).rect(25, 46, 7, 9, C.JEANS).rect(33, 46, 7, 9, C.JEANS);
  }, O => { O.vline(26, 49, 54, C.JEANS_SH); O.vline(38, 49, 54, C.JEANS_SH); });
  part(cv, L => { L.rect(23, 55, 9, 3, C.W).rect(33, 55, 9, 3, C.W); },
    O => { O.hline(23, 31, 57, C.FAINT).hline(33, 41, 57, C.FAINT); O.px([[27, 56], [28, 56], [36, 56], [37, 56]], C.COBALT); });
}

function drawTorso(cv) {
  part(cv, L => L.rect(30, 27, 5, 5, C.SKIN_SH)); // cuello
  part(cv, L => L.poly([[24, 30.5], [40, 30.5], [42.5, 34], [41.5, 46.5], [22.5, 46.5], [21.5, 34]], C.POLO), O => {
    for (let x = 24; x <= 40; x += 2) O.vline(x, 34, 45, C.POLO_RIB); // punto canalé
    // cuello en pico con ribete blanco
    O.hline(30, 34, 31, C.SKIN_SH).hline(31, 33, 32, C.SKIN_SH).set(32, 33, C.SKIN_SH);
    O.hline(26, 29, 31, C.W).hline(35, 38, 31, C.W);
    O.px([[30, 32], [34, 32], [31, 33], [33, 33], [32, 34]], C.W);
    O.px([[27, 32], [37, 32]], C.W);
  });
}

function face(O, expr) {
  const brows = {
    normal: [[[27, 18], [28, 18], [29, 18]], [[35, 18], [36, 18], [37, 18]]],
    up: [[[27, 17], [28, 16], [29, 17]], [[35, 17], [36, 16], [37, 17]]],
    angry: [[[26, 17], [27, 17], [28, 18], [29, 18]], [[35, 18], [36, 18], [37, 17], [38, 17]]],
    quirk: [[[27, 17], [28, 16], [29, 16]], [[35, 19], [36, 19], [37, 19]]],
    soft: [[[27, 18], [28, 17], [29, 18]], [[35, 18], [36, 17], [37, 18]]],
  };
  const E = {
    normal: () => { O.rect(27, 20, 2, 2, C.EYE).rect(36, 20, 2, 2, C.EYE); },
    look: () => { O.rect(26, 20, 2, 2, C.EYE).rect(35, 20, 2, 2, C.EYE); },
    wide: () => { O.rect(27, 19, 2, 3, C.EYE).rect(36, 19, 2, 3, C.EYE); O.px([[28, 19], [37, 19]], C.W); },
    closed: () => { O.px([[26, 21], [27, 20], [28, 20], [29, 21], [35, 21], [36, 20], [37, 20], [38, 21]], C.EYE); },
    tired: () => {
      O.hline(26, 29, 20, C.SKIN_SH).hline(35, 38, 20, C.SKIN_SH);
      O.rect(27, 21, 2, 1, C.EYE).rect(36, 21, 2, 1, C.EYE);
      O.hline(26, 29, 22, C.BAGS).hline(35, 38, 22, C.BAGS);
    },
  };
  const M = {
    smirk: () => O.px([[30, 26], [31, 26], [32, 26], [33, 26], [34, 25]], C.MOUTH),
    open: () => { O.hline(30, 34, 25, C.MOUTH).hline(31, 33, 26, C.MOUTH).set(32, 26, C.PINK); },
    grin: () => { O.hline(29, 35, 25, C.K).hline(30, 34, 26, C.W).px([[29, 26], [35, 26]], C.K).hline(30, 34, 27, C.K); },
    tongue: () => { O.px([[30, 26], [31, 26], [32, 26]], C.MOUTH); O.px([[33, 26], [33, 27]], C.PINK); },
    wavy: () => O.px([[30, 26], [31, 26], [32, 26], [33, 27]], C.MOUTH),
    smile: () => O.px([[30, 25], [31, 26], [32, 26], [33, 26], [34, 25]], C.MOUTH),
  };
  const b = brows[expr.brows || 'normal']; O.px(b[0], C.HAIR); O.px(b[1], C.HAIR);
  E[expr.eyes || 'normal']();
  M[expr.mouth || 'smirk']();
  O.px([[32, 24], [33, 24]], C.SKIN_SH); // nariz
  if (expr.blush !== false) O.px(expr.blush === 'big'
    ? [[24, 23], [25, 23], [26, 23], [25, 24], [38, 23], [39, 23], [40, 23], [39, 24]]
    : [[25, 24], [26, 24], [38, 24], [39, 24]], C.PINK);
}

function drawHead(cv, expr) {
  part(cv, L => { L.ellipse(22, 21, 2, 2.5, C.SKIN); L.ellipse(42, 21, 2, 2.5, C.SKIN); },
    O => O.px([[22, 21], [42, 21]], C.SKIN_SH));
  part(cv, L => L.ellipse(32, 20, 9, 9.5, C.SKIN), (O, L) => {
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) if (L.get(x, y) && !L.get(x, y + 1)) O.set(x, y, C.SKIN_SH);
    face(O, expr);
  });
  // pelo: casquete + cortinas con raya al medio
  part(cv, L => {
    L.ellipse(32, 13, 11, 7, C.HAIR, (x, y) => y <= 11);
    L.poly([[32, 9], [30, 12], [27, 14], [24, 16], [22, 18.5], [20.5, 17], [21, 12], [23, 9.5]], C.HAIR);
    L.poly([[32, 9], [34, 12], [37, 14], [40, 16], [42.5, 18], [45, 17.5], [44, 12], [41.5, 9.5]], C.HAIR);
    L.poly([[27, 8], [29.5, 4.5], [31.5, 8]], C.HAIR);
    L.poly([[34, 7.5], [37.5, 4.5], [38, 8]], C.HAIR);
  }, O => {
    O.px([[25, 9], [26, 8], [27, 8], [22, 12], [22, 13], [23, 11]], C.HAIR_HI);
    O.px([[37, 8], [38, 8], [39, 9], [41, 11], [42, 12]], C.HAIR_HI);
    O.px([[30, 6], [36, 6]], C.HAIR_HI);
  });
}

function drawArm(cv, sh, el, hand, opt = {}) {
  part(cv, L => {
    L.capsule(...sh, ...el, 1.8, C.SKIN).capsule(...el, ...hand, 1.8, C.SKIN);
    if (opt.bicep) L.ellipse(...opt.bicep, 2.2, 2, C.SKIN);
    if (opt.thumb) L.capsule(...opt.thumb[0], ...opt.thumb[1], 1, C.SKIN);
    L.ellipse(...hand, opt.hx || 2.3, opt.hy || 2.3, C.SKIN);
  }, O => { if (opt.knuckles) O.px(opt.knuckles, C.SKIN_SH); });
  // manga corta del polo
  const m = [sh[0] + (el[0] - sh[0]) * 0.5, sh[1] + (el[1] - sh[1]) * 0.5];
  part(cv, L => L.capsule(...sh, ...m, 2.8, C.POLO), O => {
    O.set(Math.round(m[0]), Math.round(m[1]), C.POLO_RIB);
  });
}

const HEART = ['.p.p.', 'ppppp', 'ppppp', '.ppp.', '..p..'];
const QMARK = ['.ooo.', 'oo.oo', '...oo', '..oo.', '..oo.', '.....', '..oo.'];

/* ---------- las 6 poses ---------- */
const POSES = [
  {
    id: 'funciona-en-mi-maquina',
    title: 'Funciona en mi máquina',
    build(cv) {
      // portátil abierto en el suelo
      part(cv, L => { L.rect(46, 47, 12, 8, C.K); L.poly([[44, 55], [60, 55], [61, 58], [43, 58]], C.FAINT); }, O => {
        O.rect(47, 48, 10, 6, C.LIME);
        O.hline(48, 51, 49, C.COBALT).hline(49, 54, 51, C.K).hline(48, 52, 52, C.COBALT);
        O.hline(45, 59, 56, C.SOFT);
      });
      drawLegs(cv); drawTorso(cv); drawHead(cv, { brows: 'up', mouth: 'smirk' });
      drawArm(cv, [25, 34], [19, 41], [14, 35], { hx: 2.8, hy: 1.8 });
      drawArm(cv, [39, 34], [45, 41], [50, 35], { hx: 2.8, hy: 1.8 });
      // bocadillo con ✓
      part(cv, L => { L.rect(46, 1, 15, 11, C.W); L.poly([[47, 11], [51, 11], [44.5, 15]], C.W); }, O => {
        O.px([[49, 6], [50, 7], [51, 8], [52, 7], [53, 6], [54, 5], [55, 4], [56, 3]], C.K);
        O.px([[49, 7], [50, 8], [51, 9], [52, 8], [53, 7], [54, 6], [55, 5], [56, 4]], C.LIME);
      });
    },
  },
  {
    id: 'abrazo-al-portatil',
    title: 'Abrazo al portátil',
    build(cv) {
      drawLegs(cv); drawTorso(cv); drawHead(cv, { brows: 'soft', eyes: 'closed', mouth: 'open', blush: 'big' });
      part(cv, L => L.rect(23, 34, 19, 12, C.COBALT), O => {
        O.hline(23, 41, 45, C.COBALT_T); O.ellipse(32, 39, 1.6, 1.6, C.LIME);
      });
      drawArm(cv, [25, 34], [20, 42], [31, 43]);
      drawArm(cv, [39, 34], [44, 40], [34, 38]);
      const H = { p: C.PINK };
      part(cv, L => { L.ascii(9, 9, HEART, H); L.ascii(50, 4, HEART, H); L.ascii(53, 16, HEART, H); L.ascii(7, 24, HEART, H); });
    },
  },
  {
    id: 'servidor-al-hombro',
    title: 'Servidor al hombro',
    build(cv) {
      part(cv, L => L.rect(43, 8, 11, 25, C.CASE), O => {
        O.vline(44, 8, 32, C.COBALT);
        for (const y of [11, 15, 19, 23]) { O.hline(46, 50, y, C.CASE_HI); O.set(52, y, C.LIME); }
        O.px([[52, 12], [52, 20]], C.ORANGE);
        for (let x = 46; x <= 52; x += 2) O.vline(x, 27, 30, C.CASE_HI);
      });
      drawLegs(cv); drawTorso(cv); drawHead(cv, { brows: 'angry', mouth: 'grin' });
      drawArm(cv, [25, 34], [16, 35], [16, 26], { bicep: [20, 32], hx: 2.6, hy: 2.6, knuckles: [[15, 25], [17, 25]] });
      drawArm(cv, [39, 34], [48, 40], [51, 34], { hx: 2.6 });
      // destellos de fuerza
      part(cv, L => L.px([[11, 21], [12, 22], [16, 18], [16, 19], [21, 21], [20, 22]], C.LIME));
    },
  },
  {
    id: 'tecleando-a-lo-loco',
    title: 'Tecleando a lo loco',
    build(cv) {
      drawLegs(cv); drawTorso(cv); drawHead(cv, { brows: 'angry', eyes: 'wide', mouth: 'tongue' });
      drawArm(cv, [25, 34], [21, 42], [27, 44]);
      drawArm(cv, [39, 34], [43, 42], [37, 44]);
      // tapa del portátil (vista trasera)
      part(cv, L => L.rect(19, 41, 27, 11, C.COBALT), O => {
        O.hline(19, 45, 41, C.COBALT_T); O.ellipse(32, 46, 1.6, 1.6, C.LIME);
      });
      // chispas, líneas de movimiento, gota de sudor y { }
      part(cv, L => L.px([[23, 38], [30, 37], [36, 38], [41, 37]], C.LIME).px([[26, 36], [39, 35], [33, 36]], C.ORANGE));
      cv.px([[15, 40], [16, 40], [14, 43], [15, 43], [49, 40], [50, 40], [50, 43], [51, 43]], C.SOFT);
      part(cv, L => L.ascii(46, 11, ['.c.', 'ccc', 'ccc', '.c.'], { c: C.COBALT_T }), O => O.set(46, 13, C.W));
      part(cv, L => L.ascii(8, 6, ['.cc...cc.', '.c.....c.', 'c.......c', '.c.....c.', '.cc...cc.'], { c: C.COBALT }));
    },
  },
  {
    id: 'el-cable-desenchufado',
    title: 'El cable desenchufado',
    build(cv) {
      part(cv, L => L.path([[19, 38], [14, 46], [19, 51], [13, 56], [5, 57]], 1, C.COBALT));
      drawLegs(cv); drawTorso(cv); drawHead(cv, { brows: 'quirk', eyes: 'look', mouth: 'wavy' });
      part(cv, L => L.rect(16, 29, 6, 5, C.ORANGE), O => O.px([[17, 27], [17, 28], [20, 27], [20, 28]], C.SOFT).hline(16, 21, 33, C.K));
      drawArm(cv, [25, 34], [19, 42], [19, 35]);
      drawArm(cv, [39, 34], [50, 25], [43, 9], { hx: 2.4 });
      part(cv, L => L.ascii(8, 2, QMARK, { o: C.ORANGE }));
      cv.px([[47, 4], [48, 3], [50, 6], [51, 6], [38, 4], [38, 5]], C.SOFT);
    },
  },
  {
    id: 'cafe-xxl',
    title: 'Café XXL',
    build(cv) {
      drawLegs(cv); drawTorso(cv); drawHead(cv, { brows: 'soft', eyes: 'tired', mouth: 'smile' });
      // taza gigante con </>
      part(cv, L => { L.rect(6, 27, 12, 14, C.W); L.capsule(19, 31, 19, 36, 2, C.W); }, O => {
        O.rect(19, 32, 1, 4, null);
        O.hline(7, 16, 28, C.COFFEE);
        O.ascii(7, 32, ['..c....c..', '.c..c...c.', 'c...c....c', '.c.c....c.', '..cc...c..'], { c: C.COBALT });
        O.hline(6, 17, 40, C.FAINT);
      });
      drawArm(cv, [25, 34], [21, 41], [20, 37]);
      drawArm(cv, [39, 34], [46, 40], [47, 31], { thumb: [[46, 29], [46, 25]], hx: 2.6, hy: 2.6, knuckles: [[48, 31], [48, 33]] });
      cv.px([[8, 24], [9, 23], [8, 22], [9, 21], [12, 24], [13, 23], [12, 22], [13, 21], [12, 20], [16, 24], [15, 23], [16, 22]], C.SOFT);
      part(cv, L => L.px([[52, 22], [51, 23], [52, 23], [53, 23], [52, 24]], C.LIME));
      part(cv, L => L.ascii(48, 4, ['ccc', '..c', '.c.', 'ccc'], { c: C.COBALT }).ascii(53, 1, ['cc', '.c', 'cc'], { c: C.COBALT }));
    },
  },
];

function character(pose) { const cv = new Layer(S, S); pose.build(cv); return cv; }

/* ---------- escena: escritorio con vistas a la Alhambra (96×96) ---------- */
const BG = 96;
function scene() {
  const cv = new Layer(BG, BG);
  cv.rect(0, 0, BG, BG, C.SURF);

  // ventana: cielo de atardecer con bandas tramadas
  const sky = [[6, C.COBALT], [15, C.PINK], [26, '#ffb07a'], [36, C.ORANGE]];
  for (let y = 6; y <= 48; y++) for (let x = 12; x <= 83; x++) {
    let c = sky[0][1];
    for (let i = 0; i < sky.length; i++) if (y >= sky[i][0]) c = sky[i][1];
    for (let i = 1; i < sky.length; i++) if (y === sky[i][0] - 1 || y === sky[i][0] - 2) c = (x + y) % 2 ? sky[i][1] : sky[i - 1][1];
    cv.set(x, y, c);
  }
  // nubes
  cv.hline(18, 27, 12, C.COBALT_T).hline(21, 30, 13, C.COBALT_T).hline(60, 70, 20, C.W).hline(64, 76, 21, C.W);
  // sol
  cv.ellipse(66, 33, 6, 6, C.LIME);
  // Sierra Nevada al fondo, con nieve
  const sierra = new Layer(BG, BG);
  sierra.poly([[12, 38], [18, 35.5], [26, 36], [34, 32], [42, 33], [50, 30], [58, 31], [66, 27], [72, 26], [78, 28], [84, 30], [84, 49], [12, 49]], '#8e7fd6');
  for (let x = 12; x <= 83; x++) { // nieve en las cumbres altas
    let top = 0; while (top < BG && !sierra.get(x, top)) top++;
    if (top < 34) for (let k = 0; k < (top < 30 ? 3 : 2); k++) sierra.set(x, top + k, (x + k) % 5 === 0 && k ? '#b9b0ea' : C.W);
  }
  cv.draw(sierra);
  // colina de la Sabika con arboleda
  cv.poly([[12, 44], [26, 39], [50, 38], [70, 41], [83, 44], [83, 48], [12, 48]], '#2e4a2f');
  for (const x of [16, 22, 58, 64, 70, 77]) { cv.vline(x, 38, 44, '#1f3320'); cv.vline(x + 1, 39, 44, '#1f3320'); } // cipreses
  // la Alhambra: muralla + torres (Vela, Comares...) en rojo
  const RED = '#c4542e', RED_D = '#8f3a22';
  cv.rect(20, 34, 36, 6, RED);
  cv.rect(19, 30, 5, 10, RED).rect(18, 29, 7, 1, RED);           // Torre de la Vela
  cv.rect(27, 32, 4, 8, RED);
  cv.rect(36, 27, 7, 13, RED).rect(35, 27, 9, 1, RED_D);          // Torre de Comares
  cv.rect(48, 31, 4, 9, RED).rect(54, 33, 4, 7, RED);
  cv.hline(20, 55, 34, RED_D);
  for (const [x, y] of [[21, 32], [38, 30], [40, 30], [38, 33], [40, 33], [29, 35], [49, 34], [55, 35]]) cv.set(x, y, RED_D);
  for (let x = 20; x <= 56; x += 2) cv.set(x, 33, RED); // almenas
  // marco, parteluz y alféizar
  part(cv, L => {
    L.rect(10, 4, 76, 2, C.W).rect(10, 49, 76, 1, C.W).rect(10, 4, 2, 46, C.W).rect(84, 4, 2, 46, C.W).rect(47, 6, 2, 43, C.W);
  });
  part(cv, L => L.rect(7, 50, 82, 2, C.W), O => O.hline(7, 88, 51, C.FAINT));

  // zócalo de alicatado
  for (let y = 60; y <= 71; y++) for (let x = 0; x < BG; x++) {
    const u = x % 8, v = (y - 60) % 8;
    const d = Math.abs(u - 3.5) + Math.abs(v - 3.5);
    cv.set(x, y, d < 2 ? C.LIME : d < 3 ? C.K : (u + v) % 8 === 0 ? C.COBALT : C.W);
  }
  cv.hline(0, BG - 1, 59, C.K);

  // monitor con código
  part(cv, L => { L.rect(17, 65, 5, 7, C.CASE); L.rect(12, 70, 15, 2, C.CASE); });
  part(cv, L => L.rect(3, 44, 35, 22, C.K), O => {
    O.rect(5, 46, 31, 17, '#141414');
    const lines = [[0, 8, C.PINK], [2, 14, C.LIME], [2, 9, C.COBALT], [4, 18, C.W], [4, 11, C.ORANGE], [2, 6, C.LIME], [0, 3, C.PINK], [0, 12, C.COBALT]];
    lines.forEach(([ind, len, c], i) => O.hline(7 + ind, 7 + ind + len, 47 + i * 2, c));
    O.set(20 + 1, 61, C.LIME); // cursor
    O.hline(4, 36, 64, C.CASE);
  });

  // libros y planta a la derecha
  part(cv, L => { L.rect(66, 61, 4, 11, C.COBALT); L.rect(70, 59, 4, 13, C.PINK); L.rect(74, 62, 3, 10, C.LIME); });
  part(cv, L => {
    L.ellipse(85, 56, 4, 3, '#7fb83a'); L.ellipse(81, 59, 3, 2.5, '#7fb83a'); L.ellipse(89, 59, 3, 2.5, '#7fb83a'); L.ellipse(85, 52, 2.5, 3, '#7fb83a');
  }, O => O.px([[84, 54], [85, 51], [82, 58], [88, 58], [86, 57]], C.LIME));
  part(cv, L => L.poly([[80, 62], [90, 62], [89, 71.5], [81, 71.5]], C.ORANGE), O => O.hline(80, 90, 63, '#e0551c'));

  // mesa y suelo
  cv.rect(0, 86, BG, 10, C.FAINT); cv.hline(0, BG - 1, 86, C.SOFT);
  part(cv, L => { L.rect(0, 72, BG, 3, C.POLO); L.rect(3, 75, 3, 11, C.POLO); L.rect(90, 75, 3, 11, C.POLO); }, O => O.hline(0, BG - 1, 72, C.CASE_HI));
  return cv;
}

/* ---------- salida ---------- */
const OUT = path.join(__dirname, '..', 'img', 'pixel');
const bg = scene();
toPNG(bg, 10, path.join(OUT, 'fondo-alhambra.png'));
const manifest = [];
POSES.forEach((pose, i) => {
  const n = String(i + 1).padStart(2, '0');
  const ch = character(pose);
  toPNG(ch, 16, path.join(OUT, 'poses', `${n}-${pose.id}.png`));
  const sc = new Layer(BG, BG); sc.draw(bg); sc.draw(ch, 16, 36);
  toPNG(sc, 10, path.join(OUT, 'escena', `${n}-${pose.id}.png`));
  manifest.push({ id: pose.id, title: pose.title, pose: `img/pixel/poses/${n}-${pose.id}.png`, scene: `img/pixel/escena/${n}-${pose.id}.png` });
});
fs.writeFileSync(path.join(OUT, 'poses.json'), JSON.stringify(manifest, null, 2) + '\n');

// hoja de contactos para revisar (SHEET=ruta.png node tools/pixelart.js)
if (process.env.SHEET) {
  const sheet = new Layer(6 * (S + 2) + 2, (S + 4) + BG * 2 + 12);
  sheet.rect(0, 0, sheet.w, sheet.h, '#bfbfbf');
  POSES.forEach((p, i) => {
    const ch = character(p); const t = new Layer(S, S); t.rect(0, 0, S, S, C.W); t.draw(ch);
    sheet.draw(t, i * (S + 2) + 2, 2);
  });
  POSES.forEach((p, i) => {
    const sc = new Layer(BG, BG); sc.draw(bg); sc.draw(character(p), 16, 36);
    sheet.draw(sc, (i % 3) * (BG + 2) + 2, S + 6 + Math.floor(i / 3) * (BG + 2));
  });
  toPNG(sheet, 4, process.env.SHEET);
}
console.log('OK', manifest.length, 'poses →', OUT);
