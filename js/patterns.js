// Pattern, opening and play-style analytics, computed from the saved game archive.
// Pure logic (no DOM): replays each game and looks at the shapes every move creates,
// how the bot answered them, and how openings turned out.

import {
  SIZE, CENTER, EMPTY, AXES, DIRS8, P1, P2, idx, inBounds, other, newGame, applyMove, capturesAt, lockedOf,
} from './rules.js';
import { resolveVariant, getVariant } from './variants.js';

// ---------------------------------------------------------------------------
// Shapes through a stone

export const SHAPES = {
  five: { label: 'Five', rank: 7, forcing: true },
  openFour: { label: 'Open four', rank: 6, forcing: true },
  four: { label: 'Four', rank: 5, forcing: true },
  tria: { label: 'Open three (tria)', rank: 4, forcing: true },
  split3: { label: 'Split three', rank: 3, forcing: true },
  pair: { label: 'Pair', rank: 1, forcing: false },
};
export const SHAPE_ORDER = ['five', 'openFour', 'four', 'tria', 'split3', 'pair'];

/** Line around (x, y) on one axis as a string: X = p, O = opponent, . = empty, # = off board. */
function lineString(board, x, y, p, axis, reach = 5) {
  const [dx, dy] = AXES[axis];
  let s = '';
  for (let k = -reach; k <= reach; k++) {
    const cx = x + dx * k, cy = y + dy * k;
    if (!inBounds(cx, cy)) { s += '#'; continue; }
    const c = board[idx(cx, cy)];
    s += c === EMPTY ? '.' : c === p ? 'X' : 'O';
  }
  return s;
}

// Does the substring `pat` occur in `line` at a position covering index `at`?
function covers(line, pat, at) {
  let from = 0;
  for (;;) {
    const i = line.indexOf(pat, from);
    if (i < 0) return false;
    if (i <= at && at < i + pat.length) return true;
    from = i + 1;
  }
}

/** The strongest shape on one axis that includes the stone at the centre of `line` (index 5). */
function shapeOnLine(line) {
  const c = 5;
  // Contiguous run through the centre.
  let a = c, b = c;
  while (line[a - 1] === 'X') a--;
  while (line[b + 1] === 'X') b++;
  const run = b - a + 1;
  const before = line[a - 1], after = line[b + 1];
  if (run >= 5) return 'five';
  if (run === 4 && before === '.' && after === '.') return 'openFour';
  for (const pat of ['XXXX.', '.XXXX', 'X.XXX', 'XX.XX', 'XXX.X']) if (covers(line, pat, c)) return 'four';
  if (run === 3 && before === '.' && after === '.' && (line[a - 2] === '.' || line[b + 2] === '.')) return 'tria';
  for (const pat of ['.X.XX.', '.XX.X.']) if (covers(line, pat, c)) return 'split3';
  if (run === 2) return 'pair';
  return null;
}

/** Shapes `p` would have through (x, y) (the stone must be on the board, or is assumed placed). */
export function shapesAt(board, x, y, p) {
  const i = idx(x, y);
  const prev = board[i];
  board[i] = p;
  const out = [];
  for (let a = 0; a < 4; a++) {
    const sh = shapeOnLine(lineString(board, x, y, p, a));
    if (sh) out.push({ shape: sh, axis: a });
  }
  board[i] = prev;
  return out;
}

// After `p` plays (x, y): is a pair (or Keryo three) of the opponent now bracketed on one side
// by this stone with the far end empty? That's a capture threat.
function makesCaptureThreat(board, x, y, p, sizes) {
  if (!sizes.length) return false;
  const opp = other(p);
  for (const [dx, dy] of DIRS8) {
    for (const n of sizes) {
      let ok = true;
      for (let k = 1; k <= n; k++) {
        const cx = x + dx * k, cy = y + dy * k;
        if (!inBounds(cx, cy) || board[idx(cx, cy)] !== opp) { ok = false; break; }
      }
      if (!ok) continue;
      const ex = x + dx * (n + 1), ey = y + dy * (n + 1);
      if (inBounds(ex, ey) && board[idx(ex, ey)] === EMPTY) {
        const bx = x + dx * (n + 2), by = y + dy * (n + 2);
        if (!inBounds(bx, by) || board[idx(bx, by)] !== opp) return true;
      }
    }
  }
  return false;
}

// Would (x, y) have been a strong point for `q` (so playing there blocks q)?
function blocksThreat(board, x, y, q, sizes, locked = null) {
  const sh = shapesAt(board, x, y, q);
  if (sh.some((s) => s.shape === 'five')) return 'win';     // stopped a five
  if (sh.some((s) => s.shape === 'openFour')) return 'three'; // stopped an open three becoming an open four
  if (sh.some((s) => s.shape === 'four')) return 'four';
  if (sizes.length && capturesAt(board, x, y, q, sizes, locked).length) return 'capture';
  return null;
}

/**
 * Describe one move: shapes it made, whether it was forcing, captured, threatened a capture,
 * blocked a threat, or left a pair exposed.
 */
export function describeMove(before, x, y) {
  const s = before;
  const p = s.toMove;
  const opp = other(p);
  const sizes = s.variant.captureSizes;
  const locked = lockedOf(s);
  const blocked = blocksThreat(s.board, x, y, opp, sizes, locked);
  const after = { board: s.board.slice() };
  after.board[idx(x, y)] = p;
  const caps = capturesAt(after.board, x, y, p, sizes, locked);
  for (const c of caps) after.board[c] = EMPTY;
  const shapes = shapesAt(after.board, x, y, p);
  const strongest = shapes.reduce((m, sh) => (!m || SHAPES[sh.shape].rank > SHAPES[m].rank ? sh.shape : m), null);
  const threatsMade = shapes.filter((sh) => SHAPES[sh.shape].rank >= 3).length;
  const capThreat = makesCaptureThreat(after.board, x, y, p, sizes);
  // An exposed pair: one of my pairs through this stone with an enemy on one end and space on the other.
  let exposed = false;
  if (sizes.includes(2)) {
    for (let a = 0; a < 4; a++) {
      const line = lineString(after.board, x, y, p, a);
      if (covers(line, 'OXX.', 5) || covers(line, '.XXO', 5)) { exposed = true; break; }
    }
  }
  return {
    shapes: shapes.map((sh) => sh.shape),
    strongest,
    doubleThreat: threatsMade >= 2,
    captured: caps.length,
    capThreat,
    blocked,
    exposed,
    forcing: threatsMade > 0 || capThreat || caps.length > 0,
  };
}

// ---------------------------------------------------------------------------
// Openings (normalised under the 8 symmetries of the board about the centre)

const SYM = [
  ([x, y]) => [x, y], ([x, y]) => [-x, y], ([x, y]) => [x, -y], ([x, y]) => [-x, -y],
  ([x, y]) => [y, x], ([x, y]) => [-y, x], ([x, y]) => [y, -x], ([x, y]) => [-y, -x],
];
const off = ([x, y]) => [x - CENTER, y - CENTER];
const keyOf = (offs) => offs.map(([a, b]) => a + ',' + b).join(' ');

/** Canonical form of a list of offsets from the centre, plus every symmetry that produces it. */
export function canonical(offsets) {
  let best = null, ts = [];
  for (let t = 0; t < 8; t++) {
    const k = keyOf(offsets.map(SYM[t]));
    if (best === null || k < best) { best = k; ts = [t]; }
    else if (k === best) ts.push(t);
  }
  return { key: best, transforms: ts, offsets: offsets.map(SYM[ts[0]]) };
}
function canonicalFollowUp(transforms, offset) {
  let best = null;
  for (const t of transforms) {
    const o = SYM[t](offset);
    const k = keyOf([o]);
    if (best === null || k < best.k) best = { k, o };
  }
  return best.o;
}

const describeOffset = ([dx, dy]) => {
  const ax = Math.abs(dx), ay = Math.abs(dy), d = Math.max(ax, ay);
  if (d === 1) return ax && ay ? 'touching, diagonal' : 'touching, side';
  if ((ax === 0 || ay === 0)) return `${d} away, straight`;
  if (ax === ay) return `${d} away, diagonal`;
  return `${d} away, off-line`;
};
/** Plain-language name for an opening from its canonical offsets [blue reply, gold 2nd, ...]. */
export function openingName(offsets) {
  const parts = [];
  if (offsets[0]) parts.push(`Blue ${describeOffset(offsets[0])}`);
  if (offsets[1]) parts.push(`Gold ${describeOffset(offsets[1])}`);
  return parts.join(' · ');
}

// ---------------------------------------------------------------------------
// Aggregation over the archive

const finished = (g) => ['win', 'loss', 'resigned', 'draw'].includes(g.result) && Array.isArray(g.moves) && g.moves.length >= 2 && g.variantId;
const won = (g) => g.result === 'win';

function bump(map, key, init) {
  if (!map.has(key)) map.set(key, init());
  return map.get(key);
}

/**
 * @param {Array} history  newest first, as saved by the app
 * @param {{ variantId?: string }} filter
 */
export function computePatterns(history, filter = {}) {
  const games = (history || []).filter(finished).filter((g) => !filter.variantId || g.variantId === filter.variantId);

  const style = { moves: 0, forcing: 0, defending: 0, captures: 0, capThreats: 0, exposed: 0, doubleThreats: 0, games: games.length };
  const shapeStats = new Map(); // shape -> { made, gamesWith, winsWith, replies: {captured, blocked, counter, elsewhere}, kept }
  const openingsGold = new Map(); // your 2nd stone vs the bot's reply
  const openingsBlue = new Map(); // your reply to the centre stone

  for (const g of games) {
    let variant;
    try { variant = resolveVariant(g.variantId, g.options || {}); } catch { continue; }
    const you = g.you || P1;
    const s = newGame(variant);
    const descs = [];
    const shapesThisGame = new Set();
    try {
      for (let i = 0; i < g.moves.length; i++) {
        const [x, y] = g.moves[i];
        const d = describeMove(s, x, y);
        d.player = s.toMove;
        const rec = applyMove(s, x, y);
        d.rec = rec;
        descs.push(d);
      }
    } catch { continue; }

    for (let i = 0; i < descs.length; i++) {
      const d = descs[i];
      if (d.player !== you) continue;
      style.moves++;
      if (d.forcing) style.forcing++;
      if (d.blocked) style.defending++;
      if (d.captured) style.captures++;
      if (d.capThreat) style.capThreats++;
      if (d.exposed) style.exposed++;
      if (d.doubleThreat) style.doubleThreats++;
      const key = d.strongest && d.strongest !== 'five' ? d.strongest : null;
      if (!key) continue;
      const st = bump(shapeStats, key, () => ({ made: 0, gamesWith: 0, winsWith: 0, replies: { captured: 0, blocked: 0, counter: 0, elsewhere: 0 }, kept: 0, followed: 0 }));
      st.made++;
      shapesThisGame.add(key);
      // How did the bot answer?
      const r = descs[i + 1];
      if (r) {
        const kind = r.captured ? 'captured' : ['win', 'four', 'three'].includes(r.blocked) ? 'blocked' : r.forcing ? 'counter' : 'elsewhere';
        st.replies[kind]++;
      }
      // Did you keep the initiative with your next move?
      const next = descs[i + 2];
      if (next) { st.followed++; if (next.forcing) st.kept++; }
    }
    for (const key of shapesThisGame) {
      const st = shapeStats.get(key);
      st.gamesWith++;
      if (won(g)) st.winsWith++;
    }

    // Openings (only games that start on the centre point)
    const m = g.moves;
    if (m[0][0] !== CENTER || m[0][1] !== CENTER || m.length < 4) continue;
    if (you === P1) {
      const c = canonical([off(m[1]), off(m[2])]);
      const o = bump(openingsGold, c.key, () => ({ offsets: c.offsets, games: 0, wins: 0, replies: new Map() }));
      o.games++; if (won(g)) o.wins++;
      const reply = canonicalFollowUp(c.transforms, off(m[3]));
      const rk = keyOf([reply]);
      const rr = bump(o.replies, rk, () => ({ offset: reply, games: 0, wins: 0 }));
      rr.games++; if (won(g)) rr.wins++;
    } else {
      const c = canonical([off(m[1])]);
      const o = bump(openingsBlue, c.key, () => ({ offsets: c.offsets, games: 0, wins: 0, replies: new Map() }));
      o.games++; if (won(g)) o.wins++;
      const reply = canonicalFollowUp(c.transforms, off(m[2]));
      const rk = keyOf([reply]);
      const rr = bump(o.replies, rk, () => ({ offset: reply, games: 0, wins: 0 }));
      rr.games++; if (won(g)) rr.wins++;
    }
  }

  const pct = (a, b) => (b ? Math.round((a / b) * 100) : null);
  const per = (n) => (style.games ? +(n / style.games).toFixed(1) : 0);
  const aggression = pct(style.forcing, style.moves);
  const defence = pct(style.defending, style.moves);
  let label = 'Balanced';
  let blurb = 'You mix attack and defence. Keep it up, and look for moves that do both at once.';
  if (style.moves >= 15) {
    if (aggression >= 45 && defence < 30) { label = 'Attacker'; blurb = 'You like to force the play. Watch for open pairs and the bot\'s counter-threats while you push.'; }
    else if (defence >= 40 && aggression < 35) { label = 'Defender'; blurb = 'You spend a lot of moves blocking. Try to block with moves that also build your own threats.'; }
    else if (per(style.capThreats) >= 3) { label = 'Capturer'; blurb = 'You hunt pairs. Captures are a strong second route to winning, as long as your own shape stays safe.'; }
  }

  const shapes = SHAPE_ORDER.filter((k) => shapeStats.has(k)).map((k) => {
    const st = shapeStats.get(k);
    const total = Object.values(st.replies).reduce((a, b) => a + b, 0);
    return {
      shape: k, label: SHAPES[k].label, made: st.made, perGame: per(st.made),
      winPctWith: pct(st.winsWith, st.gamesWith), gamesWith: st.gamesWith,
      keptInitiativePct: pct(st.kept, st.followed),
      replies: Object.fromEntries(Object.entries(st.replies).map(([kk, v]) => [kk, pct(v, total) ?? 0])),
    };
  });

  const openingList = (map) => [...map.values()]
    .sort((a, b) => b.games - a.games)
    .map((o) => ({
      offsets: o.offsets, name: openingName(o.offsets), parts: o.offsets.map(describeOffset), games: o.games, wins: o.wins, winPct: pct(o.wins, o.games),
      replies: [...o.replies.values()].sort((a, b) => b.games - a.games)
        .map((r) => ({ offset: r.offset, games: r.games, winPct: pct(r.wins, r.games), name: describeOffset(r.offset) })),
    }));

  return {
    games: style.games,
    style: {
      label, blurb, moves: style.moves, aggression, defence,
      capturesPerGame: per(style.captures), capThreatsPerGame: per(style.capThreats),
      exposedPerGame: per(style.exposed), doubleThreatsPerGame: per(style.doubleThreats),
    },
    shapes,
    openings: { asGold: openingList(openingsGold), asBlue: openingList(openingsBlue) },
    variants: [...new Set((history || []).filter(finished).map((g) => g.variantId))].map((id) => ({ id, name: getVariant(id).name })),
  };
}

export const REPLY_LABELS = { blocked: 'Blocked it', captured: 'Captured', counter: 'Counter-attacked', elsewhere: 'Played elsewhere' };
