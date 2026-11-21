// Connect6 bot and analysis. No DOM: runs in the page, the bot's Web Worker and Node tests.
//
// Connect6: the first player places one stone, then each turn is two stones; six or more in a
// row wins; no captures. The usual way to think about it is in "windows": any six points in a
// line. A window holding only your stones is a chance; with four or five of them you can finish
// it this turn (you have two stones). The opponent's windows with four or more are threats you
// must cover with your two stones, or you lose.
//
// The bot plans a whole turn (both stones) at once and plays them one by one.

import { SIZE, EMPTY, P1, P2, idx, other, isLegal, firstOfTurn, cloneState, applyMove, undoMove } from './rules.js';

// Every window of six points, and the windows each point belongs to.
const WINDOWS = [];
const CELL_WINDOWS = Array.from({ length: SIZE * SIZE }, () => []);
for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const ex = x + dx * 5, ey = y + dy * 5;
    if (ex < 0 || ey < 0 || ex >= SIZE || ey >= SIZE) continue;
    const cells = [];
    for (let k = 0; k < 6; k++) cells.push(idx(x + dx * k, y + dy * k));
    const w = WINDOWS.length;
    WINDOWS.push(cells);
    for (const c of cells) CELL_WINDOWS[c].push(w);
  }
}

// Value of a window holding n of your stones and none of the opponent's.
const W = [0, 1, 10, 60, 400, 900, 0];
export const C6_WIN = 1e6;

function counts(board, w) {
  let a = 0, b = 0;
  for (const c of WINDOWS[w]) { const v = board[c]; if (v === P1) a++; else if (v === P2) b++; }
  return [a, b];
}

/** Static score of the board for `me` (positive = good for me). */
export function c6Evaluate(board, me) {
  let score = 0;
  for (let w = 0; w < WINDOWS.length; w++) {
    const [a, b] = counts(board, w);
    const mine = me === P1 ? a : b, theirs = me === P1 ? b : a;
    if (mine && !theirs) score += W[mine];
    else if (theirs && !mine) score -= W[theirs] * 1.1;
  }
  return score;
}

/** Windows where `p` needs at most `need` more stones (and the opponent has none). */
export function liveWindows(board, p, minStones) {
  const out = [];
  for (let w = 0; w < WINDOWS.length; w++) {
    const [a, b] = counts(board, w);
    const mine = p === P1 ? a : b, theirs = p === P1 ? b : a;
    if (!theirs && mine >= minStones && mine < 6) out.push(w);
  }
  return out;
}

const emptiesOf = (board, w) => WINDOWS[w].filter((c) => board[c] === EMPTY);

/** Stones left in the current turn for the side to move (1 or 2). */
export function stonesLeft(s) {
  if (s.ply === 0) return 1;
  return firstOfTurn(s.variant, s.ply) ? 2 : 1;
}

/** Points where the side to move finishes six this turn (one stone or two). */
export function c6WinNow(s) {
  const me = s.toMove;
  const left = stonesLeft(s);
  for (const w of liveWindows(s.board, me, 6 - left)) {
    const e = emptiesOf(s.board, w);
    if (e.length <= left) return e;
  }
  return null;
}

/**
 * Threat windows of the opponent (they could finish six on their next turn), and the fewest
 * stones that cover them all, found greedily.
 */
export function c6Threats(board, them) {
  const wins = liveWindows(board, them, 4);
  const left = new Set(wins);
  const cover = [];
  while (left.size) {
    let best = -1, bestHit = 0;
    const tally = new Map();
    for (const w of left) for (const c of emptiesOf(board, w)) tally.set(c, (tally.get(c) || 0) + 1);
    for (const [c, n] of tally) if (n > bestHit) { bestHit = n; best = c; }
    if (best < 0) break;
    cover.push(best);
    for (const w of [...left]) if (WINDOWS[w].includes(best)) left.delete(w);
  }
  return { windows: wins, cover };
}

function nearbyEmpties(board, dist = 2) {
  const mark = new Uint8Array(SIZE * SIZE);
  let any = false;
  for (let i = 0; i < board.length; i++) {
    if (board[i] === EMPTY) continue;
    any = true;
    const x = i % SIZE, y = (i - x) / SIZE;
    for (let dy = -dist; dy <= dist; dy++) for (let dx = -dist; dx <= dist; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && board[idx(nx, ny)] === EMPTY) mark[idx(nx, ny)] = 1;
    }
  }
  if (!any) return [idx(9, 9)];
  const out = [];
  for (let i = 0; i < mark.length; i++) if (mark[i]) out.push(i);
  return out;
}

// How much a single stone at c changes things for `me` (attack + defence), from its windows only.
function stoneGain(board, c, me) {
  let g = 0;
  for (const w of CELL_WINDOWS[c]) {
    const [a, b] = counts(board, w);
    const mine = me === P1 ? a : b, theirs = me === P1 ? b : a;
    if (!theirs) g += W[Math.min(5, mine + 1)] - W[mine];
    if (!mine && theirs) g += W[theirs] * 1.1;
  }
  return g;
}

const LEVEL_CFG = {
  1: { width: 6, noise: 0.6, pairs: false, reply: false, missThreat: 0.35 },
  2: { width: 8, noise: 0.3, pairs: true, reply: false, missThreat: 0.12 },
  3: { width: 10, noise: 0.12, pairs: true, reply: false, missThreat: 0 },
  4: { width: 12, noise: 0.04, pairs: true, reply: true, replyWidth: 6, replyBest: 6, missThreat: 0 },
  5: { width: 14, noise: 0, pairs: true, reply: true, replyWidth: 12, replyBest: 8, missThreat: 0 },
  reply: { width: 10, noise: 0, pairs: true, reply: false, missThreat: 0 },
};

/**
 * Plan the rest of the current turn for the side to move.
 * @returns {{ stones: number[], score: number }}  board indexes, in order; score for the mover
 */
export function planTurn(state, level = 3, rng = Math.random) {
  const cfg = LEVEL_CFG[level] || LEVEL_CFG[3];
  const s = state;
  const me = s.toMove, opp = other(me);
  const board = s.board;
  const left = stonesLeft(s);

  // 1. Finish six if we can.
  const win = c6WinNow(s);
  if (win) {
    const stones = win.slice();
    if (stones.length < left) {
      const extra = nearbyEmpties(board).find((c) => !stones.includes(c));
      if (extra !== undefined) stones.push(extra);
    }
    return { stones: stones.slice(0, left), score: C6_WIN };
  }

  // 2. Cover the opponent's threats (lower levels sometimes overlook them).
  const threats = c6Threats(board, opp);
  if (threats.windows.length && rng() >= cfg.missThreat) {
    const cells = [...new Set(threats.windows.flatMap((w) => emptiesOf(board, w)))];
    const covers = (set) => threats.windows.every((w) => WINDOWS[w].some((c) => set.includes(c)));
    let best = null, bestVal = -Infinity;
    if (left === 2) {
      const pool = cells.concat(topSingles(board, me, 8).filter((c) => !cells.includes(c)));
      for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) {
        const pair = [pool[i], pool[j]];
        if (!covers(pair)) continue;
        const val = scorePair(board, pair, me);
        if (val > bestVal) { bestVal = val; best = pair; }
      }
    } else {
      for (const c of cells) {
        if (!covers([c])) continue;
        const val = scorePair(board, [c], me);
        if (val > bestVal) { bestVal = val; best = [c]; }
      }
    }
    if (best) return { stones: best, score: bestVal };
    // Can't cover everything: block as much as possible (the game is probably lost).
    const cover = threats.cover.slice(0, left);
    while (cover.length < left) cover.push(topSingles(board, me, 1).find((c) => !cover.includes(c)));
    return { stones: cover, score: -C6_WIN / 2 };
  }

  // 3. Build: best single stones, then the best pair among them.
  const singles = topSingles(board, me, cfg.width);
  if (left === 1 || !cfg.pairs) {
    const pick = pickNoisy(singles.map((c) => ({ stones: [c], val: scorePair(board, [c], me) })), cfg.noise, rng);
    if (left === 2) {
      const second = topSingles(withStones(board, pick.stones, me), me, 1)[0];
      return { stones: [pick.stones[0], second], score: pick.val };
    }
    return { stones: pick.stones, score: pick.val };
  }
  let options = [];
  for (let i = 0; i < singles.length; i++) for (let j = i + 1; j < singles.length; j++) {
    const pair = [singles[i], singles[j]];
    options.push({ stones: pair, val: scorePair(board, pair, me) });
  }
  options.sort((a, b) => b.val - a.val);
  options = options.slice(0, 12);
  // Strong levels look at the opponent's best answer to the top few pairs.
  if (cfg.reply) {
    options = options.slice(0, cfg.replyWidth);
    for (const o of options) {
      const after = withStones(board, o.stones, me);
      const theirWin = liveWindows(after, opp, 4).length > 0;
      if (theirWin) { o.val = -C6_WIN / 2; continue; }
      const mine = c6Threats(after, me);
      // Two or more separate threats need more than two stones to stop: a win next turn.
      if (mine.cover.length >= 3) { o.val = C6_WIN / 2; continue; }
      // The opponent answers with a solid plan of their own (blocks first), then we judge the result.
      const reply = planTurn({ board: after, toMove: opp, ply: s.ply + left, variant: s.variant }, 'reply', () => 0.5);
      const b2 = withStones(after, reply.stones, opp);
      let v = c6Evaluate(b2, me);
      const myThreats = c6Threats(b2, me);
      if (myThreats.cover.length >= 3) v += C6_WIN / 4;
      else v += myThreats.windows.length * 150;
      if (c6Threats(b2, opp).cover.length >= 3) v -= C6_WIN / 4;
      o.val = v;
    }
    options.sort((a, b) => b.val - a.val);
  }
  const pick = pickNoisy(options, cfg.noise, rng);
  return { stones: pick.stones, score: pick.val };
}

function withStones(board, stones, p) {
  const b = board.slice();
  for (const c of stones) b[c] = p;
  return b;
}

function scorePair(board, stones, me) {
  const b = withStones(board, stones, me);
  let v = c6Evaluate(b, me);
  const mine = c6Threats(b, me);
  if (mine.cover.length >= 3) v += C6_WIN / 4; // more threats than the opponent has stones
  else v += mine.windows.length * 150;
  return v;
}

function topSingles(board, me, n) {
  return nearbyEmpties(board)
    .map((c) => ({ c, g: stoneGain(board, c, me) }))
    .sort((a, b) => b.g - a.g)
    .slice(0, n)
    .map((o) => o.c);
}

function pickNoisy(options, noise, rng) {
  if (!options.length) return { stones: [], val: 0 };
  const sorted = options.slice().sort((a, b) => b.val - a.val);
  if (!noise) return sorted[0];
  const top = Math.max(1, Math.abs(sorted[0].val));
  let best = sorted[0], bestVal = -Infinity;
  for (const o of sorted.slice(0, 6)) {
    const v = o.val + (rng() - 0.5) * noise * top * 2;
    if (v > bestVal) { bestVal = v; best = o; }
  }
  return best;
}

/** The next stone for the side to move: { x, y }. */
export function c6Move(state, level = 3, rng = Math.random) {
  const { stones } = planTurn(state, level, rng);
  for (const c of stones) {
    const x = c % SIZE, y = (c - x) / SIZE;
    if (isLegal(state, x, y)) return { x, y };
  }
  const any = nearbyEmpties(state.board).find((c) => isLegal(state, c % SIZE, (c - (c % SIZE)) / SIZE));
  return { x: any % SIZE, y: (any - (any % SIZE)) / SIZE };
}

// Map the heuristic onto the same scale the review uses for Pente scores.
const toScore = (v) => (Math.abs(v) >= C6_WIN / 4 ? Math.sign(v) * 50000 : v * 2);

/**
 * Analysis of one position for game review (same shape as ai.js analysePosition).
 * Scores are for the side to move.
 */
export function c6Analyse(state, played = null) {
  const s = cloneState(state);
  if (s.winner !== null) return { best: null, bestScore: s.winner === s.toMove ? 100000 : s.winner === 0 ? 0 : -100000, playedScore: null, forcedWin: false, allowsForced: null };
  const me = s.toMove;
  const plan = planTurn(s, 5, () => 0.5);
  const best = plan.stones[0];
  const bestXY = [best % SIZE, (best - (best % SIZE)) / SIZE];
  const afterScore = (c) => {
    const x = c % SIZE, y = (c - x) / SIZE;
    if (!isLegal(s, x, y)) return null;
    applyMove(s, x, y);
    let v;
    if (s.winner !== null) v = s.winner === me ? C6_WIN : -C6_WIN;
    else if (s.toMove === me) v = planTurn(s, 5, () => 0.5).score;
    else v = -planTurn(s, 4, () => 0.5).score;
    undoMove(s);
    return v;
  };
  // Score the best stone and the played stone the same way.
  const bestVal = afterScore(best);
  const playedVal = played ? afterScore(idx(played[0], played[1])) : null;
  const bestScore = toScore(Math.max(bestVal ?? plan.score, playedVal ?? -Infinity));
  return {
    best: bestXY, bestScore,
    playedScore: playedVal === null ? null : toScore(playedVal),
    forcedWin: (bestVal ?? 0) >= C6_WIN / 4, allowsForced: null,
  };
}
