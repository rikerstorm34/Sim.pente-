// Runs the bots and game analysis off the main thread so the page never freezes.
import { fromSnapshot, newGame, applyMove } from './rules.js';
import { resolveVariant } from './variants.js';
import { chooseMove, analysePosition } from './ai.js';

self.onmessage = (e) => {
  const { id, type } = e.data;
  try {
    if (type === 'analyse') {
      // Analyse every position of a saved game, reporting progress as it goes.
      const { variantId, options, moves } = e.data;
      const variant = resolveVariant(variantId, options);
      const s = newGame(variant);
      const plies = [];
      for (let i = 0; i <= moves.length; i++) {
        const played = i < moves.length ? moves[i] : null;
        plies.push(analysePosition(s, played));
        self.postMessage({ id, progress: (i + 1) / (moves.length + 1) });
        if (played) applyMove(s, played[0], played[1]);
      }
      self.postMessage({ id, analysis: plies });
      return;
    }
    const { snapshot, level } = e.data;
    const variant = resolveVariant(snapshot.variantId, snapshot.options);
    const state = fromSnapshot(snapshot, variant);
    const move = chooseMove(state, level);
    self.postMessage({ id, move });
  } catch (err) {
    self.postMessage({ id, error: String((err && err.message) || err) });
  }
};
