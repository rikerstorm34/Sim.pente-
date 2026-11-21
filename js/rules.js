// Rules engine for Pente and its variants.
// Pure logic: no DOM, so it runs in the page, in the bot's Web Worker and in Node tests.
//
// Board: 19×19, indexed by idx(x, y). x = column 0..18 (A..T without I), y = row 0..18 from the TOP
// (displayed row number = 19 - y). The centre point is (9, 9), "K10".

export const SIZE = 19;
export const CENTER = 9;
export const EMPTY = 0;
export const P1 = 1; // moves first (gold)
export const P2 = 2; // moves second (blue)

const COLS = 'ABCDEFGHJKLMNOPQRST';
export const AXES = [[1, 0], [0, 1], [1, 1], [1, -1]];
export const DIRS8 = AXES.concat(AXES.map(([dx, dy]) => [-dx, -dy]));

export const idx = (x, y) => y * SIZE + x;
export const xOf = (i) => i % SIZE;
export const yOf = (i) => (i - (i % SIZE)) / SIZE;
export const inBounds = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
export const other = (p) => (p === P1 ? P2 : P1);
export const coordName = (x, y) => COLS[x] + (SIZE - y);

export function parseCoord(name) {
  const x = COLS.indexOf(name[0].toUpperCase());
  const y = SIZE - parseInt(name.slice(1), 10);
  if (x < 0 || !inBounds(x, y)) throw new Error('Bad coordinate ' + name);
  return [x, y];
}

// ---------------------------------------------------------------------------
// Game state

/**
 * Create a new game.
 * @param {object} variant  a resolved variant config (see variants.js)
 */
export function newGame(variant) {
  return {
    variant,
    board: new Int8Array(SIZE * SIZE),
    toMove: P1,
    ply: 0,                 // stones placed so far by both players
    captured: [0, 0, 0],    // captured[p] = opponent stones player p has captured
    banked: [null, [], []], // banked[p] = list of fives player p has banked ({axis, cells})
    pendingFive: null,      // Boat rule: { player, cells } waiting to see if it survives one turn
    winner: null,           // P1, P2, or 0 for a draw
    winReason: null,        // 'five' | 'two-fives' | 'captures' | 'five-and-captures' | 'board-full'
    history: [],
  };
}

export function cloneState(s) {
  return {
    variant: s.variant,
    board: s.board.slice(),
    toMove: s.toMove,
    ply: s.ply,
    captured: s.captured.slice(),
    banked: [null, s.banked[1].slice(), s.banked[2].slice()],
    pendingFive: s.pendingFive,
    winner: s.winner,
    winReason: s.winReason,
    history: [],
  };
}

// Compact, JSON-safe snapshot (for saving games and talking to the bot worker).
export function toSnapshot(s) {
  return {
    variantId: s.variant.id,
    options: s.variant.options || {},
    board: Array.from(s.board),
    toMove: s.toMove,
    ply: s.ply,
    captured: s.captured.slice(),
    banked: [null, s.banked[1], s.banked[2]],
    pendingFive: s.pendingFive,
    winner: s.winner,
    winReason: s.winReason,
    moves: s.history.map((h) => [h.x, h.y]),
  };
}

export function fromSnapshot(snap, variant) {
  const s = newGame(variant);
  s.board = Int8Array.from(snap.board);
  s.toMove = snap.toMove;
  s.ply = snap.ply;
  s.captured = snap.captured.slice();
  s.banked = [null, (snap.banked[1] || []).slice(), (snap.banked[2] || []).slice()];
  s.pendingFive = snap.pendingFive;
  s.winner = snap.winner;
  s.winReason = snap.winReason;
  return s;
}

// Replays a list of moves from the start; gives back a state with full undo history.
export function replay(variant, moves) {
  const s = newGame(variant);
  for (const [x, y] of moves) applyMove(s, x, y);
  return s;
}

// ---------------------------------------------------------------------------
// Opening rules and legality

const cheb = (x, y) => Math.max(Math.abs(x - CENTER), Math.abs(y - CENTER));

/** Why a move is illegal, or null if it is legal. */
export function illegalReason(s, x, y) {
  if (s.winner !== null) return 'The game is over.';
  if (!inBounds(x, y)) return 'Off the board.';
  if (s.board[idx(x, y)] !== EMPTY) return 'That point is taken.';
  const opening = s.variant.opening;
  if (opening !== 'free' && s.ply === 0 && (x !== CENTER || y !== CENTER)) {
    return 'The first stone goes on the centre point.';
  }
  if ((opening === 'tournament' || opening === 'g-pente') && s.ply === 2) {
    if (cheb(x, y) < 3) return 'Tournament rule: your second stone must be at least 3 points from the centre.';
    if (opening === 'g-pente' && (x === CENTER || y === CENTER)) {
      const d = cheb(x, y);
      if (d === 3 || d === 4) return 'G-Pente rule: not 3 or 4 points from the centre along its row or column.';
    }
  }
  return null;
}

export const isLegal = (s, x, y) => illegalReason(s, x, y) === null;

export function legalMoves(s) {
  const out = [];
  if (s.winner !== null) return out;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (isLegal(s, x, y)) out.push([x, y]);
  return out;
}

// ---------------------------------------------------------------------------
// Captures

/**
 * Stones `player` would capture by placing at (x, y), on the board as it is.
 * Returns a flat list of board indexes. Does not change the board.
 */
// Stones that can't be captured: in Five + Captures, every stone of a banked five is safe.
export function lockedOf(s) {
  if (!s.variant || !s.variant.lockBankedFives) return null;
  const b1 = s.banked[1], b2 = s.banked[2];
  if (!b1.length && !b2.length) return null;
  const set = new Set();
  for (const f of b1) for (const c of f.cells) set.add(c);
  for (const f of b2) for (const c of f.cells) set.add(c);
  return set;
}

export function capturesAt(board, x, y, player, sizes, locked = null) {
  const out = [];
  if (!sizes || sizes.length === 0) return out;
  const opp = other(player);
  for (const [dx, dy] of DIRS8) {
    for (const n of sizes) {
      const ex = x + dx * (n + 1), ey = y + dy * (n + 1);
      if (!inBounds(ex, ey) || board[idx(ex, ey)] !== player) continue;
      let ok = true;
      for (let k = 1; k <= n; k++) {
        const c = idx(x + dx * k, y + dy * k);
        if (board[c] !== opp || (locked && locked.has(c))) { ok = false; break; }
      }
      if (ok) for (let k = 1; k <= n; k++) out.push(idx(x + dx * k, y + dy * k));
    }
  }
  return out;
}

// Poof rule: stones of `player` that become a bracketed group because `player` just played at (x, y).
function poofsAt(board, x, y, player, sizes) {
  const out = [];
  const opp = other(player);
  for (const [dx, dy] of AXES) {
    for (const n of sizes) {
      for (let k = 0; k < n; k++) {
        const sx = x - dx * k, sy = y - dy * k;
        const bx = sx - dx, by = sy - dy, ax = sx + dx * n, ay = sy + dy * n;
        if (!inBounds(bx, by) || !inBounds(ax, ay)) continue;
        if (board[idx(bx, by)] !== opp || board[idx(ax, ay)] !== opp) continue;
        let ok = true;
        for (let j = 0; j < n; j++) {
          const cx = sx + dx * j, cy = sy + dy * j;
          if (!inBounds(cx, cy) || board[idx(cx, cy)] !== player) { ok = false; break; }
        }
        if (ok) for (let j = 0; j < n; j++) out.push(idx(sx + dx * j, sy + dy * j));
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Lines

/** The full run of `player` stones through (x, y) along one axis, as a list of indexes. */
export function runThrough(board, x, y, player, axis) {
  const [dx, dy] = AXES[axis];
  if (board[idx(x, y)] !== player) return [];
  let sx = x, sy = y;
  while (inBounds(sx - dx, sy - dy) && board[idx(sx - dx, sy - dy)] === player) { sx -= dx; sy -= dy; }
  const cells = [];
  let cx = sx, cy = sy;
  while (inBounds(cx, cy) && board[idx(cx, cy)] === player) { cells.push(idx(cx, cy)); cx += dx; cy += dy; }
  return cells;
}

// A winning line: five in a row (six in Connect6). With overlineWins off, longer lines don't count.
function isFiveRun(len, variant) {
  const n = variant.lineToWin || 5;
  return variant.overlineWins ? len >= n : len === n;
}

/**
 * Who places stone number `ply` (0-based). Normally players alternate; in Connect6 (twoStones)
 * the first player places one stone, then each turn is two stones.
 */
export function moverOf(variant, ply) {
  if (!variant.twoStones) return ply % 2 === 0 ? P1 : P2;
  if (ply === 0) return P1;
  return ((ply - 1) >> 1) % 2 === 0 ? P2 : P1;
}

/** Connect6: is this the first stone of a two-stone turn? */
export const firstOfTurn = (variant, ply) => !variant.twoStones || ply === 0 || (ply - 1) % 2 === 0;

/** Fives (one per axis at most) that pass through (x, y) for `player`. */
export function fivesThrough(board, x, y, player, variant) {
  const out = [];
  for (let a = 0; a < 4; a++) {
    const cells = runThrough(board, x, y, player, a);
    if (isFiveRun(cells.length, variant)) out.push({ axis: a, cells });
  }
  return out;
}

/** Does `player` have any five anywhere? (Used for the Boat rule.) */
function lineStillIntact(board, cells, player) {
  return cells.every((i) => board[i] === player);
}

// Could `opp` (moving next) capture any stone in `cells`?
function canBreakByCapture(s, cells, owner) {
  const opp = other(owner);
  const sizes = s.variant.captureSizes;
  if (!sizes.length) return false;
  const set = new Set(cells);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (s.board[idx(x, y)] !== EMPTY) continue;
    const caps = capturesAt(s.board, x, y, opp, sizes, lockedOf(s));
    if (caps.some((i) => set.has(i))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Making and unmaking moves

/**
 * Place a stone for the side to move. Mutates `s` and returns an event record:
 * { x, y, player, captured: [indexes], poofed: [indexes], newFives: [...], winner, winReason }
 * Throws if the move is illegal.
 */
export function applyMove(s, x, y) {
  const why = illegalReason(s, x, y);
  if (why) throw new Error(why);
  const v = s.variant;
  const player = s.toMove;
  const opp = other(player);
  const here = idx(x, y);

  const record = {
    x, y, player,
    captured: [], poofed: [], newFives: [],
    prev: {
      toMove: s.toMove, ply: s.ply, captured: s.captured.slice(),
      banked: [null, s.banked[1].slice(), s.banked[2].slice()],
      pendingFive: s.pendingFive, winner: s.winner, winReason: s.winReason,
    },
  };

  s.board[here] = player;

  // Captures and poofs are both judged on the board right after the stone lands, then removed together.
  const caps = capturesAt(s.board, x, y, player, v.captureSizes, lockedOf(s));
  const poofs = v.poof ? poofsAt(s.board, x, y, player, v.captureSizes) : [];
  const capSet = [...new Set(caps)];
  const poofSet = [...new Set(poofs)];
  for (const i of capSet) s.board[i] = EMPTY;
  for (const i of poofSet) s.board[i] = EMPTY;
  s.captured[player] += capSet.length;
  s.captured[opp] += poofSet.length;
  record.captured = capSet;
  record.poofed = poofSet;

  s.ply += 1;
  s.toMove = v.twoStones ? moverOf(v, s.ply) : opp;

  decideWinner(s, record, x, y, player);
  s.history.push(record);
  return record;
}

function decideWinner(s, record, x, y, player) {
  const v = s.variant;
  const opp = other(player);
  const win = (who, reason) => { s.winner = who; s.winReason = reason; };

  // 1. Capture wins (not in variants that need a five as well).
  if (v.captureWinStones && !v.requireFiveAndCaptures) {
    const a = s.captured[player], b = s.captured[opp];
    const t = v.captureWinStones;
    if (a >= t || b >= t) {
      // Poof can push both players over the line on one move; ties play on until someone leads.
      if (a >= t && b >= t) {
        if (a > b) return finish(win(player, 'captures'));
        if (b > a) return finish(win(opp, 'captures'));
      } else if (a >= t) {
        return finish(win(player, 'captures'));
      } else {
        return finish(win(opp, 'captures'));
      }
    }
  }

  // 2. Boat rule: an opponent's five from last turn that survived this move wins now.
  if (s.pendingFive && s.pendingFive.player === opp) {
    if (lineStillIntact(s.board, s.pendingFive.cells, opp)) return finish(win(opp, 'five'));
    s.pendingFive = null;
  }

  // 3. New fives through the stone just placed (it may have been poofed away).
  const fives = s.board[idx(x, y)] === player ? fivesThrough(s.board, x, y, player, v) : [];

  if (v.boat) {
    if (fives.length) {
      const cells = [...new Set(fives.flatMap((f) => f.cells))];
      if (canBreakByCapture(s, cells, player)) {
        s.pendingFive = { player, cells };
      } else {
        return finish(win(player, 'five'));
      }
    }
  } else {
    for (const f of fives) {
      const banked = s.banked[player];
      const already = v.fivesMustDifferInDirection
        ? banked.some((b) => b.axis === f.axis)
        : banked.some((b) => b.axis === f.axis && b.cells.some((c) => f.cells.includes(c)));
      if (!already) {
        banked.push({ axis: f.axis, cells: f.cells.slice() });
        record.newFives.push(f);
      }
    }
    const nFives = s.banked[player].length;
    if (v.requireFiveAndCaptures) {
      if (nFives >= 1 && s.captured[player] >= v.captureWinStones) return finish(win(player, 'five-and-captures'));
    } else if (nFives >= v.fivesToWin) {
      return finish(win(player, v.fivesToWin > 1 ? 'two-fives' : 'five'));
    }
  }

  // 4. A full board is a draw.
  if (s.ply >= SIZE * SIZE || !s.board.includes(EMPTY)) return finish(win(0, 'board-full'));

  function finish() {
    record.winner = s.winner;
    record.winReason = s.winReason;
  }
  finish();
}

/** Take back the last move. Returns the undone record, or null if there is nothing to undo. */
export function undoMove(s) {
  const r = s.history.pop();
  if (!r) return null;
  const opp = other(r.player);
  s.board[idx(r.x, r.y)] = EMPTY;
  for (const i of r.captured) s.board[i] = opp;
  for (const i of r.poofed) s.board[i] = r.player;
  // The placed stone may itself have been poofed; it is cleared above either way.
  s.board[idx(r.x, r.y)] = EMPTY;
  const p = r.prev;
  s.toMove = p.toMove;
  s.ply = p.ply;
  s.captured = p.captured.slice();
  s.banked = [null, p.banked[1].slice(), p.banked[2].slice()];
  s.pendingFive = p.pendingFive;
  s.winner = p.winner;
  s.winReason = p.winReason;
  return r;
}

// ---------------------------------------------------------------------------
// Helpers used by the bot and the coach

/** Empty points within `dist` of any stone (legal moves only). Falls back to all legal moves early on. */
export function nearbyMoves(s, dist = 2) {
  if (s.winner !== null) return [];
  if (s.ply === 0) return legalMoves(s);
  const mark = new Uint8Array(SIZE * SIZE);
  for (let i = 0; i < s.board.length; i++) {
    if (s.board[i] === EMPTY) continue;
    const x = xOf(i), y = yOf(i);
    for (let dy = -dist; dy <= dist; dy++) for (let dx = -dist; dx <= dist; dx++) {
      const nx = x + dx, ny = y + dy;
      if (inBounds(nx, ny)) mark[idx(nx, ny)] = 1;
    }
  }
  const out = [];
  for (let i = 0; i < mark.length; i++) {
    if (!mark[i]) continue;
    const x = xOf(i), y = yOf(i);
    if (isLegal(s, x, y)) out.push([x, y]);
  }
  // The tournament rule can push the only legal moves far away.
  return out.length ? out : legalMoves(s);
}

/** Points where `player` would win the game outright by playing there now (any variant). */
export function winningPointsFor(s, player) {
  const out = [];
  if (s.winner !== null) return out;
  const scratch = cloneState(s);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (scratch.board[idx(x, y)] !== EMPTY) continue;
    scratch.toMove = player;
    if (!isLegal(scratch, x, y)) continue;
    applyMove(scratch, x, y);
    if (scratch.winner === player) out.push([x, y]);
    undoMove(scratch);
  }
  return out;
}

/** Points where `player` would complete a five-in-a-row (whether or not that wins in this variant). */
export function fivePointsFor(s, player) {
  const out = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = idx(x, y);
    if (s.board[i] !== EMPTY) continue;
    s.board[i] = player;
    const hit = fivesThrough(s.board, x, y, player, s.variant).length > 0;
    s.board[i] = EMPTY;
    if (hit) out.push([x, y]);
  }
  return out;
}

/** Every capture `player` could make next move: [{ x, y, stones: [indexes] }]. */
export function captureChancesFor(s, player) {
  const out = [];
  const sizes = s.variant.captureSizes;
  if (!sizes.length) return out;
  const locked = lockedOf(s);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (s.board[idx(x, y)] !== EMPTY) continue;
    const stones = capturesAt(s.board, x, y, player, sizes, locked);
    if (stones.length) out.push({ x, y, stones });
  }
  return out;
}

/** Points where `player` would make an open four (four in a row, both ends empty). */
export function openFourPointsFor(s, player) {
  const out = [];
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const i = idx(x, y);
    if (s.board[i] !== EMPTY) continue;
    s.board[i] = player;
    for (let a = 0; a < 4; a++) {
      const run = runThrough(s.board, x, y, player, a);
      if (run.length !== 4) continue;
      const [dx, dy] = AXES[a];
      const first = run[0], last = run[run.length - 1];
      const bx = xOf(first) - dx, by = yOf(first) - dy, ax = xOf(last) + dx, ay = yOf(last) + dy;
      if (inBounds(bx, by) && inBounds(ax, ay) && s.board[idx(bx, by)] === EMPTY && s.board[idx(ax, ay)] === EMPTY) {
        out.push([x, y]);
        break;
      }
    }
    s.board[i] = EMPTY;
  }
  return out;
}
