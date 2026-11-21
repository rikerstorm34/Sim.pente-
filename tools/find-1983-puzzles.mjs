// Scans the 1983 games for positions where the player to move (the eventual winner) has a
// forced win by a chain of fours, and reports the shortest chain found in each game.
//   node tools/find-1983-puzzles.mjs
import { PLAYABLE_1983, masterEntry } from '../js/master-games.js';
import { newGame, applyMove, cloneState, coordName } from '../js/rules.js';
import { resolveVariant } from '../js/variants.js';
import { findVCF } from '../js/ai.js';

for (const g of PLAYABLE_1983) {
  if (g.uncertain) continue;
  const e = masterEntry(g.n);
  const s = newGame(resolveVariant('pente'));
  const winner = g.winner === 'W' ? 1 : 2;
  for (let i = 0; i < e.moves.length; i++) {
    if (i >= 8 && s.toMove === winner && s.winner === null) {
      let found = null;
      for (let d = 2; d <= 8 && !found; d++) {
        const m = findVCF(cloneState(s), winner, d, Date.now() + 1500, 40000);
        if (m) found = { d, m: coordName(m.x, m.y) };
      }
      if (found) {
        const played = coordName(...e.moves[i]);
        console.log(`game ${g.n} ply ${i} (${Math.floor(i / 2) + 1}${i % 2 ? '...' : '.'}) ${g.winner} to move: chain depth ${found.d} starting ${found.m}; played ${played}${played === found.m ? ' (found it)' : ''}; game length ${e.moves.length}`);
        break;
      }
    }
    applyMove(s, ...e.moves[i]);
  }
}
