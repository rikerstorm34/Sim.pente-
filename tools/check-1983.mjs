// Replays every transcribed 1983 game and reports moves that can't be right:
// a point already taken, a capture the booklet marks (*) that didn't happen, or one it doesn't mark.
//   node tools/check-1983.mjs [gameNumber]
import { GAMES_1983, toCoord } from '../js/master-games.js';
import { newGame, applyMove, parseCoord, illegalReason, coordName } from '../js/rules.js';
import { resolveVariant } from '../js/variants.js';

const only = Number(process.argv[2]) || null;
let bad = 0;
for (const g of GAMES_1983) {
  if (only && g.n !== only) continue;
  if (g.doubtful) continue;
  const s = newGame(resolveVariant('pente'));
  const toks = g.moves.trim().split(/\s+/);
  const problems = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    const cap = t.endsWith('*');
    const c = toCoord(t);
    const [x, y] = parseCoord(c);
    const why = illegalReason(s, x, y);
    const label = `${Math.floor(i / 2) + 1}${i % 2 ? '...' : '.'}${t}`;
    if (why) { problems.push(`${label} (${c}): ${why}`); break; }
    const rec = applyMove(s, x, y);
    if (!!rec.captured.length !== cap) problems.push(`${label} (${c}): booklet ${cap ? 'marks' : 'has no'} capture, engine ${rec.captured.length ? 'captured ' + rec.captured.map((k) => coordName(k % 19, Math.floor(k / 19))).join(' ') : 'none'}`);
    if (s.winner !== null && i < toks.length - 1) { problems.push(`${label}: game already won (${s.winReason}) before the end of the record`); break; }
  }
  if (problems.length) { bad++; console.log(`Game ${g.n} (${g.white} – ${g.black}):\n  ` + problems.join('\n  ')); }
  else if (only) console.log(`Game ${g.n} OK, ${toks.length} moves, winner on board: ${s.winner}, captures W${s.captured[1] / 2} B${s.captured[2] / 2}`);
}
console.log(`${GAMES_1983.length} games, ${bad} with problems`);
