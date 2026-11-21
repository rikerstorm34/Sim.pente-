// Connect6: one stone first, then two a turn; six or more wins; no captures.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVariant } from '../js/variants.js';
import { newGame, applyMove, undoMove, parseCoord, P1, P2, moverOf, illegalReason } from '../js/rules.js';
import { chooseMove } from '../js/ai.js';
import { planTurn } from '../js/connect6.js';
import { analyse } from '../js/coach.js';

const v = resolveVariant('connect6');
const play = (s, ...names) => { for (const n of names) applyMove(s, ...parseCoord(n)); };

test('Turn order: Gold one stone, then two stones each', () => {
  const order = Array.from({ length: 9 }, (_, i) => moverOf(v, i));
  assert.deepEqual(order, [P1, P2, P2, P1, P1, P2, P2, P1, P1]);
  const s = newGame(v);
  assert.ok(illegalReason(s, 0, 0), 'first stone on the centre');
  play(s, 'K10');
  assert.equal(s.toMove, P2);
  play(s, 'A1');
  assert.equal(s.toMove, P2, 'Blue places a second stone');
  play(s, 'A2');
  assert.equal(s.toMove, P1);
  undoMove(s);
  assert.equal(s.toMove, P2);
});

test('Six in a row wins, five does not, and there are no captures', () => {
  const s = newGame(v);
  // Gold builds K10..O10 (five), Blue plays far away.
  play(s, 'K10', 'A1', 'A3', 'L10', 'M10', 'A5', 'A7', 'N10', 'O10');
  assert.equal(s.winner, null, 'five is not enough');
  play(s, 'A9', 'A11');
  play(s, 'P10');
  assert.equal(s.winner, P1);
  assert.equal(s.winReason, 'five');

  const t = newGame(v);
  play(t, 'K10', 'L10', 'M10', 'N10');
  assert.equal(t.board[parseCoord('L10')[1] * 19 + parseCoord('L10')[0]], P2, 'bracketed pair is not captured');
});

test('The bot finishes six and covers threats', () => {
  // Gold has four in a row with both ends open and it is Gold's turn (two stones): win.
  const s = newGame(v);
  play(s, 'K10', 'A1', 'A3', 'L10', 'M10', 'A5', 'A7', 'N10', 'C17', 'C15', 'C13');
  // Now Gold to move? order: ...
  assert.equal(s.toMove, P1);
  const m1 = chooseMove(s, 3);
  applyMove(s, m1.x, m1.y);
  const m2 = chooseMove(s, 3);
  applyMove(s, m2.x, m2.y);
  assert.equal(s.winner, P1);

  // Blue must cover Gold's four: every Blue plan blocks it.
  const b = newGame(v);
  play(b, 'K10', 'A1', 'A3', 'L10', 'M10', 'A5', 'C3', 'N10', 'S19');
  assert.equal(b.toMove, P2);
  const plan = planTurn(b, 4, () => 0.5);
  const blocked = (cells) => {
    const t = { ...b, board: b.board.slice() };
    for (const c of cells) t.board[c] = P2;
    // No window of six on row 10 left with only gold stones and four of them.
    let open = false;
    for (let x0 = 0; x0 <= 13; x0++) {
      let g = 0, bl = 0;
      for (let k = 0; k < 6; k++) { const c = t.board[9 * 19 + x0 + k]; if (c === P1) g++; else if (c === P2) bl++; }
      if (g >= 4 && !bl) open = true;
    }
    return !open;
  };
  assert.ok(blocked(plan.stones), 'plan covers the four');
  assert.ok(analyse(b, P2).some((n) => n.tag === 'Must block'), 'coach warns about the four');
});
