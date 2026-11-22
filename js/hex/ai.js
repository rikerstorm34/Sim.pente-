// Hex bots and analysis. No DOM: runs in the bot's Web Worker and in Node tests.
//
//   1 Pip    plays near the centre and its stones; usually spots a win or block in one
//   2 Juno   one move ahead: shortens its own shortest path and lengthens yours
//   3 Ludo   Monte Carlo tree search, short budget (~0.35 s)
//   4 Vega   Monte Carlo tree search, ~1 s
//   5 Orion  Monte Carlo tree search, ~2.5 s
// The search plays thousands of random games to the end ("playouts"), always saving a bridge
// when the opponent pushes into it, and shares statistics between moves that end up with the
// same owner (RAVE), which suits Hex because every cell gets filled.

import { EMPTY, GOLD, BLUE, SWAP, other, geometry, connected, canSwap, shortestPath, emptyCells } from './rules.js';

export const LEVELS = {
  1: { name: 'Pip', title: 'Novice' },
  2: { name: 'Juno', title: 'Apprentice' },
  3: { name: 'Ludo', title: 'Tactician' },
  4: { name: 'Vega', title: 'Strategist' },
  5: { name: 'Orion', title: 'Master' },
};

/** Empty cells where `p` connects at once. */
export function winningCells(board, n, p) {
  const out = [];
  const { dist } = shortestPath(board, n, p);
  if (dist !== 1) return out;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== EMPTY) continue;
    board[i] = p;
    if (connected(board, n, p)) out.push(i);
    board[i] = EMPTY;
  }
  return out;
}

/** Should Blue swap Gold's first stone? Central stones are strong; edge stones on Gold's own edges are weak. */
export function shouldSwap(first, n) {
  const r = Math.floor(first / n), c = first % n;
  const edge = Math.min(r, c, n - 1 - r, n - 1 - c);
  if (edge >= 2) return true;               // anything off the outer two rings
  if (r === 0 || r === n - 1) return false; // first row on Gold's own edge: weak
  return edge === 1 && (c >= 2 && c <= n - 3); // second ring, not near an acute corner
}

// ---------------------------------------------------------------------------
// Monte Carlo tree search with RAVE

function playout(board, n, toMove, rng, filledOut) {
  const { nb, bridges } = geometry(n);
  const b = board.slice();
  const empties = [];
  for (let i = 0; i < b.length; i++) if (b[i] === EMPTY) empties.push(i);
  for (let i = empties.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); const t = empties[i]; empties[i] = empties[j]; empties[j] = t; }
  let p = toMove, last = -1, k = 0;
  let left = empties.length;
  while (left > 0) {
    let move = -1;
    // Save a bridge the opponent just pushed into.
    if (last >= 0) {
      for (const a of nb[last]) {
        if (b[a] !== p) continue;
        for (const br of bridges[a]) {
          if (b[br.to] !== p) continue;
          const [x, y] = br.carrier;
          if (x === last && b[y] === EMPTY) { move = y; break; }
          if (y === last && b[x] === EMPTY) { move = x; break; }
        }
        if (move >= 0) break;
      }
    }
    if (move < 0) {
      while (b[empties[k]] !== EMPTY) k++;
      move = empties[k];
    }
    b[move] = p;
    left--;
    last = move;
    p = other(p);
  }
  if (filledOut) filledOut.set(b);
  return connected(b, n, GOLD) ? GOLD : BLUE;
}

class Node {
  constructor(move, mover, parent) {
    this.move = move; this.mover = mover; this.parent = parent;
    this.children = null; this.visits = 0; this.wins = 0; this.amafVisits = 0; this.amafWins = 0;
  }
}

/**
 * Search from a position.
 * @returns {{ root: Node, stats: Array<{move, visits, rate}> }} rate = win rate for the side to move
 */
export function mcts(s, { timeMs = 1000, maxPlayouts = Infinity, rng = Math.random } = {}) {
  const n = s.n;
  const root = new Node(-1, other(s.toMove), null);
  const deadline = Date.now() + timeMs;
  const board = s.board.slice();
  const final = new Int8Array(board.length);
  let playouts = 0;
  const K = 300;
  while (playouts < maxPlayouts && (playouts & 63 || Date.now() < deadline)) {
    // Selection / expansion
    const path = [root];
    let node = root, toMove = s.toMove;
    const placed = [];
    for (;;) {
      if (!node.children) {
        node.children = [];
        for (let i = 0; i < board.length; i++) if (board[i] === EMPTY) node.children.push(new Node(i, toMove, node));
        break;
      }
      if (!node.children.length) break;
      let best = null, bv = -Infinity;
      const logN = Math.log(node.visits + 1);
      for (const ch of node.children) {
        const q = ch.visits ? ch.wins / ch.visits : 0.5;
        const a = ch.amafVisits ? ch.amafWins / ch.amafVisits : 0.5;
        const beta = Math.sqrt(K / (3 * node.visits + K));
        const v = (1 - beta) * q + beta * a + 0.35 * Math.sqrt(logN / (ch.visits + 1));
        if (v > bv) { bv = v; best = ch; }
      }
      node = best;
      board[node.move] = toMove;
      placed.push(node.move);
      path.push(node);
      toMove = other(toMove);
      if (node.visits === 0) break;
    }
    // Playout (if someone already connected, the result is known)
    const winner = playout(board, n, toMove, rng, final);
    for (const m of placed) board[m] = EMPTY;
    playouts++;
    // Backpropagation with RAVE
    for (const nd of path) {
      nd.visits++;
      if (nd.mover === winner) nd.wins++;
      if (nd.children) {
        for (const ch of nd.children) {
          if (final[ch.move] === ch.mover) { ch.amafVisits++; if (ch.mover === winner) ch.amafWins++; }
        }
      }
    }
  }
  const stats = (root.children || []).map((ch) => ({ move: ch.move, visits: ch.visits, rate: ch.visits ? ch.wins / ch.visits : (ch.amafVisits ? ch.amafWins / ch.amafVisits : 0.5) }));
  stats.sort((a, b) => b.visits - a.visits);
  return { root, stats, playouts };
}

// ---------------------------------------------------------------------------

function nearCells(s) {
  const n = s.n;
  const { nb } = geometry(n);
  const out = new Set();
  for (let i = 0; i < s.board.length; i++) if (s.board[i] !== EMPTY) for (const j of nb[i]) if (s.board[j] === EMPTY) out.add(j);
  return [...out];
}

/** Moves that can't be ignored: win now, or the only block. Returns a move or null. */
export function urgentMove(s) {
  const n = s.n, p = s.toMove;
  const win = winningCells(s.board, n, p);
  if (win.length) return win[0];
  const threat = winningCells(s.board, n, other(p));
  if (threat.length) return threat[0];
  return null;
}

const MCTS_MS = { 3: 350, 4: 1000, 5: 2500 };

/** The bot's move for the side to move (a cell, or SWAP). */
export function chooseMove(s, level = 3, rng = Math.random) {
  const n = s.n, p = s.toMove;
  if (canSwap(s) && level >= 3 && shouldSwap(s.history[0].move, n)) return SWAP;
  const empties = emptyCells(s);
  if (!s.history.length && level >= 2) {
    // Opening: with the swap rule a balanced first stone; without it, near the centre.
    const c = (n - 1) / 2;
    // With the swap rule, a near-edge stone that is roughly fair (c2 or its half-turn image).
    if (s.swap) return rng() < 0.5 ? 1 * n + 2 : (n - 2) * n + (n - 3);
    return Math.round(c) * n + Math.round(c);
  }
  if (level <= 1) {
    if (rng() < 0.7) { const u = urgentMove(s); if (u !== null) return u; }
    const near = nearCells(s);
    const pool = near.length && rng() < 0.7 ? near : empties;
    const c = (n - 1) / 2;
    let best = pool[0], bv = -Infinity;
    for (const i of pool) {
      const r = Math.floor(i / n), q = i % n;
      const v = -Math.abs(r - c) - Math.abs(q - c) + rng() * 6;
      if (v > bv) { bv = v; best = i; }
    }
    return best;
  }
  const urgent = urgentMove(s);
  if (urgent !== null) return urgent;
  if (level === 2) {
    let best = empties[0], bv = -Infinity;
    for (const i of empties) {
      s.board[i] = p;
      const mine = shortestPath(s.board, n, p).dist, theirs = shortestPath(s.board, n, other(p)).dist;
      s.board[i] = EMPTY;
      const v = theirs * 1.1 - mine + rng() * 0.6;
      if (v > bv) { bv = v; best = i; }
    }
    return best;
  }
  const { stats } = mcts(s, { timeMs: MCTS_MS[level] || 1000, rng });
  return stats.length ? stats[0].move : empties[0];
}

/**
 * Analysis for review: winning chances for the side to move with the best move and with the
 * move played.
 */
export function analysePosition(s, played = null, { timeMs = 450 } = {}) {
  if (s.winner) return { best: null, bestChance: null, playedChance: null, forced: true };
  if (played === SWAP || canSwap(s)) {
    return { best: null, bestChance: null, playedChance: null, forced: true };
  }
  const n = s.n, p = s.toMove;
  const win = winningCells(s.board, n, p);
  if (win.length) {
    return { best: win[0], bestChance: 1, playedChance: played === null ? null : win.includes(played) ? 1 : null, forced: false, ...(played !== null && !win.includes(played) ? afterChance(s, played) : {}) };
  }
  const { stats } = mcts(s, { timeMs });
  const top = stats[0];
  const res = { best: top.move, bestChance: top.rate, playedChance: null, forced: false };
  if (played !== null) {
    const st = stats.find((x) => x.move === played);
    if (st && st.visits >= 40) res.playedChance = Math.min(st.rate, top.rate + 0.02);
    else Object.assign(res, afterChance(s, played));
  }
  return res;
}

function afterChance(s, played) {
  const t = { ...s, board: s.board.slice(), history: s.history.slice() };
  t.board[played] = s.toMove;
  if (connected(t.board, s.n, s.toMove)) return { playedChance: 1 };
  t.toMove = other(s.toMove);
  if (winningCells(t.board, s.n, t.toMove).length) return { playedChance: 0 };
  const { stats } = mcts(t, { timeMs: 160 });
  return { playedChance: stats.length ? 1 - stats[0].rate : 0.5 };
}

// ---------------------------------------------------------------------------
// Exact solver for small positions (puzzles): can the side to move force a win?

export function solve(s, { nodeLimit = 2e6 } = {}) {
  const n = s.n;
  const b = s.board.slice();
  let nodes = 0;
  const tt = new Map();
  function win(p) {
    if (++nodes > nodeLimit) throw new Error('too big');
    const key = b.join('') + p;
    if (tt.has(key)) return tt.get(key);
    const o = other(p);
    // Win now? (one empty cell short of a chain = a win in one)
    const mine = shortestPath(b, n, p);
    if (mine.dist <= 1) { tt.set(key, true); return true; }
    const empties = [];
    for (let i = 0; i < b.length; i++) if (b[i] === EMPTY) empties.push(i);
    // Must-block: if the opponent connects next move, only the blocking cells are worth trying.
    let cands = empties;
    if (shortestPath(b, n, o).dist === 1) {
      const theirs = [];
      for (const i of empties) { b[i] = o; if (connected(b, n, o)) theirs.push(i); b[i] = EMPTY; }
      if (theirs.length > 1) { tt.set(key, false); return false; }
      cands = theirs;
    }
    // Order: cells on our shortest path first.
    const sp = new Set(mine.path);
    const ordered = cands.slice().sort((x, y) => (sp.has(y) ? 1 : 0) - (sp.has(x) ? 1 : 0));
    for (const i of ordered) {
      b[i] = p;
      const ok = !win(o);
      b[i] = EMPTY;
      if (ok) { tt.set(key, true); return true; }
    }
    tt.set(key, false);
    return false;
  }
  /** Winning first moves for the side to move. */
  const p = s.toMove, o = other(p);
  const out = [];
  for (let i = 0; i < b.length; i++) {
    if (b[i] !== EMPTY) continue;
    b[i] = p;
    const ok = connected(b, n, p) || !win(o);
    b[i] = EMPTY;
    if (ok) out.push(i);
  }
  return { winning: out, nodes };
}
