// The practice bot. Version 1: pattern scoring plus a short alpha-beta search.
// It works for every variant because it plays through the same rules engine.
// Later milestones replace this with a stronger, capture-aware threat search.

import {
  SIZE, EMPTY, AXES, DIRS8, idx, inBounds, other,
  applyMove, undoMove, cloneState, nearbyMoves, capturesAt, winningPointsFor,
} from './rules.js';

export const LEVELS = {
  1: { name: 'Pip', title: 'Novice', blurb: 'Plays loosely and often misses threats. Good for learning the rules.',
       depth: 0, noise: 0.9, missThreat: 0.45, missWin: 0.25 },
  2: { name: 'Juno', title: 'Apprentice', blurb: 'Sees simple threats and captures, but doesn\'t look far ahead.',
       depth: 2, rootWidth: 10, width: 8, noise: 0.12, missThreat: 0, missWin: 0 },
  3: { name: 'Ludo', title: 'Tactician', blurb: 'Looks several moves ahead and punishes open pairs.',
       depth: 4, rootWidth: 12, width: 7, noise: 0.02, missThreat: 0, missWin: 0 },
};

const WIN = 10_000_000;
// Value of a 5-cell window holding n of one player's stones and none of the other's.
const WINDOW = [0, 1, 12, 120, 1500, 250000];

// ---------------------------------------------------------------------------
// Static evaluation, from the point of view of `me`.

function lineScores(board) {
  const score = [0, 0, 0];
  for (const [dx, dy] of AXES) {
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const ex = x + dx * 4, ey = y + dy * 4;
      if (!inBounds(ex, ey)) continue;
      let a = 0, b = 0;
      for (let k = 0; k < 5; k++) {
        const c = board[idx(x + dx * k, y + dy * k)];
        if (c === 1) a++; else if (c === 2) b++;
      }
      if (a && !b) score[1] += WINDOW[a];
      else if (b && !a) score[2] += WINDOW[b];
    }
  }
  return score;
}

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

// How many of p's stones the opponent could capture next move (a rough "open pairs" count).
function exposure(s, p) {
  const sizes = s.variant.captureSizes;
  if (!sizes.length) return 0;
  const opp = other(p);
  let n = 0;
  for (let i = 0; i < s.board.length; i++) {
    if (s.board[i] !== EMPTY) continue;
    const x = i % SIZE, y = (i - x) / SIZE;
    n += capturesAt(s.board, x, y, opp, sizes).length;
  }
  return n;
}

export function evaluate(s, me) {
  if (s.winner !== null) return s.winner === me ? WIN : s.winner === 0 ? 0 : -WIN;
  const opp = other(me);
  const v = s.variant;
  const lines = lineScores(s.board);
  // Once a five is banked in Five + Captures, more fives matter much less than captures.
  const lineWeight = (p) => (v.requireFiveAndCaptures && s.banked[p].length ? 0.25 : 1);
  let mine = lines[me] * lineWeight(me) + captureValue(s, me) + s.banked[me].length * 5000;
  let theirs = lines[opp] * lineWeight(opp) + captureValue(s, opp) + s.banked[opp].length * 5000;
  // Open pairs: worse if the opponent moves next.
  const toMoveIsOpp = s.toMove === opp;
  mine -= exposure(s, me) * (toMoveIsOpp ? 260 : 70);
  theirs -= exposure(s, opp) * (toMoveIsOpp ? 70 : 260);
  // The side to move has the tempo.
  return s.toMove === me ? mine * 1.1 - theirs : mine - theirs * 1.1;
}

// ---------------------------------------------------------------------------
// Quick per-move score, used to order and prune candidate moves.

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
      if (!theirs) { before += WINDOW[mine]; after += WINDOW[mine + 1]; }
    }
  }
  return after - before;
}

// Would placing p at (x, y) create a pair of p's that the opponent can capture right away?
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

function orderedMoves(s, me, width, extra = []) {
  const moves = nearbyMoves(s, 2).map(([x, y]) => ({ x, y, q: quickScore(s, x, y, me) }));
  moves.sort((a, b) => b.q - a.q);
  const top = moves.slice(0, width);
  for (const [x, y] of extra) {
    if (!top.some((m) => m.x === x && m.y === y)) top.push({ x, y, q: quickScore(s, x, y, me) });
  }
  return top;
}

// ---------------------------------------------------------------------------
// Search

function negamax(s, depth, alpha, beta, width, ply) {
  const me = s.toMove;
  if (s.winner !== null || depth === 0) {
    const e = evaluate(s, me);
    // Prefer quicker wins and slower losses.
    return e >= WIN ? e - ply : e <= -WIN ? e + ply : e;
  }
  let best = -Infinity;
  for (const m of orderedMoves(s, me, width)) {
    applyMove(s, m.x, m.y);
    const val = -negamax(s, depth - 1, -beta, -alpha, width, ply + 1);
    undoMove(s);
    if (val > best) best = val;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best === -Infinity ? evaluate(s, me) : best;
}

/**
 * Pick a move for the side to move.
 * @param {object} state  game state (not modified)
 * @param {number} level  1..3
 * @param {() => number} rng  random source (injectable for tests)
 * @returns {{x: number, y: number}}
 */
export function chooseMove(state, level = 2, rng = Math.random) {
  const cfg = LEVELS[level] || LEVELS[2];
  const s = cloneState(state);
  const me = s.toMove;
  const opp = other(me);

  const candidates = nearbyMoves(s, 2);
  if (candidates.length === 1) return { x: candidates[0][0], y: candidates[0][1] };

  // 1. Take a win if there is one (lower levels sometimes miss it).
  const wins = winningPointsFor(s, me);
  if (wins.length && rng() >= cfg.missWin) return { x: wins[0][0], y: wins[0][1] };

  // 2. Points the opponent would win on next move must be considered.
  const theirWins = winningPointsFor(s, opp);

  // Level 1: greedy with noise and blind spots.
  if (cfg.depth === 0) {
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

  // Levels 2+: alpha-beta over the most promising moves, always including blocks.
  const root = orderedMoves(s, me, cfg.rootWidth, theirWins);
  const results = [];
  for (const m of root) {
    applyMove(s, m.x, m.y);
    // Full window at the root so near-equal moves get exact scores.
    const val = -negamax(s, cfg.depth - 1, -Infinity, Infinity, cfg.width, 1);
    undoMove(s);
    results.push({ x: m.x, y: m.y, val });
  }
  results.sort((a, b) => b.val - a.val);
  // A little noise between near-equal moves keeps games varied.
  const bestVal = results[0].val;
  const margin = Math.max(50, Math.abs(bestVal) * cfg.noise);
  const close = results.filter((r) => r.val >= bestVal - margin && Math.abs(bestVal) < WIN / 2);
  const pick = close.length > 1 ? close[Math.floor(rng() * close.length)] : results[0];
  return { x: pick.x, y: pick.y };
}
