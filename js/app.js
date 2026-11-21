// Game Training Sim.pente — app shell, screens and game flow.
import {
  P1, P2, applyMove, undoMove, illegalReason, toSnapshot, replay, coordName, other, newGame,
} from './rules.js';
import { VARIANTS, COMING_LATER, getVariant, resolveVariant } from './variants.js';
import { LEVELS, LEVEL_IDS } from './ai.js';
import { computeStats } from './stats.js';
import { buildReview, CLASSES, CLASS_ORDER, FOCUS_TIPS } from './review.js';
import { analyse, previewWarning } from './coach.js';
import { BoardView } from './board.js';

// ---------------------------------------------------------------------------
// Small helpers

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage full or blocked */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};
const KEYS = { theme: 'gts.theme', game: 'gts.currentGame', history: 'gts.history', setup: 'gts.lastSetup', analysis: 'gts.analysis' };

const ICON = {
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  hint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 21V5"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l5-6 4 3 6-8 3 4"/><path d="M3 21h18"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
};

let toastTimer = null;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2600);
}

// ---------------------------------------------------------------------------
// Theme

function currentTheme() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
function setTheme(t) {
  document.documentElement.dataset.theme = t;
  store.set(KEYS.theme, t);
  const b = $('#theme-toggle');
  b.innerHTML = t === 'dark' ? ICON.sun : ICON.moon;
  b.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  $('meta[name="theme-color"]').setAttribute('content', t === 'dark' ? '#0D1230' : '#2F44B0');
}
$('#theme-toggle').addEventListener('click', () => setTheme(currentTheme() === 'dark' ? 'light' : 'dark'));
setTheme(currentTheme());

// ---------------------------------------------------------------------------
// The bot runs in a Web Worker; if workers aren't available, it runs inline.

let worker = null;
let reqSeq = 0;
const pending = new Map();
try {
  worker = new Worker(new URL('./ai-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    if (e.data.progress !== undefined) { if (p.onProgress) p.onProgress(e.data.progress); return; }
    pending.delete(e.data.id);
    if (e.data.error) p.reject(new Error(e.data.error));
    else p.resolve(e.data.analysis !== undefined ? e.data.analysis : e.data.move);
  };
  worker.onerror = () => { worker = null; for (const p of pending.values()) p.reject(new Error('worker failed')); pending.clear(); };
} catch { worker = null; }

function askAnalysis(entry, onProgress) {
  return new Promise((resolve, reject) => {
    if (!worker) {
      // Inline fallback (no worker available): analyse on the main thread in small steps.
      import('./ai.js').then(async ({ analysePosition }) => {
        const s = newGame(resolveVariant(entry.variantId, entry.options || {}));
        const out = [];
        for (let i = 0; i <= entry.moves.length; i++) {
          const played = i < entry.moves.length ? entry.moves[i] : null;
          out.push(analysePosition(s, played, { timeMs: 200 }));
          onProgress((i + 1) / (entry.moves.length + 1));
          if (played) applyMove(s, played[0], played[1]);
          await new Promise((r) => setTimeout(r, 0));
        }
        resolve(out);
      }).catch(reject);
      return;
    }
    const id = ++reqSeq;
    pending.set(id, { resolve, reject, onProgress });
    worker.postMessage({ id, type: 'analyse', variantId: entry.variantId, options: entry.options || {}, moves: entry.moves });
  });
}

async function askBot(state, level) {
  const snapshot = toSnapshot(state);
  if (worker) {
    try {
      return await new Promise((resolve, reject) => {
        const id = ++reqSeq;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, snapshot, level });
      });
    } catch { /* fall through to inline */ }
  }
  const { chooseMove } = await import('./ai.js');
  await new Promise((r) => setTimeout(r, 30));
  return chooseMove(state, level);
}

// ---------------------------------------------------------------------------
// Routing

const routes = {
  '': renderHome, '/': renderHome, '/setup': renderSetup, '/play': renderGame,
  '/variants': renderVariants, '/stats': renderStats, '/learn': () => renderSoon('learn'), '/review': renderArchive, '/puzzles': () => renderSoon('puzzles'),
};
function parseHash() {
  const h = location.hash.replace(/^#/, '');
  const [path, query = ''] = h.split('?');
  return { path, params: new URLSearchParams(query) };
}
function route() {
  const { path, params } = parseHash();
  const reviewId = path.startsWith('/review/') ? decodeURIComponent(path.slice(8)) : null;
  const fn = reviewId ? () => renderReview(reviewId) : routes[path] || renderHome;
  document.body.classList.toggle('in-game', path === '/play');
  const navKey = { '': 'home', '/': 'home', '/setup': 'play', '/play': 'play', '/variants': 'variants', '/learn': 'learn', '/review': 'review', '/puzzles': 'home', '/stats': 'stats' }[path] || (reviewId ? 'review' : 'home');
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (path !== '/play') leaveGame();
  leaveReview();
  fn(params);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);

// ---------------------------------------------------------------------------
// Home

function renderHome() {
  const saved = store.get(KEYS.game, null);
  const history = store.get(KEYS.history, []);
  const resume = saved ? (() => {
    const v = getVariant(saved.variantId);
    const bot = LEVELS[saved.level];
    return `
      <section class="card stack">
        <div class="eyebrow" style="color:var(--aqua)">Game in progress</div>
        <div><h2 style="font-size:23px">${esc(v.name)} vs ${esc(bot.name)}</h2>
          <p class="muted" style="margin:4px 0 0">${esc(bot.title)} · move ${saved.moves.length + 1}</p></div>
        <a class="btn primary block" href="#/play">Resume game ${ICON.arrow}</a>
      </section>`;
  })() : `
      <section class="card stack">
        <div class="eyebrow" style="color:var(--aqua)">Quick start</div>
        <div><h2 style="font-size:23px">Play a practice game</h2>
          <p class="muted" style="margin:4px 0 0">Pick a variant and a bot. The coach points out threats and chances as you play.</p></div>
        <a class="btn primary block" href="#/setup">Set up a game ${ICON.arrow}</a>
      </section>`;

  const historyHtml = history.length ? `
      <section class="card">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:6px">
          <h3 style="font-size:18px">Recent games</h3>
          <a href="#/stats" style="font-size:14px;font-weight:600">${(() => { const t = computeStats(history).total; return t.winPct === null ? 'Stats' : `${t.winPct}% wins · Stats`; })()} →</a>
        </div>
        <ul class="history">
          ${history.slice(0, 6).map((h) => `<li><span>${h.id && Array.isArray(h.moves) ? `<a href="#/review/${encodeURIComponent(h.id)}">${esc(h.variantName)}</a>` : esc(h.variantName)} <span class="muted">vs ${esc(h.botName)} (L${h.level})</span></span>
            <span class="${h.result === 'win' ? 'result-win' : h.result === 'loss' ? 'result-loss' : 'muted'}">${{ win: 'Won', loss: 'Lost', resigned: 'Resigned', unfinished: 'Unfinished', draw: 'Draw' }[h.result] || 'Draw'}</span></li>`).join('')}
        </ul>
      </section>` : '';

  // Focus areas: what went wrong most often across your last 10 reviewed games.
  const analysed = Object.values(store.get(KEYS.analysis, {})).sort((a, b) => (b.at || 0) - (a.at || 0)).slice(0, 10);
  const focusTotals = {};
  for (const a of analysed) for (const [tag, n] of a.focus || []) focusTotals[tag] = (focusTotals[tag] || 0) + n;
  const topFocus = Object.entries(focusTotals).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const focusHtml = `
      <section class="card">
        <h3 style="font-size:18px">Focus areas</h3>
        ${topFocus.length ? topFocus.map(([tag, n]) => `
          <div style="margin-top:10px"><b>${esc(tag)}</b> <span class="muted" style="font-size:13px">· ${n} move${n > 1 ? 's' : ''} in your last ${analysed.length} reviewed game${analysed.length > 1 ? 's' : ''}</span>
          <p style="margin:2px 0 0;font-size:14px">${esc(FOCUS_TIPS[tag] || '')}</p></div>`).join('')
        : `<p class="muted" style="margin:6px 0 0;font-size:14px">${analysed.length ? 'No recurring problems in your reviewed games. Keep it up, or try a stronger bot.' : 'Review a game and this panel will show what to work on, such as defending pairs or blocking open threes.'}</p>`}
        <a href="#/review" style="display:inline-block;margin-top:10px;font-size:14px;font-weight:600">Review your games →</a>
      </section>`;

  app.innerHTML = `
    <div class="key-strip" aria-hidden="true" style="margin:0 0 16px"></div>
    <div style="margin-bottom:14px">
      <div class="eyebrow">Welcome</div>
      <h1 style="font-size:30px;margin-top:4px">Ready to train?</h1>
    </div>
    <div class="home-grid">
      <div class="stack">
        ${resume}
        <div class="tiles">
          <a class="tile" href="#/setup"><span class="brand-stones" aria-hidden="true" style="width:30px;height:18px"><span class="p1" style="width:18px;height:18px"></span><span class="p2" style="width:18px;height:18px;left:12px"></span></span>
            <span><strong>Play a bot</strong><small>${LEVEL_IDS.length} levels · ${VARIANTS.length} variants</small></span></a>
          <a class="tile" href="#/variants">${ICON.grid}<span><strong>Variants</strong><small>Rules and what each trains</small></span></a>
          <a class="tile soon" href="#/learn">${ICON.book}<span><strong>Lessons</strong><small><span class="badge">SOON</span></small></span></a>
          <a class="tile" href="#/review">${ICON.chart}<span><strong>Review</strong><small>Replay and analyse past games</small></span></a>
        </div>
      </div>
      <div class="stack">${focusHtml}${historyHtml}
        <section class="card">
          <h3 style="font-size:18px">New to Pente?</h3>
          <p style="margin:6px 0 0;font-size:14px">Make five in a row, or capture five pairs by bracketing them. Start with <b>Pip</b> (Level 1) and keep the coach on. The full rules are under <a href="#/variants">Variants</a>.</p>
        </section>
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Statistics

function bar(pct) {
  return `<div style="height:6px;border-radius:3px;background:var(--track);margin-top:4px"><div style="width:${pct || 0}%;height:6px;border-radius:3px;background:var(--accent)"></div></div>`;
}
function statTable(rows) {
  if (!rows.length) return '<p class="muted" style="margin:6px 0 0;font-size:14px">No finished games yet.</p>';
  return `<div class="stat-rows">${rows.map((r) => `
    <div class="stat-row">
      <div style="display:flex;justify-content:space-between;gap:10px"><span>${esc(r.label)}</span>
        <span class="mono" style="font-size:13px">${r.wins}–${r.losses}${r.draws ? '–' + r.draws : ''} · <b>${r.winPct}%</b></span></div>
      ${bar(r.winPct)}
    </div>`).join('')}</div>`;
}

function renderStats() {
  const st = computeStats(store.get(KEYS.history, []));
  const t = st.total;
  const head = `
    <div style="margin-bottom:14px">
      <div class="eyebrow">Your record</div>
      <h1 style="font-size:28px;margin-top:4px">Statistics</h1>
      <p class="muted" style="margin:6px 0 0">Built from every game you finish. Unfinished games aren't counted${st.unfinished ? ` (${st.unfinished} so far)` : ''}. <a href="#/review">Browse all games →</a></p>
    </div>`;
  if (!t.played) {
    app.innerHTML = head + `<div class="card stack" style="max-width:640px"><p style="margin:0">No finished games yet. Your win rate, streaks and breakdowns will appear here after your first game.</p>
      <a class="btn primary" href="#/setup">Play a game ${ICON.arrow}</a></div>`;
    return;
  }
  const streak = st.streak.current
    ? `${st.streak.current} ${st.streak.kind === 'win' ? (st.streak.current > 1 ? 'wins' : 'win') : st.streak.kind === 'loss' ? (st.streak.current > 1 ? 'losses' : 'loss') : 'draws'}`
    : '—';
  const ends = (list) => (list.length ? `<ul class="rules" style="margin-top:6px">${list.map(([k, n]) => `<li>${esc(k)}: <b>${n}</b></li>`).join('')}</ul>` : '<p class="muted" style="margin:6px 0 0;font-size:14px">None yet.</p>');
  app.innerHTML = head + `
    <div class="stat-grid">
      <div class="card stat"><div class="eyebrow">Win rate</div><div class="big">${t.winPct}%</div><div class="muted">${t.wins} won · ${t.losses} lost${t.draws ? ` · ${t.draws} drawn` : ''}</div></div>
      <div class="card stat"><div class="eyebrow">Games</div><div class="big">${t.played}</div><div class="muted">finished</div></div>
      <div class="card stat"><div class="eyebrow">Current streak</div><div class="big" style="font-size:24px">${esc(streak)}</div><div class="muted">Best win streak: ${st.streak.bestWin}</div></div>
      <div class="card stat"><div class="eyebrow">Game length</div><div class="big">${st.length.avgMoves ?? '—'}</div><div class="muted">your moves per game${st.length.fastestWin ? ` · fastest win ${st.length.fastestWin}` : ''}</div></div>
    </div>
    <section class="card" style="margin-top:14px">
      <h2 style="font-size:20px">Last ${st.recent.length} games</h2>
      <div class="form" aria-label="Recent results, newest first">${st.recent.map((r) => `<span class="form-dot ${r}" title="${r === 'W' ? 'Win' : r === 'L' ? 'Loss' : 'Draw'}">${r}</span>`).join('')}</div>
      <p class="muted" style="margin:6px 0 0;font-size:13px">Newest first.</p>
    </section>
    <div class="home-grid" style="margin-top:14px">
      <section class="card"><h2 style="font-size:20px">By opponent</h2>${statTable(st.byLevel)}</section>
      <section class="card"><h2 style="font-size:20px">By variant</h2>${statTable(st.byVariant)}</section>
      <section class="card"><h2 style="font-size:20px">By side</h2>${statTable(st.bySide)}
        <p class="muted" style="margin:10px 0 0;font-size:13px">Moving first is a real advantage in Pente, so expect a higher win rate as Gold.</p></section>
      <section class="card"><h2 style="font-size:20px">Captures</h2>
        ${st.captures ? `
        <div class="stat-rows">
          <div class="stat-row" style="display:flex;justify-content:space-between"><span>Pairs you capture per game</span><b class="mono">${st.captures.avgYou}</b></div>
          <div class="stat-row" style="display:flex;justify-content:space-between"><span>Pairs the bots capture per game</span><b class="mono">${st.captures.avgThem}</b></div>
          <div class="stat-row" style="display:flex;justify-content:space-between"><span>Times your stones were captured</span><b class="mono">${st.captures.timesCaptured}</b></div>
        </div>` : '<p class="muted" style="margin:6px 0 0;font-size:14px">Captures are counted for games played from now on.</p>'}
      </section>
      <section class="card"><h2 style="font-size:20px">How you win</h2>${ends(st.winsBy)}</section>
      <section class="card"><h2 style="font-size:20px">How you lose</h2>${ends(st.lossesBy)}
        ${st.undos ? `<p class="muted" style="margin:10px 0 0;font-size:13px">Undos used: ${st.undos}</p>` : ''}</section>
    </div>`;
}

// ---------------------------------------------------------------------------
// Game archive and review

const RESULT_LABEL = { win: 'Won', loss: 'Lost', resigned: 'Resigned', draw: 'Draw', unfinished: 'Unfinished' };
const CLASS_COLOR = {
  best: '#16706A', excellent: '#2F7C77', good: '#5B8E8A', inaccuracy: '#B08900', mistake: '#D9661C', missedWin: '#D9661C', blunder: '#C0392B',
};
const ANALYSIS_VERSION = 1;
const ANALYSIS_LIMIT = 60;

function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
function reviewable(h) { return h && h.id && Array.isArray(h.moves) && h.moves.length > 0; }
function cachedAnalysis(id) {
  const c = store.get(KEYS.analysis, {})[id];
  return c && c.v === ANALYSIS_VERSION ? c : null;
}
function saveAnalysis(id, plies, review) {
  const cache = store.get(KEYS.analysis, {});
  cache[id] = { v: ANALYSIS_VERSION, plies, acc: review.accuracy, focus: review.focus, at: Date.now() };
  const ids = Object.keys(cache).sort((a, b) => (cache[b].at || 0) - (cache[a].at || 0));
  for (const old of ids.slice(ANALYSIS_LIMIT)) delete cache[old];
  store.set(KEYS.analysis, cache);
}
const clsBadge = (cls) => (cls ? `<span class="cls-badge" style="--c:${CLASS_COLOR[cls]}">${esc(CLASSES[cls].label)}</span>` : '');

function renderArchive(params) {
  const all = store.get(KEYS.history, []).filter(reviewable);
  const f = params.get('f') || 'all';
  const vf = params.get('v') || '';
  let list = all.filter((h) => f === 'all' || (f === 'wins' ? h.result === 'win' : f === 'losses' ? (h.result === 'loss' || h.result === 'resigned') : h.result === f));
  if (vf) list = list.filter((h) => h.variantId === vf);
  const variantsUsed = [...new Set(all.map((h) => h.variantId))];
  const link = (nf, nv) => `#/review?f=${nf}${nv ? `&v=${encodeURIComponent(nv)}` : ''}`;
  const chip = (key, label) => `<a class="chip ${f === key ? 'on' : ''}" href="${link(key, vf)}">${label}</a>`;

  app.innerHTML = `
    <div style="margin-bottom:14px">
      <div class="eyebrow">Review</div>
      <h1 style="font-size:28px;margin-top:4px">Your games</h1>
      <p class="muted" style="margin:6px 0 0">Open any game to replay it move by move. The analysis rates each of your moves, explains it, and picks out the moments that decided the game.</p>
    </div>
    ${all.length ? `
    <div class="filters">
      ${chip('all', 'All')}${chip('wins', 'Wins')}${chip('losses', 'Losses')}${chip('unfinished', 'Unfinished')}
      ${variantsUsed.length > 1 ? `<label class="sr-only" for="vf">Variant</label>
      <select id="vf" class="select"><option value="">All variants</option>${variantsUsed.map((v) => `<option value="${esc(v)}" ${v === vf ? 'selected' : ''}>${esc(getVariant(v).name)}</option>`).join('')}</select>` : ''}
    </div>
    <div class="game-list">
      ${list.map((h) => {
        const c = cachedAnalysis(h.id);
        const bot = LEVELS[h.level];
        const res = RESULT_LABEL[h.result] || h.result;
        return `<a class="game-row" href="#/review/${encodeURIComponent(h.id)}">
          <span class="stone ${h.you === P2 ? 'p2' : 'p1'}" aria-hidden="true" style="width:22px;height:22px"></span>
          <span class="gr-main"><b>${esc(h.variantName || getVariant(h.variantId).name)} vs ${esc(bot ? bot.name : h.botName)}</b>
            <small class="muted">${esc(fmtDate(h.at))} · ${Math.ceil(h.moves.length / 2)} moves${c && c.acc !== null ? ` · accuracy ${c.acc}` : ''}</small></span>
          <span class="pill ${h.result === 'win' ? 'win' : h.result === 'loss' || h.result === 'resigned' ? 'loss' : ''}">${esc(res)}</span>
        </a>`;
      }).join('') || '<p class="muted">No games match these filters.</p>'}
    </div>` : `
    <div class="card stack" style="max-width:640px"><p style="margin:0">No saved games yet. Every game you play from now on is kept here.</p>
      <a class="btn primary" href="#/setup">Play a game ${ICON.arrow}</a></div>`}`;
  $('#vf')?.addEventListener('change', (e) => { location.hash = link(f, e.target.value); });
}

let rv = null; // the review screen's state

function leaveReview() {
  if (!rv) return;
  document.removeEventListener('keydown', rv.onKey);
  rv.token++;
  rv = null;
}

function renderReview(id) {
  const entry = store.get(KEYS.history, []).find((h) => h.id === id);
  if (!reviewable(entry)) {
    app.innerHTML = `<div class="card stack" style="max-width:640px"><p style="margin:0">That game isn't available. Games played before the archive existed only kept their result.</p><a class="btn" href="#/review">Back to your games</a></div>`;
    return;
  }
  const variant = resolveVariant(entry.variantId, entry.options || {});
  const bot = LEVELS[entry.level] || LEVELS[1];
  const names = { you: 'You', them: bot.name };
  rv = { entry, variant, bot, names, cursor: entry.moves.length, review: null, showBest: true, token: 1, onKey: null };

  app.innerHTML = `
    <div class="game-head" style="margin-bottom:12px">
      <a class="icon-btn" href="#/review" aria-label="Back to your games">${ICON.back}</a>
      <div class="title">
        <h1>${esc(getVariant(entry.variantId).name)} vs ${esc(bot.name)}</h1>
        <div class="eyebrow">${esc(fmtDate(entry.at))} · ${esc(RESULT_LABEL[entry.result] || entry.result)} · you played ${entry.you === P2 ? 'Blue' : 'Gold'}</div>
      </div>
    </div>
    <div class="game">
      <div class="stack" style="gap:12px">
        <div class="board-wrap" id="board"></div>
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
        <section class="card" id="rv-focus" hidden></section>
      </div>
    </div>`;

  view = new BoardView($('#board'), { onPoint: () => {}, onHover: null });
  const ro = new ResizeObserver(() => view && view.setLabels(view.svg.getBoundingClientRect().width >= 460));
  ro.observe($('#board'));
  app.querySelectorAll('[data-nav-move]').forEach((b) => b.addEventListener('click', () => rvStep(b.dataset.navMove)));
  rv.onKey = (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowLeft') { rvStep('prev'); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { rvStep('next'); e.preventDefault(); }
    else if (e.key === 'Home') rvStep('first');
    else if (e.key === 'End') rvStep('last');
  };
  document.addEventListener('keydown', rv.onKey);

  const cached = cachedAnalysis(id);
  if (cached) {
    rv.review = buildReview(entry, cached.plies, names);
    rvUpdate(true);
  } else {
    rvUpdate(true);
    rvAnalyse();
  }
}

async function rvAnalyse() {
  const r = rv;
  const token = r.token;
  const box = $('#rv-summary');
  const setProgress = (p) => {
    if (rv !== r || r.token !== token) return;
    box.innerHTML = `<h2 style="font-size:20px">Analysing your game</h2>
      <p class="muted" style="margin:6px 0 10px;font-size:14px">The engine is checking every move. This happens once per game, on your device.</p>
      <div class="progress"><div style="width:${Math.round(p * 100)}%"></div></div>
      <div class="mono muted" style="font-size:12px;margin-top:6px">${Math.round(p * 100)}%</div>`;
  };
  setProgress(0);
  try {
    const plies = await askAnalysis(r.entry, setProgress);
    if (rv !== r || r.token !== token) return;
    r.review = buildReview(r.entry, plies, r.names);
    saveAnalysis(r.entry.id, plies, r.review);
    rvUpdate(true);
  } catch (err) {
    console.error(err);
    if (rv === r) box.innerHTML = '<p style="margin:0">The analysis hit a problem. Reload the page to try again.</p>';
  }
}

function rvStep(where) {
  if (!rv) return;
  const n = rv.entry.moves.length;
  rv.cursor = where === 'first' ? 0 : where === 'last' ? n : where === 'prev' ? Math.max(0, rv.cursor - 1) : where === 'next' ? Math.min(n, rv.cursor + 1) : Number(where);
  rvUpdate();
}

function rvRetry(ply) {
  const e = rv.entry;
  const last = store.get(KEYS.setup, {});
  startGame({
    variantId: e.variantId, level: e.level, side: e.you === P2 ? 'p2' : 'p1', coach: true,
    coachMode: last.coachMode || 'quiet', tournamentRule: (e.options || {}).tournamentRule !== false,
    capturePairs: (e.options || {}).capturePairs || 5,
  }, e.moves.slice(0, ply));
}

function rvUpdate(full = false) {
  const r = rv;
  if (!r || !view) return;
  const { entry, review } = r;
  const n = entry.moves.length;
  const k = r.cursor;
  const state = replay(r.variant, entry.moves.slice(0, k));
  const m = k > 0 ? (review ? review.moves[k - 1] : { ply: k - 1, x: entry.moves[k - 1][0], y: entry.moves[k - 1][1], name: coordName(...entry.moves[k - 1]), isYou: (k - 1) % 2 === (entry.you === P2 ? 1 : 0) }) : null;
  const rings = m && m.cls ? [{ x: m.x, y: m.y, color: CLASS_COLOR[m.cls] }] : [];
  const showBest = m && m.best && m.cls && m.cls !== 'best' && r.showBest && state.board[m.best[1] * 19 + m.best[0]] === 0;
  view.render(state, { last: m ? [m.x, m.y] : null, rings, hints: showBest ? [m.best] : [] });
  $('#rv-counter').textContent = `${k} / ${n}`;

  // Move card
  const who = (mv) => (mv.isYou ? 'You' : r.bot.name);
  let card;
  if (!m) card = '<h2 style="font-size:20px">Start of the game</h2><p class="muted" style="margin:6px 0 0;font-size:14px">Step through with the arrows, tap a move below, or jump to a key moment.</p>';
  else {
    const rank = m.cls ? CLASSES[m.cls].rank : 0;
    card = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
        <h2 style="font-size:20px">${Math.floor(m.ply / 2) + 1}. ${esc(who(m))}: <span class="mono">${esc(m.name)}</span></h2>${clsBadge(m.cls)}
      </div>
      ${review ? `<p style="margin:8px 0 0;font-size:14px">${esc(m.text)}</p>` : '<p class="muted" style="margin:8px 0 0;font-size:14px">Ratings appear when the analysis finishes.</p>'}
      ${m.best && m.cls && m.cls !== 'best' ? `<div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
        <button class="btn" type="button" id="rv-best"><span>${r.showBest ? 'Hide' : 'Show'} best move (<span class="mono">${esc(m.bestName)}</span>)</span></button>
        ${m.isYou && rank >= 3 ? `<button class="btn primary" type="button" id="rv-retry">Retry from here</button>` : ''}
      </div>` : ''}`;
  }
  $('#rv-move').innerHTML = card;
  $('#rv-best')?.addEventListener('click', () => { r.showBest = !r.showBest; rvUpdate(); });
  $('#rv-retry')?.addEventListener('click', () => rvRetry(m.ply));

  // Move strip
  const strip = $('#rv-moves');
  if (full || !strip.children.length) {
    strip.innerHTML = entry.moves.map((mv, i) => {
      const rm = review ? review.moves[i] : null;
      const dot = rm && rm.cls ? `<i style="background:${CLASS_COLOR[rm.cls]}"></i>` : '';
      return `<button type="button" class="mv ${i % 2 === 0 ? 'g' : 'b'}" data-ply="${i + 1}">${i % 2 === 0 ? `<span class="n">${i / 2 + 1}.</span>` : ''}${dot}${coordName(mv[0], mv[1])}</button>`;
    }).join('');
    strip.querySelectorAll('[data-ply]').forEach((b) => b.addEventListener('click', () => rvStep(b.dataset.ply)));
  }
  strip.querySelectorAll('.mv').forEach((b) => b.classList.toggle('on', Number(b.dataset.ply) === k));
  const on = strip.querySelector('.mv.on');
  if (on) on.scrollIntoView({ block: 'nearest', inline: 'nearest' });

  if (!review) return;

  if (full) {
    // Summary
    const order = CLASS_ORDER.filter((c) => review.counts[c]);
    $('#rv-summary').innerHTML = `
      <div style="display:flex;gap:18px;align-items:flex-end;flex-wrap:wrap">
        <div><div class="eyebrow">Your accuracy</div><div class="big-num">${review.accuracy ?? '—'}</div></div>
        <div><div class="eyebrow">${esc(r.bot.name)}</div><div class="big-num muted" style="font-size:24px">${review.theirAccuracy ?? '—'}</div></div>
      </div>
      <div class="cls-counts">${order.map((c) => `<span>${clsBadge(c)} <b class="mono">${review.counts[c]}</b></span>`).join('')}</div>`;

    // Graph
    const W = 400, H = 120;
    const pts = review.curve.map((v, i) => `${(i / Math.max(1, n)) * W},${(H - 4 - v * (H - 8)).toFixed(1)}`).join(' ');
    const keys = review.keyMoments.map((km) => {
      const i = km.ply + 1;
      return `<circle cx="${(i / Math.max(1, n)) * W}" cy="${(H - 4 - review.curve[i] * (H - 8)).toFixed(1)}" r="5" fill="${CLASS_COLOR[km.cls]}" stroke="#fff" stroke-width="1.5"></circle>`;
    }).join('');
    const g = $('#rv-graph');
    g.hidden = false;
    g.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:baseline"><h2 style="font-size:20px">Your winning chances</h2><span class="muted" style="font-size:12px">tap to jump</span></div>
      <svg id="rv-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:120px;margin-top:8px;cursor:pointer;display:block" role="img" aria-label="Your winning chances through the game">
        <rect x="0" y="0" width="${W}" height="${H / 2}" style="fill:var(--good-bg)"></rect>
        <rect x="0" y="${H / 2}" width="${W}" height="${H / 2}" style="fill:var(--warn-bg)"></rect>
        <line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" style="stroke:var(--border)" stroke-dasharray="3 4"></line>
        <polyline points="${pts}" fill="none" style="stroke:var(--accent-text)" stroke-width="2" vector-effect="non-scaling-stroke"></polyline>
        ${keys}
        <line id="rv-cursor" x1="0" y1="0" x2="0" y2="${H}" style="stroke:var(--text)" stroke-width="1" opacity=".5" vector-effect="non-scaling-stroke"></line>
      </svg>
      <div style="display:flex;justify-content:space-between" class="mono muted"><span style="font-size:11px">start</span><span style="font-size:11px">end</span></div>`;
    $('#rv-svg').addEventListener('click', (e) => {
      const rect = e.currentTarget.getBoundingClientRect();
      rvStep(String(Math.round(((e.clientX - rect.left) / rect.width) * n)));
    });

    // Key moments
    const kbox = $('#rv-key');
    kbox.hidden = false;
    kbox.innerHTML = `<h2 style="font-size:20px">Key moments</h2>${review.keyMoments.length ? review.keyMoments.map((km) => `
      <div class="km-row">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center"><b class="mono">${Math.floor(km.ply / 2) + 1}. ${esc(km.name)}</b>${clsBadge(km.cls)}</div>
        <p style="margin:4px 0 8px;font-size:14px">${esc(km.text)}</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn" type="button" data-goto="${km.ply + 1}">Go to move</button>
          <button class="btn primary" type="button" data-retry="${km.ply}">Retry from here</button>
        </div>
      </div>`).join('') : '<p class="muted" style="margin:6px 0 0;font-size:14px">No mistakes big enough to count as key moments. Well played.</p>'}`;
    kbox.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => { rvStep(b.dataset.goto); window.scrollTo({ top: 0, behavior: 'smooth' }); }));
    kbox.querySelectorAll('[data-retry]').forEach((b) => b.addEventListener('click', () => rvRetry(Number(b.dataset.retry))));

    // Focus areas
    const fbox = $('#rv-focus');
    if (review.focus.length) {
      fbox.hidden = false;
      fbox.innerHTML = `<h2 style="font-size:20px">What to work on</h2>${review.focus.map(([tag, count]) => `
        <div style="margin-top:10px"><b>${esc(tag)}</b> <span class="muted" style="font-size:13px">· ${count} move${count > 1 ? 's' : ''}</span>
        <p style="margin:2px 0 0;font-size:14px">${esc(FOCUS_TIPS[tag] || '')}</p></div>`).join('')}`;
    } else fbox.hidden = true;
  }
  const cur = $('#rv-cursor');
  if (cur) { const x = (k / Math.max(1, n)) * 400; cur.setAttribute('x1', x); cur.setAttribute('x2', x); }
}

// ---------------------------------------------------------------------------
// Coming-soon screens

function renderSoon(which) {
  const copy = {
    learn: ['Lessons', 'Step-by-step lessons from the rules to advanced theory, each with hands-on exercises and a practice game against a bot set up to test the idea.'],
    review: ['Game review', 'After each game: a winning-chances graph, every move rated with a reason, the key moments to retry, and a recommended next lesson.'],
    puzzles: ['Puzzles', 'Tactics puzzles built from real positions, including your own mistakes, with spaced repetition.'],
  }[which];
  app.innerHTML = `
    <div class="card stack" style="max-width:640px;margin:0 auto">
      <span class="badge" style="align-self:flex-start">COMING IN A LATER MILESTONE</span>
      <h1 style="font-size:28px">${esc(copy[0])}</h1>
      <p style="margin:0">${esc(copy[1])}</p>
      <p class="muted" style="margin:0">For now, practise against the bots with the coach turned on.</p>
      <a class="btn primary" href="#/setup">Play a practice game ${ICON.arrow}</a>
    </div>`;
}

// ---------------------------------------------------------------------------
// Variants library

function rulesList(v) {
  return `<ul class="rules">${v.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;
}

function renderVariants() {
  app.innerHTML = `
    <div style="margin-bottom:14px">
      <div class="eyebrow">Variants</div>
      <h1 style="font-size:28px;margin-top:4px">Variants and what they train</h1>
      <p class="muted" style="margin:6px 0 0;max-width:680px">Each variant changes one or two rules to put pressure on a specific skill. Play them to sharpen that part of your game.</p>
    </div>
    <div class="choice-list two">
      ${VARIANTS.map((v) => `
        <section class="card" style="display:flex;flex-direction:column;gap:8px">
          <h2 style="font-size:22px">${esc(v.name)}</h2>
          <div class="muted" style="font-size:14px">${esc(v.tagline)}</div>
          <div style="font-size:14px"><b style="color:var(--aqua)">Trains:</b> ${esc(v.trains)}</div>
          ${rulesList(v)}
          <a class="btn" style="margin-top:auto;align-self:flex-start" href="#/setup?v=${esc(v.id)}">Play ${esc(v.name)} ${ICON.arrow}</a>
        </section>`).join('')}
    </div>
    <section class="card" style="margin-top:14px">
      <h2 style="font-size:20px">Coming later</h2>
      <ul class="rules">${COMING_LATER.map((c) => `<li><b>${esc(c.name)}:</b> ${esc(c.note)}</li>`).join('')}</ul>
    </section>`;
}

// ---------------------------------------------------------------------------
// Game setup

function renderSetup(params) {
  const last = store.get(KEYS.setup, {});
  const sel = {
    variantId: params.get('v') || last.variantId || 'pente',
    level: last.level || 1,
    side: last.side || 'p1',
    coachMode: last.coachMode || (last.coach === false ? 'off' : 'quiet'),
    tournamentRule: last.tournamentRule !== false,
    capturePairs: last.capturePairs || 5,
  };
  app.innerHTML = `
    <form id="setup" class="stack" style="max-width:980px;margin:0 auto">
      <div>
        <div class="eyebrow">New game</div>
        <h1 style="font-size:28px;margin-top:4px">Set up a practice game</h1>
      </div>

      <section>
        <h2 class="section-title">Variant</h2>
        <div class="choice-list two">
          ${VARIANTS.map((v) => `
            <label class="choice">
              <input type="radio" name="variant" value="${esc(v.id)}" ${v.id === sel.variantId ? 'checked' : ''}>
              <span class="body">
                <span class="title">${esc(v.name)}</span>
                <span class="sub">${esc(v.tagline)}</span>
                <span class="trains"><b>Trains:</b> ${esc(v.trains)}</span>
                <span class="variant-rules" ${v.id === sel.variantId ? '' : 'hidden'}>${rulesList(v)}</span>
              </span>
            </label>`).join('')}
        </div>
      </section>

      <section class="card stack" id="options">
        <div class="switch-row" id="opt-tournament">
          <div><b>Tournament rule</b><div class="muted" style="font-size:13px">First player's second stone must be 3+ points from the centre. Recommended.</div></div>
          <label class="switch"><input type="checkbox" name="tournamentRule" ${sel.tournamentRule ? 'checked' : ''} aria-label="Tournament rule"><span></span></label>
        </div>
        <div id="opt-pairs">
          <b>Capture target</b><div class="muted" style="font-size:13px;margin-bottom:8px">Pairs you need, on top of a five.</div>
          <div class="segmented" role="radiogroup" aria-label="Capture target">
            ${[5, 8, 10].map((n) => `<label><input type="radio" name="capturePairs" value="${n}" ${n === sel.capturePairs ? 'checked' : ''}><span>${n} pairs</span></label>`).join('')}
          </div>
        </div>
      </section>

      <section>
        <h2 class="section-title">Opponent</h2>
        <div class="choice-list levels">
          ${LEVEL_IDS.map((l) => `
            <label class="choice">
              <input type="radio" name="level" value="${l}" ${l === sel.level ? 'checked' : ''}>
              <span class="body">
                <span class="title"><span class="stone p2" style="width:22px;height:22px"></span>${esc(LEVELS[l].name)} <span class="badge">LEVEL ${l}</span></span>
                <span class="sub">${esc(LEVELS[l].title)}</span>
                <span class="trains">${esc(LEVELS[l].blurb)}</span>
              </span>
            </label>`).join('')}
        </div>
      </section>

      <section class="card stack">
        <div>
          <b>Your stones</b><div class="muted" style="font-size:13px;margin-bottom:8px">Gold always moves first.</div>
          <div class="segmented" role="radiogroup" aria-label="Your stones">
            <label><input type="radio" name="side" value="p1" ${sel.side === 'p1' ? 'checked' : ''}><span>Gold · 1st</span></label>
            <label><input type="radio" name="side" value="p2" ${sel.side === 'p2' ? 'checked' : ''}><span>Blue · 2nd</span></label>
            <label><input type="radio" name="side" value="random" ${sel.side === 'random' ? 'checked' : ''}><span>Random</span></label>
          </div>
        </div>
        <div>
          <b>Coach</b><div class="muted" style="font-size:13px;margin-bottom:8px">Points out threats, open pairs and chances. <b>Quiet</b> keeps its notes hidden until you tap to see them.</div>
          <div class="segmented" role="radiogroup" aria-label="Coach">
            ${[['quiet', 'Quiet'], ['always', 'Always show'], ['off', 'Off']].map(([v, l]) => `<label><input type="radio" name="coachMode" value="${v}" ${sel.coachMode === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}
          </div>
        </div>
      </section>

      <div class="sticky-start"><button class="btn primary block" type="submit">Start game ${ICON.arrow}</button></div>
    </form>`;

  const form = $('#setup');
  const sync = () => {
    const vid = form.variant.value;
    const v = getVariant(vid);
    form.querySelectorAll('.variant-rules').forEach((n) => {
      n.hidden = n.closest('label').querySelector('input').value !== vid;
    });
    $('#opt-tournament').hidden = v.config.opening !== 'tournament';
    $('#opt-pairs').hidden = vid !== 'five-captures';
    $('#options').hidden = $('#opt-tournament').hidden && $('#opt-pairs').hidden;
  };
  form.addEventListener('change', sync);
  sync();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const settings = {
      variantId: form.variant.value,
      level: Number(form.level.value),
      side: form.side.value,
      coach: form.coachMode.value !== 'off',
      coachMode: form.coachMode.value,
      tournamentRule: form.tournamentRule.checked,
      capturePairs: Number((form.capturePairs && form.capturePairs.value) || 5),
    };
    store.set(KEYS.setup, settings);
    startGame(settings);
  });
}

// ---------------------------------------------------------------------------
// Game

let game = null;      // live game controller state
let view = null;      // BoardView for the current screen
let gameToken = 0;    // bumps whenever a game starts or is left, to drop stale bot replies

// Every game is kept with its full move list so it can be replayed and reviewed later.
const ARCHIVE_LIMIT = 300;
function archiveGame(g, result, reason) {
  const def = getVariant(g.variantId);
  const bot = LEVELS[g.level] || LEVELS[1];
  const history = store.get(KEYS.history, []);
  const id = (g.startedAt || Date.now()).toString(36) + Math.random().toString(36).slice(2, 6);
  history.unshift({
    id,
    variantId: g.variantId, options: g.options, you: g.you, level: g.level,
    variantName: def.name, botName: bot.name, result, reason,
    moves: g.moves, plies: g.moves.length, undos: g.undos || 0,
    startedAt: g.startedAt || null, at: Date.now(),
  });
  store.set(KEYS.history, history.slice(0, ARCHIVE_LIMIT));
  return id;
}

function startGame(settings, initialMoves = []) {
  const you = settings.side === 'random' ? (Math.random() < 0.5 ? P1 : P2) : settings.side === 'p2' ? P2 : P1;
  const options = { tournamentRule: settings.tournamentRule, capturePairs: settings.capturePairs };
  // A game left unfinished is kept in the archive rather than thrown away.
  const previous = store.get(KEYS.game, null);
  if (previous && previous.moves && previous.moves.length) archiveGame(previous, 'unfinished', null);
  const saved = { variantId: settings.variantId, options, you, level: settings.level, coach: settings.coach, coachMode: settings.coachMode || 'quiet', moves: initialMoves.slice(), startedAt: Date.now() };
  store.set(KEYS.game, saved);
  game = null;
  if (location.hash === '#/play') route(); else location.hash = '#/play';
}

function loadGame() {
  const saved = store.get(KEYS.game, null);
  if (!saved) return null;
  try {
    const variant = resolveVariant(saved.variantId, saved.options);
    const state = replay(variant, saved.moves);
    return {
      ...saved, state, variant, def: getVariant(saved.variantId), bot: LEVELS[saved.level] || LEVELS[1],
      preview: null, hover: null, warn: null, hints: [], notes: [], thinking: false, resignArmed: false, undos: saved.undos || 0,
      coachMode: saved.coachMode || 'quiet', revealed: false,
    };
  } catch {
    store.del(KEYS.game);
    return null;
  }
}

function saveGame() {
  if (!game) return;
  store.set(KEYS.game, {
    variantId: game.variantId, options: game.options, you: game.you, level: game.level, coach: game.coach, coachMode: game.coachMode,
    moves: game.state.history.map((h) => [h.x, h.y]), startedAt: game.startedAt, undos: game.undos,
  });
}

function leaveGame() {
  gameToken++;
  if (game) game.thinking = false;
  view = null;
}

function renderGame() {
  game = loadGame();
  if (!game) { location.hash = '#/setup'; return; }
  gameToken++;
  const g = game;
  const optsBits = [];
  if (g.variant.opening === 'tournament') optsBits.push('Tournament rule');
  if (g.variant.opening === 'center' && g.def.config.opening === 'tournament') optsBits.push('No tournament rule');
  if (g.variantId === 'five-captures') optsBits.push(`${g.options.capturePairs} pairs`);

  app.innerHTML = `
    <div class="game-head" style="margin-bottom:12px">
      <a class="icon-btn" href="#/" aria-label="Back to home">${ICON.back}</a>
      <div class="title">
        <h1>${esc(g.def.name)} vs ${esc(g.bot.name)}</h1>
        <div class="eyebrow">${esc([`Level ${g.level} · ${g.bot.title}`].concat(optsBits).join(' · '))}</div>
      </div>
      <a class="icon-btn" href="#/variants" aria-label="Rules for this variant">${ICON.book}</a>
    </div>
    <div class="game">
      <div class="stack" style="gap:12px">
        <div id="opp-phone" class="only-phone"></div>
        <div class="board-wrap" id="board"></div>
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
          <a class="btn" href="#/setup">${ICON.plus}<span>New</span></a>
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

  view = new BoardView($('#board'), { onPoint: onBoardPoint, onHover: onBoardHover });
  const ro = new ResizeObserver(() => view && view.setLabels(view.svg.getBoundingClientRect().width >= 460));
  ro.observe($('#board'));

  $('#btn-undo').addEventListener('click', onUndo);
  $('#btn-hint').addEventListener('click', onHint);
  $('#btn-resign').addEventListener('click', onResign);

  if (g.state.winner !== null) { updateGame(); showResult(); return; }
  if (g.state.toMove !== g.you) botTurn(); else { refreshNotes(); updateGame(); }
}

// --- Rendering the dynamic parts

function playerCard(p) {
  const g = game, s = g.state, v = g.variant;
  const isYou = p === g.you;
  const active = s.winner === null && s.toMove === p;
  const name = isYou ? `You · ${p === P1 ? 'Gold' : 'Blue'}` : `${g.bot.name} · ${p === P1 ? 'Gold' : 'Blue'}`;
  let status = isYou ? (active ? 'Your turn' : 'Waiting') : (active ? `<span class="thinking">Thinking</span>` : g.bot.title);
  if (s.winner !== null) status = s.winner === p ? 'Winner' : s.winner === 0 ? 'Draw' : '';
  const counts = [];
  let pips = '';
  if (v.captureSizes.length && v.captureWinStones) {
    if (v.captureSizes.length === 1 && v.captureSizes[0] === 2) {
      const target = v.captureWinStones / 2, have = Math.min(target, Math.floor(s.captured[p] / 2));
      pips = `<div class="pips" aria-hidden="true">${Array.from({ length: target }, (_, i) => `<span class="pip ${i < have ? 'on ' + (p === P1 ? 'p2' : 'p1') : ''}"></span>`).join('')}</div>`;
      counts.push(`CAPTURES ${Math.floor(s.captured[p] / 2)}/${target}`);
    } else {
      counts.push(`STONES ${s.captured[p]}/${v.captureWinStones}`);
    }
  } else if (!v.captureSizes.length) {
    counts.push('NO CAPTURES');
  }
  if (v.fivesToWin > 1) counts.push(`FIVES ${s.banked[p].length}/${v.fivesToWin}`);
  if (v.requireFiveAndCaptures) counts.push(`FIVE ${s.banked[p].length ? '✓' : '—'}`);
  return `
    <div class="player ${active ? 'active' : ''}">
      <span class="stone ${p === P1 ? 'p1' : 'p2'}" aria-hidden="true"></span>
      <div class="who"><div class="name">${esc(name)}</div><div class="status">${status}</div></div>
      <div class="counts">${pips}${counts.map(esc).join('<br>')}</div>
    </div>`;
}

// In Quiet mode the coach's notes (and its board markers) stay hidden until the player opens them.
const coachVisible = (g) => g.coach && (g.coachMode === 'always' || g.revealed);

function renderBoard() {
  if (!game || !view) return;
  const g = game, s = g.state;
  const lastRec = s.history[s.history.length - 1];
  const threatNote = coachVisible(g) ? g.notes.find((n) => n.kind === 'threat') : null;
  const ghostAt = g.preview || g.hover;
  view.render(s, {
    last: lastRec ? [lastRec.x, lastRec.y] : null,
    ghost: ghostAt && s.winner === null ? [ghostAt[0], ghostAt[1], g.you] : null,
    ghostWarn: !!(g.preview && g.warn && coachVisible(g)),
    threats: threatNote ? threatNote.points.slice(0, 4) : [],
    hints: g.hints,
  });
}

function updateGame() {
  if (!game || !view) return;
  const g = game, s = g.state;
  const opp = other(g.you);
  $('#opp-phone').innerHTML = playerCard(opp);
  $('#opp-desk').innerHTML = playerCard(opp);
  $('#me').innerHTML = playerCard(g.you);

  renderBoard();

  // Coach
  const coach = $('#coach');
  if (!g.coach) {
    coach.innerHTML = s.winner === null && s.toMove === g.you && s.ply === 0
      ? '<div class="note"><p>Your move. The first stone goes on the centre point.</p></div>' : '';
  } else {
    const notes = g.notes.slice(0, 3);
    const quiet = g.coachMode !== 'always';
    let body;
    if (s.winner !== null) body = '';
    else if (g.thinking) body = `<div class="note"><p class="muted">${esc(g.bot.name)} is thinking…</p></div>`;
    else if (s.ply === 0 && s.toMove === g.you) body = '<div class="note"><p class="muted">Your move. The first stone goes on the centre point.</p></div>';
    else if (quiet && !g.revealed) {
      body = notes.length
        ? `<button class="btn block coach-peek" type="button" id="coach-open">Coach has ${notes.length} note${notes.length > 1 ? 's' : ''} · Show</button>`
        : '<div class="note"><p class="muted">Nothing to flag right now.</p></div>';
    } else if (!notes.length) {
      body = '<div class="note"><p class="muted">No immediate threats. Build toward a tria, and keep your pairs covered.</p></div>';
    } else {
      body = notes.map((n, i) => `
      <div class="note ${n.kind}">
        <div class="eyebrow">${n.kind === 'threat' ? 'Heads up' : 'Chance'} · ${esc(n.tag)}</div>
        <p><b>${esc(n.title)}.</b> ${esc(n.text)}</p>
        ${n.reveal ? `<button class="link" type="button" data-reveal="${i}">Show me</button>` : ''}
      </div>`).join('') + (quiet ? '<button class="link" type="button" id="coach-close">Hide notes</button>' : '');
    }
    coach.innerHTML = `
      <div class="coach-head">
        <h2>Coach</h2>
        <label class="coach-mode"><span>Always show</span>
          <span class="switch"><input type="checkbox" id="coach-always" ${quiet ? '' : 'checked'} aria-label="Always show coach notes"><span></span></span>
        </label>
      </div>${body}`;
    coach.querySelectorAll('[data-reveal]').forEach((b) => b.addEventListener('click', () => {
      g.hints = g.notes[Number(b.dataset.reveal)].points.slice(0, 4);
      updateGame();
    }));
    $('#coach-open', coach)?.addEventListener('click', () => { g.revealed = true; updateGame(); });
    $('#coach-close', coach)?.addEventListener('click', () => { g.revealed = false; g.hints = []; updateGame(); });
    $('#coach-always', coach).addEventListener('change', (e) => {
      g.coachMode = e.target.checked ? 'always' : 'quiet';
      const last = store.get(KEYS.setup, {});
      store.set(KEYS.setup, { ...last, coachMode: g.coachMode, coach: true });
      saveGame();
      updateGame();
    });
  }

  // Confirm bar
  const conf = $('#confirm');
  if (g.preview && s.winner === null && !g.thinking) {
    const [x, y] = g.preview;
    conf.innerHTML = `
      ${g.warn && coachVisible(g) ? `<div class="warn">${esc(g.warn)}</div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 2fr;gap:8px">
        <button class="btn" type="button" id="btn-cancel">Cancel</button>
        <button class="btn primary" type="button" id="btn-confirm">Place at <span class="mono">${coordName(x, y)}</span></button>
      </div>`;
    $('#btn-confirm').addEventListener('click', () => placeMine(x, y));
    $('#btn-cancel').addEventListener('click', () => { g.preview = null; g.warn = null; updateGame(); });
  } else if (s.winner === null && !g.thinking && s.toMove === g.you) {
    conf.innerHTML = `<div class="muted" style="font-size:12px;text-align:center">Tap a point to preview your move, then confirm. With a mouse, just click.</div>`;
  } else {
    conf.innerHTML = '';
  }

  // Buttons
  $('#btn-undo').disabled = g.thinking || s.history.length === 0 || (s.history.length === 1 && g.you === P2);
  $('#btn-hint').disabled = g.thinking || s.winner !== null || s.toMove !== g.you;
  $('#btn-resign').disabled = s.winner !== null;
  const rb = $('#btn-resign');
  rb.classList.toggle('danger-armed', g.resignArmed);
  rb.querySelector('span').textContent = g.resignArmed ? 'Sure?' : 'Resign';

  // Move list
  const rows = [];
  for (let i = 0; i < s.history.length; i += 2) {
    const fmt = (h) => (h ? coordName(h.x, h.y) + (h.captured.length ? ` ×${h.captured.length}` : '') + (h.poofed.length ? ` poof${h.poofed.length}` : '') : '');
    rows.push(`<span class="n">${i / 2 + 1}.</span><span>${fmt(s.history[i])}</span><span>${fmt(s.history[i + 1])}</span>`);
  }
  $('#moves').innerHTML = rows.join('') || '<span class="muted" style="grid-column:1/-1">No moves yet.</span>';
}

function refreshNotes() {
  const g = game;
  g.notes = g.coach ? analyse(g.state, g.you, g.bot.name) : [];
  g.revealed = false; // Quiet mode starts hidden again each turn.
}

// --- Input

function onBoardHover(x, y) {
  const g = game;
  if (!g || g.thinking || g.state.winner !== null || g.state.toMove !== g.you || g.preview) return;
  const next = x === null || illegalReason(g.state, x, y) ? null : [x, y];
  if (String(next) === String(g.hover)) return;
  g.hover = next;
  renderBoard();
}

function onBoardPoint(x, y, pointerType) {
  const g = game;
  if (!g || g.thinking || g.state.winner !== null || g.state.toMove !== g.you) return;
  const why = illegalReason(g.state, x, y);
  if (why) { toast(why); return; }
  if (pointerType === 'mouse') { placeMine(x, y); return; }
  if (g.preview && g.preview[0] === x && g.preview[1] === y) { placeMine(x, y); return; }
  g.preview = [x, y];
  g.warn = g.coach ? previewWarning(g.state, x, y, g.bot.name) : null;
  updateGame();
}

function announce(rec, mover) {
  const who = mover === game.you ? 'You' : game.bot.name;
  if (rec.captured.length) {
    view.flashRemoved(rec.captured, mover === P1 ? '#3C5FD6' : '#E8B54A');
    toast(`${who} captured ${rec.captured.length} stones.`);
  }
  if (rec.poofed.length) {
    view.flashRemoved(rec.poofed, mover === P1 ? '#E8B54A' : '#3C5FD6');
    toast(`Poof! ${who === 'You' ? 'Your' : game.bot.name + '\'s'} ${rec.poofed.length} stones were bracketed and removed.`);
  }
  if (rec.newFives.length && game.state.winner === null) {
    if (game.variant.fivesToWin > 1) toast(`${who} banked a five. One more in a different direction wins.`);
    else if (game.variant.requireFiveAndCaptures) toast(`${who} banked a five. Now the capture target is all that's left.`);
  }
  if (game.variant.boat && game.state.pendingFive && game.state.winner === null) {
    toast(game.state.pendingFive.player === game.you
      ? `Five! ${game.bot.name} gets one move to break it with a capture.`
      : `${game.bot.name} made a five. Break it with a capture now, or it wins.`);
  }
}

function placeMine(x, y) {
  const g = game;
  if (!g || g.thinking || g.state.toMove !== g.you || g.state.winner !== null) return;
  if (illegalReason(g.state, x, y)) return;
  g.preview = null; g.hover = null; g.warn = null; g.hints = []; g.resignArmed = false;
  const rec = applyMove(g.state, x, y);
  saveGame();
  updateGame();
  announce(rec, g.you);
  if (g.state.winner !== null) { finishGame(); return; }
  botTurn();
}

async function botTurn() {
  const g = game;
  const token = gameToken;
  g.thinking = true;
  g.notes = [];
  updateGame();
  const started = performance.now();
  let move;
  try {
    move = await askBot(g.state, g.level);
  } catch (err) {
    console.error(err);
    toast('The bot hit a problem. Try Undo, or start a new game.');
    g.thinking = false; updateGame();
    return;
  }
  // A short pause so the move doesn't appear instantly.
  const wait = Math.max(0, 450 - (performance.now() - started));
  await new Promise((r) => setTimeout(r, wait));
  if (token !== gameToken || game !== g) return;
  g.thinking = false;
  const rec = applyMove(g.state, move.x, move.y);
  saveGame();
  refreshNotes();
  updateGame();
  announce(rec, other(g.you));
  if (g.state.winner !== null) finishGame();
}

function onUndo() {
  const g = game;
  if (!g || g.thinking) return;
  if (!g.state.history.length) return;
  undoMove(g.state);
  // Step back to your own turn (taking back the bot's reply and your move).
  while (g.state.history.length && g.state.toMove !== g.you) undoMove(g.state);
  if (g.state.toMove !== g.you) { botTurn(); return; }
  g.undos++;
  g.preview = null; g.warn = null; g.hints = []; g.resignArmed = false;
  saveGame();
  refreshNotes();
  $('.result')?.remove();
  updateGame();
}

async function onHint() {
  const g = game;
  if (!g || g.thinking || g.state.toMove !== g.you || g.state.winner !== null) return;
  const btn = $('#btn-hint');
  btn.disabled = true;
  const token = gameToken;
  const move = await askBot(g.state, 4);
  if (token !== gameToken || game !== g) return;
  g.hints = [[move.x, move.y]];
  g.revealed = true; // asking for a hint opens the coach
  g.notes = [{ kind: 'opportunity', tag: 'Hint', title: `Consider ${coordName(move.x, move.y)}`,
    text: 'This is the move Vega (Level 4) would play here. Before you take it, try to see why.', points: [[move.x, move.y]] }]
    .concat(g.notes.filter((n) => n.tag !== 'Hint'));
  updateGame();
}

function onResign() {
  const g = game;
  if (!g || g.state.winner !== null) return;
  if (!g.resignArmed) {
    g.resignArmed = true;
    updateGame();
    setTimeout(() => { if (game === g && g.resignArmed) { g.resignArmed = false; updateGame(); } }, 3000);
    return;
  }
  g.resignArmed = false;
  gameToken++;
  g.thinking = false;
  g.state.winner = other(g.you);
  g.state.winReason = 'resign';
  finishGame(true);
}

const REASONS = {
  'five': 'Five in a row.',
  'two-fives': 'Two fives in different directions.',
  'captures': 'By captures.',
  'five-and-captures': 'A five plus the capture target.',
  'board-full': 'The board is full.',
  'resign': 'By resignation.',
};

function finishGame(resigned = false) {
  const g = game;
  const s = g.state;
  const result = s.winner === g.you ? 'win' : s.winner === 0 ? 'draw' : resigned ? 'resigned' : 'loss';
  g.archivedId = archiveGame({
    variantId: g.variantId, options: g.options, you: g.you, level: g.level,
    moves: s.history.map((h) => [h.x, h.y]), startedAt: g.startedAt, undos: g.undos,
  }, result, s.winReason);
  store.del(KEYS.game);
  updateGame();
  showResult(result);
}

function showResult(result) {
  const g = game, s = g.state;
  if (!result) result = s.winner === g.you ? 'win' : s.winner === 0 ? 'draw' : 'loss';
  const title = result === 'win' ? 'You win!' : result === 'draw' ? 'Draw' : `${g.bot.name} wins`;
  const sub = REASONS[s.winReason] || '';
  const tip = result === 'win'
    ? (LEVELS[g.level + 1] ? `Ready for ${LEVELS[g.level + 1].name} (Level ${g.level + 1})?` : 'Try a variant that trains a different skill.')
    : 'Review the game to see where it turned, or use Undo to try the critical moment again.';
  const wrap = document.createElement('div');
  wrap.className = 'result';
  wrap.innerHTML = `
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div class="eyebrow">${esc(g.def.name)} · ${s.ply} moves</div>
      <h2 id="result-title">${esc(title)}</h2>
      <p class="muted" style="margin:0">${esc(sub)}</p>
      <p style="margin:12px 0 0;font-size:14px">${esc(tip)}</p>
      <div class="row">
        ${g.archivedId && s.ply > 1 ? `<a class="btn primary" href="#/review/${encodeURIComponent(g.archivedId)}">Review this game</a>` : ''}
        <button class="btn ${g.archivedId && s.ply > 1 ? '' : 'primary'}" type="button" id="again">Play again</button>
        ${result !== 'resigned' ? '<button class="btn" type="button" id="look">Look at the board</button>' : ''}
        <a class="btn" href="#/setup">Change settings</a>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  $('#again', wrap).addEventListener('click', () => {
    close();
    startGame({ variantId: g.variantId, level: g.level, side: g.you === P1 ? 'p1' : 'p2', coach: g.coach, coachMode: g.coachMode,
      tournamentRule: g.options.tournamentRule, capturePairs: g.options.capturePairs });
  });
  $('#look', wrap)?.addEventListener('click', close);
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  window.addEventListener('hashchange', close, { once: true });
  $('#again', wrap).focus();
}

// ---------------------------------------------------------------------------
route();
