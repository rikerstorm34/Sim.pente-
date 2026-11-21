// Puzzle trainer logic (no DOM): the puzzle collection, variations, and spaced repetition.
//
// Sources
//   champions  the generated bank from the 1983 World Championship games (js/puzzle-bank.js)
//   lessons    every lesson puzzle (shown exactly as in the lesson, since their text names lines)
//   mine       positions from your own analysed games where you had a forced win and missed it
//
// Variations: champion puzzles are shown in one of the 8 board symmetries (rotations and
// mirror images), chosen per attempt, so the same idea appears as a fresh-looking position.
//
// Spaced repetition (simple Leitner boxes, counted in puzzles rather than days):
//   a miss brings the puzzle back after 4 more puzzles; each solve moves it up a box and
//   pushes it further out (12, 40, 120, 400 puzzles).

import { PUZZLE_BANK } from './puzzle-bank.js';
import { PLAYABLE_1983, masterEntry, roundOf, openingOf } from './master-games.js';
import { ALL_LESSONS } from './lessons.js';
import { coordName, parseCoord, CENTER } from './rules.js';

export const THEMES = {
  chain: { name: 'Chains of fours', blurb: 'Every move a four, until one can\'t be stopped.' },
  defend: { name: 'Stop the attack', blurb: 'Your opponent has a winning chain ready. Find the only defence.' },
  keystone: { name: 'Keystones', blurb: 'Capture a blocking stone and make a four with the same move.' },
  counter: { name: 'Block with a four', blurb: 'Answer an open three with a four of your own.' },
  fork: { name: 'Double attacks', blurb: 'One stone threatens two pairs.' },
  pair: { name: 'Safe captures', blurb: 'Win a pair without walking into trouble.' },
  block: { name: 'Safe blocks', blurb: 'Stop an open three without leaving a pair to capture.' },
  save: { name: 'Save your pair', blurb: 'Rescue a threatened pair without letting the opponent attack.' },
  capwin: { name: 'Fifth capture', blurb: 'Finish the game with a capture.' },
  lesson: { name: 'Lesson puzzles', blurb: 'Every puzzle from the lessons, for review.' },
  mine: { name: 'From your games', blurb: 'Wins you missed in your own games.' },
};

function prompts(theme, opp) {
  switch (theme) {
    case 'chain': return ['Find the chain of fours that wins.', 'Every move has to make a four. Look for the point where your lines can keep feeding each other.'];
    case 'defend': return [`${opp} has a winning chain of fours ready. Find the move that stops it.`, 'Find the stone their first four needs, or a capture that breaks their line.'];
    case 'keystone': return ['One capture takes away a stone that blocks your line and makes a four at the same time. Find it.', 'Look at the stones blocking your lines. Is one of them part of a pair?'];
    case 'counter': return [`${opp} has an open three. Block it with a move that also makes a four.`, 'One end of their three is also on one of your lines.'];
    case 'fork': return [`Place one stone that threatens two of ${opp}'s pairs at once, without leaving a pair of your own.`, 'Find an empty point at the end of two different pairs.'];
    case 'pair': return ['You can capture more than one pair. Only one capture is safe. Find it.', 'After each capture, check what your opponent can capture back or attack.'];
    case 'block': return [`Block ${opp}'s open three without giving them a pair to capture.`, 'Of the blocking points, pick the one that doesn\'t make a pair next to their stone.'];
    case 'save': return [`${opp} threatens to capture one of your pairs. Save it, without letting them start a winning attack.`, 'Extend, block the open end, or capture the attacker.'];
    case 'capwin': return ['One more capture wins the game. Find it.', 'Look for a pair you can bracket.'];
    default: return ['Find the best move.', ''];
  }
}

// ---------------------------------------------------------------------------
// Board symmetries (applied around the centre)

const SYMS = [
  ([x, y]) => [x, y], ([x, y]) => [-y, x], ([x, y]) => [-x, -y], ([x, y]) => [y, -x],
  ([x, y]) => [-x, y], ([x, y]) => [x, -y], ([x, y]) => [y, x], ([x, y]) => [-y, -x],
];
export function transformCoord(name, sym) {
  if (!sym) return name;
  const [x, y] = parseCoord(name);
  const [dx, dy] = SYMS[sym]([x - CENTER, y - CENTER]);
  return coordName(dx + CENTER, dy + CENTER);
}
function transformGoal(goal, sym) {
  if (!sym || !goal) return goal;
  if (goal.all) return { all: goal.all.map((g) => transformGoal(g, sym)) };
  if (goal.points) return { ...goal, points: goal.points.map((c) => transformCoord(c, sym)) };
  return goal;
}

// ---------------------------------------------------------------------------
// The collection

const surname = (n) => n.split(' ').pop();

function championItems() {
  const games = new Map(PLAYABLE_1983.map((g) => [g.n, g]));
  return PUZZLE_BANK.filter((p) => games.has(p.g)).map((p) => {
    const g = games.get(p.g);
    const moverIsWhite = p.ply % 2 === 0;
    const mover = moverIsWhite ? g.white : g.black;
    const opp = moverIsWhite ? g.black : g.white;
    return {
      id: `wc-${p.id}`, source: 'champions', theme: p.theme, level: p.level,
      title: `${surname(mover)} vs ${surname(opp)}`,
      origin: { kind: 'master', n: p.g, ply: p.ply, played: p.played, mover, opp, round: roundOf(p.g), opening: openingOf(p.g) },
      bank: p,
    };
  });
}

function lessonItems() {
  const out = [];
  for (const l of ALL_LESSONS) {
    l.steps.forEach((st, i) => {
      if (st.type !== 'puzzle') return;
      out.push({
        id: `ls-${l.id}-${i}`, source: 'lessons', theme: 'lesson', level: st.level, title: st.title,
        origin: { kind: 'lesson', lessonId: l.id, lessonTitle: l.title, step: i }, step: st,
      });
    });
  }
  return out;
}

/**
 * Your missed wins: plies where you were to move, the analysis found a forced win, and you
 * played something else that didn't keep it. history: archived games; analysis: the cache.
 */
export function mineItems(history = [], analysis = {}) {
  const out = [];
  for (const h of history) {
    const a = analysis[h.id];
    if (!a || !Array.isArray(a.plies) || !Array.isArray(h.moves)) continue;
    const youIdx = h.you === 2 ? 1 : 0;
    a.plies.forEach((pa, ply) => {
      if (!pa || ply % 2 !== youIdx || ply >= h.moves.length || !pa.forcedWin || !pa.best) return;
      const played = h.moves[ply];
      if (played[0] === pa.best[0] && played[1] === pa.best[1]) return;
      if (pa.playedScore !== null && pa.playedScore !== undefined && pa.playedScore >= pa.bestScore) return;
      out.push({
        id: `me-${h.id}-${ply}`, source: 'mine', theme: 'mine', level: 4,
        title: `Your game vs ${h.botName || 'a bot'}`,
        origin: { kind: 'mine', gameId: h.id, ply, played: coordName(...played), at: h.at },
        mine: { variantId: h.variantId, options: h.options || {}, moves: h.moves.slice(0, ply).map((m) => coordName(...m)), best: coordName(...pa.best) },
      });
    });
  }
  return out;
}

let cached = null;
export function collection(history, analysis) {
  if (!cached) cached = [...championItems(), ...lessonItems()];
  return [...cached, ...mineItems(history, analysis)];
}

// ---------------------------------------------------------------------------
// Turning an item into a playable puzzle (setup spec + stages), with a variation.

export function buildPuzzle(item, sym = 0) {
  if (item.source === 'lessons') {
    return { setup: item.step.setup, stages: item.step.stages, sym: 0, level: item.level, title: item.title };
  }
  if (item.source === 'mine') {
    const m = item.mine;
    return {
      setup: { variant: m.variantId, options: m.options, moves: m.moves.map((c) => transformCoord(c, sym)) },
      stages: [{
        prompt: 'In your game you had a forced win here and missed it. Find it now.',
        goal: { kind: 'forcedWin' }, answer: transformCoord(m.best, sym),
        hint: 'Start with a four. Look for the point where two of your lines can feed each other.',
        success: 'That\'s the win you missed. Next time, look for chains of fours before you play a quiet move.',
      }],
      sym, level: item.level, title: item.title,
    };
  }
  const p = item.bank;
  const entry = masterEntry(p.g);
  const moves = entry.moves.slice(0, p.ply).map(([x, y]) => transformCoord(coordName(x, y), sym));
  const [prompt, hint] = prompts(p.theme, 'Your opponent');
  const found = p.played === p.answer;
  return {
    setup: { moves },
    stages: [{
      prompt, goal: transformGoal(p.goal, sym), answer: transformCoord(p.answer, sym), hint,
      success: found
        ? `${surname(item.origin.mover)} found this at the board in game ${p.g}.`
        : `In the game, ${surname(item.origin.mover)} played ${transformCoord(p.played, sym)} instead.`,
    }],
    sym, level: item.level, title: item.title,
  };
}

/** Four rings for a hint: the answer plus three nearby empty points, in a fixed shuffled order. */
export function hintRing(answer, isEmpty, seed = 1) {
  const [ax, ay] = parseCoord(answer);
  const pts = [[ax, ay]];
  const near = [];
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    if (!dx && !dy) continue;
    const x = ax + dx, y = ay + dy;
    if (x >= 0 && y >= 0 && x < 19 && y < 19 && isEmpty(x, y)) near.push([x, y]);
  }
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; };
  while (pts.length < 4 && near.length) pts.push(near.splice(Math.floor(rnd() * near.length), 1)[0]);
  return pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

// ---------------------------------------------------------------------------
// Progress and spaced repetition

const BOX_GAP = [4, 12, 40, 120, 400];

export function emptyProgress() {
  return { count: 0, streak: 0, best: 0, items: {} };
}

/** Record an attempt. solved: true if solved without seeing the answer. */
export function record(progress, id, solved) {
  const p = progress;
  p.count = (p.count || 0) + 1;
  const it = p.items[id] || { n: 0, ok: 0, box: 0, due: 0 };
  it.n++;
  if (solved) {
    it.ok++;
    it.box = Math.min(BOX_GAP.length - 1, it.box + (it.n === 1 ? 2 : 1));
    p.streak = (p.streak || 0) + 1;
    p.best = Math.max(p.best || 0, p.streak);
  } else {
    it.box = 0;
    p.streak = 0;
  }
  it.due = p.count + BOX_GAP[it.box];
  it.last = solved ? 'ok' : 'miss';
  p.items[id] = it;
  return p;
}

/**
 * Pick the next puzzle: first anything you missed that's due again, then unseen puzzles
 * (lower levels first unless a level is chosen), then the longest-waiting solved ones.
 */
export function pickNext(items, progress, { rnd = Math.random, exclude = null } = {}) {
  if (!items.length) return null;
  const p = progress;
  const pool = items.filter((i) => i.id !== exclude);
  if (!pool.length) return items[0];
  const due = pool.filter((i) => p.items[i.id] && p.items[i.id].due <= p.count);
  if (due.length) {
    due.sort((a, b) => p.items[a.id].due - p.items[b.id].due);
    return due[0];
  }
  const fresh = pool.filter((i) => !p.items[i.id]);
  if (fresh.length) {
    const minLevel = Math.min(...fresh.map((i) => i.level));
    const near = fresh.filter((i) => i.level <= minLevel + 1);
    return near[Math.floor(rnd() * near.length)];
  }
  const seen = pool.slice().sort((a, b) => p.items[a.id].due - p.items[b.id].due);
  return seen[0];
}

export function summary(items, progress) {
  const p = progress;
  const byTheme = {};
  for (const i of items) {
    const t = (byTheme[i.theme] ||= { total: 0, solved: 0, missed: 0 });
    t.total++;
    const it = p.items[i.id];
    if (it && it.ok) t.solved++;
    else if (it) t.missed++;
  }
  const tried = items.filter((i) => p.items[i.id]);
  const solved = tried.filter((i) => p.items[i.id].ok);
  const due = items.filter((i) => p.items[i.id] && p.items[i.id].last === 'miss' && p.items[i.id].due <= p.count + 4).length;
  return { total: items.length, tried: tried.length, solved: solved.length, due, byTheme, streak: p.streak || 0, best: p.best || 0 };
}
