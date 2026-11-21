// Game review: turns the engine's analysis of a saved game into move ratings,
// plain-language explanations, a winning-chances curve, key moments and focus areas.
// Pure logic (no DOM).

import {
  P1, other, moverOf, coordName, xOf, yOf, newGame, applyMove, cloneState,
  winningPointsFor, captureChancesFor, openFourPointsFor, fivePointsFor,
} from './rules.js';
import { resolveVariant } from './variants.js';
import { winChance, FORCED } from './ai.js';
import { c6WinNow, liveWindows } from './connect6.js';

export const CLASSES = {
  best: { label: 'Best', tone: 'good', rank: 0 },
  excellent: { label: 'Excellent', tone: 'good', rank: 1 },
  good: { label: 'Good', tone: 'good', rank: 2 },
  inaccuracy: { label: 'Inaccuracy', tone: 'meh', rank: 3 },
  mistake: { label: 'Mistake', tone: 'bad', rank: 4 },
  missedWin: { label: 'Missed win', tone: 'bad', rank: 5 },
  blunder: { label: 'Blunder', tone: 'bad', rank: 6 },
};
export const CLASS_ORDER = ['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'missedWin', 'blunder'];

const pt = (p) => coordName(p[0], p[1]);
const nm = (i) => coordName(xOf(i), yOf(i));
const same = (a, b) => !!a && !!b && a[0] === b[0] && a[1] === b[1];
const list = (arr) => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' or ' + arr[arr.length - 1]);

/** Rate one move from its analysis. */
export function classify(a, played) {
  if (!a || a.playedScore === null || a.playedScore === undefined) return null;
  const isBest = same(a.best, played);
  const loss = isBest ? 0 : Math.max(0, winChance(a.bestScore) - winChance(a.playedScore));
  let cls;
  if (!isBest && a.bestScore >= FORCED && a.playedScore < FORCED) cls = 'missedWin';
  else if (isBest) cls = 'best';
  else if (loss <= 0.02) cls = 'excellent';
  else if (loss <= 0.06) cls = 'good';
  else if (loss <= 0.12) cls = 'inaccuracy';
  else if (loss <= 0.22) cls = 'mistake';
  else cls = 'blunder';
  return { cls, loss, isBest };
}

/** Why a move was good or bad, in plain words, with concept tags for focus areas. */
export function explain(before, move, a, rating, names) {
  if (before.variant.twoStones) return explainC6(before, move, a, rating, names);
  const s = before;
  const v = s.variant;
  const me = s.toMove;
  const opp = other(me);
  const oppName = names[opp];
  const caps = v.captureSizes.length > 0;
  const fiveWins = v.fivesToWin === 1 && !v.requireFiveAndCaptures && !v.boat;
  const rank = rating ? CLASSES[rating.cls].rank : 0;
  const weak = rank >= 3; // inaccuracy or worse: say what went wrong
  const neg = [], pos = [];
  const tags = new Set();

  const myWinsBefore = winningPointsFor(s, me);
  const oppWinsBefore = winningPointsFor(s, opp);
  const key = (c) => c.x + ',' + c.y + ':' + c.stones.join('.');
  const oppCapsBefore = caps ? new Set(captureChancesFor(s, opp).map(key)) : new Set();
  const myCapsBefore = caps ? captureChancesFor(s, me) : [];
  const oppFoursBefore = fiveWins ? openFourPointsFor(s, opp) : [];

  const after = cloneState(s);
  const rec = applyMove(after, move[0], move[1]);
  if (after.winner === me) return { text: 'Won the game.', tags: [] };

  // What went wrong.
  if (myWinsBefore.length) {
    neg.push(`Missed a win: ${list(myWinsBefore.slice(0, 2).map(pt))} won on the spot.`);
    tags.add('Finishing');
  } else if (rating && rating.cls === 'missedWin' && a.best) {
    neg.push(`Missed a forced win starting at ${pt(a.best)}: a chain of threats ${oppName} couldn't stop.`);
    tags.add('Attack');
  }
  const oppWinsAfter = after.winner === null ? winningPointsFor(after, opp) : [];
  if (oppWinsAfter.length) {
    if (weak) {
      neg.push(oppWinsBefore.length
        ? `Didn't stop ${oppName}'s threat: they can still win at ${pt(oppWinsAfter[0])}.`
        : `Allowed ${oppName} to win at ${pt(oppWinsAfter[0])}.`);
      tags.add('Defence');
    } else {
      neg.push(`Nothing could stop ${oppName} here; the damage was done earlier.`);
    }
  } else if (weak) {
    const fresh = caps && after.winner === null ? captureChancesFor(after, opp).filter((c) => !oppCapsBefore.has(key(c))) : [];
    if (fresh.length) {
      neg.push(`Left ${fresh[0].stones.slice().sort((p, q) => p - q).map(nm).join('–')} open: ${oppName} can capture at ${pt([fresh[0].x, fresh[0].y])}.`);
      tags.add('Defending pairs');
    } else if (a && a.allowsForced) {
      neg.push(`Allowed a forced win: ${oppName} can start a chain of threats at ${pt(a.allowsForced)} that can't be stopped.`);
      tags.add('Defence');
    } else if (oppFoursBefore.length && after.winner === null && openFourPointsFor(after, opp).length) {
      neg.push(`Didn't block ${oppName}'s open three. They can make an open four at ${pt(openFourPointsFor(after, opp)[0])}.`);
      tags.add('Defence');
    }
  }
  if (caps && weak && myCapsBefore.length && !rec.captured.length && a.best &&
      myCapsBefore.some((c) => c.x === a.best[0] && c.y === a.best[1])) {
    neg.push(`Missed a capture at ${pt(a.best)}.`);
    tags.add('Captures');
  }

  // What the move did well.
  if (after.winner === null) {
    if (rec.captured.length) pos.push(`Captured ${rec.captured.length} stones.`);
    if (rec.newFives && rec.newFives.length) pos.push('Completed a five.');
    if (oppWinsBefore.length && !oppWinsAfter.length) pos.push('Blocked the threat.');
    else if (fiveWins && fivePointsFor(after, me).length > fivePointsFor(s, me).length) pos.push('Made a four, forcing a reply.');
    else if (fiveWins && openFourPointsFor(after, me).length > openFourPointsFor(s, me).length) pos.push('Built an open three (a tria).');
    if (oppFoursBefore.length && !openFourPointsFor(after, opp).length) pos.push(`Blocked ${oppName}'s open three.`);
    if (caps && !rec.captured.length && captureChancesFor(after, me).length > myCapsBefore.length) pos.push('Threatens a capture.');
  }

  if (weak) {
    if (!neg.length) {
      const soft = rank === 3;
      neg.push(a && a.reply
        ? `This ${soft ? `gives ${oppName} a better game` : `lets ${oppName} take over`}: their best reply is ${pt(a.reply)}.`
        : `This ${soft ? `gives ${oppName} a better game` : `hands ${oppName} the upper hand`}.`);
      tags.add('Planning');
    }
    if (a && a.best && !neg.some((t) => t.includes(pt(a.best)))) neg.push(`${pt(a.best)} was stronger.`);
    const text = pos.length ? `${pos.join(' ')} But ${neg.join(' ').replace(/^./, (c) => c.toLowerCase())}` : neg.join(' ');
    return { text, tags: [...tags] };
  }
  const text = [...neg, ...pos].join(' ') || (rank === 0 ? 'The engine\'s choice too.' : 'A solid move.');
  return { text, tags: [...tags] };
}

// Connect6: threats are windows of six with four or more stones of one colour.
function explainC6(s, move, a, rating, names) {
  const me = s.toMove, opp = other(me), oppName = names[opp];
  const rank = rating ? CLASSES[rating.cls].rank : 0;
  const weak = rank >= 3;
  const neg = [], pos = [], tags = new Set();
  const winBefore = c6WinNow(s);
  const oppThreatsBefore = liveWindows(s.board, opp, 4).length;
  const myThreatsBefore = liveWindows(s.board, me, 4).length;
  const after = cloneState(s);
  applyMove(after, move[0], move[1]);
  if (after.winner === me) return { text: 'Made six. Won the game.', tags: [] };
  if (winBefore) { neg.push(`Missed a six at ${list(winBefore.map(nm))}.`); tags.add('Finishing'); }
  const oppThreatsAfter = liveWindows(after.board, opp, 4).length;
  if (after.toMove === opp && oppThreatsAfter) {
    neg.push(`Left ${oppName} a line they can finish next turn.`);
    tags.add('Defence');
  }
  if (oppThreatsAfter < oppThreatsBefore) pos.push('Blocked a threat.');
  if (liveWindows(after.board, me, 4).length > myThreatsBefore) pos.push('Made a threat: four in a line with room for six.');
  if (weak) {
    if (!neg.length) { neg.push(`This gives ${oppName} the better game.`); tags.add('Planning'); }
    if (a && a.best && !neg.some((t) => t.includes(pt(a.best)))) neg.push(`${pt(a.best)} was stronger.`);
    const text = pos.length ? `${pos.join(' ')} But ${neg.join(' ').replace(/^./, (c) => c.toLowerCase())}` : neg.join(' ');
    return { text, tags: [...tags] };
  }
  return { text: [...neg, ...pos].join(' ') || (rank === 0 ? 'The engine\'s choice too.' : 'A solid move.'), tags: [...tags] };
}

/**
 * Build the full review of a saved game.
 * @param {object} entry   archived game { variantId, options, moves, you, level }
 * @param {Array}  analysis  one analysePosition() result per position (moves.length + 1)
 * @param {{ you: string, them: string }} names
 */
export function buildReview(entry, analysis, names = { you: 'You', them: 'Your opponent' }) {
  const variant = resolveVariant(entry.variantId, entry.options || {});
  const you = entry.you || P1;
  const them = other(you);
  const nameOf = { [you]: names.you, [them]: names.them };
  const s = newGame(variant);
  const moves = [];
  // Set-up stones of a choose-your-side opening (D-Pente, Swap2) belong to neither side: not rated.
  const setup = entry.setup || 0;
  for (let i = 0; i < entry.moves.length; i++) {
    const move = entry.moves[i];
    const a = analysis[i];
    const player = s.toMove;
    const rating = i < setup ? null : classify(a, move);
    const why = i < setup ? { text: 'A set-up stone, placed before the sides were chosen.', tags: [] } : explain(s, move, a, rating, nameOf);
    moves.push({
      ply: i, player, isYou: i >= setup && player === you, setup: i < setup, x: move[0], y: move[1], name: pt(move),
      cls: rating ? rating.cls : null, loss: rating ? rating.loss : 0,
      best: a && a.best ? a.best : null, bestName: a && a.best ? pt(a.best) : null,
      text: why.text, tags: why.tags,
    });
    applyMove(s, move[0], move[1]);
  }

  // Winning chances for you after each move (position 0 = start). Two estimates per position,
  // averaged, so the curve doesn't zig-zag with whose turn it is.
  const toYou = (score, sideToMove) => (sideToMove === you ? winChance(score) : 1 - winChance(score));
  const t = newGame(variant);
  const curve = [];
  for (let i = 0; i <= entry.moves.length; i++) {
    const a = analysis[i];
    let est = a ? toYou(a.bestScore, t.toMove) : 0.5;
    if (i > 0) {
      const prev = analysis[i - 1];
      const mover = moverOf(variant, i - 1);
      if (prev && prev.playedScore !== null && prev.playedScore !== undefined) est = (est + toYou(prev.playedScore, mover)) / 2;
    }
    if (t.winner !== null) est = t.winner === you ? 1 : t.winner === 0 ? 0.5 : 0;
    curve.push(est);
    if (i < entry.moves.length) applyMove(t, entry.moves[i][0], entry.moves[i][1]);
  }

  const mine = moves.filter((m) => m.isYou && m.cls);
  const counts = Object.fromEntries(CLASS_ORDER.map((c) => [c, mine.filter((m) => m.cls === c).length]));
  const accuracy = mine.length ? Math.round(mine.reduce((acc, m) => acc + 100 * Math.exp(-6 * m.loss), 0) / mine.length) : null;
  const theirs = moves.filter((m) => !m.isYou && m.cls);
  const theirAccuracy = theirs.length ? Math.round(theirs.reduce((acc, m) => acc + 100 * Math.exp(-6 * m.loss), 0) / theirs.length) : null;

  const keyMoments = mine
    .filter((m) => CLASSES[m.cls].rank >= 4)
    .sort((a, b) => b.loss - a.loss || CLASSES[b.cls].rank - CLASSES[a.cls].rank)
    .slice(0, 3)
    .sort((a, b) => a.ply - b.ply);

  const focusCount = {};
  for (const m of mine) {
    if (CLASSES[m.cls].rank < 3) continue;
    for (const tag of m.tags) focusCount[tag] = (focusCount[tag] || 0) + 1;
  }
  const focus = Object.entries(focusCount).sort((a, b) => b[1] - a[1]);

  return { moves, curve, counts, accuracy, theirAccuracy, keyMoments, focus };
}

export const FOCUS_TIPS = {
  'Defending pairs': 'Before each move, check whether it leaves two of your stones in a row with an enemy stone on one end.',
  Defence: 'Look at your opponent\'s threes and fours first. An open three must be blocked at an end before it becomes an open four.',
  Captures: 'Scan for enemy pairs with your stone on one end. Closing the other end captures them.',
  Attack: 'Look for chains of fours: each one forces a reply and can set up a double threat.',
  Finishing: 'When you have four in a row, check every line for a five before you play anything else.',
  Planning: 'Before you commit, ask what your opponent\'s best reply is. The move that looks most active isn\'t always the safest.',
};
