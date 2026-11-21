import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, parseCoord, idx, P1, P2 } from '../js/rules.js';
import { resolveVariant } from '../js/variants.js';
import { shapesAt, describeMove, canonical, openingName, computePatterns } from '../js/patterns.js';

function position({ p1 = [], p2 = [], toMove = P1 } = {}) {
  const s = newGame(resolveVariant('pente'));
  for (const n of p1) { const [x, y] = parseCoord(n); s.board[idx(x, y)] = P1; }
  for (const n of p2) { const [x, y] = parseCoord(n); s.board[idx(x, y)] = P2; }
  s.toMove = toMove; s.ply = 10;
  return s;
}
const at = (n) => parseCoord(n);

test('shapes: open three, split three, four, open four, pair', () => {
  const s = position({ p1: ['K10', 'L10'] });
  assert.deepEqual(shapesAt(s.board, ...at('M10'), P1).map((x) => x.shape), ['tria']);
  assert.deepEqual(shapesAt(s.board, ...at('N10'), P1).map((x) => x.shape), ['split3']);
  const t = position({ p1: ['K10', 'L10', 'M10'] });
  assert.deepEqual(shapesAt(t.board, ...at('N10'), P1).map((x) => x.shape), ['openFour']);
  const u = position({ p1: ['K10', 'L10', 'M10'], p2: ['J10'] });
  assert.deepEqual(shapesAt(u.board, ...at('N10'), P1).map((x) => x.shape), ['four']);
  const v = position({ p1: ['K10'] });
  assert.deepEqual(shapesAt(v.board, ...at('L10'), P1).map((x) => x.shape), ['pair']);
});

test('describeMove: captures, capture threats, blocks and exposed pairs', () => {
  const s = position({ p1: ['K10'], p2: ['L10', 'M10'] });
  assert.equal(describeMove(s, ...at('N10')).captured, 2);
  const t = position({ p1: ['F5'], p2: ['L10', 'M10'] });
  assert.equal(describeMove(t, ...at('K10')).capThreat, true);
  const u = position({ p1: ['A1'], p2: ['K10', 'L10', 'M10'] });
  assert.equal(describeMove(u, ...at('N10')).blocked, 'three');
  const v = position({ p1: ['K10'], p2: ['J10'] });
  assert.equal(describeMove(v, ...at('L10')).exposed, true);
});

test('openings are the same under rotation and reflection', () => {
  const a = canonical([[1, 0], [0, 3]]);
  const b = canonical([[0, -1], [3, 0]]);
  const c = canonical([[-1, 0], [0, -3]]);
  assert.equal(a.key, b.key);
  assert.equal(a.key, c.key);
  assert.match(openingName(a.offsets), /Blue touching, side · Gold 3 away, straight/);
});

test('computePatterns: style, shapes with bot replies, openings', () => {
  // A short game as Gold: K10, L10 (blue touching), K13 (gold 3 straight), L11, K12, ...
  const moves = [[9, 9], [10, 9], [9, 6], [10, 8], [9, 7], [10, 7], [9, 8]];
  const h = [
    { result: 'win', variantId: 'pente', options: {}, you: P1, level: 1, moves },
    { result: 'loss', variantId: 'pente', options: {}, you: P1, level: 1, moves: [[9, 9], [9, 10], [6, 9], [9, 11]] },
    { result: 'unfinished', variantId: 'pente', you: P1, moves: [[9, 9]] },
  ];
  const r = computePatterns(h);
  assert.equal(r.games, 2);
  assert.ok(r.style.moves > 0);
  assert.equal(r.openings.asGold.length, 1, 'both games are the same opening up to symmetry');
  assert.equal(r.openings.asGold[0].games, 2);
  assert.equal(r.openings.asGold[0].winPct, 50);
  assert.ok(r.shapes.length > 0);
  const tria = r.shapes.find((x) => x.shape === 'tria' || x.shape === 'openFour' || x.shape === 'split3');
  assert.ok(tria, 'gold built a three-or-better');
});
