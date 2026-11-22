// Hex rules. No DOM: runs in the page, the bot's Web Worker and Node tests.
//
// An n×n rhombus of hexagons, cells 0..n²-1 = row * n + column. Row 0 is the top row ("1"),
// column 0 is "a". Gold moves first and connects the top and bottom edges; Blue connects the
// left and right edges. Stones never move and are never captured. Someone always wins: the board
// can't fill up without one side connecting.
// Swap rule (optional): right after Gold's first stone, Blue may swap instead of moving. The
// stone is mirrored across the long diagonal and becomes Blue's, and Gold moves next.

export const EMPTY = 0, GOLD = 1, BLUE = 2;
export const SWAP = -2;
export const other = (p) => (p === GOLD ? BLUE : GOLD);
const LETTERS = 'abcdefghijklmnopqrs';

const cache = new Map();
/** Neighbour lists for a board size. Neighbours of (r, c): (r, c±1), (r±1, c), (r-1, c+1), (r+1, c-1). */
export function geometry(n) {
  if (cache.has(n)) return cache.get(n);
  const nb = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const list = [];
    for (const [dr, dc] of [[0, -1], [0, 1], [-1, 0], [1, 0], [-1, 1], [1, -1]]) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < n && cc < n) list.push(rr * n + cc);
    }
    nb.push(list);
  }
  // Bridges: two cells sharing exactly two empty neighbours (the "carrier").
  const bridges = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const list = [];
    for (const [dr, dc, a, b] of [
      [-1, 2, [-1, 1], [0, 1]], [1, 1, [0, 1], [1, 0]], [2, -1, [1, 0], [1, -1]],
      [1, -2, [1, -1], [0, -1]], [-1, -1, [0, -1], [-1, 0]], [-2, 1, [-1, 0], [-1, 1]],
    ]) {
      const rr = r + dr, cc = c + dc;
      const ok = (x, y) => x >= 0 && y >= 0 && x < n && y < n;
      if (!ok(rr, cc) || !ok(r + a[0], c + a[1]) || !ok(r + b[0], c + b[1])) continue;
      list.push({ to: rr * n + cc, carrier: [(r + a[0]) * n + c + a[1], (r + b[0]) * n + c + b[1]] });
    }
    bridges.push(list);
  }
  const g = { n, nb, bridges };
  cache.set(n, g);
  return g;
}

export const cellName = (i, n) => (i === SWAP ? 'swap' : LETTERS[i % n] + (Math.floor(i / n) + 1));
export function parseCell(name, n) {
  if (name === 'swap') return SWAP;
  const c = LETTERS.indexOf(name[0].toLowerCase()), r = parseInt(name.slice(1), 10) - 1;
  if (c < 0 || c >= n || r < 0 || r >= n) throw new Error('Bad cell ' + name);
  return r * n + c;
}

export function newGame(n = 9, swap = true) {
  return { n, swap, board: new Int8Array(n * n), toMove: GOLD, history: [], winner: 0 };
}
export function cloneState(s) {
  return { n: s.n, swap: s.swap, board: s.board.slice(), toMove: s.toMove, history: s.history.slice(), winner: s.winner };
}

/** Has `p` connected its two edges? */
export function connected(board, n, p) {
  const { nb } = geometry(n);
  const seen = new Uint8Array(n * n);
  const stack = [];
  for (let k = 0; k < n; k++) {
    const start = p === GOLD ? k : k * n; // top row / left column
    if (board[start] === p) { seen[start] = 1; stack.push(start); }
  }
  while (stack.length) {
    const i = stack.pop();
    const r = Math.floor(i / n), c = i % n;
    if ((p === GOLD && r === n - 1) || (p === BLUE && c === n - 1)) return true;
    for (const j of nb[i]) if (!seen[j] && board[j] === p) { seen[j] = 1; stack.push(j); }
  }
  return false;
}

/** The cells of a winning chain (for highlighting), or []. */
export function winningChain(board, n, p) {
  const { nb } = geometry(n);
  const prev = new Int32Array(n * n).fill(-2);
  const queue = [];
  for (let k = 0; k < n; k++) {
    const start = p === GOLD ? k : k * n;
    if (board[start] === p) { prev[start] = -1; queue.push(start); }
  }
  while (queue.length) {
    const i = queue.shift();
    const r = Math.floor(i / n), c = i % n;
    if ((p === GOLD && r === n - 1) || (p === BLUE && c === n - 1)) {
      const out = [];
      for (let j = i; j !== -1; j = prev[j]) out.push(j);
      return out;
    }
    for (const j of nb[i]) if (prev[j] === -2 && board[j] === p) { prev[j] = i; queue.push(j); }
  }
  return [];
}

export const canSwap = (s) => s.swap && s.history.length === 1 && s.history[0].move !== SWAP && s.toMove === BLUE;

export function illegalReason(s, m) {
  if (s.winner) return 'The game is over.';
  if (m === SWAP) return canSwap(s) ? null : 'You can only swap right after Gold\'s first stone.';
  if (!Number.isInteger(m) || m < 0 || m >= s.n * s.n) return 'Off the board.';
  if (s.board[m] !== EMPTY) return 'That cell is taken.';
  return null;
}

export const mirror = (i, n) => (i % n) * n + Math.floor(i / n);

export function play(s, m) {
  const why = illegalReason(s, m);
  if (why) throw new Error(why + ' (' + cellName(m, s.n) + ')');
  const p = s.toMove;
  let swapped = null;
  if (m === SWAP) {
    swapped = s.history[0].move;
    s.board[swapped] = EMPTY;
    s.board[mirror(swapped, s.n)] = BLUE;
  } else s.board[m] = p;
  s.history.push({ move: m, player: p, swapped });
  s.toMove = other(p);
  if (m !== SWAP && connected(s.board, s.n, p)) s.winner = p;
  return s.history[s.history.length - 1];
}

export function undo(s) {
  const rec = s.history.pop();
  if (!rec) return null;
  if (rec.move === SWAP) { s.board[mirror(rec.swapped, s.n)] = EMPTY; s.board[rec.swapped] = GOLD; } else s.board[rec.move] = EMPTY;
  s.toMove = rec.player;
  s.winner = 0;
  return rec;
}

export function emptyCells(s) {
  const out = [];
  for (let i = 0; i < s.board.length; i++) if (s.board[i] === EMPTY) out.push(i);
  return out;
}

/**
 * Shortest path for `p` from edge to edge: empty cells cost 1, own stones 0, opponent stones
 * block. Returns { dist, path } (path = empty cells on one shortest route).
 */
export function shortestPath(board, n, p) {
  const { nb } = geometry(n);
  const INF = 1e9;
  const dist = new Array(n * n).fill(INF), prev = new Int32Array(n * n).fill(-1);
  const o = other(p);
  const dq = [];
  for (let k = 0; k < n; k++) {
    const i = p === GOLD ? k : k * n;
    if (board[i] === o) continue;
    dist[i] = board[i] === p ? 0 : 1;
    dq.push(i);
  }
  // 0-1 BFS with a simple bucket queue.
  const buckets = [[], []];
  for (const i of dq) buckets[dist[i]].push(i);
  let level = 0;
  const done = new Uint8Array(n * n);
  while (level < buckets.length) {
    const b = buckets[level];
    if (!b || !b.length) { level++; continue; }
    const i = b.pop();
    if (done[i] || dist[i] !== level) continue;
    done[i] = 1;
    for (const j of nb[i]) {
      if (board[j] === o) continue;
      const d = level + (board[j] === p ? 0 : 1);
      if (d < dist[j]) { dist[j] = d; prev[j] = i; (buckets[d] || (buckets[d] = [])).push(j); }
    }
  }
  let best = INF, end = -1;
  for (let k = 0; k < n; k++) {
    const i = p === GOLD ? (n - 1) * n + k : k * n + n - 1;
    if (dist[i] < best) { best = dist[i]; end = i; }
  }
  const path = [];
  for (let i = end; i !== -1 && best < INF; i = prev[i]) if (board[i] === EMPTY) path.push(i);
  return { dist: best, path };
}
