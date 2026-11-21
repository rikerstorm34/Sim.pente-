// Choose-your-side openings (D-Pente, DK-Pente, Swap2). No DOM: runs in the page, the bot's
// Web Worker and Node tests.
//
// Two seats: the OPENER sets up the first stones (of both colours); the CHOOSER then picks a
// colour. In Swap2 the chooser may instead add two stones and hand the choice back.
// The stones themselves follow normal turn order (Gold, Blue, Gold, ...), so the rules engine
// plays them like ordinary moves. Only who controls them, and who ends up with which colour,
// is decided here.
//
// Decisions are stored as a list of words:
//   D-Pente:  ['keep']  chooser stays Blue   |  ['swap']  chooser takes Gold
//   Swap2:    ['gold'] / ['blue']  chooser's colour
//             ['more', 'gold' | 'blue']  chooser adds two stones, then the opener picks a colour

import { P1, P2, CENTER, cloneState, applyMove, isLegal, inBounds, other } from './rules.js';
import { analysePosition, winChance } from './ai.js';

export const OPENINGS = {
  'd-pente': { first: 4, name: 'D-Pente opening' },
  swap2: { first: 3, more: 2, name: 'Swap2 opening' },
};

export const openingKind = (variant) => (variant && variant.choice) || null;

/**
 * Where the opening stands after `plies` stones and the given decisions.
 * @returns {{ phase: 'place'|'decide'|'play', by?: 'opener'|'chooser', choices?: string[], setup: number }}
 *   setup = how many stones belong to the set-up (known once the opening is over)
 */
export function openingStatus(kind, plies, decisions = []) {
  const o = OPENINGS[kind];
  if (!o) return { phase: 'play', setup: 0 };
  if (kind === 'd-pente') {
    if (plies < o.first) return { phase: 'place', by: 'opener', setup: o.first };
    if (!decisions[0]) return { phase: 'decide', by: 'chooser', choices: ['keep', 'swap'], setup: o.first };
    return { phase: 'play', setup: o.first };
  }
  // Swap2
  if (plies < o.first) return { phase: 'place', by: 'opener', setup: o.first };
  if (!decisions[0]) return { phase: 'decide', by: 'chooser', choices: ['gold', 'blue', 'more'], setup: o.first };
  if (decisions[0] !== 'more') return { phase: 'play', setup: o.first };
  const all = o.first + o.more;
  if (plies < all) return { phase: 'place', by: 'chooser', setup: all };
  if (!decisions[1]) return { phase: 'decide', by: 'opener', choices: ['gold', 'blue'], setup: all };
  return { phase: 'play', setup: all };
}

/** The opener's colour once the opening is decided (null before). */
export function openerColour(kind, decisions = []) {
  if (kind === 'd-pente') {
    if (!decisions[0]) return null;
    return decisions[0] === 'swap' ? P2 : P1;
  }
  if (kind === 'swap2') {
    if (!decisions[0]) return null;
    if (decisions[0] === 'gold') return P2;
    if (decisions[0] === 'blue') return P1;
    if (!decisions[1]) return null;
    return decisions[1] === 'gold' ? P1 : P2;
  }
  return null;
}

/** Colour for a seat (1 = opener, 2 = chooser), or null while undecided. */
export function seatColour(kind, decisions, seat) {
  const o = openerColour(kind, decisions);
  if (o === null) return null;
  return seat === 1 ? o : other(o);
}

/** Plain-language labels for each decision. */
export const CHOICE_LABELS = {
  keep: { title: 'Stay Blue', sub: 'Gold moves next' },
  swap: { title: 'Take Gold', sub: 'You move next' },
  gold: { title: 'Play Gold', sub: '' },
  blue: { title: 'Play Blue', sub: '' },
  more: { title: 'Add two stones', sub: 'One Blue, one Gold, then your opponent picks a side' },
};

// ---------------------------------------------------------------------------
// Judging the set-up (used by the bots, and by the coach's "What does Vega think?")

/**
 * Gold's winning chances (0..1) in a position, from a short search.
 * @param {object} state  game state (not modified)
 */
export function goldChances(state, timeMs = 350) {
  const a = analysePosition(state, null, { timeMs, maxDepth: 6 });
  const c = winChance(a.bestScore);
  return state.toMove === P1 ? c : 1 - c;
}

/** A plain sentence about who stands better. */
export function describeChances(gold) {
  const pct = Math.round(gold * 100);
  if (pct >= 45 && pct <= 55) return `Close to even (about ${pct}% for Gold).`;
  const side = pct > 50 ? 'Gold' : 'Blue';
  const share = pct > 50 ? pct : 100 - pct;
  const size = share >= 75 ? 'clearly' : share >= 62 ? 'somewhat' : 'slightly';
  return `${side} is ${size} better (about ${share}% for ${side}).`;
}

// Small random source so tests can be repeatable.
const rnd = (rng, n) => Math.floor(rng() * n);

function nearPoint(rng, cx, cy, minD, maxD) {
  for (let tries = 0; tries < 50; tries++) {
    const x = cx + rnd(rng, 2 * maxD + 1) - maxD;
    const y = cy + rnd(rng, 2 * maxD + 1) - maxD;
    const d = Math.max(Math.abs(x - cx), Math.abs(y - cy));
    if (d >= minD && d <= maxD && inBounds(x, y)) return [x, y];
  }
  return [cx + minD, cy];
}

/**
 * The opener's set-up: stones to place from the current position (normal turn order).
 * The bot tries a few random shapes near the centre and keeps the most even one, so the
 * chooser gets a real decision.
 */
export function chooseSetup(state, kind, rng = Math.random, { tries = 5, timeMs = 220 } = {}) {
  const want = (kind === 'd-pente' ? OPENINGS['d-pente'].first : OPENINGS.swap2.first) - state.ply;
  if (want <= 0) return [];
  let best = null, bestGap = Infinity;
  for (let t = 0; t < tries; t++) {
    const s = cloneState(state);
    const stones = [];
    let ok = true;
    for (let i = 0; i < want; i++) {
      const ply = state.ply + i;
      let p;
      if (kind === 'swap2' && ply === 0) p = [CENTER, CENTER];
      else {
        const anchorStone = kind === 'd-pente' && ply === 0 ? [CENTER + rnd(rng, 3) - 1, CENTER + rnd(rng, 3) - 1] : null;
        p = anchorStone || nearPoint(rng, CENTER, CENTER, 1, kind === 'd-pente' ? 3 : 2);
      }
      if (!isLegal(s, p[0], p[1])) { ok = false; break; }
      applyMove(s, p[0], p[1]);
      stones.push(p);
    }
    if (!ok) continue;
    const gap = Math.abs(goldChances(s, timeMs) - 0.5);
    if (gap < bestGap) { bestGap = gap; best = stones; }
  }
  if (best) return best;
  // Fallback: a plain diagonal shape.
  const fallback = [];
  const s = cloneState(state);
  for (const [dx, dy] of [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    if (fallback.length >= want) break;
    if (isLegal(s, CENTER + dx, CENTER + dy)) { applyMove(s, CENTER + dx, CENTER + dy); fallback.push([CENTER + dx, CENTER + dy]); }
  }
  return fallback;
}

/** Swap2's "add two stones" for the chooser: one Blue then one Gold, keeping things even. */
export function chooseMore(state, rng = Math.random, { tries = 6, timeMs = 200 } = {}) {
  let best = null, bestGap = Infinity;
  for (let t = 0; t < tries; t++) {
    const s = cloneState(state);
    const stones = [];
    for (let i = 0; i < 2; i++) {
      let p = nearPoint(rng, CENTER, CENTER, 1, 3);
      for (let k = 0; k < 10 && !isLegal(s, p[0], p[1]); k++) p = nearPoint(rng, CENTER, CENTER, 1, 3);
      if (!isLegal(s, p[0], p[1])) break;
      applyMove(s, p[0], p[1]);
      stones.push(p);
    }
    if (stones.length < 2) continue;
    const gap = Math.abs(goldChances(s, timeMs) - 0.5);
    if (gap < bestGap) { bestGap = gap; best = stones; }
  }
  return best || [];
}

/**
 * A bot's decision when it is its turn to choose.
 * @param {object} state  position after the set-up stones
 * @param {string[]} choices  from openingStatus()
 * @returns {string}
 */
export function chooseSide(state, choices, rng = Math.random, { timeMs = 400 } = {}) {
  const gold = goldChances(state, timeMs);
  if (choices.includes('keep')) return gold > 0.5 ? 'swap' : 'keep';
  // Swap2 chooser: near-even positions are sometimes handed back with two more stones.
  if (choices.includes('more') && Math.abs(gold - 0.5) < 0.04 && rng() < 0.5) return 'more';
  return gold >= 0.5 ? 'gold' : 'blue';
}

/**
 * One opening job for a bot (or the coach), by name. Lower levels sometimes choose a side at random.
 * @param {'setup'|'more'|'decide'|'judge'} action
 */
export function runOpening(state, action, { choices = [], level = 3, rng = Math.random } = {}) {
  const kind = openingKind(state.variant);
  if (action === 'setup') return chooseSetup(state, kind, rng);
  if (action === 'more') return chooseMore(state, rng);
  if (action === 'judge') return goldChances(state, 700);
  if (action === 'decide') {
    if (level <= 2 && rng() < (level === 1 ? 0.5 : 0.25)) return choices[Math.floor(rng() * choices.length)];
    return chooseSide(state, choices, rng);
  }
  throw new Error('Unknown opening job ' + action);
}
