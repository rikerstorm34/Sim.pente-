// Renju (15×15, limits on Gold) and Ninuki-Renju (exact five, no double threes, captures).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVariant } from '../js/variants.js';
import { newGame, applyMove, illegalReason, parseCoord, coordName, setFrame, idx, P1, P2, WALL, CENTER } from '../js/rules.js';
import { chooseMove } from '../js/ai.js';

function position(variantId, { p1 = [], p2 = [], toMove = P1 } = {}) {
  const v = resolveVariant(variantId);
  setFrame(v.boardSize || 19);
  const s = newGame(v);
  for (const c of p1) s.board[idx(...parseCoord(c))] = P1;
  for (const c of p2) s.board[idx(...parseCoord(c))] = P2;
  s.toMove = toMove;
  s.ply = 10;
  return s;
}
const why = (s, c) => illegalReason(s, ...parseCoord(c));

test('Renju board: 15×15 in the middle of the grid, named A–P (no I) and 1–15', () => {
  setFrame(15);
  assert.equal(coordName(CENTER, CENTER), 'H8');
  assert.deepEqual(parseCoord('A1'), [2, 16]);
  assert.deepEqual(parseCoord('P15'), [16, 2]);
  assert.throws(() => parseCoord('Q1'));
  const s = newGame(resolveVariant('renju'));
  assert.equal(s.board[idx(0, 0)], WALL);
  assert.equal(s.board[idx(2, 2)], 0);
  assert.equal(illegalReason(s, 1, 9), 'Off the board.');
  setFrame(19);
  assert.equal(coordName(CENTER, CENTER), 'K10');
});

test('Renju opening: centre, then next to it, then within two points', () => {
  setFrame(15);
  const s = newGame(resolveVariant('renju'));
  assert.ok(why(s, 'A1'));
  applyMove(s, ...parseCoord('H8'));
  assert.ok(why(s, 'H10'), 'second stone must touch the centre');
  applyMove(s, ...parseCoord('J9'));
  assert.ok(why(s, 'L8'), 'third stone within two points');
  assert.equal(why(s, 'K8'), null);
  setFrame(19);
});

test('Renju: Gold may not make a double three, double four or overline; Blue may', () => {
  // Double three: H8 joins G8-J8 across and H9-H10 down, both open.
  let s = position('renju', { p1: ['G8', 'J8', 'H9', 'H10'] });
  assert.match(why(s, 'H8'), /double three/);
  s = position('renju', { p2: ['G8', 'J8', 'H9', 'H10'], toMove: P2 });
  assert.equal(why(s, 'H8'), null, 'Blue has no limits');
  // Double four: H8 makes E8-F8-G8-H8 (+ D8 or J8) and H4..H7 + H8.
  s = position('renju', { p1: ['E8', 'F8', 'G8', 'H5', 'H6', 'H7'], p2: ['D8', 'H4'] });
  assert.match(why(s, 'H8'), /double four/);
  // Overline: filling the gap makes six.
  s = position('renju', { p1: ['C8', 'D8', 'E8', 'G8', 'H8'] });
  assert.match(why(s, 'F8'), /overline/);
  // A five wins even if it also makes another four.
  s = position('renju', { p1: ['D8', 'E8', 'F8', 'G8', 'H5', 'H6', 'H7'], p2: ['C8', 'H4'] });
  assert.equal(why(s, 'H8'), null);
  applyMove(s, ...parseCoord('H8'));
  assert.equal(s.winner, P1);
  // Four-three is allowed.
  s = position('renju', { p1: ['E8', 'F8', 'G8', 'H9', 'H10'], p2: ['D8'] });
  assert.equal(why(s, 'H8'), null);
  setFrame(19);
});

test('Renju: Gold needs exactly five; Blue wins with six', () => {
  let s = position('renju', { p2: ['C8', 'D8', 'E8', 'G8', 'H8'], toMove: P2 });
  applyMove(s, ...parseCoord('F8'));
  assert.equal(s.winner, P2);
  setFrame(19);
});

test('Ninuki-Renju: exact five, no double threes (unless stopping a five), unperfect five', () => {
  // Overline doesn't win.
  let s = position('ninuki', { p1: ['F10', 'G10', 'H10', 'K10', 'L10'] });
  applyMove(s, ...parseCoord('J10'));
  assert.equal(s.winner, null);
  // Double three forbidden for both sides.
  s = position('ninuki', { p2: ['J10', 'L10', 'K11', 'K12'], toMove: P2 });
  assert.match(why(s, 'K10'), /double three/);
  // ...unless it blocks a five: Gold threatens K10 (F10..J10 four? use a diagonal five point).
  s = position('ninuki', { p1: ['K6', 'K7', 'K8', 'K9'], p2: ['J10', 'L10', 'K11', 'K12'], toMove: P2 });
  assert.equal(why(s, 'K10'), null, 'blocking a five is allowed');
  // Opening: second stone next to the centre, Gold's second at least 3 away.
  s = newGame(resolveVariant('ninuki'));
  applyMove(s, CENTER, CENTER);
  assert.ok(illegalReason(s, CENTER + 2, CENTER));
  applyMove(s, CENTER + 1, CENTER);
  assert.ok(illegalReason(s, CENTER + 2, CENTER + 2));
  assert.equal(illegalReason(s, CENTER + 3, CENTER), null);
  // Unperfect five: a five that can be broken by a capture waits one move.
  s = position('ninuki', { p1: ['K10', 'L10', 'M10', 'N10', 'L11'], p2: ['L12', 'Q3'] });
  applyMove(s, ...parseCoord('O10'));
  assert.equal(s.winner, null, 'Blue gets one move to capture L10-L11');
  applyMove(s, ...parseCoord('L9'));
  assert.equal(s.winner, null, 'the five was broken');
});

test('Renju bots never play a forbidden move', () => {
  setFrame(15);
  const s = newGame(resolveVariant('renju'));
  for (let i = 0; i < 30 && s.winner === null; i++) {
    const m = chooseMove(s, 2, Math.random, { timeScale: 0.3 });
    assert.equal(illegalReason(s, m.x, m.y), null);
    applyMove(s, m.x, m.y);
  }
  setFrame(19);
});
