// Player statistics, computed from the saved game archive. Pure logic (no DOM) so it is testable.
import { replay, P1 } from './rules.js';
import { resolveVariant, getVariant } from './variants.js';
import { LEVELS } from './ai.js';

const isFinished = (g) => g.result === 'win' || g.result === 'loss' || g.result === 'resigned' || g.result === 'draw';
const isWin = (g) => g.result === 'win';
const isLoss = (g) => g.result === 'loss' || g.result === 'resigned';

function record(games) {
  const fin = games.filter(isFinished);
  const w = fin.filter(isWin).length, l = fin.filter(isLoss).length, d = fin.filter((g) => g.result === 'draw').length;
  return { played: fin.length, wins: w, losses: l, draws: d, winPct: fin.length ? Math.round((w / fin.length) * 100) : null };
}

function groupBy(games, keyFn, labelFn) {
  const map = new Map();
  for (const g of games) {
    const k = keyFn(g);
    if (k === undefined || k === null) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(g);
  }
  return [...map.entries()].map(([k, list]) => ({ key: k, label: labelFn(k, list), ...record(list) }))
    .filter((r) => r.played > 0);
}

/** Replays a saved game to count captures for each side. Returns null for old entries without moves. */
function captureCounts(g) {
  if (!Array.isArray(g.moves) || !g.variantId) return null;
  try {
    const s = replay(resolveVariant(g.variantId, g.options || {}), g.moves);
    const you = g.you || P1;
    const them = you === P1 ? 2 : 1;
    let pairsLost = 0;
    for (const h of s.history) if (h.player === them && h.captured.length) pairsLost += 1;
    return { you: s.captured[you], them: s.captured[them], timesCaptured: pairsLost };
  } catch {
    return null;
  }
}

/**
 * @param {Array} history  newest first, as saved by the app
 */
export function computeStats(history) {
  const all = Array.isArray(history) ? history : [];
  const fin = all.filter(isFinished);
  const chronological = fin.slice().reverse();

  // Streaks
  let current = 0, currentKind = null, bestWin = 0, run = 0;
  for (const g of chronological) {
    if (isWin(g)) { run++; bestWin = Math.max(bestWin, run); } else run = 0;
  }
  for (const g of fin) { // newest first
    const kind = isWin(g) ? 'win' : isLoss(g) ? 'loss' : 'draw';
    if (currentKind === null) currentKind = kind;
    if (kind !== currentKind) break;
    current++;
  }

  const plies = fin.map((g) => g.plies ?? (Array.isArray(g.moves) ? g.moves.length : g.moves)).filter((n) => typeof n === 'number');
  const yourMoves = (n) => Math.ceil(n / 2);
  const winPlies = fin.filter(isWin).map((g) => g.plies ?? (Array.isArray(g.moves) ? g.moves.length : g.moves)).filter((n) => typeof n === 'number');

  // How games end
  const reasonLabel = { five: 'Five in a row', 'two-fives': 'Two fives', captures: 'Captures', 'five-and-captures': 'Five + captures', resign: 'Resignation', 'board-full': 'Full board' };
  const endings = (list) => {
    const m = {};
    for (const g of list) {
      const r = g.result === 'resigned' ? 'resign' : g.reason;
      if (!r) continue;
      const label = reasonLabel[r] || r;
      m[label] = (m[label] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };

  // Captures (replayed from move lists)
  let capGames = 0, capYou = 0, capThem = 0, timesCaptured = 0;
  for (const g of fin) {
    const c = captureCounts(g);
    if (!c) continue;
    capGames++; capYou += c.you; capThem += c.them; timesCaptured += c.timesCaptured;
  }

  return {
    total: record(all),
    unfinished: all.filter((g) => g.result === 'unfinished').length,
    streak: { current, kind: currentKind, bestWin },
    recent: fin.slice(0, 10).map((g) => (isWin(g) ? 'W' : isLoss(g) ? 'L' : 'D')),
    byLevel: groupBy(fin, (g) => g.level, (k) => {
      const b = LEVELS[k];
      return b ? `${b.name} · Level ${k}` : `Level ${k}`;
    }).sort((a, b) => a.key - b.key),
    byVariant: groupBy(fin, (g) => g.variantId || g.variantName, (k, list) => (getVariant(k).id === k ? getVariant(k).name : list[0].variantName || k))
      .sort((a, b) => b.played - a.played),
    bySide: groupBy(fin.filter((g) => g.you), (g) => g.you, (k) => (k === P1 ? 'Gold (moving first)' : 'Blue (moving second)')),
    length: {
      avgMoves: plies.length ? Math.round(plies.reduce((a, b) => a + b, 0) / plies.length / 2) : null,
      fastestWin: winPlies.length ? yourMoves(Math.min(...winPlies)) : null,
    },
    winsBy: endings(fin.filter(isWin)),
    lossesBy: endings(fin.filter(isLoss)),
    captures: capGames ? {
      games: capGames,
      avgYou: +(capYou / capGames / 2).toFixed(1),
      avgThem: +(capThem / capGames / 2).toFixed(1),
      timesCaptured,
    } : null,
    undos: fin.reduce((a, g) => a + (g.undos || 0), 0),
  };
}
