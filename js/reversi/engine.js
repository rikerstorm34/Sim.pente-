// Reversi for the shared game shell (js/games/shell.js). No DOM.
// Everything the shell needs: rules, bots, analysis, coach notes, explanations, puzzle goals
// and per-game statistics.

import {
  N, EMPTY, GOLD, BLUE, PASS, other, newGame, cloneState, play as playMove, undo as undoMove, movesFor,
  illegalReason as why, counts, result, cellName, parseCell, flipsFor, CORNERS, X_SQUARES, C_SQUARES,
  frontier, emptyRegions, isEdge,
} from './rules.js';
import { chooseMove as botMove, analysePosition, winChance, scoreMoves } from './ai.js';

export { PASS };
export const COLOUR = { [GOLD]: 'Gold', [BLUE]: 'Blue' };
const nm = cellName;
const list = (a) => (a.length <= 1 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);

export const newState = () => newGame();
export function replay(moves) {
  const s = newGame();
  for (const m of moves) playMove(s, m);
  return s;
}
export const clone = cloneState;
export const legalMoves = (s) => {
  if (s.over) return [];
  const m = movesFor(s.board, s.toMove);
  return m.length ? m : [PASS];
};
export const illegalReason = why;
export const play = (s, m) => playMove(s, m);
export const undo = (s) => undoMove(s);
export const toMove = (s) => s.toMove;
export const isOver = (s) => s.over;
export const moveCount = (s) => s.history.length;
export const moveName = (m) => nm(m);
export const parseMove = (name) => parseCell(name);
export const lastMove = (s) => (s.history.length ? s.history[s.history.length - 1].move : null);

/** A move the side to move must make (a pass), or null. */
export const forcedMove = (s) => (!s.over && !movesFor(s.board, s.toMove).length ? PASS : null);

/** { winner: 0|1|2, text, gold, blue } */
export function outcome(s) {
  const r = result(s);
  const text = r.winner === 0 ? 'Draw, 32–32' : `${COLOUR[r.winner]} wins ${Math.max(r.gold, r.blue)}–${Math.min(r.gold, r.blue)}`;
  return { winner: r.winner, text, gold: r.gold, blue: r.blue };
}

/** Disc counts for the player cards. */
export function playerInfo(s, p) {
  const c = counts(s.board);
  return `${p === GOLD ? c.gold : c.blue} DISCS`;
}

export const chooseMove = (s, level) => botMove(s, level);

/** For review: chances for the side to move, before and after the played move. */
export function analyse(s, played = null) {
  const a = analysePosition(s, played, { timeMs: 450 });
  if (a.bestScore === null) return { best: PASS, bestChance: null, playedChance: null, exact: false, forced: true };
  const toChance = (v) => (a.exact ? (v > 0 ? 1 : v < 0 ? 0 : 0.5) * 0.8 + winChance(v) * 0.2 : winChance(v));
  return {
    best: a.best, exact: a.exact,
    bestChance: toChance(a.bestScore), playedChance: a.playedScore === null ? null : toChance(a.playedScore),
    bestScore: Math.round(a.bestScore), playedScore: a.playedScore === null ? null : Math.round(a.playedScore),
  };
}

// ---------------------------------------------------------------------------
// Coach

const cornerMoves = (board, p) => movesFor(board, p).filter((c) => CORNERS.includes(c));
const giftSquares = (board, moves) => moves.filter((c) => (c in X_SQUARES && board[X_SQUARES[c]] === EMPTY) || (c in C_SQUARES && board[C_SQUARES[c]] === EMPTY));

/** Coach notes for the side to move (you). */
export function coachNotes(s, you, oppName = 'Your opponent') {
  if (s.over || s.toMove !== you) return [];
  const opp = other(you);
  const notes = [];
  const mine = movesFor(s.board, you);
  if (!mine.length) return [{ kind: 'threat', tag: 'Pass', title: 'No legal move', text: 'You have no move that traps a disc, so you pass.', points: [] }];
  const corners = mine.filter((c) => CORNERS.includes(c));
  if (corners.length) {
    notes.push({ kind: 'opportunity', tag: 'Corner', title: 'A corner is open to you',
      text: `Corners can never be flipped, and they anchor whole edges. Check what ${list(corners.map(nm))} gives back before you take it.`,
      points: corners, reveal: true });
  }
  const theirCorners = cornerMoves(s.board, opp);
  if (theirCorners.length) {
    notes.push({ kind: 'threat', tag: 'Corner', title: `${oppName} can take a corner`,
      text: `${oppName} can play ${list(theirCorners.map(nm))} next. Can you take that option away, or make it cost something?`,
      points: theirCorners });
  }
  const risky = giftSquares(s.board, mine);
  if (risky.length && risky.length < mine.length) {
    notes.push({ kind: 'threat', tag: 'Danger squares', title: 'Squares next to empty corners',
      text: `${list(risky.slice(0, 4).map(nm))} sit next to an empty corner. Playing there often hands the corner over. Look elsewhere first.`,
      points: risky });
  }
  const theirN = movesFor(s.board, opp).length;
  if (mine.length <= 3 && theirN > mine.length + 2) {
    notes.push({ kind: 'threat', tag: 'Mobility', title: 'You are running short of moves',
      text: `You have ${mine.length} move${mine.length === 1 ? '' : 's'}, ${oppName} has ${theirN}. Prefer quiet moves that flip few discs, especially discs on the outside.`,
      points: [] });
  }
  const empties = counts(s.board).empty;
  if (empties <= 14) {
    const odd = emptyRegions(s.board).filter((r) => r.length % 2 === 1).flat().filter((c) => mine.includes(c));
    if (odd.length) {
      notes.push({ kind: 'opportunity', tag: 'Parity', title: 'Endgame: odd regions first',
        text: `In the endgame, try to get the last move in each region. Moving into a region with an odd number of empty squares (${list(odd.slice(0, 4).map(nm))}) usually does that.`,
        points: odd, reveal: false });
    }
  }
  return notes;
}

/** Warning shown while previewing a move, or null. */
export function previewWarning(s, m, oppName = 'Your opponent') {
  if (m === PASS || why(s, m)) return null;
  const opp = other(s.toMove);
  const before = new Set(cornerMoves(s.board, opp));
  const t = cloneState(s);
  playMove(t, m);
  const gift = cornerMoves(t.board, opp).filter((c) => !before.has(c));
  return gift.length ? `Careful: this lets ${oppName} take ${list(gift.map(nm))}.` : null;
}

// ---------------------------------------------------------------------------
// Review explanations

export function explain(s, m, a, rank, oppName) {
  if (m === PASS) return { text: 'No legal move, so a pass.', tags: [] };
  const me = s.toMove, opp = other(me);
  const pos = [], neg = [], tags = new Set();
  const flips = flipsFor(s.board, m, me).length;
  const before = new Set(cornerMoves(s.board, opp));
  const t = cloneState(s);
  playMove(t, m);
  if (CORNERS.includes(m)) pos.push('Takes a corner, which can never be flipped back.');
  const gift = cornerMoves(t.board, opp).filter((c) => !before.has(c));
  if (gift.length) { neg.push(`Lets ${oppName} take ${list(gift.map(nm))}.`); tags.add('Corners'); }
  else if ((m in X_SQUARES && s.board[X_SQUARES[m]] === EMPTY)) { neg.push('Plays next to an empty corner (an X-square), a common way to lose the corner later.'); tags.add('Corners'); }
  const replies = movesFor(t.board, opp).length;
  if (!t.over && replies <= 3 && replies > 0) pos.push(`Leaves ${oppName} only ${replies} move${replies === 1 ? '' : 's'}.`);
  if (flips >= 6 && counts(s.board).empty > 20) {
    neg.push(`Flips ${flips} discs. Early on, more discs usually means more targets and fewer moves for you.`);
    tags.add('Mobility');
  }
  if (isEdge(m) && !CORNERS.includes(m) && counts(s.board).empty > 30 && rank >= 3) { neg.push('Takes an edge early, which can leave it unbalanced.'); tags.add('Edges'); }
  if (a && a.exact && a.playedScore !== null && a.playedScore !== undefined) {
    const v = a.playedScore;
    pos.push(v > 0 ? `With perfect play from here you win by ${v}.` : v < 0 ? `With perfect play from here you lose by ${-v}.` : 'With perfect play from here it is a draw.');
    if (rank >= 3) tags.add('Endgame');
  }
  if (rank >= 3 && !neg.length) { neg.push(`This gives ${oppName} the better game.`); tags.add(counts(s.board).empty <= 14 ? 'Endgame' : 'Mobility'); }
  const text = rank >= 3 ? [...neg, ...pos].join(' ') : [...pos, ...neg].join(' ') || (rank === 0 ? 'The engine\'s choice too.' : 'A solid move.');
  return { text, tags: [...tags] };
}

// ---------------------------------------------------------------------------
// Positions and puzzle goals

/**
 * A position from a lesson or puzzle spec:
 *   { moves: 'f5d6c3' }  or  { gold: ['d5', ...], blue: [...], toMove: 'gold' | 'blue' }
 */
export function setupPosition(spec) {
  if (spec.moves !== undefined) {
    const s = newGame();
    const str = spec.moves.replace(/\s+/g, '');
    for (let i = 0; i < str.length; i += 2) {
      const c = parseCell(str.slice(i, i + 2));
      if (!movesFor(s.board, s.toMove).length) playMove(s, PASS);
      playMove(s, c);
    }
    if (!s.over && !movesFor(s.board, s.toMove).length) playMove(s, PASS);
    return s;
  }
  const s = newGame();
  s.board.fill(EMPTY);
  for (const c of spec.gold || []) s.board[parseCell(c)] = GOLD;
  for (const c of spec.blue || []) s.board[parseCell(c)] = BLUE;
  s.toMove = spec.toMove === 'blue' ? BLUE : GOLD;
  return s;
}

/** Exact or deep scores for every legal move (puzzles). */
export function moveScores(s, timeMs = 3000) {
  return scoreMoves(s.board, s.toMove, { timeMs, maxDepth: 8, exactAt: 16, fullEval: true });
}

/**
 * Does move m reach the goal? Goals:
 *   points {points:[names]} · corner · noCorner (opponent can't take a corner next) ·
 *   fewest (leaves the opponent the fewest moves) · best (an engine-best move) ·
 *   win (still wins with perfect play) · mostFlips · makePass (opponent must pass) ·
 *   leastFrontier (adds the fewest discs to your frontier) · all {all:[goals]}
 */
export function checkGoal(s, m, goal) {
  if (goal.all) return goal.all.every((g) => checkGoal(s, m, g));
  if (why(s, m)) return false;
  const me = s.toMove, opp = other(me);
  const t = cloneState(s);
  playMove(t, m);
  switch (goal.kind) {
    case 'points': return goal.points.includes(nm(m));
    case 'corner': return CORNERS.includes(m);
    case 'noCorner': return cornerMoves(t.board, opp).length === 0;
    case 'fewest': {
      const n = (c) => { const u = cloneState(s); playMove(u, c); return movesFor(u.board, opp).length; };
      const mine = n(m);
      return movesFor(s.board, me).every((c) => n(c) >= mine);
    }
    case 'best': {
      const { scores } = moveScores(s);
      const top = Math.max(...scores.values());
      return scores.get(m) >= top - (goal.slack || 0);
    }
    case 'mostFlips': {
      const n = flipsFor(s.board, m, me).length;
      return movesFor(s.board, me).every((c) => flipsFor(s.board, c, me).length <= n);
    }
    case 'makePass': return !t.over && movesFor(t.board, opp).length === 0;
    case 'leastFrontier': {
      const f = (c) => { const u = cloneState(s); playMove(u, c); return frontier(u.board, me); };
      const mine = f(m);
      return movesFor(s.board, me).every((c) => f(c) >= mine);
    }
    case 'win': {
      const { scores, exact } = moveScores(s);
      return exact && scores.get(m) > 0;
    }
    default: return false;
  }
}

/** All moves that reach a goal (for tests and hints). */
export const solutions = (s, goal) => movesFor(s.board, s.toMove).filter((m) => checkGoal(s, m, goal)).map(nm);

// ---------------------------------------------------------------------------
// Openings: games are turned so the first move is f5, then matched to named lines.

export const OPENINGS = [
  ['Parallel opening', 'f5f4'],
  ['Perpendicular opening', 'f5d6'],
  ['Diagonal opening', 'f5f6'],
  ['Tiger', 'f5d6c3d3c4'],
  ["Leader's Tiger", 'f5d6c3d3c4f4e6'],
  ['Rose-Bill', 'f5d6c3d3c4f4c5b3c2'],
  ['Cat', 'f5d6c4d3c5'],
  ['Rose', 'f5d6c5f4e3c6d3f6e6d7'],
  ['Inoue', 'f5d6c5f4e3c6e6'],
  ['Shaman', 'f5d6c5f4e3c6f3'],
  ['Buffalo', 'f5f6e6f4c3'],
  ['Heath', 'f5f6e6f4g5'],
  ['Cow', 'f5f6e6d6c5'],
];

// The four symmetries that keep the start position: identity, both diagonals, half-turn.
const SYMS = [
  (x, y) => [x, y], (x, y) => [y, x], (x, y) => [7 - y, 7 - x], (x, y) => [7 - x, 7 - y],
];
export function normaliseOpening(moves) {
  const first = moves.find((m) => m !== PASS);
  if (first === undefined) return [];
  const target = parseCell('f5');
  const f = SYMS.find((t) => { const [x, y] = t(first % N, Math.floor(first / N)); return y * N + x === target; }) || SYMS[0];
  return moves.filter((m) => m !== PASS).map((m) => { const [x, y] = f(m % N, Math.floor(m / N)); return y * N + x; });
}
export function openingName(moves) {
  const seq = normaliseOpening(moves).map(nm).join('');
  let best = null;
  for (const [name, line] of OPENINGS) if (seq.startsWith(line) && (!best || line.length > best[1].length)) best = [name, line];
  return best ? best[0] : null;
}

// ---------------------------------------------------------------------------
// Statistics for one finished game, from your side.

export function gameStats(moves, you) {
  const s = newGame();
  const opp = other(you);
  let cornersYou = 0, cornersThem = 0, gifts = 0, mobSum = 0, mobN = 0;
  for (const m of moves) {
    const p = s.toMove;
    if (p === you && m !== PASS) {
      mobSum += movesFor(s.board, you).length; mobN++;
      if ((m in X_SQUARES && s.board[X_SQUARES[m]] === EMPTY) || (m in C_SQUARES && s.board[C_SQUARES[m]] === EMPTY)) gifts++;
    }
    if (CORNERS.includes(m)) { if (p === you) cornersYou++; else cornersThem++; }
    playMove(s, m);
  }
  const r = result(s);
  const diff = you === GOLD ? r.gold - r.blue : r.blue - r.gold;
  return { cornersYou, cornersThem, gifts, mobility: mobN ? mobSum / mobN : 0, discDiff: s.over ? diff : null, opening: openingName(moves), frontierEnd: frontier(s.board, you) };
}
