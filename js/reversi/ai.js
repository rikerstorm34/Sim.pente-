// Reversi bots and analysis. No DOM: runs in the bot's Web Worker and in Node tests.
//
// Scores are in discs: roughly "how many discs ahead the side to move will finish".
// Midgame scores come from a hand-made evaluation (corners, X/C squares, mobility, frontier,
// stable discs, parity); near the end the search plays out every line and scores are exact.
//
// Levels (same names as the Pente bots):
//   1 Pip    random moves, often greedy (most discs flipped)
//   2 Juno   one move ahead on a square-value table
//   3 Ludo   3 moves ahead with mobility and corners; exact for the last 8 squares
//   4 Vega   up to ~0.8 s of iterative deepening; exact for the last 12 squares
//   5 Orion  up to ~1.6 s; exact for the last 16 squares

import { N, EMPTY, GOLD, BLUE, PASS, other, flipsFor, canPlay, movesFor, CORNERS, X_SQUARES, C_SQUARES, NEIGHBOURS, stableDiscs, counts } from './rules.js';

export const LEVELS = {
  1: { name: 'Pip', title: 'Novice' },
  2: { name: 'Juno', title: 'Apprentice' },
  3: { name: 'Ludo', title: 'Tactician' },
  4: { name: 'Vega', title: 'Strategist' },
  5: { name: 'Orion', title: 'Master' },
};

// Square values for the simplest bot and for move ordering.
const W = [
  100, -20, 10, 5, 5, 10, -20, 100,
  -20, -50, -2, -2, -2, -2, -50, -20,
  10, -2, 1, 1, 1, 1, -2, 10,
  5, -2, 1, 0, 0, 1, -2, 5,
  5, -2, 1, 0, 0, 1, -2, 5,
  10, -2, 1, 1, 1, 1, -2, 10,
  -20, -50, -2, -2, -2, -2, -50, -20,
  100, -20, 10, 5, 5, 10, -20, 100,
];
export const SQUARE_VALUE = W;

// ---------------------------------------------------------------------------
// Light board operations (no history) for the search.

function doMove(board, c, p) {
  const f = flipsFor(board, c, p);
  board[c] = p;
  for (const d of f) board[d] = p;
  return f;
}
function undoMove(board, c, p, f) {
  board[c] = EMPTY;
  const o = other(p);
  for (const d of f) board[d] = o;
}

/** Final disc difference for `p`, with empty squares given to the winner. */
export function finalDiff(board, p) {
  const { gold, blue, empty } = counts(board);
  const mine = p === GOLD ? gold : blue, theirs = p === GOLD ? blue : gold;
  if (mine > theirs) return mine + empty - theirs;
  if (theirs > mine) return mine - (theirs + empty);
  return 0;
}

function emptiesOf(board) {
  let e = 0;
  for (let i = 0; i < board.length; i++) if (board[i] === EMPTY) e++;
  return e;
}

/**
 * Static evaluation for `p` (in discs, roughly).
 * @param {boolean} full  include stable discs (slower; strong levels)
 */
export function evaluate(board, p, full = true) {
  const o = other(p);
  const e = emptiesOf(board);
  let v = 0;
  // Corners, and X/C squares next to an empty corner.
  for (const c of CORNERS) { if (board[c] === p) v += 14; else if (board[c] === o) v -= 14; }
  for (const x in X_SQUARES) {
    if (board[X_SQUARES[x]] !== EMPTY) continue;
    if (board[x] === p) v -= 7; else if (board[x] === o) v += 7;
  }
  for (const x in C_SQUARES) {
    if (board[C_SQUARES[x]] !== EMPTY) continue;
    if (board[x] === p) v -= 2.5; else if (board[x] === o) v += 2.5;
  }
  // Mobility (moves now) and frontier (potential mobility).
  const m = movesFor(board, p).length, mo = movesFor(board, o).length;
  v += 22 * (m - mo) / (m + mo + 2);
  let fp = 0, fo = 0;
  for (let c = 0; c < N * N; c++) {
    const d = board[c];
    if (d === EMPTY) continue;
    if (NEIGHBOURS[c].some((n) => board[n] === EMPTY)) { if (d === p) fp++; else fo++; }
  }
  v += 8 * (fo - fp) / (fo + fp + 2);
  if (full) v += 1.6 * (stableDiscs(board, p) - stableDiscs(board, o));
  // Discs matter only near the end.
  if (e < 16) {
    const { gold, blue } = counts(board);
    const diff = p === GOLD ? gold - blue : blue - gold;
    v += diff * (16 - e) / 16;
  }
  // Parity: with an odd number of empties the side to move should get the last move.
  if (e % 2 === 1) v += 1.5;
  return v;
}

// ---------------------------------------------------------------------------
// Search

class Timeout extends Error {}

function orderMoves(board, moves, p, deep) {
  if (!deep) return moves.slice().sort((a, b) => W[b] - W[a]);
  // Fastest-first: fewest replies for the opponent, then square value.
  const o = other(p);
  const scored = moves.map((c) => {
    const f = doMove(board, c, p);
    const replies = movesFor(board, o).length;
    undoMove(board, c, p, f);
    return { c, k: replies * 10 - W[c] / 10 };
  });
  scored.sort((a, b) => a.k - b.k);
  return scored.map((x) => x.c);
}

function makeSearch({ deadline = Infinity, nodeLimit = Infinity, fullEval = true } = {}) {
  let nodes = 0;
  const tick = () => {
    if ((++nodes & 1023) === 0 && (Date.now() > deadline || nodes > nodeLimit)) throw new Timeout();
  };
  // Negamax alpha-beta. depth counts moves; a pass doesn't use depth.
  function negamax(board, p, depth, alpha, beta, passed) {
    tick();
    const moves = movesFor(board, p);
    if (!moves.length) {
      if (passed) return finalDiff(board, p);
      return -negamax(board, other(p), depth, -beta, -alpha, true);
    }
    if (depth <= 0) return evaluate(board, p, fullEval);
    const ordered = orderMoves(board, moves, p, depth >= 3);
    let best = -Infinity;
    for (const c of ordered) {
      const f = doMove(board, c, p);
      const v = -negamax(board, other(p), depth - 1, -beta, -alpha, false);
      undoMove(board, c, p, f);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
  // Exact endgame: plays every line out to the end.
  function solve(board, p, alpha, beta, passed, empties) {
    tick();
    const moves = movesFor(board, p);
    if (!moves.length) {
      if (passed) return finalDiff(board, p);
      return -solve(board, other(p), -beta, -alpha, true, empties);
    }
    const ordered = empties > 6 ? orderMoves(board, moves, p, true) : moves;
    let best = -Infinity;
    for (const c of ordered) {
      const f = doMove(board, c, p);
      const v = -solve(board, other(p), -beta, -alpha, false, empties - 1);
      undoMove(board, c, p, f);
      if (v > best) best = v;
      if (v > alpha) alpha = v;
      if (alpha >= beta) break;
    }
    return best;
  }
  return { negamax, solve, nodes: () => nodes };
}

/**
 * Score every legal move for the side to move.
 * @returns {{ scores: Map<number, number>, exact: boolean, depth: number }}
 *   exact = scores are final disc differences (perfect play)
 */
export function scoreMoves(board, p, { timeMs = 400, maxDepth = 8, exactAt = 12, fullEval = true, nodeLimit = Infinity } = {}) {
  const moves = movesFor(board, p);
  const scores = new Map();
  if (!moves.length) return { scores, exact: false, depth: 0 };
  const b = board.slice();
  const empties = emptiesOf(b);
  const deadline = Date.now() + timeMs;
  if (empties <= exactAt) {
    // Exact: each move gets its true value (full window so values are exact, not bounds).
    try {
      const S = makeSearch({ deadline: deadline + timeMs * 3, nodeLimit, fullEval });
      for (const c of orderMoves(b, moves, p, true)) {
        const f = doMove(b, c, p);
        scores.set(c, -S.solve(b, other(p), -65, 65, false, empties - 1));
        undoMove(b, c, p, f);
      }
      return { scores, exact: true, depth: empties };
    } catch (err) {
      if (!(err instanceof Timeout)) throw err;
      // Too slow: fall back to the heuristic search below. Restore the board first.
      scores.clear();
      for (let i = 0; i < b.length; i++) b[i] = board[i];
    }
  }
  let depth = 1, done = null;
  for (; depth <= maxDepth; depth++) {
    const S = makeSearch({ deadline, nodeLimit, fullEval });
    const round = new Map();
    try {
      for (const c of orderMoves(b, moves, p, depth >= 3)) {
        const f = doMove(b, c, p);
        round.set(c, -S.negamax(b, other(p), depth - 1, -1000, 1000, false));
        undoMove(b, c, p, f);
      }
      done = round;
    } catch (err) {
      if (!(err instanceof Timeout)) throw err;
      for (let i = 0; i < b.length; i++) b[i] = board[i];
      break;
    }
    if (Date.now() > deadline) break;
  }
  if (!done) { // not even depth 1 finished: use the static evaluation
    done = new Map();
    for (const c of moves) {
      const f = doMove(b, c, p);
      done.set(c, -evaluate(b, other(p), fullEval));
      undoMove(b, c, p, f);
    }
  }
  return { scores: done, exact: false, depth: Math.max(1, depth - 1) };
}

const LEVEL_CFG = {
  3: { timeMs: 250, maxDepth: 3, exactAt: 8, fullEval: false, noise: 2 },
  4: { timeMs: 800, maxDepth: 9, exactAt: 12, fullEval: true, noise: 0.3 },
  5: { timeMs: 1600, maxDepth: 12, exactAt: 16, fullEval: true, noise: 0 },
};

/** The bot's move for the side to move (a square, or PASS). */
export function chooseMove(state, level = 3, rng = Math.random) {
  const p = state.toMove;
  const moves = movesFor(state.board, p);
  if (!moves.length) return PASS;
  if (level <= 1) {
    if (rng() < 0.45) {
      let best = moves[0], most = -1;
      for (const c of moves) { const n = flipsFor(state.board, c, p).length + rng(); if (n > most) { most = n; best = c; } }
      return best;
    }
    return moves[Math.floor(rng() * moves.length)];
  }
  if (level === 2) {
    let best = moves[0], bv = -Infinity;
    for (const c of moves) {
      const v = W[c] + flipsFor(state.board, c, p).length * 0.5 + rng() * 12;
      if (v > bv) { bv = v; best = c; }
    }
    return best;
  }
  const cfg = LEVEL_CFG[level] || LEVEL_CFG[4];
  const { scores } = scoreMoves(state.board, p, cfg);
  let best = moves[0], bv = -Infinity;
  for (const [c, v] of scores) {
    const vv = v + (rng() - 0.5) * 2 * cfg.noise;
    if (vv > bv) { bv = vv; best = c; }
  }
  return best;
}

/** Winning chances (0..1) for a disc score. */
export const winChance = (discs) => 1 / (1 + Math.exp(-discs / 7));

/**
 * Analysis of one position for game review and the coach.
 * @param {object} state  position before the move
 * @param {number|null} played  the move actually played (square or PASS)
 * @returns {{ best, bestScore, playedScore, exact, scores: Array<[number, number]> }}
 *   scores for the side to move, in discs
 */
export function analysePosition(state, played = null, { timeMs = 450 } = {}) {
  const p = state.toMove;
  const moves = movesFor(state.board, p);
  if (!moves.length) return { best: PASS, bestScore: null, playedScore: null, exact: false, scores: [] };
  const { scores, exact } = scoreMoves(state.board, p, { timeMs, maxDepth: 7, exactAt: 14, fullEval: true });
  let best = moves[0], bestScore = -Infinity;
  for (const [c, v] of scores) if (v > bestScore) { bestScore = v; best = c; }
  return {
    best, bestScore, exact,
    playedScore: played !== null && scores.has(played) ? scores.get(played) : null,
    scores: [...scores.entries()],
  };
}
