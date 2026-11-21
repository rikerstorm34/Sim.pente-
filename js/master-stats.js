// Statistics on the 1983 World Championship games (no DOM): who won, how, with which openings,
// where on the board, and which habits separate winners from losers.
import { PLAYABLE_1983, masterEntry, openingOf, OPENING_MOVES, toCoord } from './master-games.js';
import { computePatterns, describeMove } from './patterns.js';
import { newGame, applyMove, P1, P2, CENTER, other } from './rules.js';
import { resolveVariant } from './variants.js';

const pct = (a, b) => (b ? Math.round((100 * a) / b) : null);
const R = 6; // heatmap reach around the centre

function replayFacts(g) {
  const e = masterEntry(g.n);
  const s = newGame(resolveVariant('pente'));
  const winner = g.winner === 'W' ? P1 : P2;
  const facts = { n: g.n, winner, plies: e.moves.length, firstCapture: null, firstFour: null, firstForcing: null, leadAt20: null, moves: [] };
  e.moves.forEach(([x, y], i) => {
    const d = describeMove(s, x, y);
    const who = s.toMove;
    const rec = applyMove(s, x, y);
    facts.moves.push({ x: x - CENTER, y: y - CENTER, who, i });
    if (rec.captured.length && facts.firstCapture === null) facts.firstCapture = who;
    if (d.forcing && facts.firstForcing === null) facts.firstForcing = who;
    if ((d.strongest === 'four' || d.strongest === 'openFour') && facts.firstFour === null) facts.firstFour = who;
    if (i === 19) facts.leadAt20 = s.captured[P1] === s.captured[P2] ? 0 : s.captured[P1] > s.captured[P2] ? P1 : P2;
  });
  facts.end = s.winner === winner ? (s.winReason === 'captures' ? 'captures' : 'five') : 'resigned';
  facts.captured = { [P1]: s.captured[P1] / 2, [P2]: s.captured[P2] / 2 };
  facts.second = e.moves.length > 2 ? [e.moves[2][0] - CENTER, e.moves[2][1] - CENTER] : null;
  return facts;
}

let cache = null;

export function masterStats() {
  if (cache) return cache;
  const games = PLAYABLE_1983;
  const facts = games.map(replayFacts);

  // --- Overview and findings
  const goldWins = facts.filter((f) => f.winner === P1).length;
  const endings = { five: 0, captures: 0, resigned: 0 };
  for (const f of facts) endings[f.end]++;
  const avgMoves = Math.round(facts.reduce((a, f) => a + f.plies, 0) / facts.length / 2);
  const rate = (key) => {
    const rel = facts.filter((f) => f[key]);
    return { games: rel.length, winPct: pct(rel.filter((f) => f[key] === f.winner).length, rel.length) };
  };
  const findings = {
    firstCapture: rate('firstCapture'),
    firstForcing: rate('firstForcing'),
    firstFour: rate('firstFour'),
    leadAt20: rate('leadAt20'),
    capturesWinner: +(facts.reduce((a, f) => a + f.captured[f.winner], 0) / facts.length).toFixed(1),
    capturesLoser: +(facts.reduce((a, f) => a + f.captured[other(f.winner)], 0) / facts.length).toFixed(1),
  };

  // --- Players
  const names = [...new Set(games.flatMap((g) => [g.white, g.black]))];
  const players = names.map((name) => {
    const mine = games.filter((g) => g.white === name || g.black === name);
    const entries = mine.map((g) => masterEntry(g.n, g.white === name ? 'W' : 'B'));
    const wins = entries.filter((e) => e.result === 'win').length;
    const asGold = entries.filter((e) => e.you === P1), asBlue = entries.filter((e) => e.you === P2);
    const pat = computePatterns(entries);
    const fs = mine.map((g) => facts.find((f) => f.n === g.n));
    const side = (g) => (g.white === name ? P1 : P2);
    return {
      name, games: mine.length, wins, winPct: pct(wins, mine.length),
      gold: { games: asGold.length, wins: asGold.filter((e) => e.result === 'win').length },
      blue: { games: asBlue.length, wins: asBlue.filter((e) => e.result === 'win').length },
      capturesPerGame: +(mine.reduce((a, g, i) => a + fs[i].captured[side(g)], 0) / mine.length).toFixed(1),
      style: pat.style,
    };
  }).sort((a, b) => b.wins - a.wins || b.winPct - a.winPct || a.name.localeCompare(b.name));

  // --- Openings
  const openingNames = Object.keys(OPENING_MOVES).concat('Irregular');
  const openings = openingNames.map((name) => {
    const fs = facts.filter((f) => openingOf(f.n) === name);
    const gw = fs.filter((f) => f.winner === P1).length;
    return {
      name, games: fs.length, goldWins: gw, goldPct: pct(gw, fs.length),
      avgMoves: fs.length ? Math.round(fs.reduce((a, f) => a + f.plies, 0) / fs.length / 2) : null,
      moves: OPENING_MOVES[name] ? OPENING_MOVES[name].split(' ').map(toCoord) : null,
    };
  }).filter((o) => o.games).sort((a, b) => b.games - a.games);

  // --- Winners vs losers: habits
  const winnerEntries = games.map((g) => masterEntry(g.n));
  const loserEntries = games.map((g) => masterEntry(g.n, g.winner === 'W' ? 'B' : 'W'));
  const wp = computePatterns(winnerEntries), lp = computePatterns(loserEntries);
  const habit = (label, key, unit, note) => ({ label, unit, note, winners: wp.style[key], losers: lp.style[key] });
  const habits = [
    habit('Forcing moves', 'aggression', '%', 'Share of moves that made a threat the opponent had to answer.'),
    habit('Blocking moves', 'defence', '%', 'Share of moves that blocked a threat.'),
    habit('Captures per game', 'capturesPerGame', '', 'Pairs captured.'),
    habit('Capture threats per game', 'capThreatsPerGame', '', 'Moves that set up a capture.'),
    habit('Pairs left open per game', 'exposedPerGame', '', 'Moves that left a pair the opponent could capture next move.'),
    habit('Double threats per game', 'doubleThreatsPerGame', '', 'Moves that made two threats at once.'),
  ];
  const shapeWin = {};
  for (const sh of wp.shapes) shapeWin[sh.shape] = { label: sh.label, winners: sh.perGame, losers: 0 };
  for (const sh of lp.shapes) (shapeWin[sh.shape] ||= { label: sh.label, winners: 0 }).losers = sh.perGame;

  // --- Heatmaps (stones played, by winners and by losers, around the centre)
  const size = 2 * R + 1;
  const grid = () => Array.from({ length: size }, () => new Array(size).fill(0));
  const heat = { winners: grid(), losers: grid(), winnerTotal: 0, loserTotal: 0, outside: 0 };
  for (const f of facts) {
    for (const m of f.moves) {
      if (Math.abs(m.x) > R || Math.abs(m.y) > R) { heat.outside++; continue; }
      if (m.who === f.winner) { heat.winners[m.y + R][m.x + R]++; heat.winnerTotal++; }
      else { heat.losers[m.y + R][m.x + R]++; heat.loserTotal++; }
    }
  }

  // --- Gold's second stone (folded so every symmetric placement counts together)
  const second = {};
  for (const f of facts) {
    if (!f.second) continue;
    const a = Math.abs(f.second[0]), b = Math.abs(f.second[1]);
    const k = `${Math.max(a, b)},${Math.min(a, b)}`;
    const c = (second[k] ||= { dx: Math.max(a, b), dy: Math.min(a, b), games: 0, goldWins: 0 });
    c.games++;
    if (f.winner === P1) c.goldWins++;
  }

  cache = {
    overview: { games: games.length, goldWins, goldPct: pct(goldWins, games.length), endings, avgMoves, players: names.length },
    findings, players, openings, habits, shapes: Object.values(shapeWin), heat, reach: R,
    second: Object.values(second).sort((a, b) => b.games - a.games),
  };
  return cache;
}

// ---------------------------------------------------------------------------
// Opening explorer: after a named opening's defining moves, what did the masters play next,
// and how did it turn out? Games are turned (one of the 8 symmetries) so they line up.

const SYM = [
  ([x, y]) => [x, y], ([x, y]) => [-y, x], ([x, y]) => [-x, -y], ([x, y]) => [y, -x],
  ([x, y]) => [-x, y], ([x, y]) => [x, -y], ([x, y]) => [y, x], ([x, y]) => [-y, -x],
];
const rel = (name) => [name.charCodeAt(0) - 65 - (name[0] > 'I' ? 1 : 0) - CENTER, Number(name.slice(1)) - 10];

export function openingTree(openingName, depth = 4) {
  const prefix = OPENING_MOVES[openingName];
  if (!prefix) return null;
  const pre = prefix.split(' ').map(toCoord).map(rel); // display coords: x right, y up
  const games = [];
  for (const g of PLAYABLE_1983) {
    if (openingOf(g.n) !== openingName) continue;
    const mv = g.moves.trim().split(/\s+/).map(toCoord).map(rel);
    const sym = SYM.findIndex((f) => pre.every((p, i) => { const q = f(mv[i] || [99, 99]); return q[0] === p[0] && q[1] === p[1]; }));
    if (sym < 0) continue;
    games.push({ g, moves: mv.map(SYM[sym]) });
  }
  // Build the tree of continuations.
  const root = { games: games.length, whiteWins: games.filter((x) => x.g.winner === 'W').length, children: new Map() };
  for (const { g, moves } of games) {
    let node = root;
    for (let i = pre.length; i < Math.min(moves.length, pre.length + depth); i++) {
      const key = moves[i].join(',');
      if (!node.children.has(key)) node.children.set(key, { move: moves[i], ply: i, games: 0, whiteWins: 0, children: new Map(), list: [] });
      node = node.children.get(key);
      node.games++;
      if (g.winner === 'W') node.whiteWins++;
      node.list.push(g.n);
    }
  }
  const name = ([x, y]) => String.fromCharCode(65 + x + CENTER + (x + CENTER >= 8 ? 1 : 0)) + (y + 10);
  const flatten = (node) => [...node.children.values()].sort((a, b) => b.games - a.games).map((c) => ({
    move: name(c.move), offset: c.move, ply: c.ply, games: c.games,
    moverWinPct: pct(c.ply % 2 === 0 ? c.whiteWins : c.games - c.whiteWins, c.games), gameNumbers: c.list,
    next: flatten(c),
  }));
  return { name: openingName, prefix: pre.map(name), prefixOffsets: pre, games: root.games, goldPct: pct(root.whiteWins, root.games), next: flatten(root) };
}
