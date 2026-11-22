// Hex for the shared game shell (js/games/shell.js). No DOM.
import {
  EMPTY, GOLD, BLUE, SWAP, other, newGame, cloneState, play as playMove, undo as undoMove,
  illegalReason as why, cellName, parseCell, canSwap, geometry, shortestPath, connected, emptyCells, mirror,
} from './rules.js';
import { chooseMove as botMove, analysePosition, winningCells, solve } from './ai.js';

export { SWAP };
export const COLOUR = { [GOLD]: 'Gold', [BLUE]: 'Blue' };
const sizeOf = (o) => (o && o.size) || 9;
const list = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

export const newState = (o = {}) => newGame(sizeOf(o), o.swap !== false);
export function replay(moves, o = {}) {
  const s = newState(o);
  for (const m of moves) playMove(s, m);
  return s;
}
export const clone = cloneState;
export const legalMoves = (s) => (s.winner ? [] : emptyCells(s).concat(canSwap(s) ? [SWAP] : []));
export const illegalReason = why;
export const play = (s, m) => playMove(s, m);
export const undo = (s) => undoMove(s);
export const toMove = (s) => s.toMove;
export const isOver = (s) => !!s.winner;
export const moveName = (m, o) => cellName(m, sizeOf(o));
export const parseMove = (name, o) => parseCell(name, sizeOf(o));
export const lastMove = (s) => (s.history.length ? (s.history[s.history.length - 1].move === SWAP ? mirror(s.history[0].move, s.n) : s.history[s.history.length - 1].move) : null);
export const forcedMove = () => null;

export function outcome(s) {
  return { winner: s.winner, text: `${COLOUR[s.winner]} connected ${s.winner === GOLD ? 'top and bottom' : 'left and right'} in ${s.history.length} moves` };
}

export function playerInfo(s, p) {
  const d = shortestPath(s.board, s.n, p).dist;
  return d === 0 ? 'CONNECTED' : d >= 1e9 ? 'BLOCKED' : `${d} TO GO`;
}

export const chooseMove = (s, level) => botMove(s, level);
export function analyse(s, played = null) { return analysePosition(s, played, { timeMs: 450 }); }

// ---------------------------------------------------------------------------
// Bridges

/** Bridges of `p` whose carrier was just entered by the opponent at `cell`: returns the cells that save them. */
export function bridgeSaves(board, n, p, cell) {
  if (cell === null || cell === undefined || cell < 0) return [];
  const { nb, bridges } = geometry(n);
  const out = new Set();
  for (const a of nb[cell]) {
    if (board[a] !== p) continue;
    for (const br of bridges[a]) {
      if (board[br.to] !== p) continue;
      const [x, y] = br.carrier;
      if (x === cell && board[y] === EMPTY) out.add(y);
      if (y === cell && board[x] === EMPTY) out.add(x);
    }
  }
  return [...out];
}

/** Number of bridges `p` has with both carrier cells empty. */
export function bridgeCount(board, n, p) {
  const { bridges } = geometry(n);
  let k = 0;
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== p) continue;
    for (const br of bridges[i]) if (br.to > i && board[br.to] === p && board[br.carrier[0]] === EMPTY && board[br.carrier[1]] === EMPTY) k++;
  }
  return k;
}

// ---------------------------------------------------------------------------
// Coach

export function coachNotes(s, you, oppName = 'Your opponent') {
  if (s.winner || s.toMove !== you) return [];
  const n = s.n, opp = other(you);
  const name = (i) => cellName(i, n);
  const notes = [];
  if (canSwap(s)) {
    notes.push({ kind: 'opportunity', tag: 'Swap', title: 'You may swap',
      text: 'With the swap rule you can take Gold\'s first stone as your own (mirrored onto your side) instead of playing. Swap a strong central stone; leave a weak edge stone.', points: [] });
  }
  const win = winningCells(s.board, n, you);
  if (win.length) {
    notes.push({ kind: 'opportunity', tag: 'Winning move', title: 'You can connect now', text: 'One stone completes your chain. Can you find it?', points: win, reveal: true });
    return notes;
  }
  const threat = winningCells(s.board, n, opp);
  if (threat.length) {
    notes.push({ kind: 'threat', tag: 'Must block', title: `${oppName} connects next move`,
      text: threat.length > 1 ? `${oppName} has more than one way to connect (${list(threat.map(name))}). Look for a cell that stops both, if there is one.` : `${oppName} connects at ${name(threat[0])} unless you block there.`,
      points: threat });
  }
  const last = s.history.length ? s.history[s.history.length - 1].move : null;
  const saves = bridgeSaves(s.board, n, you, last);
  if (saves.length && !threat.length) {
    notes.push({ kind: 'opportunity', tag: 'Bridge', title: 'Your bridge was cut into',
      text: `${oppName} played into one of your bridges. Reply at ${list(saves.map(name))} and the two stones stay connected.`, points: saves, reveal: true });
  }
  const mine = shortestPath(s.board, n, you).dist, theirs = shortestPath(s.board, n, opp).dist;
  if (s.history.length >= 2 && mine < 1e9 && theirs < 1e9) {
    notes.push({ kind: mine <= theirs ? 'opportunity' : 'threat', tag: 'Race', title: mine <= theirs ? 'You are ahead in the race' : `${oppName} is ahead in the race`,
      text: `You need at least ${mine} more stone${mine === 1 ? '' : 's'} to connect; ${oppName} needs ${theirs}. Bridges count as connected, so the real gap can be smaller.`,
      points: [], reveal: false });
  }
  return notes;
}

export function previewWarning(s, m, oppName = 'Your opponent') {
  if (m === SWAP || why(s, m)) return null;
  const n = s.n, me = s.toMove, opp = other(me);
  const t = cloneState(s);
  playMove(t, m);
  if (t.winner) return null;
  const threat = winningCells(t.board, n, opp);
  if (threat.length) return `Careful: ${oppName} can connect at ${list(threat.map((i) => cellName(i, n)))} after this.`;
  const last = s.history.length ? s.history[s.history.length - 1].move : null;
  const saves = bridgeSaves(s.board, n, me, last);
  if (saves.length && !saves.includes(m)) return `Your bridge stays cut unless you reply at ${list(saves.map((i) => cellName(i, n)))}.`;
  return null;
}

// ---------------------------------------------------------------------------
// Review explanations

export function explain(s, m, a, rank, oppName) {
  const n = s.n, me = s.toMove, opp = other(me);
  const name = (i) => cellName(i, n);
  if (m === SWAP) return { text: 'Swapped: took Gold\'s first stone as Blue\'s.', tags: [] };
  const pos = [], neg = [], tags = new Set();
  const winNow = winningCells(s.board, n, me);
  const threat = winningCells(s.board, n, opp);
  const last = s.history.length ? s.history[s.history.length - 1].move : null;
  const saves = bridgeSaves(s.board, n, me, last);
  const d0 = shortestPath(s.board, n, me).dist, o0 = shortestPath(s.board, n, opp).dist;
  const t = cloneState(s);
  playMove(t, m);
  if (t.winner === me) return { text: 'Connects. Game over.', tags: [] };
  if (winNow.length) { neg.push(`Missed a win at ${list(winNow.map(name))}.`); tags.add('Connection'); }
  if (threat.length && winningCells(t.board, n, opp).length) { neg.push(`Doesn't stop ${oppName} connecting.`); tags.add('Blocking'); }
  if (saves.length) {
    if (saves.includes(m)) pos.push('Saves the bridge.');
    else if (rank >= 3) { neg.push(`Leaves the bridge cut: ${name(saves[0])} would have saved it.`); tags.add('Bridges'); }
  }
  const d1 = shortestPath(t.board, n, me).dist, o1 = shortestPath(t.board, n, opp).dist;
  if (o1 > o0 && o1 < 1e9) pos.push(`Blocks: ${oppName} now needs ${o1}.`);
  if (d1 < d0) pos.push(`Shortens your path: ${d1} to go.`);
  if (bridgeCount(t.board, n, me) > bridgeCount(s.board, n, me) && !saves.length) pos.push('Makes a bridge.');
  if (rank >= 3 && o1 <= o0 && geometry(n).nb[m].some((j) => s.board[j] === opp)) {
    neg.push(`Blocking right next to ${oppName}'s stones is easy to go around; a block a little further away holds better.`);
    tags.add('Blocking');
  }
  if (rank >= 3 && !neg.length) { neg.push(`This gives ${oppName} the better game.`); tags.add('Connection'); }
  const text = rank >= 3 ? [...neg, ...pos].join(' ') : [...pos, ...neg].join(' ') || (rank === 0 ? 'The engine\'s choice too.' : 'A solid move.');
  return { text, tags: [...tags] };
}

// ---------------------------------------------------------------------------
// Unbreakable chains: stones linked by adjacency, bridges and edge bridges (a second-row stone
// with both edge cells below it empty), with no empty cell used by two links. Such a chain
// can't be cut, so it wins. (This finds the common cases, not every possible win.)

export function unbreakable(board, n, p) {
  const { nb, bridges } = geometry(n);
  const first = (i) => (p === GOLD ? Math.floor(i / n) === 0 : i % n === 0);
  const last = (i) => (p === GOLD ? Math.floor(i / n) === n - 1 : i % n === n - 1);
  // Edge links: on the edge (no carrier) or one row in with both edge cells empty.
  const edgeLink = (i, atStart) => {
    if (atStart ? first(i) : last(i)) return [];
    const r = Math.floor(i / n), c = i % n;
    let cells = null;
    if (p === GOLD) {
      if (atStart && r === 1) cells = [c, c + 1].filter((x) => x < n).map((x) => x);
      if (!atStart && r === n - 2) cells = [c, c - 1].filter((x) => x >= 0).map((x) => (n - 1) * n + x);
    } else {
      if (atStart && c === 1) cells = [r, r + 1].filter((y) => y < n).map((y) => y * n);
      if (!atStart && c === n - 2) cells = [r, r - 1].filter((y) => y >= 0).map((y) => y * n + n - 1);
    }
    if (!cells || cells.length !== 2 || cells.some((x) => board[x] !== EMPTY)) return null;
    return cells;
  };
  let budget = 20000;
  const used = new Set();
  const visited = new Set();
  function dfs(i) {
    if (--budget < 0) return false;
    const end = edgeLink(i, false);
    if (end && end.every((x) => !used.has(x))) return true;
    visited.add(i);
    const steps = [];
    for (const j of nb[i]) if (board[j] === p && !visited.has(j)) steps.push([j, []]);
    for (const br of bridges[i]) if (board[br.to] === p && !visited.has(br.to) && board[br.carrier[0]] === EMPTY && board[br.carrier[1]] === EMPTY) steps.push([br.to, br.carrier]);
    for (const [j, carrier] of steps) {
      if (carrier.some((x) => used.has(x))) continue;
      for (const x of carrier) used.add(x);
      if (dfs(j)) return true;
      for (const x of carrier) used.delete(x);
    }
    visited.delete(i);
    return false;
  }
  for (let i = 0; i < board.length; i++) {
    if (board[i] !== p) continue;
    const start = edgeLink(i, true);
    if (!start) continue;
    for (const x of start) used.add(x);
    visited.clear();
    if (dfs(i)) return true;
    for (const x of start) used.delete(x);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Positions and puzzle goals

/** { size, gold: [...], blue: [...], toMove } or { size, moves: 'e5 d6 …' } */
export function setupPosition(spec, o = {}) {
  const size = spec.size || sizeOf(o);
  const s = newGame(size, false);
  // A placed position may name the opponent's last move (for "they just cut your bridge").
  if (spec.last) s.lastCut = parseCell(spec.last, size);
  if (spec.moves !== undefined) {
    for (const nm of spec.moves.split(/\s+/).filter(Boolean)) playMove(s, parseCell(nm, size));
    return s;
  }
  for (const c of spec.gold || []) s.board[parseCell(c, size)] = GOLD;
  for (const c of spec.blue || []) s.board[parseCell(c, size)] = BLUE;
  s.toMove = spec.toMove === 'blue' ? BLUE : GOLD;
  return s;
}

/**
 * Goals: points · connect (connects at once) · block (opponent can't connect next move) ·
 * saveBridge (restores a bridge the opponent cut) · fork (leaves two separate ways to connect
 * next move, which can't both be blocked) · unbreakable (makes a chain of stones and bridges that
 * can't be cut) · win (keeps a forced win; tiny positions only) · all {all:[...]}
 */
export function checkGoal(s, m, goal) {
  if (goal.all) return goal.all.every((g) => checkGoal(s, m, g));
  if (why(s, m) || m === SWAP) return false;
  const n = s.n, me = s.toMove, opp = other(me);
  const t = cloneState(s);
  playMove(t, m);
  switch (goal.kind) {
    case 'points': return goal.points.includes(cellName(m, n));
    case 'connect': return t.winner === me;
    case 'block': return t.winner === me || winningCells(t.board, n, opp).length === 0;
    case 'saveBridge': {
      const last = s.history.length ? s.history[s.history.length - 1].move : (goal.cut !== undefined ? parseCell(goal.cut, n) : s.lastCut ?? null);
      return bridgeSaves(s.board, n, me, last).includes(m);
    }
    case 'fork': return t.winner === me || (winningCells(t.board, n, me).length >= 2 && winningCells(t.board, n, opp).length === 0);
    case 'unbreakable': return t.winner === me || (winningCells(t.board, n, opp).length === 0 && unbreakable(t.board, n, me));
    case 'win': return solve(s).winning.includes(m);
    default: return false;
  }
}

export const solutions = (s, goal) => emptyCells(s).filter((m) => checkGoal(s, m, goal)).map((m) => cellName(m, s.n));

// ---------------------------------------------------------------------------
// Statistics for one game, from your side.

export function gameStats(moves, you, o = {}) {
  const s = newState(o);
  const n = s.n, opp = other(you);
  let bridgesMade = 0, saved = 0, cut = 0, swapped = false, adjacentBlocks = 0, blocks = 0;
  for (const m of moves) {
    const p = s.toMove;
    if (m === SWAP) { if (p === you) swapped = true; playMove(s, m); continue; }
    if (p === you) {
      const last = s.history.length ? s.history[s.history.length - 1].move : null;
      const saves = bridgeSaves(s.board, n, you, last);
      if (saves.length) { if (saves.includes(m)) saved++; else cut++; }
      const before = bridgeCount(s.board, n, you);
      const o0 = shortestPath(s.board, n, opp).dist;
      s.board[m] = you;
      if (bridgeCount(s.board, n, you) > before) bridgesMade++;
      const o1 = shortestPath(s.board, n, opp).dist;
      s.board[m] = EMPTY;
      if (o1 > o0) { blocks++; if (geometry(n).nb[m].some((j) => s.board[j] === opp)) adjacentBlocks++; }
    }
    playMove(s, m);
  }
  return { size: n, bridgesMade, saved, cut, swapped, blocks, adjacentBlocks, length: moves.length, firstMove: moves.length ? moves[0] : null };
}
