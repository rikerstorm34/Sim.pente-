import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PUZZLE_BANK } from '../js/puzzle-bank.js';
import { collection, buildPuzzle, transformCoord, emptyProgress, record, pickNext, summary, mineItems, hintRing } from '../js/puzzles.js';
import { setupPosition, checkMove, parseCoord, SEARCH } from '../js/lesson-engine.js';
import { masterStats, openingTree } from '../js/master-stats.js';

SEARCH.forcedWinMs = 12000;
SEARCH.replyMs = 2000;
SEARCH.replyNodes = 80000;

test('symmetries keep the centre and are reversible', () => {
  for (let k = 0; k < 8; k++) assert.equal(transformCoord('K10', k), 'K10');
  const inv = [0, 3, 2, 1, 4, 5, 6, 7];
  for (let k = 0; k < 8; k++) assert.equal(transformCoord(transformCoord('M13', k), inv[k]), 'M13');
  const seen = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((k) => transformCoord('M13', k)));
  assert.equal(seen.size, 8, 'eight different variations');
});

test('the puzzle bank is large and every champion puzzle is correct (some checked in a variation)', () => {
  assert.ok(PUZZLE_BANK.length >= 300, `bank has ${PUZZLE_BANK.length} puzzles`);
  const items = collection([], {}).filter((i) => i.source === 'champions');
  assert.equal(items.length, PUZZLE_BANK.length);
  items.forEach((item, i) => {
    const sym = i % 5 === 0 ? (i / 5) % 8 : 0;
    const pz = buildPuzzle(item, { sym, swap: i % 3 === 0 });
    const s = setupPosition(pz.setup);
    const sg = pz.stages[0];
    assert.equal(s.winner, null, `${item.id}: game still on`);
    const r = checkMove(s, ...parseCoord(sg.answer), sg.goal);
    assert.ok(r.ok, `${item.id} (variation ${sym}): ${sg.answer} meets the goal`);
    assert.ok(sg.prompt && sg.hint && sg.success, `${item.id} has text`);
  });
});

test('lesson puzzles are in the trainer too', () => {
  const items = collection([], {});
  assert.ok(items.some((i) => i.source === 'lessons' && i.origin.lessonId === '1.1'));
});

test('spaced repetition: misses come back soon, solves go further out', () => {
  const items = [{ id: 'a', level: 1 }, { id: 'b', level: 1 }, { id: 'c', level: 2 }, { id: 'd', level: 3 }, { id: 'e', level: 3 }, { id: 'f', level: 4 }];
  const p = emptyProgress();
  const rnd = () => 0;
  const first = pickNext(items, p, { rnd });
  assert.equal(first.level, 1, 'easy puzzles first');
  record(p, 'a', false);
  assert.equal(p.items.a.due, 1 + 4);
  for (const id of ['b', 'c', 'd', 'e']) record(p, id, true);
  assert.equal(pickNext(items, p, { rnd }).id, 'a', 'the missed puzzle comes back once due');
  record(p, 'a', true);
  assert.ok(p.items.a.due > p.count + 4);
  assert.equal(p.streak, 5);
  assert.equal(summary(items, p).solved, 5);
});

test('missed wins in your own analysed games become puzzles', () => {
  const history = [{ id: 'g1', you: 1, variantId: 'pente', botName: 'Vega', moves: [[9, 9], [10, 10], [12, 9], [11, 11]], at: 1 }];
  const analysis = { g1: { plies: [null, null, { forcedWin: true, best: [13, 9], bestScore: 9000, playedScore: 0 }, null] } };
  const items = mineItems(history, analysis);
  assert.equal(items.length, 1);
  assert.equal(items[0].mine.best, 'O10');
  const ring = hintRing('O10', () => true, 3);
  assert.equal(ring.length, 4);
  assert.ok(ring.some(([x, y]) => x === 13 && y === 9));
});

test('master statistics add up', () => {
  const st = masterStats();
  const o = st.overview;
  assert.equal(o.endings.five + o.endings.captures + o.endings.resigned, o.games);
  assert.equal(st.players.reduce((a, p) => a + p.games, 0), o.games * 2);
  assert.equal(st.players.reduce((a, p) => a + p.wins, 0), o.games);
  assert.equal(st.openings.reduce((a, x) => a + x.games, 0), o.games);
  const w = openingTree('Wedge');
  assert.deepEqual(w.prefix, ['K10', 'L11', 'N10', 'N11', 'M11']);
  assert.ok(w.games >= 20 && w.next[0].move === 'L12');
});

test('lesson puzzles still work with the colours swapped (as advanced lessons show them)', async () => {
  const { swapColours, swapColourWords, canSwapColours } = await import('../js/lesson-engine.js');
  const { applyMove } = await import('../js/rules.js');
  // Renju treats the colours differently, so its puzzles are never swapped.
  const items = collection([], {}).filter((i) => i.source === 'lessons' && !i.step.setup.moves && canSwapColours(i.step.setup));
  assert.ok(items.length > 50);
  for (const item of items) {
    const pz = buildPuzzle(item, { sym: 0, swap: true });
    let s = setupPosition(pz.setup);
    const orig = setupPosition(item.step.setup);
    assert.notEqual(s.toMove, orig.toMove, `${item.id}: the other colour is to move`);
    for (const sg of pz.stages) {
      const r = checkMove(s, ...parseCoord(sg.answer), sg.goal);
      assert.ok(r.ok, `${item.id} swapped: ${sg.answer}`);
      s = r.after;
      if (sg.reply) { applyMove(s, ...parseCoord(sg.reply)); assert.equal(s.winner, null); }
    }
  }
  assert.equal(swapColourWords("Blue has a four; block Gold's line."), "Gold has a four; block Blue's line.");
});

test('a replayed puzzle gets a look you have not seen recently', async () => {
  const { nextVariation } = await import('../js/puzzles.js');
  const item = collection([], {}).find((i) => i.source === 'champions');
  const p = emptyProgress();
  const looks = new Set();
  for (let k = 0; k < 16; k++) { const v = nextVariation(item, p); looks.add(`${v.sym}/${v.swap}`); }
  assert.equal(looks.size, 16, 'all 16 looks before any repeats');
});
