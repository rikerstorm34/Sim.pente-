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

// --- Engine v2: threat search and the higher levels
import { findVCF } from '../js/ai.js';

test('threat search finds a double-four fork', () => {
  // Row 10: J10 is blocked (blue); gold K10 L10 M10 → N10 makes a four needing O10.
  // Column N: N11 N12 N13 gold, N14 blocked → N10 also makes a four needing N9.
  const s = position('pente', {
    p1: ['K10', 'L10', 'M10', 'N11', 'N12', 'N13'],
    p2: ['J10', 'N14', 'C3', 'D3', 'Q17', 'R2'],
  });
  const m = findVCF(s, P1, 6, Date.now() + 2000);
  assert.ok(m, 'should find a forced win');
  assert.equal(name(m), 'N10');
});

test('a pair that can be captured out of a four stops the threat search', () => {
  // Gold four K10 L10 M10 N10 is blocked at J10 (blue) and needs O10.
  // But gold L10–L11 is a vertical pair with blue at L12: blue L9 captures L10, breaking the four.
  // So playing N10 to make the four is NOT a forced win; with nothing else, no VCF should exist.
  const s = position('pente', {
    p1: ['K10', 'L10', 'M10', 'L11'],
    p2: ['J10', 'L12', 'A1', 'C1', 'E1'],
  });
  const m = findVCF(s, P1, 6, Date.now() + 2000);
  assert.equal(m, null);
});

test('levels 4 and 5 take wins and block threats quickly', () => {
  for (const level of [4, 5]) {
    const a = position('pente', { p1: ['K10', 'L10', 'M10', 'N10'], p2: ['K12', 'L12', 'J9'] });
    assert.ok(['J10', 'O10'].includes(name(chooseMove(a, level, seeded(level), { timeScale: 0.2 }))));
    const b = position('pente', { p1: ['K10', 'L10', 'M10', 'N10'], p2: ['J10', 'C3'], toMove: P2 });
    assert.equal(name(chooseMove(b, level, seeded(level), { timeScale: 0.2 })), 'O10');
  }
});

test('level 4 stops an opponent\'s forced win (the double-four fork)', () => {
  // Blue to move. Gold threatens the N10 fork from the first test. Blue must deal with it.
  const s = position('pente', {
    p1: ['K10', 'L10', 'M10', 'N11', 'N12', 'N13'],
    p2: ['J10', 'N14', 'C3', 'D3', 'Q17'],
    toMove: P2,
  });
  const m = chooseMove(s, 4, seeded(5), { timeScale: 0.5 });
  applyMove(s, m.x, m.y);
  assert.equal(findVCF(s, P1, 8, Date.now() + 2000), null, `blue played ${name(m)} but gold still has a forced win`);
});

test('a bot that runs out of time mid-search still returns a legal move and leaves no trace', () => {
  for (const level of [3, 4, 5]) {
    const s = newGame(resolveVariant('pente'));
    const rng = seeded(level * 11);
    for (let i = 0; i < 24 && s.winner === null; i++) {
      const before = Array.from(s.board).join('');
      const m = chooseMove(s, level, rng, { timeScale: 0.02 }); // almost no time: forces timeouts
      assert.equal(Array.from(s.board).join(''), before, 'the real game must not be changed');
      assert.equal(s.board[idx(m.x, m.y)], 0, `level ${level} picked an occupied point`);
      applyMove(s, m.x, m.y);
    }
  }
});

test('the threat search finds captures that reopen blocked fours (keystones)', () => {
  // Gold's column J10–J13 is blocked by Blue's J9, and the row L10–N10 by Blue's K10.
  // Those two blockers are a pair, so H8 captures both and leaves two five-points.
  const s = newGame(resolveVariant('pente'));
  const put = (list, p) => { for (const c of list) s.board[idx(...parseCoord(c))] = p; };
  put(['J13', 'J12', 'J11', 'J10', 'L10', 'M10', 'N10', 'M8', 'L11'], P1);
  put(['J14', 'K10', 'O10', 'J9', 'K8', 'J7', 'L7', 'K12'], P2);
  s.ply = 20; s.toMove = P1;
  const m = findVCF(s, P1, 6, Date.now() + 3000, 50000);
  assert.ok(m, 'expected a forced win');
  assert.equal(coordName(m.x, m.y), 'H8');
});
