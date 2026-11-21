// For a game whose record breaks at some move, try every point for one move (by its index,
// 0-based over all moves) and list the points that make the whole record replay cleanly.
//   node tools/fix-1983.mjs <game> <moveIndex>
import { GAMES_1983, toCoord } from '../js/master-games.js';
import { newGame, applyMove, parseCoord, illegalReason } from '../js/rules.js';
import { resolveVariant } from '../js/variants.js';
const [gn, mi] = process.argv.slice(2).map(Number);
const g = GAMES_1983.find((x) => x.n === gn);
const toks = g.moves.trim().split(/\s+/);
const clean = (list) => {
  const s = newGame(resolveVariant('pente'));
  for (const [i, t] of list.entries()) {
    const [x, y] = parseCoord(toCoord(t));
    if (illegalReason(s, x, y)) return false;
    const rec = applyMove(s, x, y);
    if (!!rec.captured.length !== t.endsWith('*') && i < list.length - 1) return false;
    if (s.winner !== null && i < list.length - 1) return false;
  }
  return true;
};
const out = [];
for (let dx = -9; dx <= 9; dx++) for (let dy = -9; dy <= 9; dy++) {
  const tok = (dx ? (dx > 0 ? 'R' + dx : 'L' + -dx) : '') + (dy ? (dy > 0 ? 'U' + dy : 'D' + -dy) : '') || '0';
  const list = toks.slice(); list[mi] = tok + (toks[mi].endsWith('*') ? '*' : '');
  if (clean(list)) out.push(tok);
}
console.log(`game ${gn} move #${mi} (${toks[mi]}): clean with`, out.length > 30 ? out.length + ' options' : out.join(' '));
