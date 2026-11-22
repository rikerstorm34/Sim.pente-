// Reversi: rules, bots, lessons and the puzzle bank.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../js/reversi/rules.js';
import * as E from '../js/reversi/engine.js';
import { chooseMove, scoreMoves } from '../js/reversi/ai.js';
import { UNITS } from '../js/reversi/lessons.js';
import { BANK } from '../js/reversi/puzzle-bank.js';

const P = R.parseCell;

test('start position, notation and first moves', () => {
  const s = R.newGame();
  assert.equal(R.cellName(0), 'a1');
  assert.equal(R.cellName(63), 'h8');
  assert.equal(s.board[P('d4')], R.BLUE);
  assert.equal(s.board[P('e4')], R.GOLD);
  assert.equal(s.toMove, R.GOLD);
  assert.deepEqual(R.movesFor(s.board, R.GOLD).map(R.cellName).sort(), ['c4', 'd3', 'e6', 'f5']);
});

test('flips every outflanked line, with no chain reaction', () => {
  const s = E.setupPosition({ gold: ['d5', 'f5'], blue: ['d4', 'e4'], toMove: 'gold' });
  const rec = R.play(s, P('d3'));
  assert.deepEqual(rec.flips.map(R.cellName).sort(), ['d4', 'e4']);
  // No chain: a disc flipped at e4 does not then flip further discs.
  const t = E.setupPosition({ gold: ['a1', 'c3'], blue: ['b2', 'd4', 'e5'], toMove: 'gold' });
  // Gold f6 traps d4, e5 against c3; b2 stays Blue (it isn't on a line ending at f6).
  R.play(t, P('f6'));
  assert.equal(t.board[P('b2')], R.BLUE);
  assert.equal(t.board[P('e5')], R.GOLD);
  assert.ok(R.illegalReason(R.newGame(), P('a1')), 'a move must flip something');
});

test('passing and the end of the game', () => {
  const s = E.setupPosition({ gold: ['d3', 'd4', 'e4', 'd5', 'e5', 'f5', 'h5', 'f6', 'f7'], blue: ['h4', 'g5'], toMove: 'blue' });
  R.play(s, P('h6'));
  assert.deepEqual(E.legalMoves(s), [R.PASS]);
  assert.ok(R.illegalReason(R.newGame(), R.PASS), 'no pass while you have a move');
  R.play(s, R.PASS);
  assert.equal(s.toMove, R.BLUE);
  // A wipe-out ends the game; empty squares go to the winner.
  const w = E.setupPosition({ gold: ['a1'], blue: ['b1'], toMove: 'gold' });
  R.play(w, P('c1'));
  assert.ok(w.over);
  const r = R.result(w);
  assert.deepEqual([r.winner, r.gold, r.blue], [R.GOLD, 64, 0]);
});

test('a draw is scored 32–32', () => {
  const s = R.newGame();
  s.board.fill(R.GOLD, 0, 32); s.board.fill(R.BLUE, 32, 64); s.over = true;
  assert.equal(E.outcome(s).text, 'Draw, 32–32');
});

test('undo restores the position', () => {
  const s = R.newGame();
  const before = s.board.join('');
  R.play(s, P('f5'));
  R.undo(s);
  assert.equal(s.board.join(''), before);
  assert.equal(s.toMove, R.GOLD);
});

test('bots only play legal moves, and Ludo beats Pip', () => {
  let ludo = 0;
  for (let g = 0; g < 4; g++) {
    const s = R.newGame();
    const lv = g % 2 ? { 1: 1, 2: 3 } : { 1: 3, 2: 1 };
    while (!s.over) {
      const m = chooseMove(s, lv[s.toMove]);
      assert.equal(R.illegalReason(s, m), null);
      R.play(s, m);
    }
    const r = R.result(s);
    if (r.winner && lv[r.winner] === 3) ludo++;
  }
  assert.ok(ludo >= 3, `Ludo won ${ludo} of 4`);
});

test('the exact endgame solver agrees with a full playout', () => {
  // 8 empties: compare the solver with brute force.
  const s = E.setupPosition({ gold: ['f1', 'c2', 'f2', 'a3', 'b3', 'c3', 'd3', 'h3', 'a4', 'b4', 'c4', 'e4', 'g4', 'h4', 'a5', 'd5', 'f5', 'g5', 'h5', 'a6', 'c6', 'e6', 'f6', 'g6', 'h6', 'f7', 'h7', 'a8', 'b8', 'c8', 'd8', 'e8', 'f8', 'g8'], blue: ['b2', 'g2', 'h2', 'e3', 'f3', 'g3', 'd4', 'f4', 'b5', 'c5', 'e5', 'b6', 'd6', 'a7', 'b7', 'c7', 'd7', 'e7'], toMove: 'gold' });
  const { scores, exact } = scoreMoves(s.board, s.toMove, { exactAt: 14, timeMs: 5000 });
  assert.ok(exact);
  function brute(st) {
    const moves = E.legalMoves(st);
    if (st.over) { const r = R.result(st); const d = r.gold - r.blue; return st.toMove === R.GOLD ? d : -d; }
    let best = -Infinity;
    for (const m of moves) {
      R.play(st, m);
      const v = st.over ? (() => { const r = R.result(st); const d = r.gold - r.blue; return (st.history[st.history.length - 1].player === R.GOLD ? d : -d); })() : (E.toMove(st) === st.history[st.history.length - 1].player ? brute(st) : -brute(st));
      R.undo(st);
      if (v > best) best = v;
    }
    return best;
  }
  const top = Math.max(...scores.values());
  assert.equal(top, brute(s));
});

test('opening names match legal lines', () => {
  for (const [name, line] of E.OPENINGS) {
    const s = E.setupPosition({ moves: line });
    assert.equal(E.openingName(s.history.map((h) => h.move)), name);
  }
  const mirrored = E.setupPosition({ moves: 'd3c5' });
  assert.equal(E.openingName(mirrored.history.map((h) => h.move)), 'Perpendicular opening');
});

function checkStages(id, step) {
  let s = E.setupPosition(step.setup);
  step.stages.forEach((sg, i) => {
    const m = E.parseMove(sg.answer);
    assert.equal(R.illegalReason(s, m), null, `${id} stage ${i + 1}: answer is legal`);
    assert.ok(E.checkGoal(s, m, sg.goal), `${id} stage ${i + 1}: ${sg.answer} reaches the goal`);
    if (sg.accept) assert.deepEqual(E.solutions(s, sg.goal).sort(), sg.accept.slice().sort(), `${id} stage ${i + 1}: accept list is complete`);
    R.play(s, m);
    if (sg.reply) R.play(s, E.parseMove(sg.reply));
    while (!s.over && E.forcedMove(s) !== null && i < step.stages.length - 1) R.play(s, R.PASS);
  });
}

test('every lesson puzzle has a correct, complete answer', () => {
  let n = 0;
  for (const u of UNITS) for (const l of u.lessons) {
    for (const [i, st] of l.steps.entries()) {
      if (st.type === 'read' && st.board) E.setupPosition(st.board);
      if (st.type !== 'puzzle') continue;
      checkStages(`${l.id} step ${i}`, st);
      n++;
    }
  }
  assert.ok(n >= 15, `${n} lesson puzzles`);
});

test('every bank puzzle has a correct, complete answer list', () => {
  assert.ok(BANK.length >= 200, `${BANK.length} puzzles`);
  for (const p of BANK) {
    const s = E.setupPosition(p.setup);
    const sol = p.goal.kind === 'best'
      ? (() => { const { scores, exact } = scoreMoves(s.board, s.toMove, { exactAt: 14, timeMs: 20000 }); assert.ok(exact, p.id); const top = Math.max(...scores.values()); assert.ok(top === p.result, p.id); return [...scores].filter(([, v]) => v === top).map(([c]) => R.cellName(c)); })()
      : E.solutions(s, p.goal);
    assert.deepEqual(sol.sort(), p.accept.slice().sort(), p.id);
  }
});
