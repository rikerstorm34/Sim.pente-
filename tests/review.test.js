import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newGame, parseCoord, idx, P1, P2 } from '../js/rules.js';
import { resolveVariant } from '../js/variants.js';
import { classify, explain, buildReview } from '../js/review.js';
import { FORCED } from '../js/ai.js';

const c = (n) => parseCoord(n);
function position(variantId, { p1 = [], p2 = [], toMove = P1 } = {}) {
  const s = newGame(resolveVariant(variantId));
  for (const n of p1) { const [x, y] = c(n); s.board[idx(x, y)] = P1; }
  for (const n of p2) { const [x, y] = c(n); s.board[idx(x, y)] = P2; }
  s.toMove = toMove; s.ply = 10;
  return s;
}

test('classify: engine move is Best; losses map to grades', () => {
  assert.equal(classify({ best: [1, 1], bestScore: 0, playedScore: 0 }, [1, 1]).cls, 'best');
  assert.equal(classify({ best: [1, 1], bestScore: 0, playedScore: -20 }, [2, 2]).cls, 'excellent');
  assert.equal(classify({ best: [1, 1], bestScore: 0, playedScore: -400 }, [2, 2]).cls, 'inaccuracy');
  assert.equal(classify({ best: [1, 1], bestScore: 0, playedScore: -4000 }, [2, 2]).cls, 'blunder');
  assert.equal(classify({ best: [1, 1], bestScore: FORCED * 2, playedScore: 100 }, [2, 2]).cls, 'missedWin');
  assert.equal(classify({ best: null, bestScore: 0, playedScore: null }, [2, 2]), null);
});

test('explain: points out a pair left open to capture', () => {
  // Gold plays L10 next to K10 while blue sits at J10: blue can capture K10–L10 at M10.
  const s = position('pente', { p1: ['K10'], p2: ['J10', 'C3'] });
  const r = explain(s, c('L10'), { best: c('K12'), reply: c('M10') }, { cls: 'mistake' }, { 1: 'You', 2: 'Ludo' });
  assert.match(r.text, /Left K10–L10 open/);
  assert.match(r.text, /M10/);
  assert.deepEqual(r.tags, ['Defending pairs']);
});

test('explain: praises a capture and a block', () => {
  const s = position('pente', { p1: ['K10'], p2: ['L10', 'M10'] });
  const r = explain(s, c('N10'), { best: c('N10') }, { cls: 'best' }, { 1: 'You', 2: 'Ludo' });
  assert.match(r.text, /Captured 2 stones/);
});

test('explain: missing an immediate win', () => {
  const s = position('pente', { p1: ['K10', 'L10', 'M10', 'N10'], p2: ['J10', 'C3'] });
  const r = explain(s, c('C5'), { best: c('O10') }, { cls: 'missedWin' }, { 1: 'You', 2: 'Ludo' });
  assert.match(r.text, /Missed a win: O10/);
  assert.ok(r.tags.includes('Finishing'));
});

test('buildReview: ratings, accuracy, curve and key moments', () => {
  const moves = [[9, 9], [10, 9], [12, 6], [11, 9], [3, 3]];
  const an = [
    { best: [9, 9], bestScore: 0, playedScore: 0 },
    { best: [10, 9], bestScore: 0, playedScore: 0 },
    { best: [12, 6], bestScore: 100, playedScore: 100 },
    { best: [11, 9], bestScore: -50, playedScore: -50 },
    { best: [12, 9], bestScore: 3000, playedScore: -200 }, // gold skips the capture at N10
    { best: null, bestScore: 200, playedScore: null },
  ];
  const r = buildReview({ variantId: 'pente', options: {}, moves, you: P1 }, an, { you: 'You', them: 'Ludo' });
  assert.equal(r.moves.length, 5);
  assert.equal(r.curve.length, 6);
  const last = r.moves[4];
  assert.equal(last.isYou, true);
  assert.equal(last.cls, 'blunder');
  assert.match(last.text, /Missed a capture at N10/);
  assert.equal(r.keyMoments.length, 1);
  assert.ok(r.accuracy < 100 && r.accuracy > 0);
  assert.equal(r.focus[0][0], 'Captures');
});

test('a move that keeps a forced win by another route is not called a missed win', async () => {
  const { analysePosition } = await import('../js/ai.js');
  const { classify } = await import('../js/review.js');
  const { newGame, idx, parseCoord, P1, P2 } = await import('../js/rules.js');
  const { resolveVariant } = await import('../js/variants.js');
  // Two separate open threes for Gold: an open four from either one wins.
  const s = newGame(resolveVariant('pente'));
  for (const c of ['K10', 'L10', 'M10', 'K5', 'L5', 'M5']) s.board[idx(...parseCoord(c))] = P1;
  for (const c of ['D16', 'Q16', 'D3', 'R3']) s.board[idx(...parseCoord(c))] = P2;
  s.ply = 20; s.toMove = P1;
  for (const played of ['N10', 'N5', 'J10', 'J5']) {
    const a = analysePosition(s, parseCoord(played), { timeMs: 300 });
    const r = classify(a, parseCoord(played));
    assert.notEqual(r && r.cls, 'missedWin', `${played} wins too`);
  }
});
