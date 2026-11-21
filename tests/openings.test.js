// Choose-your-side openings: D-Pente, DK-Pente, Swap2.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveVariant } from '../js/variants.js';
import { newGame, applyMove, P1, P2, illegalReason, CENTER } from '../js/rules.js';
import { openingStatus, seatColour, runOpening } from '../js/openings.js';

// Small repeatable random source.
function seeded(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test('D-Pente: opener places four stones, then the chooser keeps Blue or takes Gold', () => {
  for (let k = 0; k < 4; k++) assert.deepEqual(openingStatus('d-pente', k, []), { phase: 'place', by: 'opener', setup: 4 });
  const d = openingStatus('d-pente', 4, []);
  assert.equal(d.phase, 'decide');
  assert.equal(d.by, 'chooser');
  assert.deepEqual(d.choices, ['keep', 'swap']);
  assert.equal(openingStatus('d-pente', 4, ['keep']).phase, 'play');
  assert.equal(seatColour('d-pente', ['keep'], 2), P2);
  assert.equal(seatColour('d-pente', ['keep'], 1), P1);
  assert.equal(seatColour('d-pente', ['swap'], 2), P1);
  assert.equal(seatColour('d-pente', [], 2), null);
});

test('Swap2: three stones, then Gold, Blue, or two more stones and the opener chooses', () => {
  assert.equal(openingStatus('swap2', 2, []).by, 'opener');
  assert.deepEqual(openingStatus('swap2', 3, []).choices, ['gold', 'blue', 'more']);
  assert.equal(seatColour('swap2', ['gold'], 2), P1);
  assert.equal(seatColour('swap2', ['blue'], 2), P2);
  const more = openingStatus('swap2', 3, ['more']);
  assert.deepEqual([more.phase, more.by, more.setup], ['place', 'chooser', 5]);
  const back = openingStatus('swap2', 5, ['more']);
  assert.deepEqual([back.phase, back.by, back.choices], ['decide', 'opener', ['gold', 'blue']]);
  assert.equal(seatColour('swap2', ['more', 'gold'], 1), P1);
  assert.equal(seatColour('swap2', ['more', 'gold'], 2), P2);
  assert.equal(seatColour('swap2', ['more', 'blue'], 1), P2);
  assert.equal(openingStatus('swap2', 5, ['more', 'blue']).phase, 'play');
});

test('Opening rules in the engine: D-Pente starts anywhere, Swap2 starts on the centre, no tournament rule', () => {
  const d = newGame(resolveVariant('d-pente'));
  assert.equal(illegalReason(d, 2, 3), null);
  const s = newGame(resolveVariant('swap2'));
  assert.ok(illegalReason(s, 2, 3));
  applyMove(s, CENTER, CENTER);
  applyMove(s, CENTER + 1, CENTER);
  assert.equal(illegalReason(s, CENTER + 1, CENTER + 1), null, 'third stone may sit next to the centre');
  const dk = resolveVariant('dk-pente');
  assert.deepEqual([dk.captureSizes, dk.captureWinStones, dk.choice], [[2, 3], 15, 'd-pente']);
});

test('Bots set up legal openings and make valid choices', () => {
  for (const id of ['d-pente', 'swap2']) {
    const s = newGame(resolveVariant(id));
    const stones = runOpening(s, 'setup', { rng: seeded(7) });
    assert.equal(stones.length, id === 'd-pente' ? 4 : 3);
    for (const [x, y] of stones) { assert.equal(illegalReason(s, x, y), null); applyMove(s, x, y); }
    const st = openingStatus(id === 'd-pente' ? 'd-pente' : 'swap2', s.history.length, []);
    const pick = runOpening(s, 'decide', { choices: st.choices, rng: seeded(3) });
    assert.ok(st.choices.includes(pick), pick);
    if (id === 'swap2') {
      const two = runOpening(s, 'more', { rng: seeded(5) });
      assert.equal(two.length, 2);
      for (const [x, y] of two) { assert.equal(illegalReason(s, x, y), null); applyMove(s, x, y); }
      assert.equal(s.toMove, P2, 'Blue moves after five set-up stones');
    }
  }
});
