// Reversi section definition for the game shell: names, rules text, lessons, puzzles and
// statistics. (The engine and the board drawing live next to this file.)
import * as engine from './engine.js';
import { createBoard } from './board.js';
import { UNITS } from './lessons.js';
import { BANK } from './puzzle-bank.js';
import { N, PASS } from './rules.js';

const THEME_TEXT = {
  corner: { name: 'Corners', blurb: 'Take the corner that is really worth it.',
    prompt: 'Take a corner. A corner disc can never be flipped back.', hint: 'Look at the four corners.', success: 'Corner taken. That disc is yours for the rest of the game.' },
  safety: { name: 'Corner safety', blurb: 'Most moves hand over a corner: find one that doesn\'t.',
    prompt: 'Most of your moves give your opponent a corner. Find one that doesn\'t.', hint: 'Check each move for a new line toward an empty corner: diagonals through X-squares and edges through C-squares.', success: 'Safe. Your opponent gets no corner from that.' },
  mobility: { name: 'Mobility', blurb: 'Leave your opponent as few moves as possible.',
    prompt: 'Find the move that leaves your opponent the fewest moves.', hint: 'Count the replies after each candidate. Flipping fewer discs on the outside usually helps.', success: 'Right. Fewer moves for them means worse moves for them soon.' },
  quiet: { name: 'Quiet moves', blurb: 'Flip inside discs, not outside ones.',
    prompt: 'Find the quietest move: the one that adds the fewest discs to your frontier (discs next to empty squares).', hint: 'Look for a move that flips discs already surrounded by other discs.', success: 'Quiet and solid. Your opponent gets few new targets.' },
  endgame: { name: 'Endgame counting', blurb: 'Exact puzzles: every line counted to the end.' },
  parity: { name: 'Parity', blurb: 'Endgames where the region you play in decides the game.' },
};

function endgameText(p) {
  const r = p.result;
  const prompt = r > 0 ? `Exact endgame: find the only move that wins by ${r} with best play.`
    : r === 0 ? 'Exact endgame: find the only move that holds the draw.'
      : `Exact endgame: you are behind. Find the only move that loses by just ${-r}.`;
  return {
    prompt,
    hint: p.theme === 'parity' ? 'Count the empty squares in each region. Moving into a region with an odd number of empties usually gets you the last move there.' : 'Watch for moves that make your opponent pass, and for regions only one side can enter.',
    success: r > 0 ? `Correct: perfect play from here wins by ${r}.` : r === 0 ? 'Correct: that holds the draw.' : `Correct: the best you can do, a loss by ${-r}.`,
  };
}

const bankStep = (p) => {
  const t = p.theme === 'endgame' || p.theme === 'parity' ? endgameText(p) : THEME_TEXT[p.theme];
  return {
    id: p.id, theme: p.theme, level: p.level, title: THEME_TEXT[p.theme].name, origin: 'From a bot game',
    setup: p.setup,
    stages: [{ prompt: t.prompt, goal: p.goal, answer: p.accept[0], accept: p.accept, hint: t.hint, success: t.success }],
  };
};

// The 8 symmetries of the board, and swapping colours, give each bank puzzle 16 looks.
const SYM = [
  (x, y) => [x, y], (x, y) => [7 - x, y], (x, y) => [x, 7 - y], (x, y) => [7 - x, 7 - y],
  (x, y) => [y, x], (x, y) => [7 - y, x], (x, y) => [y, 7 - x], (x, y) => [7 - y, 7 - x],
];
const COLS = 'abcdefgh';
const tf = (name, k) => { const [x, y] = SYM[k](COLS.indexOf(name[0]), Number(name.slice(1)) - 1); return COLS[x] + (y + 1); };
function puzzleLook(item, prog) {
  if (item.source !== 'bank') return null;
  const looks = prog.looks || (prog.looks = {});
  const last = looks[item.id];
  let look;
  do { look = Math.floor(Math.random() * 16); } while (look === last && last !== undefined);
  looks[item.id] = look;
  const k = look % 8, swap = look >= 8;
  const st = item.step;
  const s = st.setup;
  const setup = swap
    ? { gold: s.blue.map((n) => tf(n, k)), blue: s.gold.map((n) => tf(n, k)), toMove: s.toMove === 'gold' ? 'blue' : 'gold' }
    : { gold: s.gold.map((n) => tf(n, k)), blue: s.blue.map((n) => tf(n, k)), toMove: s.toMove };
  const stages = st.stages.map((g) => ({ ...g, answer: tf(g.answer, k), accept: g.accept.map((n) => tf(n, k)) }));
  return { step: { ...st, setup, stages }, note: look === 0 ? '' : swap ? 'colours swapped' : 'rotated or mirrored' };
}

const GOAL_FAIL = {
  corner: 'That isn\'t a corner.', noCorner: 'That still gives your opponent a corner.', fewest: 'Another move leaves fewer replies.',
  leastFrontier: 'Another move adds fewer discs to your frontier.', best: 'There is a better move.', win: 'That doesn\'t win with best play.',
  mostFlips: 'Another move flips more discs.', makePass: 'Your opponent still has a move after that.', points: 'Not that one.',
};

function statsExtras(entries, { esc, bar }) {
  if (!entries.length) return '';
  const rows = entries.map((e) => ({ e, s: engine.gameStats(e.moves, e.you) }));
  const avg = (f) => (rows.reduce((a, r) => a + f(r), 0) / rows.length);
  const won = (e) => e.result === 'win';
  const fin = rows.filter((r) => r.s.discDiff !== null);
  const openings = new Map();
  for (const r of rows) {
    const name = r.s.opening || 'Other';
    const o = openings.get(name) || { n: 0, w: 0 };
    o.n++; if (won(r.e)) o.w++;
    openings.set(name, o);
  }
  const cornerWin = rows.filter((r) => r.s.cornersYou > r.s.cornersThem);
  const line = (label, value) => `<div class="stat-row" style="display:flex;justify-content:space-between;gap:10px"><span>${esc(label)}</span><b class="mono">${value}</b></div>`;
  return `
    <section class="card"><h2 style="font-size:20px">Corners</h2><div class="stat-rows">
      ${line('Corners you take per game', avg((r) => r.s.cornersYou).toFixed(1))}
      ${line('Corners the bots take per game', avg((r) => r.s.cornersThem).toFixed(1))}
      ${line('Win rate when you take more corners', cornerWin.length ? Math.round((100 * cornerWin.filter((r) => won(r.e)).length) / cornerWin.length) + '%' : '—')}
      ${line('X/C squares next to an empty corner, per game', avg((r) => r.s.gifts).toFixed(1))}
    </div><p class="muted" style="margin:10px 0 0;font-size:13px">X- and C-squares next to an empty corner are the classic way to give a corner away. Fewer is better.</p></section>
    <section class="card"><h2 style="font-size:20px">Mobility and discs</h2><div class="stat-rows">
      ${line('Your average number of moves', avg((r) => r.s.mobility).toFixed(1))}
      ${line('Average final margin', fin.length ? (fin.reduce((a, r) => a + r.s.discDiff, 0) / fin.length > 0 ? '+' : '') + (fin.reduce((a, r) => a + r.s.discDiff, 0) / fin.length).toFixed(1) + ' discs' : '—')}
    </div><p class="muted" style="margin:10px 0 0;font-size:13px">More moves to choose from usually means the bots are running out of good ones.</p></section>
    <section class="card"><h2 style="font-size:20px">Openings</h2><div class="stat-rows">
      ${[...openings.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 8).map(([name, o]) => `<div class="stat-row"><div style="display:flex;justify-content:space-between;gap:10px"><span>${esc(name)}</span><span class="mono" style="font-size:13px">${o.n} game${o.n === 1 ? '' : 's'} · <b>${Math.round((100 * o.w) / o.n)}%</b></span></div>${bar(Math.round((100 * o.w) / o.n))}</div>`).join('')}
    </div><p class="muted" style="margin:10px 0 0;font-size:13px">Games are turned so the first move is f5, then matched to the named lines from the lessons.</p></section>`;
}

export const REVERSI = {
  id: 'reversi',
  name: 'Reversi',
  aka: 'Played under Othello® tournament rules',
  tagline: 'Outflank discs to flip them. The most discs at the end wins, but the game is won with moves, not discs.',
  intro: 'Place a disc so it traps a line of your opponent\'s discs, and they all flip to your colour. Simple to learn, deep to master: strong play is about mobility, corners, edges and counting the endgame.',
  learnIntro: 'Six units from the rules to perfect endgame play. Each lesson explains one idea, then gives puzzles that get harder and a practice game against a bot.',
  rules: [
    'The board is 8×8. The game starts with four discs in the centre: d4 and e5 Blue, d5 and e4 Gold. Gold moves first.',
    'A move places a disc so that one or more straight lines of the opponent\'s discs (across, down or diagonal) are trapped between it and another of your discs. Every trapped line flips to your colour.',
    'Discs flipped by a move don\'t flip anything else in turn: only lines ending at the new disc count.',
    'If you have no legal move you pass. You may not pass when you have a move.',
    'The game ends when neither side can move. The player with more discs wins. Empty squares count for the winner, and a draw is 32–32.',
    'Squares are named like a chessboard seen from above: columns a–h left to right, rows 1–8 top to bottom, so a1 is the top-left corner.',
  ],
  notes: 'Othello is a registered trademark of MegaHouse Corporation. This app is not affiliated with MegaHouse or the World Othello Federation; it uses the standard rules of the game, which is also known as Reversi.',
  sources: [
    ['World Othello Federation: official rules', 'https://www.worldothello.org/about/about-othello/othello-rules/official-rules/english'],
    ['Brian Rose, Othello: A Minute to Learn… A Lifetime to Master (free PDF via the French federation)', 'https://www.ffothello.org/livres/othello-book-Brian-Rose.pdf'],
    ['Emmanuel Lazard\'s strategy guide (WZebra site)', 'http://radagast.se/othello/Help/strategy.html'],
    ['George Ortiz, Opening Strategy', 'https://www.othello.hk/downloads/OpeningStrategy.pdf'],
    ['FFO endgame test positions', 'http://radagast.se/othello/ffotest.html'],
  ],
  sideNote: 'Gold moves first. In Reversi the second player gets the last move when nobody passes, which helps in the endgame.',
  sideStatNote: 'Moving first is not an advantage in Reversi: with perfect play the game is a draw.',
  cellWord: 'square',
  showLegal: true,
  engine,
  board: { create: (host, handlers) => createBoard(host, handlers) },
  defaultOptions: {},
  setupOptions: [],
  optionsText: () => '',
  levelBlurbs: {
    1: 'Plays almost at random, often flipping as many discs as it can. Learn the rules here.',
    2: 'Knows that corners are good and the squares next to them are risky, but looks only one move ahead.',
    3: 'Thinks a few moves ahead about mobility and corners, and plays the last 8 squares perfectly.',
    4: 'Searches deeper with stable discs and edges in mind, and plays the last 12 squares perfectly.',
    5: 'Searches deepest and plays the last 16 squares perfectly. A real challenge.',
  },
  forcedText: (m, who) => (who === 'You' ? 'You have no legal move, so you pass.' : `${who} has no legal move and passes.`),
  lessons: UNITS,
  puzzleBank: BANK.map(bankStep),
  bankLabel: 'Bot games',
  themes: { ...Object.fromEntries(Object.entries(THEME_TEXT).map(([k, v]) => [k, { name: v.name, blurb: v.blurb }])), lesson: { name: 'Lesson puzzles', blurb: 'The puzzles from the lessons.' } },
  puzzleIntro: (n) => `${n} puzzles: positions from bot games, checked by the engine (endgames are solved exactly), plus every lesson puzzle. Each puzzle can come back rotated, mirrored or with colours swapped. Puzzles you miss come back a few puzzles later.`,
  puzzleLook,
  goalFail: (goal) => (goal.all ? 'Not quite.' : GOAL_FAIL[goal.kind] || 'Not quite.'),
  statsExtras,
};

export const REVERSI_SIZE = N;
export { PASS };
