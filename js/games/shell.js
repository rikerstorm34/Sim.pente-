// The game shell for Reversi and Hex: each game gets its own section of the app (#/reversi/…,
// #/hex/…) with a home page, setup, game screen with coach, lessons, puzzles, game records with
// review, and statistics. Everything is stored under its own keys (gts.<game>.*), so nothing
// mixes with Pente.
//
// A game plugs in with a definition (see js/games/defs.js):
//   engine   DOM-free rules + bots + analysis (js/<game>/engine.js)
//   board    { create(host, { onCell, onHover }) } → { render(state, overlay), setLabels(show) }
//   lessons  units of lessons (read / puzzle / play steps), puzzleBank, themes, statsExtras …

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

export const BOTS = {
  1: { name: 'Pip', title: 'Novice' },
  2: { name: 'Juno', title: 'Apprentice' },
  3: { name: 'Ludo', title: 'Tactician' },
  4: { name: 'Vega', title: 'Strategist' },
  5: { name: 'Orion', title: 'Master' },
};
const COLOUR = { 1: 'Gold', 2: 'Blue' };
const RESULT_LABEL = { win: 'Won', loss: 'Lost', resigned: 'Resigned', draw: 'Draw', unfinished: 'Unfinished' };
export const CLASSES = {
  best: { label: 'Best', rank: 0, color: '#16706A' },
  excellent: { label: 'Excellent', rank: 1, color: '#2F7C77' },
  good: { label: 'Good', rank: 2, color: '#5B8E8A' },
  inaccuracy: { label: 'Inaccuracy', rank: 3, color: '#B08900' },
  mistake: { label: 'Mistake', rank: 4, color: '#D9661C' },
  missedWin: { label: 'Missed win', rank: 5, color: '#D9661C' },
  blunder: { label: 'Blunder', rank: 6, color: '#C0392B' },
};
const CLASS_ORDER = Object.keys(CLASSES);
export const ACCESS_LIMIT = 5000;

// Moves are stored one character each: squares/cells from '0', a pass as '!', a swap as '~'.
export const encodeMoves = (moves) => moves.map((m) => (m === -1 ? '!' : m === -2 ? '~' : String.fromCharCode(48 + m))).join('');
export const decodeMoves = (str) => [...(str || '')].map((ch) => (ch === '!' ? -1 : ch === '~' ? -2 : ch.charCodeAt(0) - 48));

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
const bar = (pct) => `<div style="height:6px;border-radius:3px;background:var(--track);margin-top:4px"><div style="width:${pct || 0}%;height:6px;border-radius:3px;background:var(--accent)"></div></div>`;
const starsHtml = (n) => `<span class="stars" aria-label="${n} of 3 stars">${[1, 2, 3].map((i) => `<span class="${i <= n ? '' : 'dim'}">★</span>`).join('')}</span>`;
const clsBadge = (c) => (c ? `<span class="cls-badge" style="--c:${CLASSES[c].color}">${esc(CLASSES[c].label)}</span>` : '');

/**
 * Saved games for one game (newest first). The newest 5000 can be opened; older ones are kept
 * as short summaries that still count in the statistics. Variations ("Retry from here") carry
 * `parent` and are not separate games.
 */
export function createRecords(prefix, storage = globalThis.localStorage, limit = ACCESS_LIMIT) {
  const KEY = prefix + 'games', RET = prefix + 'retired';
  let cache = null;
  const read = (k) => { try { return JSON.parse(storage.getItem(k) || '[]'); } catch { return []; } };
  const pack = (e) => ({ i: e.id, t: e.at, l: e.level, y: e.you, r: e.result, e: e.reason, s: e.score, m: encodeMoves(e.moves), o: e.options, p: e.parent || undefined, f: e.fromPly ?? undefined, n: e.lesson || undefined });
  const unpack = (p) => ({ id: p.i, at: p.t, level: p.l, you: p.y, result: p.r, reason: p.e, score: p.s, moves: decodeMoves(p.m), options: p.o || {}, parent: p.p || null, fromPly: p.f ?? null, lesson: p.n || null });
  const load = () => (cache || (cache = read(KEY).map(unpack)));
  function persist() {
    let games = load();
    const originals = games.filter((e) => !e.parent);
    if (originals.length > limit) {
      const keep = new Set(originals.slice(0, limit).map((e) => e.id));
      const gone = originals.slice(limit);
      const retired = read(RET).concat(gone.map((e) => ({ t: e.at, l: e.level, y: e.you, r: e.result, n: e.moves.length, o: e.options })));
      storage.setItem(RET, JSON.stringify(retired));
      games = games.filter((e) => (e.parent ? keep.has(e.parent) : keep.has(e.id)));
      cache = games;
    }
    for (let tries = 0; tries < 8; tries++) {
      try { storage.setItem(KEY, JSON.stringify(cache.map(pack))); return; } catch {
        // Storage full: retire the oldest tenth and try again.
        const orig = cache.filter((e) => !e.parent);
        const cut = orig.slice(Math.max(10, Math.floor(orig.length * 0.9)));
        if (!cut.length) return;
        const cutIds = new Set(cut.map((e) => e.id));
        storage.setItem(RET, JSON.stringify(read(RET).concat(cut.map((e) => ({ t: e.at, l: e.level, y: e.you, r: e.result, n: e.moves.length, o: e.options })))));
        cache = cache.filter((e) => !cutIds.has(e.id) && !cutIds.has(e.parent));
      }
    }
  }
  return {
    all: () => load(),
    games: () => load().filter((e) => !e.parent),
    variationsOf: (id) => load().filter((e) => e.parent === id),
    find: (id) => load().find((e) => e.id === id) || null,
    forStats: () => load().filter((e) => !e.parent).concat(read(RET).map((r) => ({ at: r.t, level: r.l, you: r.y, result: r.r, moves: null, length: r.n, options: r.o || {}, retired: true }))),
    retiredCount: () => read(RET).length,
    add(entry) { load(); cache.unshift(entry); persist(); return entry.id; },
    clearCache() { cache = null; },
  };
}

/** Rate one move from the analysis (chances are for the player who moved). */
export function classify(a, played) {
  if (!a || a.bestChance === null || a.bestChance === undefined || a.playedChance === null || a.playedChance === undefined) return null;
  const loss = Math.max(0, a.bestChance - a.playedChance);
  if (played === a.best || loss < 0.005) return 'best';
  if (a.bestChance >= 0.85 && a.playedChance < 0.55) return 'missedWin';
  if (loss <= 0.03) return 'excellent';
  if (loss <= 0.07) return 'good';
  if (loss <= 0.13) return 'inaccuracy';
  if (loss <= 0.24) return 'mistake';
  return 'blunder';
}

/** Statistics over a list of games (finished ones count). */
export function computeStats(entries) {
  const done = entries.filter((e) => e.result !== 'unfinished');
  const won = (e) => e.result === 'win';
  const lost = (e) => e.result === 'loss' || e.result === 'resigned';
  const group = (key, label) => {
    const m = new Map();
    for (const e of done) {
      const k = key(e);
      if (!m.has(k)) m.set(k, { label: label(k), wins: 0, losses: 0, draws: 0 });
      const r = m.get(k);
      if (won(e)) r.wins++; else if (lost(e)) r.losses++; else r.draws++;
    }
    return [...m.values()].map((r) => ({ ...r, played: r.wins + r.losses + r.draws, winPct: Math.round((100 * r.wins) / Math.max(1, r.wins + r.losses + r.draws)) }));
  };
  const wins = done.filter(won).length, losses = done.filter(lost).length;
  // Streaks (entries are newest first).
  let cur = 0, kind = null;
  for (const e of done) {
    const k = won(e) ? 'win' : lost(e) ? 'loss' : 'draw';
    if (kind === null) kind = k;
    if (k !== kind) break;
    cur++;
  }
  let bestWin = 0, run = 0;
  for (const e of [...done].reverse()) { if (won(e)) { run++; bestWin = Math.max(bestWin, run); } else run = 0; }
  const lens = done.map((e) => (e.moves ? e.moves.length : e.length)).filter(Boolean);
  return {
    played: done.length, wins, losses, draws: done.length - wins - losses,
    winPct: done.length ? Math.round((100 * wins) / done.length) : 0,
    unfinished: entries.length - done.length,
    streak: { current: cur, kind, bestWin },
    recent: done.slice(0, 20).map((e) => (won(e) ? 'W' : lost(e) ? 'L' : 'D')),
    byLevel: group((e) => e.level, (k) => `${BOTS[k] ? BOTS[k].name : '?'} · Level ${k}`).sort((a, b) => a.label.localeCompare(b.label)),
    bySide: group((e) => e.you, (k) => COLOUR[k] || '?'),
    avgLength: lens.length ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : null,
  };
}

/** Leitner-style practice queue, counted in puzzles. */
const BOX_GAP = [4, 12, 40, 120, 400];
export function pickNext(items, progress, rnd = Math.random, avoid = null) {
  const p = progress.items || {};
  const due = items.filter((i) => p[i.id] && p[i.id].due <= progress.count && i.id !== avoid);
  if (due.length) return due.sort((a, b) => p[a.id].due - p[b.id].due)[0];
  const fresh = items.filter((i) => !p[i.id] && i.id !== avoid);
  if (fresh.length) {
    fresh.sort((a, b) => a.level - b.level);
    const low = fresh.filter((i) => i.level === fresh[0].level);
    return low[Math.floor(rnd() * low.length)];
  }
  const rest = items.filter((i) => i.id !== avoid);
  return rest.length ? rest.sort((a, b) => p[a.id].due - p[b.id].due)[0] : items[0];
}
export function recordPuzzle(progress, id, solved) {
  const p = progress.items || (progress.items = {});
  const it = p[id] || { box: 0, due: 0, seen: 0, solved: 0 };
  progress.count = (progress.count || 0) + 1;
  it.seen++;
  if (solved) { it.solved++; it.box = Math.min(BOX_GAP.length - 1, it.box + 1); progress.streak = (progress.streak || 0) + 1; progress.best = Math.max(progress.best || 0, progress.streak); }
  else { it.box = 0; progress.streak = 0; }
  it.due = progress.count + BOX_GAP[solved ? it.box : 0];
  p[id] = it;
  return progress;
}

// ---------------------------------------------------------------------------

export function createShell(def, ctx) {
  const E = def.engine;
  const { toast, ICON } = ctx;
  const app = () => document.getElementById('app');
  const K = (k) => `gts.${def.id}.${k}`;
  const base = `#/${def.id}`;
  const records = createRecords(K(''));
  const LESSONS = def.lessons.flatMap((u, ui) => u.lessons.map((l) => ({ ...l, unit: ui + 1, unitTitle: u.title })));
  const getLesson = (id) => LESSONS.find((l) => l.id === id) || null;
  const nextLesson = (id) => { const i = LESSONS.findIndex((l) => l.id === id); return i >= 0 ? LESSONS[i + 1] || null : null; };
  const lessonProgress = () => store.get(K('lessons'), {});
  const lessonState = (id) => lessonProgress()[id] || { done: false, steps: {} };
  const lessonsDone = () => LESSONS.filter((l) => lessonState(l.id).done).length;
  function markStep(id, step, stars) {
    const all = lessonProgress();
    const ls = all[id] || { done: false, steps: {} };
    const prev = ls.steps[step];
    ls.steps[step] = { done: true, stars: Math.max(stars, prev ? prev.stars || 0 : 0) };
    const lesson = getLesson(id);
    if (lesson && lesson.steps.every((st, i) => st.type === 'read' || (ls.steps[i] && ls.steps[i].done))) ls.done = true;
    all[id] = ls;
    store.set(K('lessons'), all);
  }
  function completeLesson(id, step) {
    markStep(id, step, 3);
    const all = lessonProgress();
    all[id] = { ...(all[id] || { steps: {} }), done: true };
    store.set(K('lessons'), all);
  }

  // ---- Worker
  let worker = null, seq = 0;
  const pending = new Map();
  try {
    worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      if (e.data.progress !== undefined) { p.onProgress && p.onProgress(e.data.progress); return; }
      pending.delete(e.data.id);
      if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.result);
    };
    worker.onerror = () => { worker = null; };
  } catch { worker = null; }
  function ask(type, payload, onProgress) {
    const msg = { game: def.id, type, ...payload };
    if (worker) {
      return new Promise((resolve, reject) => {
        const id = ++seq;
        pending.set(id, { resolve, reject, onProgress });
        worker.postMessage({ id, ...msg });
      });
    }
    // No worker: run here (slower, blocks the page briefly).
    return new Promise((resolve) => setTimeout(() => {
      const s = E.replay(msg.moves, msg.options || {});
      if (type === 'move') resolve(E.chooseMove(s, msg.level));
      else if (type === 'analyse') resolve(E.analyse(s, msg.played ?? null));
      else {
        const t = E.newState(msg.options || {});
        const out = [];
        for (const m of msg.moves) { out.push(E.analyse(t, m)); E.play(t, m); }
        resolve(out);
      }
    }, 20));
  }

  // Options for a lesson/puzzle position (e.g. a Hex board size given in the spec).
  const specOptions = (spec) => ({ ...(def.defaultOptions || {}), ...(spec.options || {}), ...(spec.size ? { size: spec.size } : {}) });

  // ---- Shared bits
  const page = (eyebrow, title, intro = '') => `<div style="margin-bottom:14px">
      <div class="eyebrow">${esc(def.name)} · ${esc(eyebrow)}</div>
      <h1 style="font-size:28px;margin-top:4px">${esc(title)}</h1>
      ${intro ? `<p class="muted" style="margin:6px 0 0;max-width:760px">${intro}</p>` : ''}
    </div>`;
  const stoneDot = (p, size = 22) => `<span class="stone p${p}" style="width:${size}px;height:${size}px;display:inline-block;vertical-align:middle"></span>`;
  const optionsText = (o) => (def.optionsText ? def.optionsText(o || {}) : '');

  // =========================================================================
  // Home

  function renderHome() {
    const cur = store.get(K('current'), null);
    const games = records.games();
    const st = computeStats(records.forStats());
    const next = LESSONS.find((l) => !lessonState(l.id).done);
    const pz = store.get(K('puzzles'), { items: {} });
    const solvedPz = Object.values(pz.items || {}).filter((i) => i.solved).length;
    app().innerHTML = `
      <section class="card stack family-hero" style="margin-bottom:14px">
        <div class="eyebrow" style="color:var(--aqua)">${esc(def.aka || 'Training')}</div>
        <h1 style="font-size:30px">${esc(def.name)}</h1>
        <p style="margin:0;max-width:760px">${esc(def.intro)}</p>
      </section>
      <div class="home-grid">
        <div class="stack">
          ${cur ? `<section class="card stack">
            <div class="eyebrow" style="color:var(--aqua)">Game in progress</div>
            <div><h2 style="font-size:23px">${esc(def.name)} vs ${esc(BOTS[cur.level].name)}</h2>
            <p class="muted" style="margin:4px 0 0">${esc(BOTS[cur.level].title)} · ${cur.moves.length} moves played${cur.lesson ? ` · Lesson ${esc(cur.lesson.id)}` : ''}</p></div>
            <a class="btn primary block" href="${base}/game">Resume game ${ICON.arrow}</a></section>` : ''}
          ${next ? `<section class="card stack">
            <div class="eyebrow">${lessonsDone() ? 'Continue learning' : 'Start here'} · Unit ${next.unit} · ${esc(next.unitTitle)}</div>
            <div><h2 style="font-size:22px">${esc(next.id)} · ${esc(next.title)}</h2><p class="muted" style="margin:4px 0 0">${esc(next.summary)}</p></div>
            <a class="btn ${cur ? '' : 'primary'}" style="align-self:flex-start" href="${base}/learn/${esc(next.id)}">${lessonsDone() ? 'Continue' : 'Start the first lesson'} ${ICON.arrow}</a></section>` : ''}
          <div class="tiles">
            <a class="tile" href="${base}/play">${stoneDot(1, 26)}<span><strong>Play a bot</strong><small>5 levels, Pip to Orion</small></span></a>
            <a class="tile" href="${base}/learn">${ICON.book}<span><strong>Lessons</strong><small>${lessonsDone()} of ${LESSONS.length} complete</small></span></a>
            <a class="tile" href="${base}/puzzles">${ICON.star}<span><strong>Puzzles</strong><small>${solvedPz} solved</small></span></a>
            <a class="tile" href="${base}/review">${ICON.chart}<span><strong>Game records</strong><small>${games.length} game${games.length === 1 ? '' : 's'} · review any of them</small></span></a>
          </div>
        </div>
        <div class="stack">
          <section class="card">
            <h3 style="font-size:18px">Your ${esc(def.name)} record</h3>
            ${st.played ? `<p style="margin:6px 0 0"><b class="mono">${st.wins}–${st.losses}${st.draws ? '–' + st.draws : ''}</b> · ${st.winPct}% won over ${st.played} game${st.played === 1 ? '' : 's'}. <a href="${base}/stats">All statistics →</a></p>` : '<p class="muted" style="margin:6px 0 0;font-size:14px">No finished games yet.</p>'}
          </section>
          <section class="card">
            <h3 style="font-size:18px">Rules in brief</h3>
            <ul class="rules" style="margin-top:6px">${def.rules.slice(0, 4).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
            <a href="${base}/rules" style="font-size:14px">Full rules and further reading →</a>
          </section>
        </div>
      </div>`;
  }

  function renderRules() {
    app().innerHTML = page('Rules', `How to play ${def.name}`, esc(def.tagline)) + `
      <section class="card" style="max-width:820px">
        <ul class="rules">${def.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
        ${def.notes ? `<p class="muted" style="margin:12px 0 0;font-size:14px">${esc(def.notes)}</p>` : ''}
      </section>
      ${def.sources ? `<section class="card" style="max-width:820px;margin-top:14px"><h2 style="font-size:20px">Further reading</h2>
        <ul class="rules">${def.sources.map(([t, u]) => `<li>${u ? `<a href="${esc(u)}" target="_blank" rel="noopener">${esc(t)}</a>` : esc(t)}</li>`).join('')}</ul></section>` : ''}`;
  }

  // =========================================================================
  // Setup

  function renderSetup() {
    const last = store.get(K('setup'), {});
    const sel = { level: last.level || 1, side: last.side || 'p1', coachMode: last.coachMode || 'quiet', options: { ...(def.defaultOptions || {}), ...(last.options || {}) } };
    app().innerHTML = `
      <form id="setup" class="stack" style="max-width:980px;margin:0 auto">
        ${page('New game', 'Set up a practice game')}
        ${(def.setupOptions || []).length ? `<section class="card stack">${def.setupOptions.map((o) => `
          <div><b>${esc(o.label)}</b>${o.sub ? `<div class="muted" style="font-size:13px;margin-bottom:8px">${esc(o.sub)}</div>` : ''}
            <div class="segmented" role="radiogroup" aria-label="${esc(o.label)}">
              ${o.choices.map(([v, l]) => `<label><input type="radio" name="opt-${o.key}" value="${esc(v)}" ${String(sel.options[o.key]) === String(v) ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}
            </div></div>`).join('')}</section>` : ''}
        <section>
          <h2 class="section-title">Opponent</h2>
          <div class="choice-list levels">
            ${[1, 2, 3, 4, 5].map((l) => `
              <label class="choice">
                <input type="radio" name="level" value="${l}" ${l === sel.level ? 'checked' : ''}>
                <span class="body">
                  <span class="title">${stoneDot(2)} ${esc(BOTS[l].name)} <span class="badge">LEVEL ${l}</span></span>
                  <span class="sub">${esc(BOTS[l].title)}</span>
                  <span class="trains">${esc(def.levelBlurbs[l])}</span>
                </span>
              </label>`).join('')}
          </div>
        </section>
        <section class="card stack">
          <div><b>Your colour</b><div class="muted" style="font-size:13px;margin-bottom:8px">${esc(def.sideNote)}</div>
            <div class="segmented" role="radiogroup" aria-label="Your colour">
              <label><input type="radio" name="side" value="p1" ${sel.side === 'p1' ? 'checked' : ''}><span>Gold · 1st</span></label>
              <label><input type="radio" name="side" value="p2" ${sel.side === 'p2' ? 'checked' : ''}><span>Blue · 2nd</span></label>
              <label><input type="radio" name="side" value="random" ${sel.side === 'random' ? 'checked' : ''}><span>Random</span></label>
            </div></div>
          <div><b>Coach</b><div class="muted" style="font-size:13px;margin-bottom:8px">Quiet keeps the coach's notes folded until you ask for them.</div>
            <div class="segmented" role="radiogroup" aria-label="Coach">
              ${[['quiet', 'Quiet'], ['always', 'Always show'], ['off', 'Off']].map(([v, l]) => `<label><input type="radio" name="coach" value="${v}" ${sel.coachMode === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
            </div></div>
        </section>
        <div class="sticky-start"><button class="btn primary block" type="submit">Start the game ${ICON.arrow}</button></div>
      </form>`;
    $('#setup').addEventListener('submit', (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const options = {};
      for (const o of def.setupOptions || []) {
        const v = f.get('opt-' + o.key);
        options[o.key] = typeof def.defaultOptions[o.key] === 'number' ? Number(v) : typeof def.defaultOptions[o.key] === 'boolean' ? v === 'true' : v;
      }
      const settings = { level: Number(f.get('level')), side: f.get('side'), coachMode: f.get('coach'), options };
      store.set(K('setup'), settings);
      startGame(settings);
    });
  }

  // =========================================================================
  // Game

  let game = null, view = null, token = 0;

  function startGame(settings, initialMoves = [], meta = {}) {
    const you = settings.side === 'random' ? (Math.random() < 0.5 ? 1 : 2) : settings.side === 'p2' ? 2 : 1;
    const prev = store.get(K('current'), null);
    if (prev && prev.moves.length && !meta.keepPrevious) archive(prev, 'unfinished', 'unfinished');
    store.set(K('current'), {
      options: settings.options || {}, level: settings.level, you, coachMode: settings.coachMode || 'quiet',
      moves: initialMoves.slice(), startedAt: Date.now(), lesson: meta.lesson || null,
      parent: meta.parent || null, fromPly: meta.parent ? initialMoves.length : null,
    });
    if (location.hash === `${base}/game`) renderGame(); else location.hash = `${base}/game`;
  }

  function archive(g, result, reason, score = '') {
    const id = (g.startedAt || Date.now()).toString(36) + Math.random().toString(36).slice(2, 6);
    records.add({ id, at: Date.now(), level: g.level, you: g.you, result, reason, score, moves: g.moves.slice(), options: g.options || {}, parent: g.parent || null, fromPly: g.parent ? g.fromPly : null, lesson: g.lesson || null });
    return id;
  }

  function loadGame() {
    const cur = store.get(K('current'), null);
    if (!cur) return null;
    let state;
    try { state = E.replay(cur.moves, cur.options || {}); } catch { store.del(K('current')); return null; }
    return { ...cur, state, bot: BOTS[cur.level], thinking: false, preview: null, hover: null, warn: null, notes: [], hints: [], revealed: false, resignArmed: false, flipped: [] };
  }
  function saveGame() {
    const g = game;
    if (!g) return;
    const moves = g.state.history.map((h) => h.move);
    store.set(K('current'), { options: g.options, level: g.level, you: g.you, coachMode: g.coachMode, moves, startedAt: g.startedAt, lesson: g.lesson, parent: g.parent, fromPly: g.fromPly });
  }
  const movesOf = (s) => s.history.map((h) => h.move);

  function renderGame() {
    game = loadGame();
    if (!game) { location.hash = `${base}/play`; return; }
    token++;
    const g = game;
    const back = g.lesson ? `${base}/learn/${encodeURIComponent(g.lesson.id)}?s=${g.lesson.step}` : base;
    app().innerHTML = `
      <div class="game-head" style="margin-bottom:12px">
        <a class="icon-btn" href="${back}" aria-label="${g.lesson ? 'Back to the lesson' : `Back to ${esc(def.name)} home`}">${ICON.back}</a>
        <div class="title">
          <h1>${esc(def.name)} vs ${esc(g.bot.name)}</h1>
          <div class="eyebrow">${esc([`Level ${g.level} · ${g.bot.title}`, optionsText(g.options)].filter(Boolean).join(' · '))}</div>
        </div>
        <a class="icon-btn" href="${base}/rules" aria-label="Rules">${ICON.book}</a>
      </div>
      ${g.lesson ? `<a class="lesson-banner" href="${back}">${ICON.book}<span><b>Lesson ${esc(g.lesson.id)} practice:</b> ${esc(g.lesson.goal || 'win the game')}</span></a>` : ''}
      <div class="game">
        <div class="stack" style="gap:12px">
          <div id="opp-phone" class="only-phone"></div>
          <div class="board-wrap ${def.id}-wrap" id="board"></div>
        </div>
        <div class="side">
          <div id="opp-desk" class="only-desk"></div>
          <div id="me"></div>
          <section id="coach" class="coach" aria-live="polite"></section>
          <div id="confirm" class="confirm-bar"></div>
          <div class="actions">
            <button class="btn" type="button" id="btn-undo">${ICON.undo}<span>Undo</span></button>
            <button class="btn" type="button" id="btn-hint">${ICON.hint}<span>Hint</span></button>
            <button class="btn" type="button" id="btn-resign">${ICON.flag}<span>Resign</span></button>
            ${g.lesson ? `<button class="btn" type="button" id="btn-restart">${ICON.plus}<span>Restart</span></button>` : `<a class="btn" href="${base}/play">${ICON.plus}<span>New</span></a>`}
          </div>
          <details class="card" style="padding:12px 16px">
            <summary style="cursor:pointer;font-weight:600">Moves</summary>
            <div class="moves" id="moves" style="margin-top:8px"></div>
          </details>
        </div>
      </div>`;
    const style = document.getElementById('gts-only-style') || Object.assign(document.createElement('style'), { id: 'gts-only-style' });
    style.textContent = '@media (min-width:960px){.only-phone{display:none}} @media (max-width:959px){.only-desk{display:none}}';
    document.head.appendChild(style);

    view = def.board.create($('#board'), { onCell, onHover }, g.options);
    const ro = new ResizeObserver(() => view && view.setLabels(view.svg.getBoundingClientRect().width >= 380));
    ro.observe($('#board'));
    $('#btn-undo').addEventListener('click', onUndo);
    $('#btn-hint').addEventListener('click', onHint);
    $('#btn-resign').addEventListener('click', onResign);
    $('#btn-restart')?.addEventListener('click', () => {
      if (g.state.history.length > (g.fromPly || 0) + 1 && !confirm('Restart this practice game from the beginning?')) return;
      startLessonGame(g.lesson.id, g.lesson.step);
    });
    if (E.isOver(g.state)) { update(); showResult(); return; }
    nextTurn();
  }

  function myTurn() { const g = game; return g && !g.thinking && !E.isOver(g.state) && E.toMove(g.state) === g.you; }

  function nextTurn() {
    const g = game;
    if (!g) return;
    if (E.isOver(g.state)) { finish(); return; }
    const forced = E.forcedMove(g.state);
    if (forced !== null && E.toMove(g.state) === g.you) {
      // A forced move for you (e.g. a pass in Reversi): play it after a short notice.
      toast(def.forcedText ? def.forcedText(forced, 'You') : 'Forced move.');
      E.play(g.state, forced);
      saveGame();
      setTimeout(nextTurn, 600);
      update();
      return;
    }
    if (E.toMove(g.state) !== g.you) { botTurn(); return; }
    refreshNotes();
    update();
  }

  function refreshNotes() {
    const g = game;
    g.notes = g.coachMode !== 'off' && myTurn() ? E.coachNotes(g.state, g.you, g.bot.name) : [];
    g.revealed = g.coachMode === 'always';
  }

  async function botTurn() {
    const g = game, t = token;
    g.thinking = true; g.notes = [];
    update();
    const started = performance.now();
    let move;
    try { move = await ask('move', { moves: movesOf(g.state), options: g.options, level: g.level }); } catch (err) {
      console.error(err); toast('The bot hit a problem. Start a new game to try again.'); g.thinking = false; update(); return;
    }
    const wait = Math.max(0, 420 - (performance.now() - started));
    await new Promise((r) => setTimeout(r, wait));
    if (t !== token || game !== g) return;
    g.thinking = false;
    if (E.illegalReason(g.state, move)) { toast('The bot tried an illegal move.'); update(); return; }
    const rec = E.play(g.state, move);
    g.flipped = rec.flips || [];
    if (def.forcedText && move === -1) toast(def.forcedText(move, g.bot.name));
    if (def.swapText && move === -2) toast(def.swapText(g.bot.name));
    saveGame();
    nextTurn();
  }

  function onCell(c, type) {
    const g = game;
    if (!myTurn()) return;
    const why = E.illegalReason(g.state, c);
    if (why) { toast(why); return; }
    if (type === 'mouse' || g.preview === c) { placeMine(c); return; }
    g.preview = c;
    g.warn = g.coachMode !== 'off' ? E.previewWarning(g.state, c, g.bot.name) : null;
    update();
  }
  function onHover(c) {
    const g = game;
    if (!g || !myTurn() || g.preview !== null) return;
    const v = c !== null && !E.illegalReason(g.state, c) ? c : null;
    if (v === g.hover) return;
    g.hover = v;
    renderBoard();
  }
  function placeMine(c) {
    const g = game;
    if (!myTurn() || E.illegalReason(g.state, c)) return;
    g.preview = null; g.hover = null; g.warn = null; g.hints = []; g.resignArmed = false;
    const rec = E.play(g.state, c);
    g.flipped = rec.flips || [];
    saveGame();
    nextTurn();
  }

  function renderBoard() {
    const g = game;
    const s = g.state;
    const showMarks = g.coachMode !== 'off' && (g.revealed || g.coachMode === 'always');
    const threats = showMarks ? g.notes.filter((n) => n.kind === 'threat').flatMap((n) => n.points) : [];
    const chances = showMarks ? g.notes.filter((n) => n.kind === 'opportunity' && n.reveal).flatMap((n) => n.points) : [];
    view.render(s, {
      last: E.lastMove(s),
      ghost: g.preview !== null ? g.preview : g.hover,
      ghostWarn: !!g.warn,
      legal: def.showLegal && myTurn() ? E.legalMoves(s).filter((m) => m >= 0) : [],
      hints: g.hints.concat(chances),
      threats,
      flipped: g.flipped,
    });
  }

  function playerCard(p) {
    const g = game, s = g.state;
    const isYou = p === g.you;
    const active = !E.isOver(s) && E.toMove(s) === p;
    const name = isYou ? `You · ${COLOUR[p]}` : `${g.bot.name} · ${COLOUR[p]}`;
    const status = isYou ? (active ? 'Your turn' : 'Waiting') : (active ? '<span class="thinking">Thinking</span>' : esc(g.bot.title));
    return `<div class="player ${active ? 'active' : ''}">
      <span class="stone p${p}" aria-hidden="true"></span>
      <div class="who"><div class="name">${esc(name)}</div><div class="status">${status}</div></div>
      <div class="counts">${esc(E.playerInfo(s, p, g.options))}</div></div>`;
  }

  function update() {
    const g = game;
    if (!g || !view) return;
    const s = g.state;
    const opp = g.you === 1 ? 2 : 1;
    $('#opp-phone').innerHTML = playerCard(opp);
    $('#opp-desk').innerHTML = playerCard(opp);
    $('#me').innerHTML = playerCard(g.you);
    renderBoard();
    // Coach
    const coach = $('#coach');
    if (g.coachMode === 'off') coach.innerHTML = '<div class="note"><p class="muted">Coach is off.</p></div>';
    else if (g.thinking) coach.innerHTML = `<div class="note"><p class="muted">${esc(g.bot.name)} is thinking…</p></div>`;
    else if (E.isOver(s)) coach.innerHTML = '';
    else if (!g.notes.length) coach.innerHTML = '<div class="note"><p class="muted">Nothing to flag right now.</p></div>';
    else if (!g.revealed) {
      coach.innerHTML = `<button class="btn block" type="button" id="coach-show">${ICON.hint}<span>Coach has ${g.notes.length} note${g.notes.length === 1 ? '' : 's'}</span></button>`;
      $('#coach-show').addEventListener('click', () => { g.revealed = true; update(); });
    } else {
      coach.innerHTML = g.notes.map((n) => `<div class="note ${n.kind}"><div class="eyebrow">${esc(n.tag)}</div><b>${esc(n.title)}</b><p>${esc(n.text)}</p></div>`).join('');
    }
    // Extra actions (e.g. Hex swap)
    const extra = def.extraActions ? def.extraActions(g.state, g.you, g.options).filter(() => myTurn()) : [];
    const conf = $('#confirm');
    if (g.preview !== null && myTurn()) {
      conf.innerHTML = `${g.warn ? `<div class="warn">${esc(g.warn)}</div>` : ''}<div style="display:grid;grid-template-columns:1fr 2fr;gap:8px">
        <button class="btn" type="button" id="btn-cancel">Cancel</button>
        <button class="btn primary" type="button" id="btn-confirm">Play <span class="mono">${esc(E.moveName(g.preview, g.options))}</span></button></div>`;
      $('#btn-confirm').addEventListener('click', () => placeMine(g.preview));
      $('#btn-cancel').addEventListener('click', () => { g.preview = null; g.warn = null; update(); });
    } else if (myTurn()) {
      conf.innerHTML = `${extra.map((a) => `<button class="btn block" type="button" data-extra="${a.move}" style="margin-bottom:8px">${esc(a.label)}</button>`).join('')}
        <div class="muted" style="font-size:12px;text-align:center">Tap a ${esc(def.cellWord)} to preview your move, then confirm. With a mouse, just click.</div>`;
      conf.querySelectorAll('[data-extra]').forEach((b) => b.addEventListener('click', () => placeMine(Number(b.dataset.extra))));
    } else conf.innerHTML = '';
    // Moves
    const ms = movesOf(s);
    const rows = [];
    for (let i = 0; i < ms.length; i += 2) rows.push(`<span class="n">${i / 2 + 1}.</span><span>${esc(E.moveName(ms[i], g.options))}</span><span>${ms[i + 1] !== undefined ? esc(E.moveName(ms[i + 1], g.options)) : ''}</span>`);
    $('#moves').innerHTML = rows.join('') || '<span class="muted">No moves yet.</span>';
    $('#btn-undo').disabled = g.thinking || ms.length <= (g.fromPly || 0) || E.isOver(s) || (ms.length === 1 && g.you === 2);
    $('#btn-hint').disabled = !myTurn();
    const rb = $('#btn-resign');
    rb.disabled = E.isOver(s);
    rb.querySelector('span').textContent = g.resignArmed ? 'Confirm' : 'Resign';
    rb.classList.toggle('danger', g.resignArmed);
  }

  function onUndo() {
    const g = game;
    if (!g || g.thinking) return;
    const floor = g.fromPly || 0;
    if (g.state.history.length <= floor) return;
    E.undo(g.state);
    while (g.state.history.length > floor && (E.toMove(g.state) !== g.you || (E.forcedMove(g.state) !== null))) E.undo(g.state);
    g.preview = null; g.hints = []; g.flipped = [];
    saveGame();
    if (E.toMove(g.state) !== g.you) { botTurn(); return; }
    refreshNotes();
    update();
  }

  async function onHint() {
    const g = game;
    if (!myTurn()) return;
    const btn = $('#btn-hint');
    btn.disabled = true;
    const t = token;
    try {
      const m = await ask('move', { moves: movesOf(g.state), options: g.options, level: 4 });
      if (t !== token || game !== g) return;
      g.hints = m >= 0 ? [m] : [];
      toast(m >= 0 ? `Vega suggests ${E.moveName(m, g.options)}.` : 'Vega suggests that move.');
    } finally { update(); }
  }

  function onResign() {
    const g = game;
    if (!g || E.isOver(g.state)) return;
    if (!g.resignArmed) { g.resignArmed = true; update(); setTimeout(() => { if (game === g && g.resignArmed) { g.resignArmed = false; update(); } }, 3500); return; }
    token++;
    g.resigned = true;
    finish(true);
  }

  function finish(resigned = false) {
    const g = game;
    const out = E.isOver(g.state) ? E.outcome(g.state, g.options) : null;
    const result = resigned ? 'resigned' : out.winner === 0 ? 'draw' : out.winner === g.you ? 'win' : 'loss';
    const id = archive({ ...g, moves: movesOf(g.state) }, result, resigned ? 'resign' : 'end', out ? out.text : 'Resigned');
    g.archivedId = id;
    g.result = result;
    g.outText = out ? out.text : `You resigned. ${g.bot.name} wins.`;
    store.del(K('current'));
    if (g.lesson && result === 'win' && !g.parent) completeLesson(g.lesson.id, g.lesson.step);
    g.notes = [];
    update();
    showResult();
  }

  function showResult() {
    const g = game;
    const won = g.result === 'win';
    const title = g.result === 'win' ? 'You won!' : g.result === 'draw' ? 'A draw' : g.result === 'resigned' ? 'Resigned' : `${g.bot.name} won`;
    const review = g.archivedId ? `<a class="btn primary" href="${base}/review/${g.archivedId}">Review game ${ICON.arrow}</a>` : '';
    const settings = { level: g.level, side: g.you === 1 ? 'p1' : 'p2', coachMode: g.coachMode, options: g.options };
    let buttons;
    if (g.parent) buttons = `${review}<a class="btn" href="${base}/review/${encodeURIComponent(g.parent)}">Back to the original game</a><a class="btn" href="${base}">Back to home</a>`;
    else if (g.lesson) {
      const nl = nextLesson(g.lesson.id);
      const nextBtn = nl ? `<a class="btn" href="${base}/learn/${esc(nl.id)}">Next lesson</a>` : `<a class="btn" href="${base}/learn">All lessons</a>`;
      const again = `<button class="btn" type="button" id="again">${won ? 'Play again' : 'Try again'}</button>`;
      buttons = won ? `${review}${nextBtn}${again}<a class="btn" href="${base}">Back to home</a>` : `${review}${again}${nextBtn}<a class="btn" href="${base}">Back to home</a>`;
    } else buttons = `${review}<button class="btn" type="button" id="again">Play again</button><a class="btn" href="${base}/play">Change settings</a><a class="btn" href="${base}">Back to home</a>`;
    $('#coach').innerHTML = `<section class="card stack result-card">
      <div class="eyebrow" style="color:${won ? 'var(--aqua)' : 'var(--muted)'}">${g.lesson && won ? 'Lesson complete' : 'Game over'}</div>
      <h2 style="font-size:26px">${esc(title)}</h2>
      <p style="margin:0">${esc(g.outText || '')}</p>
      <div class="result-actions">${buttons}</div></section>`;
    $('#confirm').innerHTML = '';
    $('#again')?.addEventListener('click', () => (g.lesson ? startLessonGame(g.lesson.id, g.lesson.step) : startGame(settings)));
  }

  function startLessonGame(id, stepIdx) {
    const lesson = getLesson(id);
    const step = lesson && lesson.steps[stepIdx];
    if (!step || step.type !== 'play') return;
    const side = step.game.side === 'random' || lesson.unit >= 4 ? 'random' : step.game.side || 'p1';
    startGame({ level: step.game.level, side, coachMode: step.game.coachMode || 'quiet', options: { ...(def.defaultOptions || {}), ...(step.game.options || {}) } }, [], { lesson: { id, step: stepIdx, goal: step.game.goal || `beat ${BOTS[step.game.level].name}` } });
  }

  // =========================================================================
  // Lessons

  function renderLearn() {
    const next = LESSONS.find((l) => !lessonState(l.id).done);
    app().innerHTML = page('Learn', 'Lessons', esc(def.learnIntro)) + `
      ${next ? `<section class="card stack" style="margin-bottom:14px">
        <div class="eyebrow" style="color:var(--aqua)">${lessonsDone() ? 'Continue' : 'Start here'} · Unit ${next.unit} · ${esc(next.unitTitle)}</div>
        <div><h2 style="font-size:23px">${esc(next.id)} · ${esc(next.title)}</h2><p class="muted" style="margin:4px 0 0">${esc(next.summary)}</p></div>
        <a class="btn primary" href="${base}/learn/${esc(next.id)}" style="align-self:flex-start">${lessonsDone() ? 'Continue' : 'Start'} ${ICON.arrow}</a>
      </section>` : '<section class="card" style="margin-bottom:14px"><h2 style="font-size:22px">All lessons complete</h2><p class="muted" style="margin:4px 0 0">Replay any lesson, or test yourself against Vega and Orion.</p></section>'}
      <div class="units">
        ${def.lessons.map((u, ui) => {
          const done = u.lessons.filter((l) => lessonState(l.id).done).length;
          return `<section class="card unit">
            <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
              <div><div class="eyebrow">Unit ${ui + 1}</div><h2 style="font-size:22px;margin-top:2px">${esc(u.title)}</h2></div>
              <span class="mono muted" style="font-size:12px">${done}/${u.lessons.length}</span>
            </div>
            <p class="muted" style="margin:4px 0 0;font-size:14px">${esc(u.blurb)}</p>
            ${bar(Math.round((done / u.lessons.length) * 100))}
            <div class="lesson-list">${u.lessons.map((l) => {
              const st = lessonState(l.id);
              const n = Object.values(st.steps).filter((x) => x.done).length;
              const total = l.steps.filter((x) => x.type !== 'read').length;
              return `<a class="lesson-row ${st.done ? 'done' : ''}" href="${base}/learn/${esc(l.id)}">
                <span class="lesson-num mono">${st.done ? '✓' : esc(l.id)}</span>
                <span style="flex:1;min-width:0"><b>${esc(l.title)}</b><small class="muted">${esc(l.summary)}</small></span>
                <span class="mono muted" style="font-size:12px">${Math.min(n, total)}/${total}</span></a>`;
            }).join('')}</div>
          </section>`;
        }).join('')}
      </div>`;
  }

  let puzzleRun = null; // the open puzzle (lesson or trainer)

  function renderLesson(id, params) {
    const lesson = getLesson(id);
    if (!lesson) { location.hash = `${base}/learn`; return; }
    const stepIdx = Math.min(lesson.steps.length - 1, Math.max(0, Number(params.get('s')) || 0));
    const step = lesson.steps[stepIdx];
    const prog = lessonState(lesson.id);
    const nl = nextLesson(lesson.id);
    const goStep = (i) => `${base}/learn/${encodeURIComponent(lesson.id)}?s=${i}`;
    app().innerHTML = `
      <div class="game-head" style="margin-bottom:10px">
        <a class="icon-btn" href="${base}/learn" aria-label="All lessons">${ICON.back}</a>
        <div class="title">
          <div class="eyebrow">${esc(def.name)} · Unit ${lesson.unit} · ${esc(lesson.unitTitle)} · Lesson ${esc(lesson.id)}</div>
          <h1 style="font-size:22px">${esc(lesson.title)}</h1>
        </div>
      </div>
      <nav class="step-dots" aria-label="Lesson steps">
        ${lesson.steps.map((st, i) => {
          const d = prog.steps[i] && prog.steps[i].done;
          return `<a href="${goStep(i)}" class="step-dot ${i === stepIdx ? 'on' : ''} ${d ? 'done' : ''}" aria-label="Step ${i + 1}" ${i === stepIdx ? 'aria-current="step"' : ''}>
            <span>${d ? '✓' : st.type === 'read' ? '¶' : st.type === 'play' ? '▶' : i + 1}</span></a>`;
        }).join('')}
      </nav>
      <div class="lesson-body" id="lesson-body"></div>
      <div class="lesson-foot">
        ${stepIdx > 0 ? `<a class="btn" href="${goStep(stepIdx - 1)}">${ICON.back} Back</a>` : '<span></span>'}
        ${stepIdx < lesson.steps.length - 1 ? `<a class="btn primary" href="${goStep(stepIdx + 1)}">Next ${ICON.arrow}</a>`
          : nl ? `<a class="btn primary" href="${base}/learn/${esc(nl.id)}">Next lesson: ${esc(nl.title)} ${ICON.arrow}</a>` : `<a class="btn primary" href="${base}/learn">All lessons</a>`}
      </div>`;
    const body = $('#lesson-body');
    if (step.type === 'read') {
      body.innerHTML = `<section class="card lesson-read ${step.board ? 'with-board' : ''}">
        <div><h2 style="font-size:24px">${esc(step.title)}</h2>${step.text.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
        ${step.board ? `<div class="board-wrap small ${def.id}-wrap" id="board"></div>` : ''}
      </section>`;
      if (step.board) {
        const bo = specOptions(step.board);
        const s = E.setupPosition(step.board, bo);
        view = def.board.create($('#board'), { onCell: () => {} }, bo);
        view.setLabels(true);
        view.render(s, { hints: (step.board.hints || []).map((n) => E.parseMove(n, bo)), threats: (step.board.threats || []).map((n) => E.parseMove(n, bo)) });
      }
      markStep(lesson.id, stepIdx, 3);
      return;
    }
    if (step.type === 'play') {
      const d = prog.steps[stepIdx] && prog.steps[stepIdx].done;
      const bot = BOTS[step.game.level];
      const random = step.game.side === 'random' || lesson.unit >= 4;
      body.innerHTML = `<section class="card stack" style="max-width:720px">
        <div class="eyebrow">Practice game</div>
        <h2 style="font-size:24px">${esc(step.title)}</h2>
        <p style="margin:0">${esc(step.text)}</p>
        <div class="player" style="max-width:420px">${stoneDot(2)}
          <div class="who"><div class="name">${esc(bot.name)} · Level ${step.game.level}</div><div class="status">${esc(bot.title)} · ${random ? 'you play Gold or Blue, picked at random' : `you play ${step.game.side === 'p2' ? 'Blue' : 'Gold'}`}</div></div></div>
        ${d ? '<p style="margin:0;color:var(--good);font-weight:600">✓ Completed. You can play it again any time.</p>' : '<p class="muted" style="margin:0">Win the game to complete the lesson. Every game is saved, so you can review it afterwards.</p>'}
        <button class="btn primary" type="button" id="start-practice" style="align-self:flex-start">${d ? 'Play again' : 'Start the game'} ${ICON.arrow}</button>
      </section>`;
      $('#start-practice').addEventListener('click', () => startLessonGame(lesson.id, stepIdx));
      return;
    }
    renderPuzzleInto(body, step, {
      solvedBefore: prog.steps[stepIdx],
      onSolved: (stars) => markStep(lesson.id, stepIdx, stars),
    });
  }

  /**
   * A puzzle (one or more stages) inside `host`. Each stage: prompt, goal, answer, hint,
   * success, optional `accept` (all correct moves, pre-computed and tested), optional reply.
   */
  function renderPuzzleInto(host, step, { solvedBefore = null, onSolved = () => {}, onFailed = () => {}, actions = '' } = {}) {
    const opts = specOptions(step.setup);
    const P = puzzleRun = { stage: 0, state: E.setupPosition(step.setup, opts), wrong: 0, hinted: false, shown: false, solved: false, preview: null, msg: null, last: null, token: (puzzleRun ? puzzleRun.token : 0) + 1, failed: false };
    P.you = E.toMove(P.state);
    if (step.setup.last) { try { P.last = E.parseMove(step.setup.last, opts); } catch { P.last = null; } }
    host.innerHTML = `
      <div class="game">
        <div class="stack" style="gap:12px"><div class="board-wrap ${def.id}-wrap" id="board"></div></div>
        <div class="side">
          <section class="card" id="pz-card" aria-live="polite"></section>
          <div id="confirm" class="confirm-bar"></div>
          <div class="actions" style="grid-template-columns:repeat(3,minmax(0,1fr))">
            <button class="btn" type="button" id="pz-hint">${ICON.hint}<span>Hint</span></button>
            <button class="btn" type="button" id="pz-show">Show answer</button>
            <button class="btn" type="button" id="pz-reset">${ICON.undo}<span>Reset</span></button>
          </div>
          ${actions}
          ${solvedBefore && solvedBefore.done ? `<p class="muted" style="margin:0;font-size:13px">Solved before ${starsHtml(solvedBefore.stars || 1)}</p>` : ''}
        </div>
      </div>`;
    view = def.board.create($('#board'), {
      onCell: (c, type) => {
        if (P.solved || E.toMove(P.state) !== P.you) return;
        const why = E.illegalReason(P.state, c);
        if (why) { toast(why); return; }
        if (type === 'mouse' || P.preview === c) { attempt(c); return; }
        P.preview = c; draw();
      },
    }, opts);
    view.setLabels(true);
    const name = (m) => E.moveName(m, opts);

    function draw() {
      const sg = step.stages[Math.min(P.stage, step.stages.length - 1)];
      view.render(P.state, {
        last: P.last, ghost: P.preview,
        legal: def.showLegal && !P.solved ? E.legalMoves(P.state).filter((m) => m >= 0) : [],
        hints: P.shown && !P.solved ? [E.parseMove(sg.answer, opts)] : [],
      });
      const multi = step.stages.length > 1;
      $('#pz-card').innerHTML = `
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
          <div class="eyebrow">Puzzle · Level ${step.level}${multi ? ` · Step ${Math.min(P.stage + 1, step.stages.length)} of ${step.stages.length}` : ''}</div>
          <span class="badge">YOU: ${COLOUR[P.you].toUpperCase()}</span>
        </div>
        <h2 style="font-size:22px;margin-top:6px">${esc(step.title)}</h2>
        <p style="margin:8px 0 0">${esc(P.solved ? 'Solved!' : sg.prompt)}</p>
        ${P.hinted && !P.solved ? `<p class="muted" style="margin:8px 0 0;font-size:14px">Hint: ${esc(sg.hint)}</p>` : ''}
        ${P.msg ? `<div class="note ${P.msg.kind}" style="margin-top:12px"><p>${esc(P.msg.text)}</p></div>` : ''}
        ${P.solved ? `<div style="margin-top:12px">${starsHtml(P.stars)}</div>` : ''}`;
      const conf = $('#confirm');
      if (P.preview !== null && !P.solved) {
        conf.innerHTML = `<div style="display:grid;grid-template-columns:1fr 2fr;gap:8px">
          <button class="btn" type="button" id="pz-cancel">Cancel</button>
          <button class="btn primary" type="button" id="pz-confirm">Play <span class="mono">${esc(name(P.preview))}</span></button></div>`;
        $('#pz-confirm').addEventListener('click', () => attempt(P.preview));
        $('#pz-cancel').addEventListener('click', () => { P.preview = null; draw(); });
      } else conf.innerHTML = '';
      $('#pz-hint').disabled = P.solved;
      $('#pz-show').disabled = P.solved || P.wrong < 2;
      $('#pz-show').title = P.wrong < 2 ? 'Available after two tries' : '';
    }

    function attempt(m) {
      const sg = step.stages[P.stage];
      P.preview = null;
      const ok = name(m) === sg.answer || (sg.accept ? sg.accept.includes(name(m)) : E.checkGoal(P.state, m, sg.goal));
      if (!ok) {
        P.wrong++;
        if (!P.failed) { P.failed = true; onFailed(); }
        P.msg = { kind: 'threat', text: def.goalFail(sg.goal) + (P.wrong >= 2 ? ' You can now show the answer.' : ' Try again.') };
        draw();
        return;
      }
      E.play(P.state, m);
      P.last = m;
      P.msg = { kind: 'opportunity', text: sg.success };
      if (P.stage < step.stages.length - 1) {
        const t = P.token;
        draw();
        setTimeout(() => {
          if (puzzleRun !== P || P.token !== t) return;
          if (sg.reply) { const r = E.parseMove(sg.reply, opts); E.play(P.state, r); P.last = r; }
          // An automatic pass for the solver's opponent, if forced (Reversi).
          while (!E.isOver(P.state) && E.toMove(P.state) !== P.you && E.forcedMove(P.state) !== null) E.play(P.state, E.forcedMove(P.state));
          P.stage++;
          P.msg = sg.reply ? { kind: 'note', text: `${COLOUR[P.you === 1 ? 2 : 1]} answered at ${sg.reply}.` } : null;
          draw();
        }, 650);
        return;
      }
      P.solved = true;
      P.stars = P.shown ? 1 : P.wrong || P.hinted ? 2 : 3;
      onSolved(P.stars, !P.failed);
      draw();
    }
    $('#pz-hint').addEventListener('click', () => { P.hinted = true; draw(); });
    $('#pz-show').addEventListener('click', () => { P.shown = true; draw(); });
    $('#pz-reset').addEventListener('click', () => renderPuzzleInto(host, step, { solvedBefore, onSolved, onFailed, actions }));
    draw();
    return P;
  }

  // =========================================================================
  // Puzzle trainer

  function puzzleItems() {
    const fromLessons = LESSONS.flatMap((l) => l.steps.map((st, i) => ({ st, i })).filter(({ st }) => st.type === 'puzzle').map(({ st, i }) => ({
      id: `ls-${l.id}-${i}`, source: 'lessons', theme: st.theme || 'lesson', level: st.level, title: st.title, step: st, origin: `Lesson ${l.id} · ${l.title}`,
    })));
    const bank = (def.puzzleBank || []).map((p) => ({ id: p.id, source: 'bank', theme: p.theme, level: p.level, title: p.title, step: p, origin: p.origin || '' }));
    return bank.concat(fromLessons);
  }

  function renderPuzzles(params) {
    const src = params.get('src') || 'all';
    const theme = params.get('t') || '';
    const all = puzzleItems();
    const items = all.filter((i) => (src === 'all' || i.source === src) && (!theme || i.theme === theme));
    const progress = store.get(K('puzzles'), { count: 0, items: {} });
    const solved = all.filter((i) => progress.items[i.id] && progress.items[i.id].solved).length;
    const due = all.filter((i) => progress.items[i.id] && progress.items[i.id].due <= progress.count && progress.items[i.id].box === 0).length;
    const themes = def.themes;
    const link = (o) => { const q = new URLSearchParams(); const v = { src, t: theme, ...o }; if (v.src !== 'all') q.set('src', v.src); if (v.t) q.set('t', v.t); return `${base}/puzzles${q.toString() ? '?' + q : ''}`; };
    const chip = (k, l) => `<a class="chip ${src === k ? 'on' : ''}" href="${link({ src: k, t: '' })}">${l}</a>`;
    const themesHere = Object.keys(themes).filter((t) => all.some((i) => i.theme === t && (src === 'all' || i.source === src)));
    app().innerHTML = page('Practice', 'Puzzles', esc(def.puzzleIntro(all.length))) + `
      <div class="pz-stats">
        <div><div class="eyebrow">Solved</div><div class="big-num">${solved}<span class="muted" style="font-size:16px"> / ${all.length}</span></div></div>
        <div><div class="eyebrow">Streak</div><div class="big-num">${progress.streak || 0}</div></div>
        <div><div class="eyebrow">Best streak</div><div class="big-num">${progress.best || 0}</div></div>
        <div><div class="eyebrow">To retry</div><div class="big-num">${due}</div></div>
      </div>
      <div class="filters">
        ${chip('all', 'All')}${chip('bank', `${esc(def.bankLabel)} <span class="muted">${all.filter((i) => i.source === 'bank').length}</span>`)}${chip('lessons', `Lessons <span class="muted">${all.filter((i) => i.source === 'lessons').length}</span>`)}
        <label class="sr-only" for="pz-theme">Theme</label>
        <select id="pz-theme" class="select"><option value="">All themes</option>${themesHere.map((t) => `<option value="${t}" ${t === theme ? 'selected' : ''}>${esc(themes[t].name)}</option>`).join('')}</select>
      </div>
      ${items.length ? '<div id="pz-host"></div>' : `<div class="card"><p style="margin:0">No puzzles match these filters.</p></div>`}
      <section class="card" style="margin-top:14px">
        <h2 style="font-size:18px">Themes</h2>
        <div class="theme-list">${themesHere.map((t) => {
          const list = all.filter((i) => i.theme === t);
          const n = list.filter((i) => progress.items[i.id] && progress.items[i.id].solved).length;
          return `<a class="theme-row ${t === theme ? 'on' : ''}" href="${link({ t: t === theme ? '' : t })}">
            <span><b>${esc(themes[t].name)}</b><small class="muted">${esc(themes[t].blurb)}</small></span>
            <span class="mono muted" style="font-size:12px">${n}/${list.length}</span>
            <span class="bar"><i style="width:${list.length ? Math.round((100 * n) / list.length) : 0}%"></i></span></a>`;
        }).join('')}</div>
      </section>`;
    $('#pz-theme')?.addEventListener('change', (e) => { location.hash = link({ t: e.target.value }); });
    if (!items.length) return;
    let current = null;
    const load = (avoid = null) => {
      const prog = store.get(K('puzzles'), { count: 0, items: {} });
      const item = pickNext(items, prog, Math.random, avoid);
      current = item;
      const look = def.puzzleLook ? def.puzzleLook(item, prog) : null;
      store.set(K('puzzles'), prog);
      const step = look ? look.step : item.step;
      let recorded = false;
      renderPuzzleInto($('#pz-host'), step, {
        actions: `<p class="muted" style="margin:0;font-size:13px">${esc(item.origin)}${look && look.note ? ` · ${esc(look.note)}` : ''}</p>
          <button class="btn primary" type="button" id="pz-next">Next puzzle ${ICON.arrow}</button>`,
        onFailed: () => { if (!recorded) { recorded = true; const p = store.get(K('puzzles'), { count: 0, items: {} }); store.set(K('puzzles'), recordPuzzle(p, item.id, false)); } },
        onSolved: () => { if (!recorded) { recorded = true; const p = store.get(K('puzzles'), { count: 0, items: {} }); store.set(K('puzzles'), recordPuzzle(p, item.id, true)); } },
      });
      $('#pz-next').addEventListener('click', () => load(current.id));
    };
    load();
  }

  // =========================================================================
  // Game records (archive) and review

  function renderArchive(params) {
    const show = Number(params.get('n')) || 100;
    const res = params.get('r') || '';
    const lv = Number(params.get('lv')) || 0;
    const all = records.games();
    const list = all.filter((e) => (!res || (res === 'loss' ? e.result === 'loss' || e.result === 'resigned' : e.result === res)) && (!lv || e.level === lv));
    const vars = new Map();
    for (const e of records.all()) if (e.parent) vars.set(e.parent, (vars.get(e.parent) || 0) + 1);
    const link = (o) => { const q = new URLSearchParams(); const v = { r: res, lv: lv || '', ...o }; if (v.r) q.set('r', v.r); if (v.lv) q.set('lv', v.lv); if (v.n) q.set('n', v.n); return `${base}/review${q.toString() ? '?' + q : ''}`; };
    app().innerHTML = page('Game records', 'Your games', `Every ${esc(def.name)} game you play is saved here (the newest ${ACCESS_LIMIT} can be opened). Open one to replay it with the engine's analysis. Retries from the middle of a game are kept as variations of that game.`) + `
      <div class="filters">
        ${[['', 'All'], ['win', 'Wins'], ['loss', 'Losses'], ['draw', 'Draws'], ['unfinished', 'Unfinished']].map(([k, l]) => `<a class="chip ${res === k ? 'on' : ''}" href="${link({ r: k })}">${l}</a>`).join('')}
        <label class="sr-only" for="ar-level">Opponent</label>
        <select id="ar-level" class="select"><option value="">All opponents</option>${[1, 2, 3, 4, 5].map((l) => `<option value="${l}" ${l === lv ? 'selected' : ''}>${BOTS[l].name}</option>`).join('')}</select>
      </div>
      ${list.length ? `<div class="game-list">${list.slice(0, show).map((e) => `
        <a class="game-row" href="${base}/review/${encodeURIComponent(e.id)}">
          <span class="stone p${e.you}" style="width:22px;height:22px" aria-hidden="true"></span>
          <span style="flex:1;min-width:0"><b>${esc(RESULT_LABEL[e.result] || e.result)}</b> vs ${esc(BOTS[e.level].name)}${e.score ? ` · <span class="mono">${esc(e.score)}</span>` : ''}
            <small class="muted">${esc(fmtDate(e.at))} · ${e.moves.length} moves${optionsText(e.options) ? ' · ' + esc(optionsText(e.options)) : ''}${e.lesson ? ` · Lesson ${esc(e.lesson.id)}` : ''}${vars.get(e.id) ? ` · ${vars.get(e.id)} variation${vars.get(e.id) === 1 ? '' : 's'}` : ''}</small></span>
          ${ICON.arrow}</a>`).join('')}</div>
        ${list.length > show ? `<a class="btn" style="margin-top:12px" href="${link({ n: show + 100 })}">Show more games</a>` : ''}`
        : `<div class="card stack" style="max-width:640px"><p style="margin:0">No games here yet.</p><a class="btn primary" href="${base}/play">Play a game ${ICON.arrow}</a></div>`}
      ${records.retiredCount() ? `<p class="muted" style="font-size:13px">${records.retiredCount()} older games are kept in your statistics but can no longer be opened.</p>` : ''}`;
    $('#ar-level').addEventListener('change', (e) => { location.hash = link({ lv: e.target.value }); });
  }

  let rv = null;
  function leaveReview() { if (rv) { document.removeEventListener('keydown', rv.onKey); rv.token++; rv = null; } }

  function buildReview(entry, plies) {
    const opts = entry.options || {};
    const s = E.newState(opts);
    const moves = [];
    const counts = {};
    let lossSum = 0, lossN = 0, theirSum = 0, theirN = 0;
    const tags = {};
    const curve = [0.5];
    let chance = 0.5;
    for (let i = 0; i < entry.moves.length; i++) {
      const m = entry.moves[i];
      const a = plies[i];
      const mover = E.toMove(s);
      const isYou = mover === entry.you;
      const forced = !a || a.forced || a.bestChance === null;
      const cls = forced ? null : classify(a, m);
      const rank = cls ? CLASSES[cls].rank : 0;
      const why = forced ? { text: def.forcedText ? def.forcedText(m, isYou ? 'You' : BOTS[entry.level].name) : 'Forced.', tags: [] } : E.explain(s, m, a, rank, isYou ? BOTS[entry.level].name : 'you', opts);
      if (cls) {
        counts[cls] = (counts[cls] || 0) + (isYou ? 1 : 0);
        const loss = Math.max(0, a.bestChance - a.playedChance);
        if (isYou) { lossSum += Math.max(0, 1 - loss * 4); lossN++; if (rank >= 3) for (const t of why.tags) tags[t] = (tags[t] || 0) + 1; }
        else { theirSum += Math.max(0, 1 - loss * 4); theirN++; }
        chance = isYou ? a.playedChance : 1 - a.playedChance;
      }
      curve.push(chance);
      moves.push({ ply: i, move: m, isYou, cls, text: why.text, best: a && a.best !== undefined ? a.best : null, loss: cls ? Math.max(0, a.bestChance - a.playedChance) : 0, exact: a && a.exact, playedScore: a ? a.playedScore : null });
      E.play(s, m);
    }
    const key = moves.filter((m) => m.isYou && m.cls && CLASSES[m.cls].rank >= 3).sort((a, b) => b.loss - a.loss).slice(0, 5);
    return { moves, counts, accuracy: lossN ? Math.round((100 * lossSum) / lossN) : null, theirAccuracy: theirN ? Math.round((100 * theirSum) / theirN) : null, key, tags, curve };
  }

  function renderReview(id, params) {
    const entry = records.find(id);
    if (!entry) { app().innerHTML = `<div class="card stack" style="max-width:640px"><p style="margin:0">That game isn't available.</p><a class="btn" href="${base}/review">Back to your games</a></div>`; return; }
    const opts = entry.options || {};
    const bot = BOTS[entry.level];
    const origin = entry.parent || entry.id;
    const variations = records.variationsOf(origin);
    rv = { entry, review: null, cursor: params.has('at') ? Math.min(entry.moves.length, Number(params.get('at')) || 0) : entry.moves.length, showBest: true, token: 1, onKey: null };
    app().innerHTML = `
      <div class="game-head" style="margin-bottom:12px">
        <a class="icon-btn" href="${base}/review" aria-label="Back to your games">${ICON.back}</a>
        <div class="title">
          <h1>${esc(def.name)} vs ${esc(bot.name)}</h1>
          <div class="eyebrow">${esc(fmtDate(entry.at))} · ${entry.score && entry.result !== 'resigned' ? esc(entry.score) : esc(RESULT_LABEL[entry.result] || entry.result)} · you played ${COLOUR[entry.you]}${optionsText(opts) ? ' · ' + esc(optionsText(opts)) : ''}</div>
        </div>
      </div>
      ${entry.lesson ? `<section class="card lesson-panel" style="margin-bottom:12px"><b>Lesson ${esc(entry.lesson.id)} practice game.</b>
        <div class="result-actions" style="margin-top:8px">${(() => { const nl = nextLesson(entry.lesson.id); return nl ? `<a class="btn primary" href="${base}/learn/${esc(nl.id)}">Next lesson</a>` : ''; })()}
        <a class="btn" href="${base}/learn/${esc(entry.lesson.id)}?s=${entry.lesson.step}">Back to the lesson</a></div></section>` : ''}
      ${entry.parent ? `<p class="muted" style="margin:0 0 12px">A variation of <a href="${base}/review/${encodeURIComponent(entry.parent)}">your earlier game</a>, replayed from move ${entry.fromPly + 1}.</p>` : ''}
      ${!entry.parent && variations.length ? `<details class="card variations" style="margin-bottom:12px;padding:12px 16px"><summary style="cursor:pointer"><b>Variations of this game</b> (${variations.length})</summary>
        <div class="game-list" style="margin-top:8px">${variations.map((v) => `<a class="game-row" href="${base}/review/${encodeURIComponent(v.id)}"><span style="flex:1">${esc(RESULT_LABEL[v.result])} · from move ${v.fromPly + 1}<small class="muted">${esc(fmtDate(v.at))}</small></span>${ICON.arrow}</a>`).join('')}</div></details>` : ''}
      <div class="game">
        <div class="stack" style="gap:12px">
          <div class="board-wrap ${def.id}-wrap" id="board"></div>
          <div class="rv-nav">
            <button class="icon-btn" type="button" data-nav-move="first" aria-label="First move">⏮</button>
            <button class="icon-btn" type="button" data-nav-move="prev" aria-label="Previous move">◀</button>
            <span class="mono" id="rv-counter"></span>
            <button class="icon-btn" type="button" data-nav-move="next" aria-label="Next move">▶</button>
            <button class="icon-btn" type="button" data-nav-move="last" aria-label="Last move">⏭</button>
          </div>
          <div class="rv-moves" id="rv-moves" aria-label="Moves"></div>
        </div>
        <div class="side">
          <section class="card" id="rv-move" aria-live="polite"></section>
          <section class="card" id="rv-summary"></section>
          <section class="card" id="rv-graph" hidden></section>
          <section class="card" id="rv-key" hidden></section>
        </div>
      </div>`;
    view = def.board.create($('#board'), { onCell: () => {} }, opts);
    const ro = new ResizeObserver(() => view && view.setLabels(view.svg.getBoundingClientRect().width >= 380));
    ro.observe($('#board'));
    app().querySelectorAll('[data-nav-move]').forEach((b) => b.addEventListener('click', () => rvStep(b.dataset.navMove)));
    rv.onKey = (e) => {
      if (e.target.closest('input, select, textarea')) return;
      if (e.key === 'ArrowLeft') { rvStep('prev'); e.preventDefault(); } else if (e.key === 'ArrowRight') { rvStep('next'); e.preventDefault(); }
    };
    document.addEventListener('keydown', rv.onKey);
    const cache = store.get(K('analysis'), {});
    if (cache[id] && cache[id].plies && cache[id].plies.length === entry.moves.length) {
      rv.review = buildReview(entry, cache[id].plies);
      rvUpdate(true);
    } else {
      rvUpdate(true);
      rvAnalyse();
    }
  }

  async function rvAnalyse() {
    const r = rv, t = r.token;
    const { entry } = r;
    $('#rv-summary').innerHTML = `<div class="eyebrow">Analysing</div><p style="margin:6px 0 0">The engine is checking every move…</p>${bar(0).replace('id', '')}<div id="rv-progress"></div>`;
    try {
      const plies = await ask('analyseGame', { moves: entry.moves, options: entry.options || {} }, (p) => {
        if (rv === r && r.token === t) $('#rv-progress').innerHTML = bar(Math.round(p * 100));
      });
      if (rv !== r || r.token !== t) return;
      const cache = store.get(K('analysis'), {});
      cache[entry.id] = { at: Date.now(), plies };
      const ids = Object.keys(cache).sort((a, b) => cache[b].at - cache[a].at);
      for (const old of ids.slice(60)) delete cache[old];
      store.set(K('analysis'), cache);
      r.review = buildReview(entry, plies);
      rvUpdate(true);
    } catch (err) {
      console.error(err);
      $('#rv-summary').innerHTML = '<p style="margin:0">The analysis could not run. Reload the page to try again.</p>';
    }
  }

  function rvStep(where) {
    const r = rv;
    const n = r.entry.moves.length;
    if (where === 'first') r.cursor = 0; else if (where === 'last') r.cursor = n;
    else if (where === 'prev') r.cursor = Math.max(0, r.cursor - 1); else if (where === 'next') r.cursor = Math.min(n, r.cursor + 1);
    else r.cursor = Math.max(0, Math.min(n, Number(where)));
    rvUpdate();
  }

  function rvUpdate(full = false) {
    const r = rv;
    if (!r || !view) return;
    const { entry, review } = r;
    const opts = entry.options || {};
    const k = r.cursor, n = entry.moves.length;
    const state = E.replay(entry.moves.slice(0, k), opts);
    const m = k > 0 ? (review ? review.moves[k - 1] : { ply: k - 1, move: entry.moves[k - 1], isYou: null }) : null;
    const showBest = m && m.cls && m.cls !== 'best' && r.showBest && m.best !== null && m.best >= 0;
    view.render(state, { last: m ? m.move : null, rings: m && m.cls && m.move >= 0 ? [{ cell: m.move, color: CLASSES[m.cls].color }] : [], hints: showBest ? [m.best] : [] });
    $('#rv-counter').textContent = `${k} / ${n}`;
    const who = (mv) => (mv.isYou ? 'You' : BOTS[entry.level].name);
    let card;
    if (!m) card = '<h2 style="font-size:20px">Start of the game</h2><p class="muted" style="margin:6px 0 0;font-size:14px">Step through with the arrows or tap a move below.</p>';
    else card = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <h2 style="font-size:20px">${m.ply + 1}. ${review ? esc(who(m)) : ''}: <span class="mono">${esc(E.moveName(m.move, opts))}</span></h2>${clsBadge(m.cls)}
      </div>
      ${review ? `<p style="margin:8px 0 0;font-size:14px">${esc(m.text)}</p>` : '<p class="muted" style="margin:8px 0 0;font-size:14px">Ratings appear when the analysis finishes.</p>'}
      ${m.cls && m.cls !== 'best' && m.best !== null && m.best >= 0 ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
        <button class="btn" type="button" id="rv-best">${r.showBest ? 'Hide' : 'Show'} best move (<span class="mono">${esc(E.moveName(m.best, opts))}</span>)</button>
        ${m.isYou && CLASSES[m.cls].rank >= 3 ? '<button class="btn primary" type="button" id="rv-retry">Retry from here</button>' : ''}
      </div>` : ''}`;
    $('#rv-move').innerHTML = card;
    $('#rv-best')?.addEventListener('click', () => { r.showBest = !r.showBest; rvUpdate(); });
    $('#rv-retry')?.addEventListener('click', () => {
      startGame({ level: entry.level, side: entry.you === 1 ? 'p1' : 'p2', coachMode: 'quiet', options: opts }, entry.moves.slice(0, m.ply), { parent: entry.parent || entry.id, lesson: entry.lesson ? { ...entry.lesson, goal: 'variation' } : null });
    });
    const strip = $('#rv-moves');
    if (full || !strip.children.length) {
      const t = E.newState(opts);
      const movers = entry.moves.map((mv) => { const p = E.toMove(t); E.play(t, mv); return p; });
      strip.innerHTML = entry.moves.map((mv, i) => {
        const rm = review ? review.moves[i] : null;
        const dot = rm && rm.cls ? `<i style="background:${CLASSES[rm.cls].color}"></i>` : '';
        const gold = movers[i] === 1;
        return `<button type="button" class="mv ${gold ? 'g' : 'b'}" data-ply="${i + 1}">${i % 2 === 0 ? `<span class="n">${i / 2 + 1}.</span>` : ''}${dot}${esc(E.moveName(mv, opts))}</button>`;
      }).join('');
      strip.querySelectorAll('[data-ply]').forEach((b) => b.addEventListener('click', () => rvStep(b.dataset.ply)));
    }
    strip.querySelectorAll('.mv').forEach((b) => b.classList.toggle('on', Number(b.dataset.ply) === k));
    const on = strip.querySelector('.mv.on');
    if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    if (!review || !full) return;
    const order = CLASS_ORDER.filter((c) => review.counts[c]);
    $('#rv-summary').innerHTML = `
      <div style="display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap">
        <div><div class="eyebrow">Your accuracy</div><div class="big-num">${review.accuracy ?? '—'}</div></div>
        <div><div class="eyebrow">${esc(BOTS[entry.level].name)}</div><div class="big-num muted" style="font-size:24px">${review.theirAccuracy ?? '—'}</div></div>
      </div>
      <div class="cls-counts">${order.map((c) => `<span>${clsBadge(c)} <b class="mono">${review.counts[c]}</b></span>`).join('')}</div>
      ${Object.keys(review.tags).length ? `<p class="muted" style="margin:10px 0 0;font-size:14px">To work on: ${Object.entries(review.tags).sort((a, b) => b[1] - a[1]).map(([t]) => esc(t)).join(', ')}.</p>` : ''}`;
    // Winning chances graph
    const W = 320, H = 110;
    const pts = review.curve.map((c, i) => `${((i / Math.max(1, review.curve.length - 1)) * W).toFixed(1)},${(H - c * H).toFixed(1)}`).join(' ');
    $('#rv-graph').hidden = false;
    $('#rv-graph').innerHTML = `<h2 style="font-size:18px">Your winning chances</h2>
      <svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;margin-top:8px" role="img" aria-label="Your winning chances over the game">
        <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" stroke="var(--border)" stroke-dasharray="3 3"/>
        <polyline points="${pts}" fill="none" stroke="var(--accent)" stroke-width="2"/>
      </svg><p class="muted" style="margin:4px 0 0;font-size:12px">Above the dashed line you were better; below it, ${esc(BOTS[entry.level].name)} was.</p>`;
    $('#rv-key').hidden = false;
    $('#rv-key').innerHTML = `<h2 style="font-size:18px">Key moments</h2>${review.key.length ? `<div class="game-list" style="margin-top:8px">${review.key.map((km) => `
      <button type="button" class="game-row" data-jump="${km.ply + 1}" style="text-align:left;width:100%">
        <span style="flex:1"><b class="mono">${km.ply + 1}. ${esc(E.moveName(km.move, opts))}</b> ${clsBadge(km.cls)}<small class="muted">${esc(km.text)}</small></span></button>`).join('')}</div>`
      : '<p class="muted" style="margin:6px 0 0;font-size:14px">No big mistakes. Well played.</p>'}`;
    $('#rv-key').querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => rvStep(b.dataset.jump)));
  }

  // =========================================================================
  // Statistics

  function statTable(rows) {
    if (!rows.length) return '<p class="muted" style="margin:6px 0 0;font-size:14px">No finished games yet.</p>';
    return `<div class="stat-rows">${rows.map((r) => `<div class="stat-row">
      <div style="display:flex;justify-content:space-between;gap:10px"><span>${esc(r.label)}</span>
      <span class="mono" style="font-size:13px">${r.wins}–${r.losses}${r.draws ? '–' + r.draws : ''} · <b>${r.winPct}%</b></span></div>${bar(r.winPct)}</div>`).join('')}</div>`;
  }

  function renderStats() {
    const entries = records.forStats();
    const st = computeStats(entries);
    const head = page('Your record', 'Statistics', `Built from every ${esc(def.name)} game you finish. Unfinished games aren't counted${st.unfinished ? ` (${st.unfinished} so far)` : ''}. <a href="${base}/review">Browse all games →</a>`);
    if (!st.played) {
      app().innerHTML = head + `<div class="card stack" style="max-width:640px"><p style="margin:0">No finished games yet. Your win rate, streaks and habits will appear here after your first game.</p><a class="btn primary" href="${base}/play">Play a game ${ICON.arrow}</a></div>`;
      return;
    }
    const streak = st.streak.current ? `${st.streak.current} ${st.streak.kind === 'win' ? (st.streak.current > 1 ? 'wins' : 'win') : st.streak.kind === 'loss' ? (st.streak.current > 1 ? 'losses' : 'loss') : 'draws'}` : '—';
    app().innerHTML = head + `
      <div class="stat-grid">
        <div class="card stat"><div class="eyebrow">Win rate</div><div class="big">${st.winPct}%</div><div class="muted">${st.wins} won · ${st.losses} lost${st.draws ? ` · ${st.draws} drawn` : ''}</div></div>
        <div class="card stat"><div class="eyebrow">Games</div><div class="big">${st.played}</div><div class="muted">finished</div></div>
        <div class="card stat"><div class="eyebrow">Current streak</div><div class="big" style="font-size:24px">${esc(streak)}</div><div class="muted">Best win streak: ${st.streak.bestWin}</div></div>
        <div class="card stat"><div class="eyebrow">Game length</div><div class="big">${st.avgLength ?? '—'}</div><div class="muted">moves per game</div></div>
      </div>
      <section class="card" style="margin-top:14px">
        <h2 style="font-size:20px">Last ${st.recent.length} games</h2>
        <div class="form">${st.recent.map((r) => `<span class="form-dot ${r}" title="${r === 'W' ? 'Win' : r === 'L' ? 'Loss' : 'Draw'}">${r}</span>`).join('')}</div>
        <p class="muted" style="margin:6px 0 0;font-size:13px">Newest first.</p>
      </section>
      <div class="home-grid" style="margin-top:14px">
        <section class="card"><h2 style="font-size:20px">By opponent</h2>${statTable(st.byLevel)}</section>
        <section class="card"><h2 style="font-size:20px">By colour</h2>${statTable(st.bySide)}${def.sideStatNote ? `<p class="muted" style="margin:10px 0 0;font-size:13px">${esc(def.sideStatNote)}</p>` : ''}</section>
        ${def.statsExtras ? def.statsExtras(entries.filter((e) => e.moves && e.result !== 'unfinished'), { esc, bar, statTable, computeStats }) : ''}
      </div>`;
  }

  // =========================================================================
  // Routing inside the section

  function render(sub, params) {
    if (sub === '' || sub === '/') return renderHome();
    if (sub === '/play') return renderSetup();
    if (sub === '/game') return renderGame();
    if (sub === '/rules') return renderRules();
    if (sub === '/learn') return renderLearn();
    if (sub.startsWith('/learn/')) return renderLesson(decodeURIComponent(sub.slice(7)), params);
    if (sub === '/puzzles') return renderPuzzles(params);
    if (sub === '/review') return renderArchive(params);
    if (sub.startsWith('/review/')) return renderReview(decodeURIComponent(sub.slice(8)), params);
    if (sub === '/stats') return renderStats();
    return renderHome();
  }
  function leave() {
    token++;
    game = null;
    view = null;
    puzzleRun = null;
    leaveReview();
  }
  /** Which nav item to highlight for a sub-path. */
  function navKey(sub) {
    if (sub === '/game') return (store.get(K('current'), {}) || {}).lesson ? 'learn' : 'play';
    if (sub === '/play') return 'play';
    if (sub.startsWith('/learn')) return 'learn';
    if (sub === '/puzzles') return 'puzzles';
    if (sub.startsWith('/review')) return 'review';
    if (sub === '/stats') return 'stats';
    if (sub === '/rules') return 'variants';
    return 'home';
  }
  return { render, leave, navKey, records, getLesson, LESSONS, puzzleItems };
}
