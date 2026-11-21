// Adds realistic "game clutter" to every lesson puzzle and writes js/lesson-boards.js.
//
//   node tools/dress-puzzles.mjs          (re-run after adding or changing puzzles)
//
// A filler stone is kept only if, at every position the learner sees (the start, after each
// answer and after each scripted reply), it changes nothing tactical for either side:
//   - no point where a side can make five, a four or an open three appears or disappears
//     on any line through the stone, and
//   - no capture chance appears or disappears near it.
// So the puzzle is exactly the same puzzle, it just looks like a real mid-game.
// After dressing, every stage is re-checked with the real goal checker (and tests do it again).

import { writeFileSync } from 'node:fs';
import { UNITS } from '../js/lessons.js';
import { setupPosition, checkMove, solutions } from '../js/lesson-engine.js';
import {
  SIZE, EMPTY, P1, P2, AXES, idx, inBounds, other, applyMove, cloneState, parseCoord, coordName, capturesAt,
} from '../js/rules.js';

const TARGET = { 1: 16, 2: 22, 3: 28, 4: 34, 5: 38 };

function rng(seedStr) {
  let h = 2166136261;
  for (const ch of seedStr) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const at = (b, x, y) => (inBounds(x, y) ? b[idx(x, y)] : -1);

// Length of the run of `c` through (x,y) along axis a (cell must already hold c).
function runLen(b, x, y, c, a) {
  const [dx, dy] = AXES[a];
  let n = 1;
  for (let k = 1; at(b, x + dx * k, y + dy * k) === c; k++) n++;
  for (let k = 1; at(b, x - dx * k, y - dy * k) === c; k++) n++;
  return n;
}

// Does placing c at (x,y) make an open four along axis a?
function openFourAt(b, x, y, c, a) {
  const [dx, dy] = AXES[a];
  let lo = 0, hi = 0;
  while (at(b, x - dx * (lo + 1), y - dy * (lo + 1)) === c) lo++;
  while (at(b, x + dx * (hi + 1), y + dy * (hi + 1)) === c) hi++;
  if (lo + hi + 1 !== 4) return false;
  return at(b, x - dx * (lo + 1), y - dy * (lo + 1)) === EMPTY && at(b, x + dx * (hi + 1), y + dy * (hi + 1)) === EMPTY;
}

// Line features of empty point p=(x,y) for colour c along axis a: bit 1 five, 2 four, 4 open four.
// (Two-stone potential may change; the real goal checker below decides whether that matters.)
function pointFeatures(b, x, y, c, a) {
  const i = idx(x, y);
  if (b[i] !== EMPTY) return 0;
  const [dx, dy] = AXES[a];
  b[i] = c;
  let f = 0;
  if (runLen(b, x, y, c, a) >= 5) f |= 1;
  // four: a 5-window through p with 4 of c and one empty, no opponent
  for (let s = -4; s <= 0 && !(f & 2); s++) {
    let mine = 0, empty = 0, ok = true;
    for (let k = 0; k < 5; k++) {
      const v = at(b, x + dx * (s + k), y + dy * (s + k));
      if (v === c) mine++; else if (v === EMPTY) empty++; else { ok = false; break; }
    }
    if (ok && mine === 4 && empty === 1) f |= 2;
  }
  if (openFourAt(b, x, y, c, a)) f |= 4;
  b[i] = EMPTY;
  return f;
}

// Signature of everything a stone at q could affect.
function localSignature(s, qx, qy) {
  const b = s.board;
  const parts = [];
  for (let a = 0; a < 4; a++) {
    const [dx, dy] = AXES[a];
    for (let k = -6; k <= 6; k++) {
      if (!k) continue;
      const x = qx + dx * k, y = qy + dy * k;
      if (!inBounds(x, y) || b[idx(x, y)] !== EMPTY) continue;
      const f1 = pointFeatures(b, x, y, P1, a), f2 = pointFeatures(b, x, y, P2, a);
      if (f1 || f2) parts.push(`${a}:${k}:${f1}:${f2}`);
    }
  }
  const sizes = s.variant.captureSizes;
  if (sizes.length) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = qx + dx, y = qy + dy;
      if (!inBounds(x, y) || b[idx(x, y)] !== EMPTY || (!dx && !dy)) continue;
      for (const c of [P1, P2]) {
        const st = capturesAt(b, x, y, c, sizes);
        if (st.length) parts.push(`c${c}:${dx},${dy}:${st.join('.')}`);
      }
    }
  }
  return parts.join('|');
}

// The positions the learner sees, plus the positions right after each answer (where goals are checked).
function stagePositions(setup, stages, extra) {
  const out = [];
  let s = setupPosition({ ...setup, extra });
  out.push(s);
  for (const sg of stages) {
    const r = checkMove(s, ...parseCoord(sg.answer), { kind: 'legal' });
    s = r.after;
    out.push(s);
    if (sg.reply) {
      const t = cloneState(s);
      applyMove(t, ...parseCoord(sg.reply));
      s = t;
      out.push(s);
    }
  }
  return out;
}

// Is a group of stones [[x, y, colour], ...] harmless in every position?
function harmless(positions, group) {
  for (const s of positions) {
    for (const [x, y] of group) if (!inBounds(x, y) || s.board[idx(x, y)] !== EMPTY) return false;
    const before = group.map(([x, y]) => localSignature(s, x, y));
    for (const [x, y, c] of group) s.board[idx(x, y)] = c;
    const after = group.map(([x, y]) => localSignature(s, x, y));
    for (const [x, y] of group) s.board[idx(x, y)] = EMPTY;
    if (before.some((b, i) => b !== after[i])) return false;
  }
  return true;
}

// Shapes that turn up in real games once a fight has died down. 'a' = one side, 'b' = the other;
// offsets are [along, across] the chosen direction.
const SHAPES = [
  { w: 3, stones: [[0, 0, 'a']] },
  { w: 3, stones: [[0, 0, 'a'], [1, 0, 'b']] },
  { w: 2, stones: [[0, 0, 'b'], [1, 0, 'a'], [2, 0, 'a'], [3, 0, 'b']] },              // pair sitting in a bracket
  { w: 2, stones: [[0, 0, 'b'], [1, 0, 'a'], [2, 0, 'a'], [3, 0, 'a'], [4, 0, 'b']] }, // three blocked both ends
  { w: 2, stones: [[0, 0, 'a'], [1, 1, 'b'], [1, 0, 'b'], [0, 1, 'a']] },              // two crossing pairs
  { w: 2, stones: [[0, 0, 'a'], [2, 0, 'a'], [1, 0, 'b']] },                           // a cut
  { w: 1, stones: [[0, 0, 'b'], [1, 0, 'a'], [2, 0, 'a'], [3, 0, 'b'], [1, 1, 'b']] },
  { w: 1, stones: [[0, 0, 'a'], [1, 0, 'b'], [0, 1, 'b'], [1, 1, 'a']] },              // checkerboard knot
];
const SHAPE_BAG = SHAPES.flatMap((sh) => Array(sh.w).fill(sh));
const DIRS = [[1, 0], [0, 1], [1, 1], [1, -1], [-1, 0], [0, -1], [-1, -1], [-1, 1]];

function verify(setup, stages, extra) {
  let s = setupPosition({ ...setup, extra });
  for (const sg of stages) {
    const r = checkMove(s, ...parseCoord(sg.answer), sg.goal);
    if (!r.ok) return false;
    s = r.after;
    if (sg.reply) {
      if (s.winner !== null) return false;
      applyMove(s, ...parseCoord(sg.reply));
      if (s.winner !== null) return false;
    }
  }
  return true;
}

// Solutions of every cheap stage (slow forced-win goals are only checked for the answer).
function stageSolutions(setup, stages, extra) {
  const out = [];
  let s = setupPosition({ ...setup, extra });
  for (const sg of stages) {
    out.push(slow(sg.goal) ? null : solutions(s, sg.goal).sort().join(','));
    s = checkMove(s, ...parseCoord(sg.answer), { kind: 'legal' }).after;
    if (sg.reply) applyMove(s, ...parseCoord(sg.reply));
  }
  return out;
}

function sound(setup, stages, extra, clean) {
  if (!verify(setup, stages, extra)) return false;
  const now = stageSolutions(setup, stages, extra);
  return now.every((v, i) => v === clean[i]);
}

const slow = (g) => (g.all ? g.all.some(slow) : ['forcedWin', 'stopForced'].includes(g.kind));

function dress(key, st) {
  const { setup, stages, level } = st;
  const target = TARGET[level] || 20;
  const rand = rng(key);
  const extra = { p1: [], p2: [] };
  // Keep the puzzle's key points (answers, replies) and the ring around them clear.
  const keep = new Set();
  for (const sg of stages) for (const c of [sg.answer, sg.reply].filter(Boolean)) {
    const [x, y] = parseCoord(c);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) keep.add(idx(x + dx, y + dy));
  }
  const base = setupPosition(setup);
  const coreStones = [];
  for (let i = 0; i < base.board.length; i++) if (base.board[i] !== EMPTY) coreStones.push(i);
  // Centre of the action: stones of the clean puzzle weighted equally.
  let cx = 0, cy = 0;
  for (const i of coreStones) { cx += i % SIZE; cy += (i - (i % SIZE)) / SIZE; }
  cx /= coreStones.length; cy /= coreStones.length;

  const positions = stagePositions(setup, stages, extra);
  const cleanSolutions = stageSolutions(setup, stages, null);
  let tries = 0;
  const placed = [];
  let balance = 0; // gold minus blue among the extras
  while (placed.length < target && tries < 6000) {
    tries++;
    const s0 = positions[0];
    const stones = [];
    for (let i = 0; i < s0.board.length; i++) if (s0.board[i] !== EMPTY) stones.push(i);
    let from;
    if (rand() < 0.75) {
      const near = stones.filter((i) => Math.max(Math.abs((i % SIZE) - cx), Math.abs(Math.floor(i / SIZE) - cy)) <= 6);
      from = (near.length ? near : stones)[Math.floor(rand() * (near.length || stones.length))];
    } else from = stones[Math.floor(rand() * stones.length)];
    const fx = from % SIZE, fy = Math.floor(from / SIZE);
    const r = rand() < 0.6 ? 1 : 2;
    const ox = fx + Math.round((rand() * 2 - 1) * r), oy = fy + Math.round((rand() * 2 - 1) * r);
    const shape = SHAPE_BAG[Math.floor(rand() * SHAPE_BAG.length)];
    if (placed.length + shape.stones.length > target + 2) continue;
    const [dx, dy] = DIRS[Math.floor(rand() * 8)];
    const [px, py] = [-dy, dx];
    const aCol = balance > 0 ? P2 : balance < 0 ? P1 : (rand() < 0.5 ? P1 : P2);
    const group = shape.stones.map(([u, v, t]) => [ox + dx * u + px * v, oy + dy * u + py * v, t === 'a' ? aCol : other(aCol)]);
    if (group.some(([x, y]) => x < 1 || y < 1 || x > SIZE - 2 || y > SIZE - 2 || keep.has(idx(x, y)))) continue;
    if (!harmless(positions, group)) continue;
    const trial = { p1: extra.p1.slice(), p2: extra.p2.slice() };
    for (const [x, y, c] of group) (c === P1 ? trial.p1 : trial.p2).push(coordName(x, y));
    if (!sound(setup, stages, trial, cleanSolutions)) continue;
    for (const [x, y, c] of group) {
      for (const s of positions) s.board[idx(x, y)] = c;
      placed.push([x, y, c]);
      (c === P1 ? extra.p1 : extra.p2).push(coordName(x, y));
      balance += c === P1 ? 1 : -1;
    }
  }
  return { extra, tries };
}

const out = {};
let n = 0;
const t0 = Date.now();
for (const u of UNITS) for (const l of u.lessons) for (const st of l.steps) {
  if (st.type !== 'puzzle' || st.setup.moves || st.setup.plain) continue;
  const key = `${l.id}|${st.title}`;
  const { extra } = dress(key, { ...st, setup: { ...st.setup, extra: undefined } });
  out[key] = extra;
  n++;
  console.log(`${key}: +${extra.p1.length + extra.p2.length} stones`);
}

const body = Object.entries(out).map(([k, v]) => `  ${JSON.stringify(k)}: { p1: ${JSON.stringify(v.p1)}, p2: ${JSON.stringify(v.p2)} },`).join('\n');
writeFileSync(new URL('../js/lesson-boards.js', import.meta.url),
  `// Generated by tools/dress-puzzles.mjs — do not edit by hand; re-run the tool after changing puzzles.\n` +
  `// Extra stones that make each lesson puzzle look like a real mid-game without changing its tactics.\n` +
  `export const BUSY = {\n${body}\n};\n`);
console.log(`Dressed ${n} puzzles in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
