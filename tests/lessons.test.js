import { test } from 'node:test';
import assert from 'node:assert/strict';
import { UNITS, ALL_LESSONS, getLesson, nextLesson } from '../js/lessons.js';
import { BUSY } from '../js/lesson-boards.js';
import { setupPosition, checkMove, parseCoord, SEARCH } from '../js/lesson-engine.js';

SEARCH.forcedWinMs = 12000; // generous for slow CI machines; the app uses 2.5 s
import { applyMove } from '../js/rules.js';
import { VARIANTS } from '../js/variants.js';
import { LEVELS } from '../js/ai.js';

test('lesson ids are unique and in order', () => {
  const ids = ALL_LESSONS.map((l) => l.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(UNITS.length, 10);
  assert.equal(getLesson('1.1').title, 'Five in a row');
  assert.equal(nextLesson('1.1').id, '1.2');
});

test('every lesson has an explanation, puzzles or a game, and valid step fields', () => {
  for (const l of ALL_LESSONS) {
    assert.ok(l.steps.length >= 2, l.id);
    assert.equal(l.steps[0].type, 'read', `${l.id} starts with an explanation`);
    for (const st of l.steps) {
      assert.ok(['read', 'puzzle', 'play'].includes(st.type), `${l.id} step type`);
      if (st.type === 'puzzle') {
        assert.ok(st.level >= 1 && st.level <= 5, `${l.id} ${st.title} level`);
        for (const sg of st.stages) assert.ok(sg.prompt && sg.goal && sg.answer && sg.hint && sg.success, `${l.id} ${st.title} stage fields`);
      }
      if (st.type === 'play') {
        assert.ok(VARIANTS.some((v) => v.id === st.game.variantId), `${l.id} variant`);
        assert.ok(LEVELS[st.game.level], `${l.id} bot level`);
      }
    }
  }
});

test('puzzles get harder within each lesson (never easier than the first)', () => {
  for (const l of ALL_LESSONS) {
    const levels = l.steps.filter((s) => s.type === 'puzzle').map((s) => s.level);
    if (levels.length) assert.ok(levels[levels.length - 1] >= levels[0], `${l.id} difficulty ramps up`);
  }
});

test('every puzzle stage: the answer meets the goal and scripted replies are legal', () => {
  for (const l of ALL_LESSONS) {
    for (const st of l.steps.filter((x) => x.type === 'puzzle')) {
      let s = setupPosition(st.setup);
      st.stages.forEach((sg, i) => {
        const r = checkMove(s, ...parseCoord(sg.answer), sg.goal);
        assert.ok(r.ok, `${l.id} "${st.title}" stage ${i + 1}: answer ${sg.answer} should meet its goal`);
        s = r.after;
        if (sg.reply) {
          assert.equal(s.winner, null, `${l.id} "${st.title}" stage ${i + 1}: game must still be on before the reply`);
          applyMove(s, ...parseCoord(sg.reply));
          assert.equal(s.winner, null, `${l.id} "${st.title}" stage ${i + 1}: the scripted reply must not end the game`);
        } else {
          assert.equal(i, st.stages.length - 1, `${l.id} "${st.title}": only the last stage may omit a reply`);
        }
      });
    }
  }
});

test('puzzles reject at least one plausible wrong move', () => {
  // The first stage of each puzzle must not accept a random far-away move.
  for (const l of ALL_LESSONS) {
    for (const st of l.steps.filter((x) => x.type === 'puzzle')) {
      const s = setupPosition(st.setup);
      const goal = st.stages[0].goal;
      if (goal.kind === 'legal') continue;
      const far = checkMove(s, 0, 0, goal); // A19 corner
      assert.equal(far.ok, false, `${l.id} "${st.title}" should not accept A19`);
    }
  }
});

test('every placed-stone puzzle has a busy, game-like board', () => {
  // Re-run `node tools/dress-puzzles.mjs` after adding or changing a puzzle.
  for (const l of ALL_LESSONS) {
    for (const st of l.steps.filter((x) => x.type === 'puzzle' && !x.setup.moves)) {
      const extra = BUSY[`${l.id}|${st.title}`];
      assert.ok(extra, `${l.id} "${st.title}" has no busy board: run node tools/dress-puzzles.mjs`);
      assert.ok(extra.p1.length + extra.p2.length >= 10, `${l.id} "${st.title}" board is too sparse`);
    }
  }
});

test('every variant has its own lesson', () => {
  const variantsTaught = new Set();
  for (const l of ALL_LESSONS) for (const st of l.steps) {
    if (st.type === 'puzzle') variantsTaught.add(st.setup.variant || 'pente');
    if (st.type === 'play') variantsTaught.add(st.game.variantId);
  }
  for (const v of VARIANTS) assert.ok(variantsTaught.has(v.id), `no lesson uses ${v.id}`);
});
