import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHistory, encodeMoves, decodeMoves } from '../js/history.js';

function fakeStorage(maxChars = Infinity) {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      const total = [...m.entries()].reduce((a, [kk, vv]) => a + (kk === k ? 0 : vv.length), 0) + v.length;
      if (total > maxChars) { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }
      m.set(k, v);
    },
    removeItem: (k) => m.delete(k),
    size: () => [...m.values()].reduce((a, v) => a + v.length, 0),
  };
}
const game = (i, extra = {}) => ({ id: 'g' + i, variantId: 'pente', options: { tournamentRule: true, capturePairs: 5 }, you: 1, level: 2, result: i % 3 ? 'win' : 'loss', reason: 'five', moves: [[9, 9], [10, 10], [12, 9], [13, 13]], plies: 4, undos: 0, at: i, ...extra });

test('moves pack into two letters each and back', () => {
  const mv = [[0, 0], [18, 18], [9, 9]];
  assert.equal(encodeMoves(mv), 'aassjj');
  assert.deepEqual(decodeMoves('aassjj'), mv);
});

test('5000 games stay openable; older ones are kept for statistics only', () => {
  const st = fakeStorage();
  const h = createHistory(st, { limit: 5000 });
  for (let i = 0; i < 5200; i++) h.add(game(i));
  assert.equal(h.games().length, 5000);
  assert.equal(h.retiredCount(), 200);
  assert.equal(h.forStats().length, 5200);
  assert.equal(h.find('g5199').moves.length, 4);
  assert.equal(h.find('g10'), null, 'retired games can\'t be opened');
  assert.ok(st.size() < 2_000_000, `5000 games use ${st.size()} characters`);
  // Survives a reload.
  const h2 = createHistory(st, { limit: 5000 });
  assert.equal(h2.games().length, 5000);
  assert.equal(h2.forStats().length, 5200);
  assert.equal(h2.find('g5199').botName, 'Juno');
});

test('variations belong to their game and are not counted', () => {
  const h = createHistory(fakeStorage());
  h.add(game(1));
  h.add(game(2, { parent: 'g1', fromPly: 3 }));
  h.add(game(3, { parent: 'g1', fromPly: 1 }));
  assert.equal(h.games().length, 1);
  assert.equal(h.forStats().length, 1);
  assert.deepEqual(h.variationsOf('g1').map((e) => e.id), ['g3', 'g2']);
});

test('when storage is full, the oldest games are retired instead of losing the new one', () => {
  const st = fakeStorage(60_000);
  let freed = 0;
  const h = createHistory(st, { onQuota: () => (freed++ < 1) });
  for (let i = 0; i < 1500; i++) h.add(game(i));
  assert.ok(h.find('g1499'), 'newest game kept');
  assert.ok(h.games().length < 1500 && h.games().length > 100);
  assert.equal(h.forStats().length, 1500);
});

test('the old format is converted', () => {
  const st = fakeStorage();
  st.setItem('gts.history', JSON.stringify([game(7), game(6)]));
  const h = createHistory(st);
  assert.equal(h.games().length, 2);
  assert.equal(st.getItem('gts.history'), null);
  assert.ok(st.getItem('gts.games'));
});
