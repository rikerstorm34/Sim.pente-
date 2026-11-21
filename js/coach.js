// The in-game coach. Looks at the position from the learner's side and points out
// threats and chances in plain language. Version 1 is rule-based; game review comes later.

import {
  other, coordName, xOf, yOf, cloneState, applyMove, undoMove, illegalReason, idx, SIZE, EMPTY, P1, P2,
  winningPointsFor, captureChancesFor, openFourPointsFor, fivePointsFor,
} from './rules.js';
import { c6WinNow, c6Threats, liveWindows, stonesLeft } from './connect6.js';

const name = (i) => coordName(xOf(i), yOf(i));
const pt = ([x, y]) => coordName(x, y);
const list = (arr) => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' or ' + arr[arr.length - 1]);

/**
 * Notes for the learner when it is their turn.
 * @returns {Array<{kind: 'threat'|'opportunity', tag: string, title: string, text: string, points: number[][], reveal?: boolean}>}
 */
export function analyse(s, you, oppName = 'Your opponent') {
  if (s.winner !== null || s.toMove !== you) return [];
  if (s.variant.twoStones) return connect6Notes(s, you, oppName);
  const opp = other(you);
  const notes = [];
  const v = s.variant;

  const myWins = winningPointsFor(s, you);
  if (myWins.length) {
    notes.push({ kind: 'opportunity', tag: 'Winning move', title: 'You can win right now',
      text: 'There is a move that wins the game. Can you find it?', points: myWins, reveal: true });
  }

  const theirWins = winningPointsFor(s, opp);
  if (theirWins.length && !myWins.length) {
    const many = theirWins.length > 1;
    notes.push({ kind: 'threat', tag: 'Must block', title: `${oppName} threatens to win`,
      text: many
        ? `${oppName} can win at ${list(theirWins.map(pt))}. If you can't block every point, look for a capture that breaks the threat.`
        : `${oppName} can win at ${pt(theirWins[0])} next move. Block it, or break the line with a capture.`,
      points: theirWins });
  } else if (!myWins.length && v.fivesToWin === 1 && !v.requireFiveAndCaptures) {
    const fours = openFourPointsFor(s, opp);
    if (fours.length) {
      notes.push({ kind: 'threat', tag: 'Open three', title: `${oppName} has an open three (a tria)`,
        text: `If ${oppName} plays ${list(fours.slice(0, 3).map(pt))}, it becomes an open four, which can't be stopped. Block one end now.`,
        points: fours });
    }
  } else if (!myWins.length) {
    const fives = fivePointsFor(s, opp);
    if (fives.length) {
      notes.push({ kind: 'threat', tag: 'Five threat', title: `${oppName} can make a five`,
        text: `${oppName} can complete a five at ${list(fives.slice(0, 3).map(pt))}. In this variant one five isn't a win on its own, but it gets them halfway.`,
        points: fives });
    }
  }

  // Renju / Ninuki-Renju: points the rules don't allow (Gold in Renju; both sides in Ninuki).
  if (v.renju || v.noDoubleThree) {
    const banned = forbiddenPoints(s, you);
    if (banned.length && (!v.renju || you === P1)) {
      notes.push({ kind: 'threat', tag: 'Forbidden', title: 'Points you can\'t play',
        text: `${list(banned.slice(0, 4).map(pt))} would make a forbidden shape (${v.renju ? 'an overline, a double four or a double three' : 'a double three'}). Don't count on them to block.`,
        points: banned });
    }
    if (v.renju && you === P2) {
      const theirs = forbiddenPoints(s, opp);
      if (theirs.length) {
        notes.push({ kind: 'opportunity', tag: 'Forbidden', title: `${oppName} can't play everywhere`,
          text: `${oppName} isn't allowed to play ${list(theirs.slice(0, 3).map(pt))}. A four that can only be blocked there wins.`,
          points: theirs, reveal: true });
      }
    }
  }

  if (v.captureSizes.length) {
    const theirCaps = captureChancesFor(s, opp);
    if (theirCaps.length) {
      const c = theirCaps[0];
      const stones = c.stones.map(name).join('–');
      const more = theirCaps.length > 1 ? ` (${theirCaps.length} capture chances in total)` : '';
      notes.push({ kind: 'threat', tag: 'Captures', title: 'Stones open to capture',
        text: `Your stones ${stones} are open. ${oppName} can capture them at ${pt([c.x, c.y])}${more}.`,
        points: theirCaps.map((t) => [t.x, t.y]) });
    }
    if (!myWins.length) {
      const mine = captureChancesFor(s, you);
      if (mine.length) {
        notes.push({ kind: 'opportunity', tag: 'Captures', title: 'A capture is available',
          text: `You can capture ${mine.length > 1 ? 'in more than one place' : 'a group of stones'}. Can you find it? Check that it doesn't leave you open.`,
          points: mine.map((t) => [t.x, t.y]), reveal: true });
      }
    }
  }
  return notes;
}

/**
 * A quick check on a move the learner is previewing. Returns a short warning, or null.
 */
export function previewWarning(s, x, y, oppName = 'Your opponent') {
  if (s.winner !== null) return null;
  if (s.variant.twoStones) {
    // Only the last stone of a turn can leave a threat uncovered.
    const scratch = cloneState(s);
    const you = scratch.toMove;
    applyMove(scratch, x, y);
    if (scratch.winner === you || scratch.toMove === you) return null;
    const t = c6Threats(scratch.board, other(you));
    return t.windows.length ? `Careful: after this, ${oppName} can still make six (cover ${list(t.cover.map(name))}).` : null;
  }
  const you = s.toMove;
  const opp = other(you);
  const scratch = cloneState(s);
  const hasCaps = scratch.variant.captureSizes.length > 0;
  const key = (c) => c.x + ',' + c.y + ':' + c.stones.join('.');
  const before = new Set(hasCaps ? captureChancesFor(scratch, opp).map(key) : []);
  applyMove(scratch, x, y);
  if (scratch.winner === you) return null;
  const wins = winningPointsFor(scratch, opp);
  if (wins.length) return `Careful: after this, ${oppName} can win at ${pt(wins[0])}.`;
  if (hasCaps) {
    const fresh = captureChancesFor(scratch, opp).filter((c) => !before.has(key(c)));
    if (fresh.length) {
      const c = fresh[0];
      return `Careful: this leaves ${c.stones.map(name).join('–')} open. ${oppName} could capture at ${pt([c.x, c.y])}.`;
    }
  }
  return null;
}

// Connect6: think in windows of six. Four or five of one colour with the rest empty can be
// finished in one turn of two stones.
function connect6Notes(s, you, oppName) {
  const opp = other(you);
  const notes = [];
  const left = stonesLeft(s);
  const win = c6WinNow(s);
  if (win) {
    notes.push({ kind: 'opportunity', tag: 'Winning move', title: 'You can make six this turn',
      text: left === 2 ? 'Two stones finish one of your lines. Can you find them?' : 'One stone finishes six. Can you find it?',
      points: win.map((i) => [xOf(i), yOf(i)]), reveal: true });
    return notes;
  }
  const t = c6Threats(s.board, opp);
  if (t.windows.length) {
    const pts = t.cover.map((i) => [xOf(i), yOf(i)]);
    notes.push({ kind: 'threat', tag: 'Must block', title: `${oppName} can make six next turn`,
      text: t.cover.length > left
        ? `${oppName} has more threats than you have stones to block them. Cover what you can at ${list(t.cover.map(name))}, or look for a six of your own.`
        : `${oppName} has four or more in a line with room to finish. ${left === 2 ? 'Use your stones' : 'Use this stone'} to cover ${list(t.cover.map(name))}.`,
      points: pts });
  } else {
    const threes = liveWindows(s.board, opp, 3);
    if (threes.length >= 2) {
      notes.push({ kind: 'threat', tag: 'Building', title: `${oppName} is building`,
        text: `${oppName} has three in a line with room to grow in more than one place. Two more stones there would make a threat you have to answer.`,
        points: [] });
    }
  }
  if (left === 2 && !t.windows.length) {
    const mine = liveWindows(s.board, you, 3);
    if (mine.length) {
      notes.push({ kind: 'opportunity', tag: 'Attack', title: 'You can make a threat',
        text: 'One of your lines has three stones with room to grow. Adding to it makes a threat your opponent must spend stones on. Two threats at once are more than two stones can block.',
        points: [], reveal: false });
    }
  }
  return notes;
}

// Empty points near the stones where `p` may not play because of a forbidden shape.
function forbiddenPoints(s, p) {
  const out = [];
  const scratch = cloneState(s);
  scratch.toMove = p;
  const seen = new Set();
  for (let i = 0; i < scratch.board.length; i++) {
    const c = scratch.board[i];
    if (c !== P1 && c !== P2) continue;
    const x0 = xOf(i), y0 = yOf(i);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = x0 + dx, y = y0 + dy;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      const j = idx(x, y);
      if (seen.has(j) || scratch.board[j] !== EMPTY) continue;
      seen.add(j);
      const why = illegalReason(scratch, x, y);
      if (why && /Forbidden|double three/.test(why)) out.push([x, y]);
    }
  }
  return out;
}
