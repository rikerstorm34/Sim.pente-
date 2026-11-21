// Runs the bot off the main thread so the page never freezes while it thinks.
import { fromSnapshot } from './rules.js';
import { resolveVariant } from './variants.js';
import { chooseMove } from './ai.js';

self.onmessage = (e) => {
  const { id, snapshot, level } = e.data;
  try {
    const variant = resolveVariant(snapshot.variantId, snapshot.options);
    const state = fromSnapshot(snapshot, variant);
    const move = chooseMove(state, level);
    self.postMessage({ id, move });
  } catch (err) {
    self.postMessage({ id, error: String(err && err.message || err) });
  }
};
