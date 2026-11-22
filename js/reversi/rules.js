// Reversi (played under the World Othello Federation rules). No DOM: runs in the page, the
// bot's Web Worker and Node tests.
//
// 8×8 board, cells 0..63 = row * 8 + column. Row 0 is the top row ("1"), column 0 is "a",
// so a1 is the top-left corner, as in WOF notation.
// Gold (1) plays the role of Black and moves first; Blue (2) is White.
// Start: d4 and e5 Blue, e4 and d5 Gold.
// A move must outflank at least one line of opposing discs (8 directions), and flips every
// outflanked line; no chain reactions. A player with no legal move passes; the game ends when
// neither can move. Empty squares count for the winner; a draw is 32–32.

export const N = 8;
export const EMPTY = 0, GOLD = 1, BLUE = 2;
export const PASS = -1;
export const other = (p) => (p === GOLD ? BLUE : GOLD);
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const COLS = 'abcdefgh';

export const cellName = (c) => (c === PASS ? 'pass' : COLS[c % N] + (Math.floor(c / N) + 1));
export function parseCell(name) {
  if (name === 'pass') return PASS;
  const c = COLS.indexOf(name[0].toLowerCase()), r = parseInt(name.slice(1), 10) - 1;
  if (c < 0 || r < 0 || r >= N) throw new Error('Bad square ' + name);
  return r * N + c;
}

// Neighbour table: for each cell and direction, the list of cells along that ray.
const RAYS = Array.from({ length: N * N }, (_, i) => {
  const x = i % N, y = Math.floor(i / N);
  return DIRS.map(([dx, dy]) => {
    const out = [];
    for (let k = 1; ; k++) {
      const nx = x + dx * k, ny = y + dy * k;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) break;
      out.push(ny * N + nx);
    }
    return out;
  });
});
export const NEIGHBOURS = Array.from({ length: N * N }, (_, i) => RAYS[i].filter((r) => r.length).map((r) => r[0]));

export function newGame() {
  const board = new Int8Array(N * N);
  board[parseCell('d4')] = BLUE; board[parseCell('e5')] = BLUE;
  board[parseCell('e4')] = GOLD; board[parseCell('d5')] = GOLD;
  return { board, toMove: GOLD, history: [], over: false };
}

export function cloneState(s) {
  return { board: s.board.slice(), toMove: s.toMove, history: s.history.slice(), over: s.over };
}

/** Discs `p` would flip by playing at `c` (empty list = not a legal move). */
export function flipsFor(board, c, p) {
  if (board[c] !== EMPTY) return [];
  const o = other(p);
  const out = [];
  for (const ray of RAYS[c]) {
    let k = 0;
    while (k < ray.length && board[ray[k]] === o) k++;
    if (k > 0 && k < ray.length && board[ray[k]] === p) for (let j = 0; j < k; j++) out.push(ray[j]);
  }
  return out;
}

export function canPlay(board, c, p) {
  if (board[c] !== EMPTY) return false;
  const o = other(p);
  for (const ray of RAYS[c]) {
    let k = 0;
    while (k < ray.length && board[ray[k]] === o) k++;
    if (k > 0 && k < ray.length && board[ray[k]] === p) return true;
  }
  return false;
}

export function movesFor(board, p) {
  const out = [];
  for (let c = 0; c < N * N; c++) if (canPlay(board, c, p)) out.push(c);
  return out;
}

/** Legal moves for the side to move: squares, or [PASS] when it has none (and the game isn't over). */
export function legalMoves(s) {
  if (s.over) return [];
  const m = movesFor(s.board, s.toMove);
  return m.length ? m : [PASS];
}

export function illegalReason(s, c) {
  if (s.over) return 'The game is over.';
  if (c === PASS) return movesFor(s.board, s.toMove).length ? 'You can only pass when you have no legal move.' : null;
  if (c < 0 || c >= N * N) return 'Off the board.';
  if (s.board[c] !== EMPTY) return 'That square is taken.';
  if (!canPlay(s.board, c, s.toMove)) return 'A move must trap at least one disc in a straight line.';
  return null;
}

/** Play a move (a square or PASS). Returns the history record. */
export function play(s, c) {
  const why = illegalReason(s, c);
  if (why) throw new Error(why + ' (' + cellName(c) + ')');
  const p = s.toMove;
  let flips = [];
  if (c !== PASS) {
    flips = flipsFor(s.board, c, p);
    s.board[c] = p;
    for (const f of flips) s.board[f] = p;
  }
  const rec = { move: c, player: p, flips };
  s.history.push(rec);
  s.toMove = other(p);
  // Game over when neither side can move.
  if (!movesFor(s.board, s.toMove).length && !movesFor(s.board, p).length) s.over = true;
  return rec;
}

export function undo(s) {
  const rec = s.history.pop();
  if (!rec) return null;
  if (rec.move !== PASS) {
    s.board[rec.move] = EMPTY;
    for (const f of rec.flips) s.board[f] = other(rec.player);
  }
  s.toMove = rec.player;
  s.over = false;
  return rec;
}

/** Play a move, passing first automatically if the side to move has no legal move. */
export function playWithPass(s, c) {
  const recs = [];
  if (!s.over && c !== PASS && !movesFor(s.board, s.toMove).length) recs.push(play(s, PASS));
  recs.push(play(s, c));
  return recs;
}

export function counts(board) {
  let g = 0, b = 0, e = 0;
  for (let i = 0; i < board.length; i++) { if (board[i] === GOLD) g++; else if (board[i] === BLUE) b++; else e++; }
  return { gold: g, blue: b, empty: e };
}

/** Final result: { winner (0 = draw), gold, blue } with empty squares given to the winner (WOF). */
export function result(s) {
  const { gold, blue, empty } = counts(s.board);
  if (gold === blue) return { winner: 0, gold: 32, blue: 32, raw: { gold, blue } };
  return gold > blue
    ? { winner: GOLD, gold: gold + empty, blue, raw: { gold, blue } }
    : { winner: BLUE, gold, blue: blue + empty, raw: { gold, blue } };
}

/** Rebuild a game from a list of moves (passes included). */
export function replay(moves) {
  const s = newGame();
  for (const m of moves) play(s, m);
  return s;
}

// Named squares
export const CORNERS = [0, 7, 56, 63];
export const X_SQUARES = { 9: 0, 14: 7, 49: 56, 54: 63 };                // X-square -> its corner
export const C_SQUARES = { 1: 0, 8: 0, 6: 7, 15: 7, 48: 56, 57: 56, 55: 63, 62: 63 };
export const isEdge = (c) => c < N || c >= N * (N - 1) || c % N === 0 || c % N === N - 1;

/** Discs next to at least one empty square. */
export function frontier(board, p) {
  let n = 0;
  for (let c = 0; c < N * N; c++) if (board[c] === p && NEIGHBOURS[c].some((d) => board[d] === EMPTY)) n++;
  return n;
}

/** Discs that can never be flipped (a safe under-estimate: grown from corners along full lines). */
export function stableDiscs(board, p) {
  const stable = new Uint8Array(N * N);
  let changed = true;
  // A disc is stable if, on each of the 4 axes, one side is the board edge or a stable disc of
  // the same colour, or the whole line on that axis is full.
  const lineFull = (c, dx, dy) => {
    const x = c % N, y = Math.floor(c / N);
    for (const s of [1, -1]) {
      for (let k = 1; ; k++) {
        const nx = x + dx * k * s, ny = y + dy * k * s;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) break;
        if (board[ny * N + nx] === EMPTY) return false;
      }
    }
    return true;
  };
  const anchored = (c, dx, dy) => {
    const x = c % N, y = Math.floor(c / N);
    for (const s of [1, -1]) {
      const nx = x + dx * s, ny = y + dy * s;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) return true;
      const d = ny * N + nx;
      if (board[d] === p && stable[d]) return true;
    }
    return false;
  };
  while (changed) {
    changed = false;
    for (let c = 0; c < N * N; c++) {
      if (board[c] !== p || stable[c]) continue;
      let ok = true;
      for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
        if (!anchored(c, dx, dy) && !lineFull(c, dx, dy)) { ok = false; break; }
      }
      if (ok) { stable[c] = 1; changed = true; }
    }
  }
  let n = 0;
  for (let c = 0; c < N * N; c++) n += stable[c];
  return n;
}

/** Empty regions (4-connected groups of empty squares) — used for parity in the endgame. */
export function emptyRegions(board) {
  const seen = new Uint8Array(N * N);
  const regions = [];
  for (let c = 0; c < N * N; c++) {
    if (board[c] !== EMPTY || seen[c]) continue;
    const cells = [];
    const stack = [c];
    seen[c] = 1;
    while (stack.length) {
      const d = stack.pop();
      cells.push(d);
      const x = d % N, y = Math.floor(d / N);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const e = ny * N + nx;
        if (board[e] === EMPTY && !seen[e]) { seen[e] = 1; stack.push(e); }
      }
    }
    regions.push(cells);
  }
  return regions;
}
