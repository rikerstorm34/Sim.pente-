// Saved games (no DOM). Games are packed tightly so thousands fit in the browser's storage.
//
//   - The newest ACCESS_LIMIT games (5000) are kept in full: they can be replayed and reviewed.
//   - Older games are "retired": only a short summary is kept (variant, side, opponent, result,
//     how it ended, length, date), so statistics still count them, but they can't be opened.
//   - A variation (a game replayed from the middle of another, e.g. "Retry from here") is stored
//     with `parent` = the original game's id. It is not a separate game: the game list and the
//     statistics skip it, and it is shown under its original game instead.
//
// Storage keys: gts.games (packed full games, newest first), gts.retired (summaries).
// The old format (gts.history, up to 300 unpacked games) is converted on first load.

import { LEVELS } from './ai.js';
import { getVariant } from './variants.js';

export const ACCESS_LIMIT = 5000;
const KEY = 'gts.games';
const RETIRED = 'gts.retired';
const OLD = 'gts.history';
const ALPH = 'abcdefghijklmnopqrs';

export const encodeMoves = (moves) => moves.map(([x, y]) => ALPH[x] + ALPH[y]).join('');
export function decodeMoves(str) {
  const out = [];
  for (let i = 0; i + 1 < str.length; i += 2) out.push([ALPH.indexOf(str[i]), ALPH.indexOf(str[i + 1])]);
  return out;
}

function pack(e) {
  const extra = {};
  for (const k of ['lesson', 'parent', 'fromPly', 'start', 'seat', 'decisions', 'setup']) if (e[k] !== undefined && e[k] !== null) extra[k] = e[k];
  const opts = e.options && Object.keys(e.options).length ? e.options : 0;
  return [e.id, e.variantId, opts, e.you, e.level, e.result, e.reason || 0, encodeMoves(e.moves || []), e.undos || 0, e.startedAt || 0, e.at || 0, Object.keys(extra).length ? extra : 0];
}

function unpack(a) {
  const [id, variantId, options, you, level, result, reason, moves, undos, startedAt, at, extra] = a;
  const mv = decodeMoves(moves);
  const def = getVariant(variantId);
  return {
    id, variantId, options: options || {}, you, level, result, reason: reason || null,
    moves: mv, plies: mv.length, undos, startedAt: startedAt || null, at,
    variantName: def ? def.name : variantId, botName: (LEVELS[level] || LEVELS[1]).name,
    ...(extra || {}),
  };
}

const retire = (e) => [e.variantId, e.you, e.level, e.result, e.reason || 0, e.plies ?? (e.moves ? e.moves.length : 0), e.at || 0];
const unretire = ([variantId, you, level, result, reason, plies, at]) => {
  const def = getVariant(variantId);
  return { variantId, you, level, result, reason: reason || null, plies, at, variantName: def ? def.name : variantId, botName: (LEVELS[level] || LEVELS[1]).name, retired: true };
};

/**
 * Games store over a Storage-like object (localStorage in the app, a Map-backed fake in tests).
 * onQuota(): called when storage is full, to free space elsewhere (e.g. the analysis cache);
 * return true if something was freed.
 */
export function createHistory(storage, { onQuota = () => false, limit = ACCESS_LIMIT } = {}) {
  let cache = null;
  let retiredCache = null;

  const read = (k, fallback) => {
    try { const v = storage.getItem(k); return v === null ? fallback : JSON.parse(v); } catch { return fallback; }
  };
  const isQuota = (e) => e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 || /quota/i.test(e.message || ''));

  function load() {
    if (cache) return cache;
    const packed = read(KEY, null);
    if (packed) cache = packed.map(unpack);
    else {
      // First run with the new format: convert the old list.
      const old = read(OLD, []);
      cache = Array.isArray(old) ? old.filter((e) => e && e.id && Array.isArray(e.moves)) : [];
      if (cache.length) persist();
      try { storage.removeItem(OLD); } catch { /* ignore */ }
    }
    return cache;
  }

  function retired() {
    if (!retiredCache) retiredCache = read(RETIRED, []);
    return retiredCache;
  }

  function persist() {
    // Keep the newest `limit` games (variations ride along with their original game).
    let keepLimit = limit;
    for (let attempt = 0; attempt < 12; attempt++) {
      const main = [], extra = [];
      let count = 0;
      const kept = new Set();
      for (const e of cache) {
        if (e.parent) continue;
        if (count < keepLimit) { main.push(e); kept.add(e.id); count++; } else extra.push(e);
      }
      const variations = cache.filter((e) => e.parent && (kept.has(e.parent) || String(e.parent).startsWith('wc83-')));
      const varSet = new Set(variations);
      const keep = cache.filter((e) => (e.parent ? varSet.has(e) : kept.has(e.id)));
      const newlyRetired = extra.map(retire);
      try {
        storage.setItem(KEY, JSON.stringify(keep.map(pack)));
        cache = keep;
        if (newlyRetired.length) {
          const all = newlyRetired.concat(retired());
          storage.setItem(RETIRED, JSON.stringify(all));
          retiredCache = all;
        }
        return true;
      } catch (err) {
        if (!isQuota(err)) throw err;
        if (onQuota()) continue;            // freed space elsewhere: try again
        keepLimit = Math.floor(Math.min(keepLimit, count) * 0.9); // retire the oldest 10% and try again
        if (keepLimit < 10) return false;
      }
    }
    return false;
  }

  return {
    /** Every stored game, newest first (originals and variations). */
    all: () => load(),
    /** Games that count: originals only (no variations). */
    games: () => load().filter((e) => !e.parent),
    /** Variations of one game, newest first. */
    variationsOf: (id) => load().filter((e) => e.parent === id),
    find: (id) => load().find((e) => e.id === id) || null,
    /** For statistics: every original game, including retired summaries. */
    forStats: () => load().filter((e) => !e.parent).concat(retired().map(unretire)),
    retiredCount: () => retired().length,
    add(entry) {
      load();
      cache.unshift(entry);
      persist();
      return entry.id;
    },
    /** Testing / reset helper. */
    clearCache() { cache = null; retiredCache = null; },
  };
}
