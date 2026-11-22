// Hex: rules, swap rule, bots, lessons and the puzzle bank.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as H from '../js/hex/rules.js';
import * as E from '../js/hex/engine.js';
import { chooseMove, winningCells, solve, shouldSwap } from '../js/hex/ai.js';
import { UNITS } from '../js/hex/lessons.js';
import { BANK } from '../js/hex/puzzle-bank.js';

test('neighbours, names and bridges', () => {
  const g = H.geometry(7);
  assert.equal(H.cellName(0, 7), 'a1');
  assert.equal(H.parseCell('g7', 7), 48);
  assert.equal(g.nb[0].length, 2, 'acute corner a1 has two neighbours');
  assert.equal(g.nb[6].length, 3, 'obtuse corner g1 has three');
  assert.equal(g.nb[H.parseCell('d4', 7)].length, 6);
  const br = g.bridges[H.parseCell('c3', 7)].find((b) => b.to === H.parseCell('d4', 7));
  assert.deepEqual(br.carrier.map((i) => H.cellName(i, 7)).sort(), ['c4', 'd3']);
});

test('Gold connects top–bottom, Blue left–right; the game ends at once', () => {
  const s = H.newGame(5, false);
  for (const [g, b] of [['c1', 'a1'], ['c2', 'a2'], ['c3', 'a3'], ['c4', 'a4']]) { H.play(s, H.parseCell(g, 5)); H.play(s, H.parseCell(b, 5)); }
  assert.equal(s.winner, 0);
  H.play(s, H.parseCell('c5', 5));
  assert.equal(s.winner, H.GOLD);
  assert.ok(H.illegalReason(s, H.parseCell('e5', 5)));
  const t = H.newGame(5, false);
  for (const [g, b] of [['a1', 'a3'], ['a2', 'b3'], ['b1', 'c3'], ['b2', 'd3']]) { H.play(t, H.parseCell(g, 5)); H.play(t, H.parseCell(b, 5)); }
  H.play(t, H.parseCell('c1', 5));
  H.play(t, H.parseCell('e3', 5));
  assert.equal(t.winner, H.BLUE);
});

test('a full board always has exactly one winner', () => {
  for (let k = 0; k < 30; k++) {
    const n = 5 + (k % 3);
    const b = new Int8Array(n * n).map(() => (Math.random() < 0.5 ? H.GOLD : H.BLUE));
    assert.notEqual(H.connected(b, n, H.GOLD), H.connected(b, n, H.BLUE));
  }
});

test('swap rule: only on Blue\'s first turn, mirrored onto Blue\'s side', () => {
  const s = H.newGame(9, true);
  assert.ok(H.illegalReason(s, H.SWAP));
  H.play(s, H.parseCell('c2', 9));
  assert.equal(H.illegalReason(s, H.SWAP), null);
  H.play(s, H.SWAP);
  assert.equal(s.board[H.parseCell('c2', 9)], H.EMPTY);
  assert.equal(s.board[H.parseCell('b3', 9)], H.BLUE);
  assert.equal(s.toMove, H.GOLD);
  H.undo(s);
  assert.equal(s.board[H.parseCell('c2', 9)], H.GOLD);
  const t = H.newGame(9, false);
  H.play(t, H.parseCell('e5', 9));
  assert.ok(H.illegalReason(t, H.SWAP), 'no swap when the rule is off');
  assert.equal(shouldSwap(H.parseCell('e5', 9), 9), true);
  assert.equal(shouldSwap(H.parseCell('c1', 9), 9), false);
});

test('shortest path and win-in-one', () => {
  const s = E.setupPosition({ size: 7, gold: ['d1', 'd2', 'd3', 'd4', 'd6', 'd7'], blue: ['c5', 'e4'], toMove: 'gold' });
  assert.equal(H.shortestPath(s.board, 7, H.GOLD).dist, 1);
  assert.deepEqual(winningCells(s.board, 7, H.GOLD).map((i) => H.cellName(i, 7)), ['d5']);
});

test('the small-board solver finds forced wins', () => {
  // Gold to move on 3×3 with the centre: wins.
  const s = H.newGame(3, false);
  const r = solve(s);
  assert.ok(r.winning.includes(H.parseCell('b2', 3)));
});

test('unbreakable chains: bridges and edge bridges with separate carriers', () => {
  const s = E.setupPosition({ size: 7, gold: ['c2', 'd3', 'd4', 'e5', 'd6'], blue: ['b4', 'f3'], toMove: 'blue' });
  assert.ok(E.unbreakable(s.board, 7, H.GOLD));
  // Every Blue intrusion has an answer that keeps Gold winning (checked by playing each one out).
  for (const m of H.emptyCells(s)) {
    const t = H.cloneState(s);
    H.play(t, m);
    if (t.winner) continue;
    const answers = H.emptyCells(t).filter((r) => { const u = H.cloneState(t); H.play(u, r); return u.winner === H.GOLD || E.unbreakable(u.board, 7, H.GOLD); });
    assert.ok(answers.length > 0, `answer to ${H.cellName(m, 7)}`);
  }
  const broken = E.setupPosition({ size: 7, gold: ['c2', 'd3', 'e5', 'd6'], blue: ['b4', 'f3'], toMove: 'gold' });
  assert.equal(E.unbreakable(broken.board, 7, H.GOLD), false);
});

test('bots play legal moves and Juno beats Pip', () => {
  let juno = 0;
  for (let g = 0; g < 6; g++) {
    const s = H.newGame(7, false);
    const lv = g % 2 ? { 1: 1, 2: 2 } : { 1: 2, 2: 1 };
    while (!s.winner) { const m = chooseMove(s, lv[s.toMove]); assert.equal(H.illegalReason(s, m), null); H.play(s, m); }
    if (lv[s.winner] === 2) juno++;
  }
  assert.ok(juno >= 5, `Juno won ${juno} of 6`);
  const s = H.newGame(7, true);
  H.play(s, H.parseCell('d4', 7));
  assert.equal(chooseMove(s, 3), H.SWAP, 'Ludo swaps a centre opening');
});

function checkStages(id, step) {
  const s = E.setupPosition(step.setup);
  step.stages.forEach((sg, i) => {
    const m = E.parseMove(sg.answer, { size: s.n });
    assert.equal(H.illegalReason(s, m), null, `${id} stage ${i + 1}: legal`);
    assert.ok(E.checkGoal(s, m, sg.goal), `${id} stage ${i + 1}: ${sg.answer} reaches the goal`);
    if (sg.accept) assert.deepEqual(E.solutions(s, sg.goal).sort(), sg.accept.slice().sort(), `${id} stage ${i + 1}: accept list is complete`);
    H.play(s, m);
    if (sg.reply) H.play(s, E.parseMove(sg.reply, { size: s.n }));
  });
}

test('every lesson puzzle has a correct, complete answer', () => {
  let n = 0;
  for (const u of UNITS) for (const l of u.lessons) for (const [i, st] of l.steps.entries()) {
    if (st.type === 'read' && st.board) { const s = E.setupPosition(st.board); for (const h of st.board.hints || []) E.parseMove(h, { size: s.n }); }
    if (st.type === 'play') assert.ok([7, 9, 11].includes(st.game.options.size));
    if (st.type !== 'puzzle') continue;
    checkStages(`${l.id} step ${i}`, st);
    n++;
  }
  assert.ok(n >= 8, `${n} lesson puzzles`);
});

test('every bank puzzle has a correct, complete answer list', () => {
  assert.ok(BANK.length >= 100, `${BANK.length} puzzles`);
  for (const p of BANK) checkStages(p.id, { setup: p.setup, stages: [{ goal: p.goal, answer: p.accept[0], accept: p.accept }] });
});
