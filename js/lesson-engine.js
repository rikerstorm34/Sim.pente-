// Lesson engine: sets up puzzle positions and checks a learner's move against a goal.
// Pure logic (no DOM) so every puzzle can be verified by tests.

import {
  P1, P2, idx, other, newGame, applyMove, undoMove, cloneState, parseCoord, coordName, isLegal,
  winningPointsFor, captureChancesFor, openFourPointsFor, fivePointsFor, nearbyMoves, CENTER, AXES,
} from './rules.js';
import { resolveVariant } from './variants.js';
import { findVCF } from './ai.js';
import { shapesAt } from './patterns.js';

/**
 * Build a puzzle position.
 * spec: { variant?, p1?: [coords], p2?: [coords], moves?: [coords], toMove?: 'p1'|'p2', captured?: { p1, p2 } (pairs),
 *         extra?: { p1, p2 } (generated clutter from lesson-boards.js) }
 * Either `moves` (played from the start, so opening rules apply) or `p1`/`p2` stones placed directly.
 */
export function setupPosition(spec) {
  const variant = resolveVariant(spec.variant || 'pente', spec.options || {});
  const s = newGame(variant);
  if (spec.moves) {
    for (const c of spec.moves) applyMove(s, ...parseCoord(c));
    s.history = [];
    return s;
  }
  const extra = spec.extra || {};
  for (const c of [...(spec.p1 || []), ...(extra.p1 || [])]) s.board[idx(...parseCoord(c))] = P1;
  for (const c of [...(spec.p2 || []), ...(extra.p2 || [])]) s.board[idx(...parseCoord(c))] = P2;
  s.toMove = spec.toMove === 'p2' ? P2 : P1;
  s.ply = 20; // past the opening rules
  if (spec.captured) {
    s.captured[P1] = (spec.captured.p1 || 0) * 2;
    s.captured[P2] = (spec.captured.p2 || 0) * 2;
  }
  // Fives already banked (Double Five, Five + Captures): { p1: [[five coords]], p2: [...] }
  for (const [side, p] of [['p1', P1], ['p2', P2]]) {
    for (const five of (spec.banked && spec.banked[side]) || []) s.banked[p].push(lineOf(five));
  }
  // Boat rule: a five that was just made and is waiting to see if it survives one turn.
  if (spec.pendingFive) {
    s.pendingFive = { player: spec.pendingFive.player === 'p2' ? P2 : P1, cells: lineOf(spec.pendingFive.cells).cells };
  }
  return s;
}

function lineOf(coords) {
  const pts = coords.map(parseCoord);
  const dx = Math.sign(pts[1][0] - pts[0][0]), dy = Math.sign(pts[1][1] - pts[0][1]);
  const axis = AXES.findIndex(([ax, ay]) => (ax === dx && ay === dy) || (ax === -dx && ay === -dy));
  return { axis, cells: pts.map(([x, y]) => idx(x, y)) };
}

/**
 * After the learner's move (opponent to move): can the learner win whatever the opponent does?
 * If the learner now threatens five, the only replies that matter are blocking those points,
 * capturing, or winning on the spot; any other reply loses at once.
 */
/** Time limit for forced-win checks. Tests raise it so a slow CI machine can't fail a sound puzzle. */
export const SEARCH = { forcedWinMs: 2500 };

export function isForcedWin(after, you, budgetMs = SEARCH.forcedWinMs) {
  if (after.winner === you) return true;
  if (after.winner !== null) return false;
  const opp = other(you);
  const deadline = Date.now() + budgetMs;
  const threats = fivePointsFor(after, you);
  let replies;
  if (threats.length) {
    replies = threats.slice();
    for (const c of captureChancesFor(after, opp)) replies.push([c.x, c.y]);
    for (const w of winningPointsFor(after, opp)) replies.push(w);
  } else {
    replies = nearbyMoves(after, 2);
    for (const c of captureChancesFor(after, opp)) replies.push([c.x, c.y]);
  }
  const seen = new Set();
  for (const [x, y] of replies) {
    const k = x + ',' + y;
    if (seen.has(k) || !isLegal(after, x, y)) continue;
    seen.add(k);
    if (Date.now() > deadline) return false;
    applyMove(after, x, y);
    let ok;
    if (after.winner !== null) ok = after.winner === you;
    else if (winningPointsFor(after, you).length) ok = true;
    else ok = !!findVCF(after, you, 8, Math.min(deadline, Date.now() + 300), 12000);
    undoMove(after);
    if (!ok) return false;
  }
  return true;
}

const key = (c) => c.x + ',' + c.y + ':' + c.stones.join('.');

/**
 * Check a move against a goal. Goals:
 *  { kind: 'win' } · { kind: 'capture', min? } · { kind: 'block' } (no immediate win left for the opponent)
 *  { kind: 'blockTria' } (opponent can no longer make an open four) · { kind: 'tria' } · { kind: 'openFour' }
 *  { kind: 'four' } · { kind: 'safe' } (no new capture chances for the opponent)
 *  { kind: 'noCaptures' } (opponent has no capture at all afterwards) · { kind: 'capThreat' }
 *  { kind: 'quiet' } (no four and no open three) · { kind: 'doubleCapThreat' } · { kind: 'bank' } (a new five counts, Double Five / Five + Captures)
 *  { kind: 'forcedWin' } · { kind: 'legal' } · { kind: 'points', points: [coords] } · { all: [goals] }
 * @returns {{ ok: boolean, after: object, record: object | null, failed?: string }}
 */
export function checkMove(state, x, y, goal) {
  if (!isLegal(state, x, y)) return { ok: false, after: state, record: null, failed: 'illegal' };
  const you = state.toMove;
  const opp = other(you);
  const before = state;
  const after = cloneState(state);
  const record = applyMove(after, x, y);
  const name = coordName(x, y);

  const test = (g) => {
    if (g.all) return g.all.every(test);
    switch (g.kind) {
      case 'win': return after.winner === you;
      case 'capture': return record.captured.length >= (g.min || 2);
      case 'block': return after.winner !== opp && (after.winner === you || winningPointsFor(after, opp).length === 0);
      case 'blockTria': return after.winner === you || (after.winner === null && openFourPointsFor(after, opp).length === 0 && winningPointsFor(after, opp).length === 0);
      case 'tria': return shapesAt(after.board, x, y, you).some((sh) => sh.shape === 'tria');
      case 'openFour': return shapesAt(after.board, x, y, you).some((sh) => sh.shape === 'openFour');
      case 'split3': return shapesAt(after.board, x, y, you).some((sh) => sh.shape === 'split3');
      case 'stopForced': {
        if (after.winner === you) return true;
        if (after.winner !== null || winningPointsFor(after, opp).length) return false;
        return !findVCF(cloneState(after), opp, 8, Date.now() + 600, 15000);
      }
      case 'four': return fivePointsFor(after, you).length > fivePointsFor(before, you).length;
      case 'safe': {
        const was = new Set(captureChancesFor(before, opp).map(key));
        return captureChancesFor(after, opp).every((c) => was.has(key(c)) && !c.stones.includes(idx(x, y)));
      }
      case 'noCaptures': return captureChancesFor(after, opp).length === 0;
      case 'capThreat': return captureChancesFor(after, you).length > captureChancesFor(before, you).length;
      case 'doubleCapThreat': {
        // One stone now threatens two different enemy pairs (two new capture points).
        const was = new Set(captureChancesFor(before, you).map(key));
        const fresh = captureChancesFor(after, you).filter((c) => !was.has(key(c)));
        return new Set(fresh.flatMap((c) => c.stones)).size >= 4 && fresh.length >= 2;
      }
      case 'quiet': return after.winner === null && fivePointsFor(after, you).length === 0 && openFourPointsFor(after, you).length === 0;
      case 'bank': return after.banked[you].length > before.banked[you].length;
      case 'forcedWin': return isForcedWin(cloneState(after), you);
      case 'legal': return true;
      case 'points': return g.points.includes(name);
      default: throw new Error('Unknown goal ' + g.kind);
    }
  };
  const ok = test(goal);
  return { ok, after, record };
}

/** Every legal move near the action that meets the goal (used by tests to keep puzzles honest). */
export function solutions(state, goal, limit = 400) {
  const out = [];
  const cands = state.ply === 0 ? [[CENTER, CENTER]] : nearbyMoves(state, 3);
  for (const [x, y] of cands.slice(0, limit)) {
    if (checkMove(state, x, y, goal).ok) out.push(coordName(x, y));
  }
  return out;
}

export { parseCoord, coordName };
