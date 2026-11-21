import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, applyMove, parseCoord, coordName, idx, P1, P2 } from '../js/rules.js';
import { resolveVariant, VARIANTS } from '../js/variants.js';
import { chooseMove } from '../js/ai.js';

function seeded(seed = 1) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
}
function position(variantId, { p1 = [], p2 = [], toMove = P1, options = {} } = {}) {
  const s = newGame(resolveVariant(variantId, options));
  for (const c of p1) { const [x, y] = parseCoord(c); s.board[idx(x, y)] = P1; }
  for (const c of p2) { const [x, y] = parseCoord(c); s.board[idx(x, y)] = P2; }
  s.toMove = toMove;
  s.ply = 10;
  return s;
}
const name = (m) => coordName(m.x, m.y);

test('levels 2 and 3 take an immediate five', () => {
  for (const level of [2, 3]) {
    const s = position('pente', { p1: ['K10', 'L10', 'M10', 'N10'], p2: ['K12', 'L12', 'J9'] });
    const m = chooseMove(s, level, seeded(level));
    assert.ok(['J10', 'O10'].includes(name(m)), `level ${level} played ${name(m)}`);
  }
});

test('levels 2 and 3 block an open four threat', () => {
  for (const level of [2, 3]) {
    // P2 to move; P1 has four in a row with one end blocked by P2.
    const s = position('pente', { p1: ['K10', 'L10', 'M10', 'N10'], p2: ['J10', 'C3'], toMove: P2 });
    const m = chooseMove(s, level, seeded(7));
    assert.equal(name(m), 'O10', `level ${level} played ${name(m)}`);
  }
});

test('level 3 takes a capture that wins the game', () => {
  const s = position('pente', { p1: ['K10'], p2: ['L10', 'M10', 'D4'] });
  s.captured[P1] = 8;
  assert.equal(name(chooseMove(s, 3, seeded(3))), 'N10');
});

test('the bot always returns a legal move, including under the tournament rule', () => {
  for (const level of [1, 2, 3]) {
    const s = newGame(resolveVariant('pente'));
    applyMove(s, 9, 9); applyMove(s, 10, 10);
    const m = chooseMove(s, level, seeded(level));
    assert.ok(Math.max(Math.abs(m.x - 9), Math.abs(m.y - 9)) >= 3);
  }
});

test('bot vs bot games finish without errors in every variant', () => {
  for (const v of VARIANTS) {
    const s = newGame(resolveVariant(v.id, { capturePairs: 5 }));
    const rng = seeded(v.id.length);
    let guard = 0;
    while (s.winner === null && guard++ < 160) {
      const level = s.toMove === P1 ? 2 : 1;
      const m = chooseMove(s, level, rng);
      applyMove(s, m.x, m.y);
    }
    assert.ok(guard < 400, v.id);
  }
});
