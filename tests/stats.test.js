import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStats } from '../js/stats.js';

const win = (o = {}) => ({ result: 'win', reason: 'five', level: 1, variantId: 'pente', you: 1, plies: 21, ...o });
const loss = (o = {}) => ({ result: 'loss', reason: 'captures', level: 2, variantId: 'pente', you: 2, plies: 30, ...o });

test('empty history gives an empty record', () => {
  const s = computeStats([]);
  assert.equal(s.total.played, 0);
  assert.equal(s.total.winPct, null);
});

test('win rate, streaks and breakdowns (newest first)', () => {
  const h = [win(), win(), loss(), win({ variantId: 'keryo', level: 3 }), { result: 'unfinished', moves: [] }, loss({ result: 'resigned', reason: 'resign' })];
  const s = computeStats(h);
  assert.equal(s.total.played, 5);
  assert.equal(s.total.wins, 3);
  assert.equal(s.total.losses, 2);
  assert.equal(s.total.winPct, 60);
  assert.equal(s.unfinished, 1);
  assert.deepEqual(s.streak, { current: 2, kind: 'win', bestWin: 2 });
  assert.deepEqual(s.recent, ['W', 'W', 'L', 'W', 'L']);
  const keryo = s.byVariant.find((r) => r.key === 'keryo');
  assert.equal(keryo.wins, 1);
  assert.equal(s.byLevel[0].key, 1);
  assert.deepEqual(s.lossesBy.map(([k]) => k).sort(), ['Captures', 'Resignation']);
});

test('captures are counted by replaying saved moves', () => {
  // Gold K10, blue L10, gold N10?? Build a capture: gold K10 (centre), blue L10, gold N13 (3 away),
  // blue M10, gold N10 captures L10+M10.
  const moves = [[9, 9], [10, 9], [12, 6], [11, 9], [12, 9]];
  const s = computeStats([win({ moves, plies: moves.length })]);
  assert.equal(s.captures.games, 1);
  assert.equal(s.captures.avgYou, 1); // one pair
  assert.equal(s.captures.avgThem, 0);
});

test('old entries without move lists are tolerated', () => {
  const s = computeStats([{ result: 'win', variantName: 'Pente', botName: 'Pip', level: 1, moves: 17 }]);
  assert.equal(s.total.wins, 1);
  assert.equal(s.captures, null);
});
