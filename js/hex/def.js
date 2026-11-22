// Hex section definition for the game shell: names, rules text, lessons, puzzles and statistics.
import * as engine from './engine.js';
import { createBoard } from './board.js';
import { UNITS } from './lessons.js';
import { BANK } from './puzzle-bank.js';

const THEMES = {
  connect: { name: 'Finish the chain', blurb: 'One stone connects. Find it.',
    prompt: 'You can connect your two edges with one stone. Find it.', hint: 'Follow your chain and look for the one missing cell.', success: 'Connected. Game over.' },
  block: { name: 'Block', blurb: 'Stop the opponent connecting next move.',
    prompt: 'Your opponent connects next move unless you stop it. Block.', hint: 'Find the single empty cell that would finish their chain.', success: 'Blocked. The game goes on.' },
  bridge: { name: 'Save the bridge', blurb: 'Your opponent pushed into a bridge: reply.',
    prompt: 'Your opponent just played into one of your bridges. Keep your stones connected.', hint: 'A bridge has two empty cells between the stones. One is now taken: take the other.', success: 'Saved. The bridge is now a solid link.' },
  fork: { name: 'Double threat', blurb: 'Two ways to connect: one stone can\'t block both.',
    prompt: 'Make a move that leaves two different ways to connect next turn.', hint: 'Look for a stone that ends up next to two separate finishing cells.', success: 'Two threats. Your opponent can only block one.' },
  unbreakable: { name: 'Unbreakable chain', blurb: 'Link your edges with stones, bridges and edge bridges.',
    prompt: 'Make a chain your opponent can\'t cut: stones linked to each other and to both edges by bridges.', hint: 'Every gap in your chain should have two empty cells your opponent would need to take.', success: 'Unbreakable: every cut has an answer, so the game is won.' },
};

const bankStep = (p) => {
  const t = THEMES[p.theme];
  return {
    id: p.id, theme: p.theme, level: p.level, title: t.name, origin: `From a bot game · ${p.setup.size}×${p.setup.size}`,
    setup: p.setup,
    stages: [{ prompt: t.prompt, goal: p.goal, answer: p.accept[0], accept: p.accept, hint: t.hint, success: t.success }],
  };
};

// Four looks per puzzle: as is, turned half a turn, and mirrored across the long diagonal with
// the colours swapped (which keeps the rules the same), plus both.
const LETTERS = 'abcdefghijklmnopqrs';
function tf(name, n, rot, flip) {
  let c = LETTERS.indexOf(name[0]), r = Number(name.slice(1)) - 1;
  if (rot) { r = n - 1 - r; c = n - 1 - c; }
  if (flip) [r, c] = [c, r];
  return LETTERS[c] + (r + 1);
}
function puzzleLook(item, prog) {
  if (item.source !== 'bank') return null;
  const looks = prog.looks || (prog.looks = {});
  const last = looks[item.id];
  let look;
  do { look = Math.floor(Math.random() * 4); } while (look === last && last !== undefined);
  looks[item.id] = look;
  const rot = look & 1, flip = look & 2;
  const st = item.step, s = st.setup, n = s.size;
  const map = (a) => a.map((x) => tf(x, n, rot, flip));
  const setup = flip
    ? { size: n, gold: map(s.blue), blue: map(s.gold), toMove: s.toMove === 'gold' ? 'blue' : 'gold', last: s.last && tf(s.last, n, rot, flip) }
    : { size: n, gold: map(s.gold), blue: map(s.blue), toMove: s.toMove, last: s.last && tf(s.last, n, rot, flip) };
  const stages = st.stages.map((g) => ({ ...g, answer: tf(g.answer, n, rot, flip), accept: map(g.accept) }));
  return { step: { ...st, setup, stages }, note: look === 0 ? '' : flip ? 'mirrored, colours swapped' : 'turned around' };
}

const GOAL_FAIL = {
  connect: 'That doesn\'t connect.', block: 'Your opponent can still connect after that.', saveBridge: 'The bridge is still cut.',
  fork: 'That doesn\'t leave two ways to connect.', unbreakable: 'Your opponent can still cut that chain.', win: 'That doesn\'t win by force.', points: 'Not that one.',
};

function statsExtras(entries, { esc, bar, computeStats }) {
  if (!entries.length) return '';
  const rows = entries.map((e) => ({ e, s: engine.gameStats(e.moves, e.you, e.options) }));
  const avg = (f) => (rows.reduce((a, r) => a + f(r), 0) / rows.length);
  const sum = (f) => rows.reduce((a, r) => a + f(r), 0);
  const line = (label, value) => `<div class="stat-row" style="display:flex;justify-content:space-between;gap:10px"><span>${esc(label)}</span><b class="mono">${value}</b></div>`;
  const saved = sum((r) => r.s.saved), cut = sum((r) => r.s.cut);
  const blocks = sum((r) => r.s.blocks), adj = sum((r) => r.s.adjacentBlocks);
  const sizes = new Map();
  for (const r of rows) { const k = r.s.size; if (!sizes.has(k)) sizes.set(k, []); sizes.get(k).push(r.e); }
  const swaps = rows.filter((r) => r.s.swapped);
  return `
    <section class="card"><h2 style="font-size:20px">Bridges</h2><div class="stat-rows">
      ${line('Bridges you make per game', avg((r) => r.s.bridgesMade).toFixed(1))}
      ${line('Cut bridges you saved', saved + cut ? `${saved} of ${saved + cut} (${Math.round((100 * saved) / (saved + cut))}%)` : '—')}
    </div><p class="muted" style="margin:10px 0 0;font-size:13px">When the opponent plays into a bridge, the other cell almost always has to be answered at once.</p></section>
    <section class="card"><h2 style="font-size:20px">Blocking</h2><div class="stat-rows">
      ${line('Moves that lengthened the opponent\'s path', blocks)}
      ${line('…played right next to their stones', blocks ? `${Math.round((100 * adj) / blocks)}%` : '—')}
      ${line('Games where you swapped', `${swaps.length} (${swaps.length ? Math.round((100 * swaps.filter((r) => r.e.result === 'win').length) / swaps.length) : 0}% won)`)}
    </div><p class="muted" style="margin:10px 0 0;font-size:13px">Blocks from a little distance hold better than blocks right in front of a chain.</p></section>
    <section class="card"><h2 style="font-size:20px">By board size</h2><div class="stat-rows">
      ${[...sizes.entries()].sort((a, b) => a[0] - b[0]).map(([k, list]) => { const st = computeStats(list); return `<div class="stat-row"><div style="display:flex;justify-content:space-between;gap:10px"><span>${k}×${k}</span><span class="mono" style="font-size:13px">${st.wins}–${st.losses} · <b>${st.winPct}%</b></span></div>${bar(st.winPct)}</div>`; }).join('')}
    </div></section>`;
}

export const HEX = {
  id: 'hex',
  name: 'Hex',
  aka: 'The connection game',
  tagline: 'Connect your two sides of the board. There are no draws: someone always gets through.',
  intro: 'Take turns placing stones on a board of hexagons. Gold links the top and bottom edges, Blue links left and right. Stones never move and are never captured, and the board can never fill up without one side connecting.',
  learnIntro: 'Six units from the rules to advanced reading: bridges, edges, blocking, ladders, openings and the swap rule. Each lesson explains one idea, then gives puzzles and a practice game.',
  rules: [
    'The board is a rhombus of hexagons, usually 11×11; smaller boards (7×7, 9×9) are good for learning.',
    'Gold moves first and connects the top and bottom edges. Blue connects the left and right edges. The corner cells belong to both edges.',
    'Players take turns placing one stone on any empty cell. Stones never move and are never captured.',
    'The first player to link their two edges with an unbroken chain of their stones wins. A draw is impossible.',
    'Swap rule (optional): moving first is a big advantage, so right after Gold\'s first stone Blue may swap instead of playing. The stone is mirrored across the long diagonal onto Blue\'s side, and Gold moves next. This makes Gold open with a move that is neither too strong nor too weak.',
    'Cells are named by column (a, b, c… left to right) and row (1, 2, 3… top to bottom).',
  ],
  notes: 'Hex was invented by Piet Hein (1942) and independently by John Nash (1948). This app is not affiliated with any Hex publisher.',
  sources: [
    ['HexWiki: strategy guides, templates and openings', 'https://www.hexwiki.net/index.php/Basic_(strategy_guide)'],
    ['Matthew Seymour, Hex: A Strategy Guide', 'http://www.mseymour.ca/hex_book/hexstrat0.html'],
    ['Ryan Hayward\'s Hex pages (University of Alberta): solved openings and programs', 'https://sites.ualberta.ca/~hayward/hex/'],
    ['Cameron Browne, Hex Strategy: Making the Right Connections (2000)', null],
    ['Ryan Hayward and Bjarne Toft, Hex: The Full Story (2019)', null],
  ],
  sideNote: 'Gold moves first and connects top to bottom. Without the swap rule, moving first is a big edge.',
  sideStatNote: 'Without the swap rule, Gold (moving first) wins far more often. With it, the game is fair.',
  cellWord: 'cell',
  showLegal: false,
  engine,
  board: { create: (host, handlers, options) => createBoard(host, handlers, options) },
  defaultOptions: { size: 9, swap: true },
  setupOptions: [
    { key: 'size', label: 'Board size', sub: '7×7 for learning, 9×9 for practice, 11×11 is the classic board.', choices: [[7, '7×7'], [9, '9×9'], [11, '11×11']] },
    { key: 'swap', label: 'Swap rule', sub: 'Blue may take Gold\'s first stone. Keeps the game fair.', choices: [[true, 'On'], [false, 'Off']] },
  ],
  optionsText: (o) => `${o.size || 9}×${o.size || 9}${o.swap === false ? '' : ' · swap rule'}`,
  levelBlurbs: {
    1: 'Plays near the centre and its own stones, and usually spots a win or a block in one. Learn the rules here.',
    2: 'Looks one move ahead: shortens its own path and blocks yours, often right in front of you.',
    3: 'Plays thousands of quick games in its head for each move (a third of a second).',
    4: 'The same search with a full second per move, and it saves its bridges. Strong on 7×7 and 9×9.',
    5: 'The longest search. A real challenge on every size.',
  },
  extraActions: (s, you, o) => (engine.legalMoves(s).includes(engine.SWAP) && you === 2 ? [{ label: 'Swap: take Gold\'s first stone', move: engine.SWAP }] : []),
  swapText: (who) => `${who} swapped: Gold's first stone is now Blue's.`,
  lessons: UNITS,
  puzzleBank: BANK.map(bankStep),
  bankLabel: 'Bot games',
  themes: { ...Object.fromEntries(Object.entries(THEMES).map(([k, v]) => [k, { name: v.name, blurb: v.blurb }])), lesson: { name: 'Lesson puzzles', blurb: 'The puzzles from the lessons.' } },
  puzzleIntro: (n) => `${n} puzzles from bot games on 7×7 to 11×11 boards, plus every lesson puzzle. Each one has a checked, complete list of answers, and comes back turned around or mirrored when you replay it.`,
  puzzleLook,
  goalFail: (goal) => (goal.all ? 'Not quite.' : GOAL_FAIL[goal.kind] || 'Not quite.'),
  statsExtras,
};
