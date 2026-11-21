import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GAMES_1983, PLAYABLE_1983, toCoord, masterEntry, openingOf, roundOf } from '../js/master-games.js';
import { newGame, applyMove, parseCoord, illegalReason } from '../js/rules.js';
import { resolveVariant } from '../js/variants.js';

test('notation converts relative to the centre', () => {
  assert.equal(toCoord('0'), 'K10');
  assert.equal(toCoord('R1U1'), 'L11');
  assert.equal(toCoord('L3D2*'), 'G8');
  assert.equal(toCoord('U3'), 'K13');
});

test('every playable 1983 game replays legally, with captures exactly where the booklet marks them', () => {
  assert.ok(PLAYABLE_1983.length >= 100);
  for (const g of PLAYABLE_1983) {
    const s = newGame(resolveVariant('pente'));
    const toks = g.moves.trim().split(/\s+/);
    toks.forEach((t, i) => {
      const [x, y] = parseCoord(toCoord(t));
      assert.equal(illegalReason(s, x, y), null, `game ${g.n} move ${i + 1} (${t}) is legal`);
      const rec = applyMove(s, x, y);
      assert.equal(rec.captured.length > 0, t.endsWith('*'), `game ${g.n} move ${i + 1} (${t}) capture mark`);
      if (i < toks.length - 1) assert.equal(s.winner, null, `game ${g.n} isn't over before its last move`);
    });
  }
});

test('game numbers are unique; entries, rounds and openings resolve', () => {
  const ns = GAMES_1983.map((g) => g.n);
  assert.equal(new Set(ns).size, ns.length);
  const e = masterEntry(89, 'B');
  assert.equal(e.you, 2);
  assert.equal(e.moves[0][0], 9);
  assert.equal(openingOf(89), 'Wedge');
  assert.equal(roundOf(119), 'Final');
  assert.equal(masterEntry(14), null, 'doubtful games are not offered');
});
