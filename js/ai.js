// The practice bots — engine v2.
//
// How it thinks:
//  1. Take an immediate win; block the opponent's immediate win.
//  2. Threat search ("VCF": victory by continuous fours). Look for a chain of five-threats
//     the opponent must answer, ending in a win. Captures are respected: a reply that breaks
//     a four by capturing from it, or that wins by captures, refutes the chain.
//  3. Stop the opponent's threat chains (higher levels).
//  4. Otherwise, alpha-beta search with iterative deepening, a transposition table and a
//     time budget, over the most promising moves, scored by line patterns and capture terms.
// Everything is played through the rules engine, so every variant is handled correctly.

import {
  SIZE, EMPTY, AXES, DIRS8, idx, inBounds, other,
  applyMove, undoMove, cloneState, nearbyMoves, capturesAt, winningPointsFor, isLegal,
} from './rules.js';

export const LEVELS = {
  1: { name: 'Pip', title: 'Novice', blurb: 'Plays loosely and often misses threats. Good for learning the rules.',
       kind: 'greedy', noise: 0.9, missThreat: 0.45, missWin: 0.25 },
  2: { name: 'Juno', title: 'Apprentice', blurb: 'Sees simple threats and captures, but doesn\'t look far ahead.',
       depth: 2, time: 350, rootWidth: 10, width: 8, noise: 0.12, vcf: 0, vcfDefend: false },
  3: { name: 'Ludo', title: 'Tactician', blurb: 'Looks several moves ahead, finds forcing wins and punishes open pairs.',
       depth: 5, time: 700, rootWidth: 12, width: 8, noise: 0.03, vcf: 6, vcfDefend: false },
  4: { name: 'Vega', title: 'Strategist', blurb: 'Searches deeper and sees your forcing sequences coming.',
       depth: 8, time: 1300, rootWidth: 14, width: 9, noise: 0.01, vcf: 10, vcfDefend: true },
  5: { name: 'Orion', title: 'Master', blurb: 'The strongest bot. Plays to win from the first move.',
       depth: 14, time: 2600, rootWidth: 16, width: 10, noise: 0, vcf: 14, vcfDefend: true },
};
export const LEVEL_IDS = Object.keys(LEVELS).map(Number);

const WIN = 10_000_000;
const NEAR_WIN = WIN / 2;
// Value of a 5-cell window holding n stones of one player and none of the other's (for move ordering).
const WINDOW = [0, 1, 12, 120, 1500, 250000];
// The same for static evaluation; a completed five is handled by the rules (winner / banked fives).
const EVAL_WINDOW = [0, 1, 12, 120, 1500, 0];

const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
class Timeout extends Error {}

// A five-in-a-row wins on the spot only in these variants (threat search relies on that).
const fiveWinsOutright = (v) => v.fivesToWin === 1 && !v.requireFiveAndCaptures && !v.boat;

// ---------------------------------------------------------------------------
// Zobrist hashing (deterministic tables)

const Z = (() => {
  let seed = 0x9e3779b9;
  const rnd = () => { seed ^= seed << 13; seed >>>= 0; seed ^= seed >>> 17; seed ^= seed << 5; seed >>>= 0; return seed; };
  const t = { a: new Uint32Array(SIZE * SIZE * 3), b: new Uint32Array(SIZE * SIZE * 3), side: [rnd(), rnd()], cap: [] };
  for (let i = 0; i < t.a.length; i++) { t.a[i] = rnd(); t.b[i] = rnd(); }
  for (let i = 0; i < 64; i++) t.cap.push([rnd(), rnd()]);
  return t;
})();

// ---------------------------------------------------------------------------
// Static evaluation (from the point of view of the side to move)

function captureValue(s, p) {
  const v = s.variant;
  if (!v.captureWinStones) return 0;
  const stones = s.captured[p];
  const left = v.captureWinStones - stones;
  let val = stones * 160 + stones * stones * 12;
  if (left <= 2) val += 3000;
  if (v.requireFiveAndCaptures && s.banked[p].length) val *= 2.5;
  return val;
}

/**
 * Score the position for the side to move.
 * Combines line patterns (inside the area where stones are), captures, open pairs and
 * "four" threats (a line that becomes five with one more stone).
 */
export function evaluate(s, me = s.toMove) {
  if (s.winner !== null) return s.winner === me ? WIN : s.winner === 0 ? 0 : -WIN;
  const v = s.variant;
  const b = s.board;
  const opp = other(me);
  const stm = s.toMove;

  let minx = SIZE, maxx = -1, miny = SIZE, maxy = -1;
  for (let i = 0; i < b.length; i++) {
    if (b[i] === EMPTY) continue;
    const x = i % SIZE, y = (i - x) / SIZE;
    if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  if (maxx < 0) return 0;
  const x0 = Math.max(0, minx - 4), x1 = Math.min(SIZE - 1, maxx + 4);
  const y0 = Math.max(0, miny - 4), y1 = Math.min(SIZE - 1, maxy + 4);

  const line = [0, 0, 0];
  const fourPts = [null, [], []];
  for (const [dx, dy] of AXES) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const ex = x + dx * 4, ey = y + dy * 4;
      if (ex < x0 || ex > x1 || ey < y0 || ey > y1) continue;
      let a = 0, c = 0, empty = -1;
      for (let k = 0; k < 5; k++) {
        const i = idx(x + dx * k, y + dy * k);
        const cell = b[i];
        if (cell === 1) a++; else if (cell === 2) c++; else empty = i;
      }
      if (a && !c) { line[1] += EVAL_WINDOW[a]; if (a === 4 && !fourPts[1].includes(empty)) fourPts[1].push(empty); }
      else if (c && !a) { line[2] += EVAL_WINDOW[c]; if (c === 4 && !fourPts[2].includes(empty)) fourPts[2].push(empty); }
    }
  }

  // Open and threatened pairs (and threes in Keryo).
  const threatened = [0, 0, 0], loose = [0, 0, 0];
  const sizes = v.captureSizes;
  if (sizes.length) {
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      const p = b[idx(x, y)];
      if (p === EMPTY) continue;
      const q = other(p);
      for (const [dx, dy] of AXES) {
        for (const n of sizes) {
          const bx = x - dx, by = y - dy, ax = x + dx * n, ay = y + dy * n;
          if (!inBounds(bx, by) || !inBounds(ax, ay)) continue;
          const before = b[idx(bx, by)];
          if (before === p) continue; // not the start of the group
          let ok = true;
          for (let k = 1; k < n; k++) if (b[idx(x + dx * k, y + dy * k)] !== p) { ok = false; break; }
          if (!ok) continue;
          const after = b[idx(ax, ay)];
          if (after === p) continue; // longer than n
          if ((before === q && after === EMPTY) || (after === q && before === EMPTY)) threatened[p] += n;
          else if (before === EMPTY && after === EMPTY) loose[p] += n;
        }
      }
    }
  }

  const fiveWins = fiveWinsOutright(v);
  // Tactical shortcuts: the side to move with a five-point can win now; two five-points for the
  // side not to move usually can't both be blocked (captures aside).
  if (fiveWins) {
    if (fourPts[stm].length) return stm === me ? NEAR_WIN : -NEAR_WIN;
    const waiting = other(stm);
    if (fourPts[waiting].length >= 2 && !threatened[waiting]) return waiting === me ? NEAR_WIN / 2 : -NEAR_WIN / 2;
  }
  // Capture win available to the side to move.
  if (v.captureWinStones && !v.requireFiveAndCaptures && threatened[other(stm)] &&
      s.captured[stm] + 2 >= v.captureWinStones) {
    return stm === me ? NEAR_WIN : -NEAR_WIN;
  }

  const lineW = (p) => (v.requireFiveAndCaptures && s.banked[p].length ? 0.25 : 1);
  const score = (p) => {
    let val = line[p] * lineW(p) + captureValue(s, p) + s.banked[p].length * 6000 + fourPts[p].length * 900;
    val -= threatened[p] * (stm === p ? 90 : 300) + loose[p] * 18;
    return val;
  };
  const mine = score(me), theirs = score(opp);
  return stm === me ? mine * 1.1 - theirs : mine - theirs * 1.1;
}

// ---------------------------------------------------------------------------
// Move ordering

function windowDelta(board, x, y, p) {
  const opp = other(p);
  let before = 0, after = 0;
  for (const [dx, dy] of AXES) {
    for (let off = -4; off <= 0; off++) {
      const sx = x + dx * off, sy = y + dy * off;
      if (!inBounds(sx, sy) || !inBounds(sx + dx * 4, sy + dy * 4)) continue;
      let mine = 0, theirs = 0;
      for (let k = 0; k < 5; k++) {
        const c = board[idx(sx + dx * k, sy + dy * k)];
        if (c === p) mine++; else if (c === opp) theirs++;
      }
      if (!theirs) { before += WINDOW[mine]; after += WINDOW[Math.min(5, mine + 1)]; }
    }
  }
  return after - before;
}

// Would placing p at (x, y) create a pair that the opponent can capture right away?
function selfRisk(board, x, y, p, sizes) {
  if (!sizes.includes(2)) return 0;
  const opp = other(p);
  let risk = 0;
  for (const [dx, dy] of DIRS8) {
    const ax = x + dx, ay = y + dy, bx = x - dx, by = y - dy, cx = x + 2 * dx, cy = y + 2 * dy;
    if (!inBounds(ax, ay) || !inBounds(bx, by) || !inBounds(cx, cy)) continue;
    if (board[idx(ax, ay)] !== p) continue;
    const back = board[idx(bx, by)], front = board[idx(cx, cy)];
    if ((back === opp && front === EMPTY) || (front === opp && back === EMPTY)) risk++;
  }
  return risk;
}

export function quickScore(s, x, y, me, { ignoreDefence = false } = {}) {
  const v = s.variant;
  const opp = other(me);
  const sizes = v.captureSizes;
  let score = windowDelta(s.board, x, y, me);
  if (!ignoreDefence) score += windowDelta(s.board, x, y, opp) * 0.9;
  if (sizes.length) {
    const caps = capturesAt(s.board, x, y, me, sizes).length;
    if (caps) {
      score += caps * 220 + caps * s.captured[me] * 25;
      if (v.captureWinStones && s.captured[me] + caps >= v.captureWinStones && !v.requireFiveAndCaptures) score += WIN / 10;
    }
    if (!ignoreDefence) {
      const theirCaps = capturesAt(s.board, x, y, opp, sizes).length;
      score += theirCaps * 200 + theirCaps * s.captured[opp] * 25;
    }
    score -= selfRisk(s.board, x, y, me, sizes) * 180;
  }
  return score;
}

function orderedMoves(s, me, width, extra = [], first = null) {
  const moves = nearbyMoves(s, 2).map(([x, y]) => ({ x, y, q: quickScore(s, x, y, me) }));
  moves.sort((a, b) => b.q - a.q);
  const top = moves.slice(0, width);
  for (const [x, y] of extra) {
    if (!top.some((m) => m.x === x && m.y === y) && isLegal(s, x, y)) top.push({ x, y, q: quickScore(s, x, y, me) });
  }
  if (first) {
    const i = top.findIndex((m) => m.x === first[0] && m.y === first[1]);
    if (i > 0) top.unshift(top.splice(i, 1)[0]);
    else if (i < 0 && isLegal(s, first[0], first[1])) top.unshift({ x: first[0], y: first[1], q: 0 });
  }
  return top;
}

// ---------------------------------------------------------------------------
// Threat search: victory by continuous fours, aware of captures.

// Moves that give `p` a five-threat (four stones + one empty in a 5-window, no enemy stones),
// with immediate fives first.
function fourMakingMoves(s, p) {
  const b = s.board;
  const wins = [], fours = [];
  const seen = new Set();
  for (const [dx, dy] of AXES) {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const ex = x + dx * 4, ey = y + dy * 4;
      if (!inBounds(ex, ey)) continue;
      let mine = 0, theirs = 0;
      const empties = [];
      for (let k = 0; k < 5; k++) {
        const i = idx(x + dx * k, y + dy * k);
        if (b[i] === p) mine++; else if (b[i] === EMPTY) empties.push(i); else theirs++;
      }
      if (theirs) continue;
      if (mine === 4) { if (!seen.has('w' + empties[0])) { seen.add('w' + empties[0]); wins.push(empties[0]); } }
      else if (mine === 3) for (const e of empties) if (!seen.has(e)) { seen.add(e); fours.push(e); }
    }
  }
  return wins.concat(fours.filter((e) => !wins.includes(e)));
}

// Empty points where `p` would complete a five (four-in-window points), anywhere.
function fivePoints(s, p) {
  const b = s.board;
  const out = [];
  for (const [dx, dy] of AXES) {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const ex = x + dx * 4, ey = y + dy * 4;
      if (!inBounds(ex, ey)) continue;
      let mine = 0, empty = -1, bad = false;
      for (let k = 0; k < 5; k++) {
        const i = idx(x + dx * k, y + dy * k);
        if (b[i] === p) mine++; else if (b[i] === EMPTY) empty = i; else { bad = true; break; }
      }
      if (!bad && mine === 4 && !out.includes(empty)) out.push(empty);
    }
  }
  return out;
}

// Every capture `p` can make right now (points only).
function captureMoves(s, p) {
  const sizes = s.variant.captureSizes;
  if (!sizes.length) return [];
  const out = [];
  const b = s.board;
  const opp = other(p);
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== EMPTY) continue;
    const x = i % SIZE, y = (i - x) / SIZE;
    let near = false;
    for (const [dx, dy] of DIRS8) {
      const nx = x + dx, ny = y + dy;
      if (inBounds(nx, ny) && b[idx(nx, ny)] === opp) { near = true; break; }
    }
    if (near && capturesAt(b, x, y, p, sizes).length) out.push(i);
  }
  return out;
}

/**
 * Look for a forced win for `attacker` (who must be on move) using only five-threats.
 * Returns the first move of the winning chain, or null.
 */
export function findVCF(state, attacker, maxDepth = 10, deadline = now() + 500, nodeLimit = 30000) {
  const s = state;
  if (!fiveWinsOutright(s.variant) || s.toMove !== attacker || s.winner !== null) return null;
  const defender = other(attacker);
  let nodes = 0;

  function attack(depth) {
    if (depth <= 0) return null;
    for (const i of fourMakingMoves(s, attacker)) {
      if (++nodes > nodeLimit || ((nodes & 63) === 0 && now() > deadline)) throw new Timeout();
      const x = i % SIZE, y = (i - x) / SIZE;
      if (!isLegal(s, x, y)) continue;
      applyMove(s, x, y);
      if (s.winner === attacker) { undoMove(s); return i; }
      if (s.winner !== null) { undoMove(s); continue; }
      const threats = fivePoints(s, attacker);
      if (!threats.length) { undoMove(s); continue; }
      // Defender's options: block a five-point, capture (may break the line or win), or win on the spot.
      const replies = new Set(threats);
      for (const c of captureMoves(s, defender)) replies.add(c);
      for (const w of fivePoints(s, defender)) replies.add(w);
      let refuted = false;
      for (const r of replies) {
        const rx = r % SIZE, ry = (r - rx) / SIZE;
        if (!isLegal(s, rx, ry)) continue;
        applyMove(s, rx, ry);
        const ok = s.winner === null ? attack(depth - 1) !== null : s.winner === attacker;
        undoMove(s);
        if (!ok) { refuted = true; break; }
      }
      undoMove(s);
      if (!refuted) return i;
    }
    return null;
  }

  const base = s.history.length;
  try {
    const i = attack(maxDepth);
    return i === null ? null : { x: i % SIZE, y: (i - (i % SIZE)) / SIZE };
  } catch (e) {
    // Out of time mid-search: take back every move the search had tried.
    while (s.history.length > base) undoMove(s);
    if (e instanceof Timeout) return null;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Alpha-beta search

class Searcher {
  constructor(s, cfg) {
    this.s = s;
    this.cfg = cfg;
    this.tt = new Map();
    this.nodes = 0;
    this.deadline = Infinity;
    this.killers = [];
    this.h1 = 0; this.h2 = 0;
    for (let i = 0; i < s.board.length; i++) if (s.board[i]) this.toggle(i, s.board[i]);
    if (s.toMove === 2) { this.h1 ^= Z.side[0]; this.h2 ^= Z.side[1]; }
    this.stack = [];
  }
  toggle(i, p) { const k = i * 3 + p; this.h1 ^= Z.a[k]; this.h2 ^= Z.b[k]; }
  key() {
    const s = this.s;
    const c1 = Z.cap[s.captured[1] & 63], c2 = Z.cap[(s.captured[2] + 17) & 63];
    const h1 = (this.h1 ^ c1[0] ^ c2[1] ^ (s.banked[1].length * 0x45d9f3b) ^ (s.banked[2].length * 0x119de1f3)) >>> 0;
    const h2 = (this.h2 ^ c1[1] ^ c2[0]) >>> 0;
    return h1 * 2097152 + (h2 & 0x1fffff);
  }
  make(x, y) {
    const rec = applyMove(this.s, x, y);
    this.stack.push([this.h1, this.h2]);
    const i = idx(x, y);
    this.toggle(i, rec.player);
    const opp = other(rec.player);
    for (const c of rec.captured) this.toggle(c, opp);
    for (const c of rec.poofed) this.toggle(c, rec.player);
    this.h1 ^= Z.side[0]; this.h2 ^= Z.side[1];
    return rec;
  }
  unmake() {
    undoMove(this.s);
    [this.h1, this.h2] = this.stack.pop();
  }

  negamax(depth, alpha, beta, ply) {
    const s = this.s;
    if ((++this.nodes & 511) === 0 && now() > this.deadline) throw new Timeout();
    if (s.winner !== null || depth <= 0) {
      const e = evaluate(s);
      return e >= NEAR_WIN ? e - ply : e <= -NEAR_WIN ? e + ply : e;
    }
    const key = this.key();
    const hit = this.tt.get(key);
    let ttMove = null;
    if (hit) {
      ttMove = hit.m;
      if (hit.d >= depth) {
        if (hit.f === 0) return hit.v;
        if (hit.f === 1 && hit.v >= beta) return hit.v;
        if (hit.f === -1 && hit.v <= alpha) return hit.v;
      }
    }
    const width = Math.max(5, this.cfg.width - Math.floor(ply / 2));
    const killers = this.killers[ply] || [];
    const moves = orderedMoves(s, s.toMove, width, killers, ttMove);
    const alpha0 = alpha;
    let best = -Infinity, bestMove = null;
    for (const m of moves) {
      this.make(m.x, m.y);
      const val = -this.negamax(depth - 1, -beta, -alpha, ply + 1);
      this.unmake();
      if (val > best) { best = val; bestMove = [m.x, m.y]; }
      if (best > alpha) alpha = best;
      if (alpha >= beta) {
        const k = this.killers[ply] || (this.killers[ply] = []);
        if (!k.some((q) => q[0] === m.x && q[1] === m.y)) { k.unshift([m.x, m.y]); k.length = Math.min(k.length, 2); }
        break;
      }
    }
    if (best === -Infinity) return evaluate(s);
    if (this.tt.size > 300000) this.tt.clear();
    this.tt.set(key, { d: depth, v: best, f: best <= alpha0 ? -1 : best >= beta ? 1 : 0, m: bestMove });
    return best;
  }
}

// ---------------------------------------------------------------------------
// Choosing a move

/**
 * Pick a move for the side to move.
 * @param {object} state  game state (not modified)
 * @param {number} level  1..5
 * @param {() => number} rng  random source (injectable for tests)
 * @param {{ timeScale?: number }} opts  timeScale < 1 speeds the bot up (tests)
 * @returns {{x: number, y: number}}
 */
export function chooseMove(state, level = 2, rng = Math.random, opts = {}) {
  const cfg = LEVELS[level] || LEVELS[2];
  const s = cloneState(state);
  const me = s.toMove;
  const opp = other(me);
  const v = s.variant;
  const started = now();
  const budget = (cfg.time || 0) * (opts.timeScale ?? 1);
  const deadline = started + budget;

  const candidates = nearbyMoves(s, 2);
  if (candidates.length === 1) return { x: candidates[0][0], y: candidates[0][1] };

  // 1. Take a win if there is one (Pip sometimes misses it).
  const wins = winningPointsFor(s, me);
  if (wins.length && rng() >= (cfg.missWin || 0)) return { x: wins[0][0], y: wins[0][1] };
  const theirWins = winningPointsFor(s, opp);

  // Pip: greedy with noise and blind spots.
  if (cfg.kind === 'greedy') {
    const blind = rng() < cfg.missThreat;
    if (theirWins.length && !blind) return { x: theirWins[0][0], y: theirWins[0][1] };
    const scored = candidates.map(([x, y]) => ({ x, y, q: quickScore(s, x, y, me, { ignoreDefence: blind }) }));
    scored.sort((a, b) => b.q - a.q);
    const pool = scored.slice(0, 6);
    const top = Math.max(1, Math.abs(pool[0].q));
    let best = pool[0], bestVal = -Infinity;
    for (const m of pool) {
      const val = m.q + (rng() - 0.5) * cfg.noise * top * 2;
      if (val > bestVal) { bestVal = val; best = m; }
    }
    return { x: best.x, y: best.y };
  }

  const vcfOk = fiveWinsOutright(v);
  // 2. A forced win by continuous fours.
  if (cfg.vcf && vcfOk && !theirWins.length) {
    const m = findVCF(s, me, cfg.vcf, Math.min(deadline, now() + budget * 0.3));
    if (m) return m;
  }

  let root = orderedMoves(s, me, cfg.rootWidth, theirWins);

  // 3. Stop the opponent's forced win, if they have one.
  if (cfg.vcfDefend && vcfOk && !theirWins.length) {
    s.toMove = opp;
    const threat = findVCF(s, opp, cfg.vcf, now() + budget * 0.15);
    s.toMove = me;
    if (threat) {
      const extra = [[threat.x, threat.y], ...captureMoves(s, me).map((i) => [i % SIZE, (i - (i % SIZE)) / SIZE])];
      const pool = orderedMoves(s, me, cfg.rootWidth + 6, extra);
      const safe = [];
      for (const m of pool) {
        if (now() > started + budget * 0.6) break;
        applyMove(s, m.x, m.y);
        const still = s.winner === null && findVCF(s, opp, cfg.vcf, now() + 60, 4000);
        undoMove(s);
        if (!still) safe.push(m);
      }
      if (safe.length) root = safe;
    }
  }

  // 4. Iterative-deepening alpha-beta over the root moves.
  const searcher = new Searcher(s, cfg);
  searcher.deadline = deadline;
  let results = root.map((m) => ({ x: m.x, y: m.y, val: m.q }));
  let completed = null;
  const margin = (best) => Math.max(40, Math.abs(best) * cfg.noise);
  try {
    for (let depth = 1; depth <= cfg.depth; depth++) {
      const out = [];
      let best = -Infinity;
      for (const m of results) {
        searcher.make(m.x, m.y);
        const floor = best === -Infinity ? -Infinity : best - margin(best);
        const val = -searcher.negamax(depth - 1, -Infinity, -floor, 1);
        searcher.unmake();
        out.push({ x: m.x, y: m.y, val });
        if (val > best) best = val;
      }
      out.sort((a, b) => b.val - a.val);
      results = out;
      completed = out;
      if (Math.abs(out[0].val) >= NEAR_WIN) break; // a forced result is known
      if (now() > started + budget * 0.55) break; // the next depth would not finish
    }
  } catch (e) {
    if (!(e instanceof Timeout)) throw e;
    // Out of time mid-search: take back every move the search had tried.
    while (searcher.stack.length) searcher.unmake();
  }
  const final = completed || results;
  final.sort((a, b) => b.val - a.val);
  const bestVal = final[0].val;
  const close = Math.abs(bestVal) < NEAR_WIN && cfg.noise > 0
    ? final.filter((r) => r.val >= bestVal - margin(bestVal))
    : [final[0]];
  const pick = close[Math.floor(rng() * close.length)] || final[0];
  if (!isLegal(state, pick.x, pick.y)) {
    const fallback = final.find((r) => isLegal(state, r.x, r.y)) || { x: candidates[0][0], y: candidates[0][1] };
    return { x: fallback.x, y: fallback.y };
  }
  return { x: pick.x, y: pick.y };
}

// ---------------------------------------------------------------------------
// Analysis for game review

/** Winning chances (0..1) for the side a score belongs to. */
export function winChance(score) {
  if (score >= NEAR_WIN / 2) return 0.995;
  if (score <= -NEAR_WIN / 2) return 0.005;
  return 1 / (1 + Math.exp(-score / 1500));
}
export const FORCED = NEAR_WIN / 2;

/**
 * Analyse one position: the engine's best move and score, and the score of the move actually
 * played, both from the same search (iterative deepening within a time budget) so they can be
 * compared fairly. Also checks whether the played move hands the opponent a forced win.
 * Scores are from the point of view of the side to move.
 */
export function analysePosition(state, played = null, { timeMs = 400, maxDepth = 8, rootWidth = 12, width = 8, vcfDepth = 10 } = {}) {
  const s = cloneState(state);
  if (s.winner !== null) {
    const score = s.winner === s.toMove ? WIN : s.winner === 0 ? 0 : -WIN;
    return { best: null, bestScore: score, playedScore: null, forcedWin: false, allowsForced: null };
  }
  const started = now();
  const me = s.toMove;
  const opp = other(me);
  const same = (m) => played && m && m[0] === played[0] && m[1] === played[1];
  const vcfOk = fiveWinsOutright(s.variant);

  // Does a move hand the opponent a forced win by continuous fours?
  const allowsForced = (m) => {
    if (!vcfOk) return null;
    applyMove(s, m[0], m[1]);
    const r = s.winner === null ? findVCF(s, opp, vcfDepth, now() + 150, 8000) : null;
    undoMove(s);
    return r;
  };

  // Immediate win.
  const wins = winningPointsFor(s, me);
  if (wins.length) {
    let playedScore = null, allows = null;
    if (played) {
      if (wins.some((w) => same(w))) playedScore = WIN;
      else {
        applyMove(s, played[0], played[1]);
        playedScore = -evaluateDeep(s, 3, width);
        undoMove(s);
        allows = allowsForced(played);
        if (allows) playedScore = Math.min(playedScore, -NEAR_WIN);
      }
    }
    return { best: wins[0], bestScore: WIN, playedScore, forcedWin: true, allowsForced: allows ? [allows.x, allows.y] : null };
  }

  // Forced win by continuous fours for the side to move.
  const vcf = vcfOk ? findVCF(s, me, vcfDepth, now() + 300, 20000) : null;

  const theirWins = winningPointsFor(s, opp);
  const extra = theirWins.slice();
  if (played) extra.push(played);
  if (vcf) extra.push([vcf.x, vcf.y]);
  let results = orderedMoves(s, me, rootWidth, extra).map((m) => ({ x: m.x, y: m.y, val: m.q }));
  const searcher = new Searcher(s, { width });
  searcher.deadline = started + timeMs;
  let completed = null;
  try {
    for (let depth = 2; depth <= maxDepth; depth++) {
      const out = [];
      for (const m of results) {
        searcher.make(m.x, m.y);
        const val = -searcher.negamax(depth - 1, -Infinity, Infinity, 1);
        searcher.unmake();
        out.push({ x: m.x, y: m.y, val });
      }
      out.sort((a, b) => b.val - a.val);
      results = out;
      completed = out;
      if (Math.abs(out[0].val) >= NEAR_WIN || now() > started + timeMs * 0.45) break;
    }
  } catch (e) {
    if (!(e instanceof Timeout)) throw e;
    while (searcher.stack.length) searcher.unmake();
  }
  const final = completed || results;
  let best = [final[0].x, final[0].y];
  let bestScore = final[0].val;
  const playedRow = played ? final.find((r) => same([r.x, r.y])) : null;
  let playedScore = playedRow ? playedRow.val : null;
  if (vcf) {
    bestScore = Math.max(bestScore, NEAR_WIN);
    best = [vcf.x, vcf.y];
    if (same(best)) playedScore = NEAR_WIN;
  }

  // The opponent's best answer to the played move, from the search's memory.
  let reply = null;
  if (played && s.winner === null) {
    searcher.make(played[0], played[1]);
    const hit = searcher.tt.get(searcher.key());
    if (hit && hit.m && s.winner === null) reply = hit.m;
    searcher.unmake();
  }

  // A played move that hands over a forced win is losing, unless the best move does too.
  let allows = null;
  if (played && !same(best) && playedScore !== null && playedScore < NEAR_WIN) {
    allows = allowsForced(played);
    if (allows && !allowsForced(best)) playedScore = Math.min(playedScore, -NEAR_WIN);
    else if (allows) allows = null;
  }
  return { best, bestScore, playedScore, forcedWin: !!vcf, allowsForced: allows ? [allows.x, allows.y] : null, reply };
}

function evaluateDeep(s, depth, width) {
  if (depth <= 0 || s.winner !== null) return evaluate(s);
  const searcher = new Searcher(s, { width });
  return searcher.negamax(depth, -Infinity, Infinity, 0);
}
