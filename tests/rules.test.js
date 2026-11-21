import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  newGame, applyMove, undoMove, illegalReason, parseCoord, idx, P1, P2, EMPTY,
  winningPointsFor, captureChancesFor, openFourPointsFor, coordName,
} from '../js/rules.js';
import { resolveVariant } from '../js/variants.js';

// Set up an arbitrary position directly (bypassing turn order) for focused tests.
function position(variantId, { p1 = [], p2 = [], toMove = P1, options = {}, ply = 10 } = {}) {
  const s = newGame(resolveVariant(variantId, options));
  for (const c of p1) { const [x, y] = parseCoord(c); s.board[idx(x, y)] = P1; }
  for (const c of p2) { const [x, y] = parseCoord(c); s.board[idx(x, y)] = P2; }
  s.toMove = toMove;
  s.ply = ply; // past the opening restrictions
  return s;
}
const play = (s, c) => { const [x, y] = parseCoord(c); return applyMove(s, x, y); };
const at = (s, c) => { const [x, y] = parseCoord(c); return s.board[idx(x, y)]; };

test('coordinates: centre is K10 and the letter I is skipped', () => {
  assert.equal(coordName(9, 9), 'K10');
  assert.equal(coordName(8, 0), 'J19');
  assert.deepEqual(parseCoord('A1'), [0, 18]);
});

test('first stone must go on the centre', () => {
  const s = newGame(resolveVariant('pente'));
  assert.ok(illegalReason(s, 0, 0));
  assert.equal(illegalReason(s, 9, 9), null);
});

test('tournament rule: first player\'s second stone at least 3 from centre', () => {
  const s = newGame(resolveVariant('pente'));
  play(s, 'K10'); play(s, 'L10');
  assert.ok(illegalReason(s, ...parseCoord('M10')), 'distance 2 is illegal');
  assert.equal(illegalReason(s, ...parseCoord('N10')), null, 'distance 3 is fine');
  // Can be switched off.
  const t = newGame(resolveVariant('pente', { tournamentRule: false }));
  play(t, 'K10'); play(t, 'L10');
  assert.equal(illegalReason(t, ...parseCoord('L11')), null);
});

test('G-Pente: also not 3 or 4 away along the centre row/column', () => {
  const s = newGame(resolveVariant('g-pente'));
  play(s, 'K10'); play(s, 'L11');
  assert.ok(illegalReason(s, ...parseCoord('N10')));
  assert.ok(illegalReason(s, ...parseCoord('K14')));
  assert.equal(illegalReason(s, ...parseCoord('K15')), null);
  assert.equal(illegalReason(s, ...parseCoord('N13')), null);
});

test('capturing a pair removes it and counts 2 stones', () => {
  const s = position('pente', { p1: ['K10'], p2: ['L10', 'M10'] });
  const r = play(s, 'N10');
  assert.equal(r.captured.length, 2);
  assert.equal(at(s, 'L10'), EMPTY);
  assert.equal(at(s, 'M10'), EMPTY);
  assert.equal(s.captured[P1], 2);
});

test('captures work in all 8 directions and several at once', () => {
  // P1 plays K10; pairs radiate out in every direction, each closed by a P1 stone.
  const p2 = [], p1 = [];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (const [dx, dy] of dirs) {
    p2.push(coordName(9 + dx, 9 + dy), coordName(9 + 2 * dx, 9 + 2 * dy));
    p1.push(coordName(9 + 3 * dx, 9 + 3 * dy));
  }
  const s = position('pente', { p1, p2 });
  const r = play(s, 'K10');
  assert.equal(r.captured.length, 16);
  assert.equal(s.winner, P1, '16 stones is past the 10-stone capture win');
  assert.equal(s.winReason, 'captures');
});

test('playing into a bracket is safe in standard Pente', () => {
  const s = position('pente', { p1: ['K10', 'N10'], p2: ['L10'], toMove: P2 });
  const r = play(s, 'M10'); // P2 makes a pair between two P1 stones
  assert.equal(r.captured.length, 0);
  assert.equal(at(s, 'L10'), P2);
  assert.equal(at(s, 'M10'), P2);
});

test('three stones are not captured in standard Pente', () => {
  const s = position('pente', { p1: ['K10'], p2: ['L10', 'M10', 'N10'] });
  assert.equal(play(s, 'O10').captured.length, 0);
});

test('Keryo: three stones can be captured; win at 15', () => {
  const s = position('keryo', { p1: ['K10'], p2: ['L10', 'M10', 'N10'] });
  assert.equal(play(s, 'O10').captured.length, 3);
  assert.equal(s.captured[P1], 3);
});

test('Poof: moving into a bracket loses your own pair', () => {
  const s = position('poof', { p1: ['K10', 'N10'], p2: ['L10'], toMove: P2 });
  const r = play(s, 'M10');
  assert.equal(r.poofed.length, 2);
  assert.equal(at(s, 'L10'), EMPTY);
  assert.equal(at(s, 'M10'), EMPTY);
  assert.equal(s.captured[P1], 2, 'poofed stones count for the opponent');
});

test('five in a row wins; overline wins in Pente', () => {
  const s = position('pente', { p1: ['K10', 'L10', 'M10', 'O10', 'P10'] });
  play(s, 'N10');
  assert.equal(s.winner, P1);
  assert.equal(s.winReason, 'five');
});

test('Gomoku: exactly five wins, six does not', () => {
  const s = position('gomoku', { p1: ['K10', 'L10', 'M10', 'O10', 'P10'] });
  play(s, 'N10'); // makes six
  assert.equal(s.winner, null);
  const t = position('gomoku', { p1: ['K10', 'L10', 'M10', 'N10'] });
  play(t, 'O10');
  assert.equal(t.winner, P1);
});

test('Double Five: one five is not enough; a six counts once', () => {
  const s = position('double-five', { p1: ['K10', 'L10', 'M10', 'N10'] });
  play(s, 'O10');
  assert.equal(s.winner, null);
  assert.equal(s.banked[P1].length, 1);
  s.toMove = P1;
  play(s, 'P10'); // extends to six: same direction, still one five
  assert.equal(s.banked[P1].length, 1);
  assert.equal(s.winner, null);
});

test('Double Five: two fives in different directions win (sharing a stone is fine)', () => {
  const s = position('double-five', {
    p1: ['K10', 'L10', 'M10', 'N10', 'O10', 'M11', 'M12', 'M8', 'M7'],
  });
  // Bank the horizontal five first.
  s.banked[P1].push({ axis: 0, cells: [] });
  // Vertical five through M10 needs M9.
  play(s, 'M9');
  assert.equal(s.winner, P1);
  assert.equal(s.winReason, 'two-fives');
});

test('Double Five: two parallel fives in the same direction do not win', () => {
  const s = position('double-five', { p1: ['A1', 'B1', 'C1', 'D1', 'A3', 'B3', 'C3', 'D3'] });
  play(s, 'E1');
  s.toMove = P1;
  play(s, 'E3');
  assert.equal(s.winner, null);
});

test('Double Five: 8 pairs (16 stones) wins by captures', () => {
  const s = position('double-five', { p1: ['K10'], p2: ['L10', 'M10'] });
  s.captured[P1] = 14;
  play(s, 'N10');
  assert.equal(s.winner, P1);
  assert.equal(s.winReason, 'captures');
});

test('Five + Captures: a five alone does not win; it is banked', () => {
  const s = position('five-captures', { p1: ['K10', 'L10', 'M10', 'N10'], options: { capturePairs: 5 } });
  play(s, 'O10');
  assert.equal(s.winner, null);
  assert.equal(s.banked[P1].length, 1);
});

test('Five + Captures: captures alone do not win', () => {
  const s = position('five-captures', { p1: ['K10'], p2: ['L10', 'M10'], options: { capturePairs: 5 } });
  s.captured[P1] = 12;
  play(s, 'N10');
  assert.equal(s.winner, null);
});

test('Five + Captures: banked five plus reaching the target wins', () => {
  const s = position('five-captures', { p1: ['K10'], p2: ['L10', 'M10'], options: { capturePairs: 8 } });
  s.banked[P1].push({ axis: 0, cells: [] });
  s.captured[P1] = 14;
  play(s, 'N10');
  assert.equal(s.winner, P1);
  assert.equal(s.winReason, 'five-and-captures');
});

test('Boat: a breakable five waits a turn; if broken, play goes on', () => {
  // P1's five on row 10 (K..O). P2 can capture L10+M10? No — needs a pair. Set up a pair inside the five
  // that P2 can bracket vertically: P1 stones at M10 and M11, P2 at M12, M9 empty.
  const s = position('boat', { p1: ['K10', 'L10', 'M10', 'N10', 'M11'], p2: ['M12'] });
  play(s, 'O10');
  assert.equal(s.winner, null, 'breakable, so not yet a win');
  assert.ok(s.pendingFive);
  play(s, 'M9'); // P2 captures M10 + M11, breaking the five
  assert.equal(at(s, 'M10'), EMPTY);
  assert.equal(s.winner, null);
  assert.equal(s.pendingFive, null);
});

test('Boat: a breakable five that survives wins after the opponent\'s move', () => {
  const s = position('boat', { p1: ['K10', 'L10', 'M10', 'N10', 'M11'], p2: ['M12'] });
  play(s, 'O10');
  play(s, 'A1'); // P2 ignores it
  assert.equal(s.winner, P1);
});

test('Boat: an unbreakable five wins at once', () => {
  const s = position('boat', { p1: ['K10', 'L10', 'M10', 'N10'] });
  play(s, 'O10');
  assert.equal(s.winner, P1);
});

test('undo restores captures, poofs, banked fives and the turn', () => {
  const s = position('pente', { p1: ['K10'], p2: ['L10', 'M10'] });
  const before = s.board.slice();
  play(s, 'N10');
  undoMove(s);
  assert.deepEqual(Array.from(s.board), Array.from(before));
  assert.equal(s.captured[P1], 0);
  assert.equal(s.toMove, P1);

  const t = position('poof', { p1: ['K10', 'N10'], p2: ['L10'], toMove: P2 });
  const b2 = t.board.slice();
  play(t, 'M10');
  undoMove(t);
  assert.deepEqual(Array.from(t.board), Array.from(b2));
  assert.equal(t.captured[P1], 0);
});

test('helpers: winning points, capture chances, open fours', () => {
  const s = position('pente', { p1: ['K10', 'L10', 'M10', 'N10'], p2: ['F5', 'G5'], toMove: P1 });
  const wins = winningPointsFor(s, P1).map(([x, y]) => coordName(x, y)).sort();
  assert.deepEqual(wins, ['J10', 'O10']);
  const caps = captureChancesFor(s, P1);
  assert.equal(caps.length, 0);
  const t = position('pente', { p1: ['K10', 'L10', 'M10'] });
  const fours = openFourPointsFor(t, P1).map(([x, y]) => coordName(x, y)).sort();
  assert.deepEqual(fours, ['J10', 'N10']);
});

test('Five + Captures: once a five is made, its stones can\'t be captured', () => {
  const put = (s, list, p) => { for (const c of list) s.board[idx(...parseCoord(c))] = p; };
  for (const [variantId, expectCapture] of [['five-captures', false], ['pente', true]]) {
    const s = newGame(resolveVariant(variantId, { capturePairs: 5 }));
    put(s, ['K10', 'L10', 'M10', 'N10', 'N11'], P1);
    put(s, ['N12', 'C3', 'D16'], P2);
    s.ply = 20; s.toMove = P1;
    applyMove(s, ...parseCoord('O10')); // Gold makes five K10–O10
    if (variantId === 'pente') { assert.equal(s.winner, P1); continue; }
    assert.equal(s.banked[P1].length, 1);
    // Blue brackets the N10–N11 pair from below: N10 is part of the five, so nothing is captured.
    assert.equal(captureChancesFor(s, P2).some((c) => c.x === 13 && c.y === 10), expectCapture);
    const rec = applyMove(s, ...parseCoord('N9'));
    assert.equal(rec.captured.length, 0);
    assert.equal(s.board[idx(...parseCoord('N10'))], P1);
  }
});
