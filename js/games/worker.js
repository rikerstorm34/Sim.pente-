// Web Worker for the Reversi and Hex bots and game analysis, so the page stays responsive.
// Messages: { id, game: 'reversi'|'hex', type: 'move'|'analyse', moves, options, level, played }
const PATHS = { reversi: '../reversi/engine.js', hex: '../hex/engine.js' };
const loaded = {};

self.onmessage = async (e) => {
  const { id, game, type, moves, options, level, played } = e.data;
  try {
    const E = loaded[game] || (loaded[game] = await import(PATHS[game]));
    const s = E.replay(moves, options || {});
    let result;
    if (type === 'move') result = E.chooseMove(s, level);
    else if (type === 'analyse') result = E.analyse(s, played === undefined ? null : played);
    else if (type === 'analyseGame') {
      // Every position of a finished game, one by one, with progress messages.
      const t = E.newState(options || {});
      const plies = [];
      for (let i = 0; i < moves.length; i++) {
        plies.push(E.analyse(t, moves[i]));
        E.play(t, moves[i]);
        self.postMessage({ id, progress: (i + 1) / moves.length });
      }
      result = plies;
    } else throw new Error('Unknown job ' + type);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
