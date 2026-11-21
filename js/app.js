// Game Training Sim.pente — app shell, screens and game flow.
import {
  P1, P2, applyMove, undoMove, illegalReason, toSnapshot, replay, coordName, other, newGame, parseCoord, cloneState, moverOf, firstOfTurn, setFrame, frameSize,
} from './rules.js';
import { VARIANTS, COMING_LATER, getVariant, resolveVariant } from './variants.js';
import { LEVELS, LEVEL_IDS } from './ai.js';
import { computeStats } from './stats.js';
import { buildReview, CLASSES, CLASS_ORDER, FOCUS_TIPS } from './review.js';
import { computePatterns, REPLY_LABELS } from './patterns.js';
import { UNITS, ALL_LESSONS, getLesson, nextLesson } from './lessons.js';
import { THEMES, collection, buildPuzzle, nextVariation, variationsOf, hintRing, emptyProgress, record as recordPuzzle, pickNext, summary as puzzleSummary } from './puzzles.js';
import { masterStats, openingTree } from './master-stats.js';
import { createHistory, ACCESS_LIMIT } from './history.js';
import { PLAYABLE_1983, GAMES_1983, masterEntry, masterId, openingOf, roundOf, OPENING_MOVES, toCoord } from './master-games.js';
import { swapColours, swapColourWords, setupPosition, checkMove, canSwapColours } from './lesson-engine.js';
import { analyse, previewWarning } from './coach.js';
import { BoardView } from './board.js';
import { openingStatus, seatColour, CHOICE_LABELS, OPENINGS, describeChances } from './openings.js';

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
const KEYS = { theme: 'gts.theme', game: 'gts.currentGame', setup: 'gts.lastSetup', analysis: 'gts.analysis', lessons: 'gts.lessons', puzzles: 'gts.puzzles' };

// Saved games: the newest 5000 can be opened; older ones live on in the statistics.
// If storage fills up, the analysis cache is trimmed first.
const saved = createHistory(localStorage, {
  onQuota: () => {
    const cache = store.get(KEYS.analysis, {});
    const ids = Object.keys(cache).sort((a, b) => (cache[b].at || 0) - (cache[a].at || 0));
    if (ids.length < 5) return false;
    for (const old of ids.slice(Math.floor(ids.length / 2))) delete cache[old];
    store.set(KEYS.analysis, cache);
    return true;
  },
});

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
    else p.resolve(e.data.analysis !== undefined ? e.data.analysis : e.data.result !== undefined ? e.data.result : e.data.move);
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

async function askOpening(state, action, extra = {}) {
  const snapshot = toSnapshot(state);
  if (worker) {
    try {
      return await new Promise((resolve, reject) => {
        const id = ++reqSeq;
        pending.set(id, { resolve, reject });
        worker.postMessage({ id, type: 'opening', snapshot, action, ...extra });
      });
    } catch { /* fall through to inline */ }
  }
  const { runOpening } = await import('./openings.js');
  await new Promise((r) => setTimeout(r, 30));
  return runOpening(state, action, extra);
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
  '/variants': renderVariants, '/stats': renderStats, '/learn': renderLearn, '/review': renderArchive, '/puzzles': renderPuzzles,
};
function parseHash() {
  const h = location.hash.replace(/^#/, '');
  const [path, query = ''] = h.split('?');
  return { path, params: new URLSearchParams(query) };
}
function route() {
  setFrame(19); // screens with a smaller board (Renju) set their own
  const { path, params } = parseHash();
  const reviewId = path.startsWith('/review/') ? decodeURIComponent(path.slice(8)) : null;
  const lessonId = path.startsWith('/learn/') ? decodeURIComponent(path.slice(7)) : null;
  const fn = reviewId ? () => renderReview(reviewId, params) : lessonId ? () => renderLesson(lessonId, params) : routes[path] || renderHome;
  document.body.classList.toggle('in-game', path === '/play');
  const inLessonGame = path === '/play' && (store.get(KEYS.game, null) || {}).lesson;
  const navKey = inLessonGame ? 'learn' : { '': 'home', '/': 'home', '/setup': 'play', '/play': 'play', '/variants': 'variants', '/learn': 'learn', '/review': 'review', '/puzzles': 'puzzles', '/stats': 'stats' }[path] || (reviewId ? 'review' : lessonId ? 'learn' : 'home');
  document.querySelectorAll('[data-nav]').forEach((a) => {
    if (a.dataset.nav === navKey) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  if (path !== '/play') leaveGame();
  leaveReview();
  leaveLesson();
  leavePuzzles();
  fn(params);
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', route);
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('[data-lesson-again]');
  if (!b) return;
  const [id, step] = b.dataset.lessonAgain.split('|');
  startLessonGame(id, Number(step));
});

// ---------------------------------------------------------------------------
// Home

function renderHome() {
  const current = store.get(KEYS.game, null);
  const history = saved.games();
  const resume = current ? (() => {
    const v = getVariant(current.variantId);
    const bot = LEVELS[current.level];
    return `
      <section class="card stack">
        <div class="eyebrow" style="color:var(--aqua)">Game in progress</div>
        <div><h2 style="font-size:23px">${esc(v.name)} vs ${esc(bot.name)}</h2>
          <p class="muted" style="margin:4px 0 0">${esc(bot.title)} · move ${current.moves.length + 1}</p></div>
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
          <a href="#/stats" style="font-size:14px;font-weight:600">${(() => { const t = computeStats(saved.forStats()).total; return t.winPct === null ? 'Stats' : `${t.winPct}% wins · Stats`; })()} →</a>
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
          <a class="tile" href="#/learn">${ICON.book}<span><strong>Lessons</strong><small>${lessonsDone()} of ${ALL_LESSONS.length} complete</small></span></a>
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

function renderStats(params = new URLSearchParams()) {
  const st = computeStats(saved.forStats());
  const t = st.total;
  const tab = params.get('tab') === 'patterns' ? 'patterns' : 'overview';
  const head = `
    <div style="margin-bottom:14px">
      <div class="eyebrow">Your record</div>
      <h1 style="font-size:28px;margin-top:4px">Statistics</h1>
      <p class="muted" style="margin:6px 0 0">Built from every game you finish. Unfinished games aren't counted${st.unfinished ? ` (${st.unfinished} so far)` : ''}. <a href="#/review">Browse all games →</a></p>
    </div>
    <div class="filters" role="tablist" aria-label="Statistics views">
      <a class="chip ${tab === 'overview' ? 'on' : ''}" role="tab" aria-selected="${tab === 'overview'}" href="#/stats">Overview</a>
      <a class="chip ${tab === 'patterns' ? 'on' : ''}" role="tab" aria-selected="${tab === 'patterns'}" href="#/stats?tab=patterns">Patterns &amp; openings</a>
    </div>`;
  if (tab === 'patterns' && t.played) { renderPatterns(head, params); return; }
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
// Lessons

function lessonProgress() { return store.get(KEYS.lessons, {}); }
function lessonState(id) { return lessonProgress()[id] || { steps: {} }; }
function lessonsDone() { return ALL_LESSONS.filter((l) => lessonState(l.id).done).length; }
function markStep(id, step, stars) {
  const all = lessonProgress();
  const ls = all[id] || { steps: {} };
  const prev = ls.steps[step];
  ls.steps[step] = { done: true, stars: Math.max(stars || 1, prev ? prev.stars || 1 : 0) };
  const lesson = getLesson(id);
  if (lesson) ls.done = lesson.steps.every((st, i) => st.type === 'read' || (ls.steps[i] && ls.steps[i].done));
  all[id] = ls;
  store.set(KEYS.lessons, all);
}
function lessonStepsDone(l) {
  const ls = lessonState(l.id);
  return l.steps.filter((st, i) => st.type !== 'read' && ls.steps[i] && ls.steps[i].done).length;
}
const practiceSteps = (l) => l.steps.filter((st) => st.type !== 'read').length;

// Advanced lessons (units 6 onward) give you Gold or Blue at random, in practice games and in
// puzzles set up by placing stones, so you get good at both sides.
const isAdvanced = (lesson) => Number(String(lesson.unitId || '').slice(1)) >= 6;

/** Winning a lesson's practice game completes the whole lesson. */
function completeLessonByGame(id, step) {
  markStep(id, step, 3);
  const all = lessonProgress();
  const ls = all[id] || { steps: {} };
  ls.done = true;
  all[id] = ls;
  store.set(KEYS.lessons, all);
}

/** Start (or restart) a lesson's practice game. It stays tied to the lesson. */
function startLessonGame(lessonId, stepIdx) {
  const lesson = getLesson(lessonId);
  const step = lesson && lesson.steps[stepIdx];
  if (!step || step.type !== 'play') { location.hash = `#/learn/${encodeURIComponent(lessonId)}`; return; }
  const g = step.game;
  const bot = LEVELS[g.level];
  const side = isAdvanced(lesson) ? 'random' : g.side || 'p1';
  startGame({ variantId: g.variantId, level: g.level, side, coach: true, coachMode: g.coachMode || 'quiet',
    tournamentRule: true, capturePairs: (g.options && g.options.capturePairs) || 5 }, g.moves || [],
  { lesson: { id: lesson.id, step: stepIdx, goal: step.goal === 'win' ? `beat ${bot.name}` : step.goal } });
}

/** A lesson puzzle as shown: in advanced lessons, placed-stone puzzles may come with colours swapped. */
function lessonLook(lesson, step) {
  if (!isAdvanced(lesson) || step.setup.moves || !canSwapColours(step.setup) || Math.random() < 0.5) return step;
  return {
    ...step, setup: swapColours(step.setup),
    stages: step.stages.map((st) => ({ ...st, prompt: swapColourWords(st.prompt), hint: swapColourWords(st.hint), success: swapColourWords(st.success) })),
  };
}
const starsHtml = (n) => `<span class="stars" aria-label="${n} of 3 stars">${'★'.repeat(n)}<span class="dim">${'★'.repeat(3 - n)}</span></span>`;

function renderLearn() {
  const next = ALL_LESSONS.find((l) => !lessonState(l.id).done);
  app.innerHTML = `
    <div style="margin-bottom:14px">
      <div class="eyebrow">Learn</div>
      <h1 style="font-size:28px;margin-top:4px">Lessons</h1>
      <p class="muted" style="margin:6px 0 0;max-width:720px">Eleven units that build on each other, from the rules to master-level ideas, with a lesson for every variant and the openings and positions of the 1983 world championship. Each lesson explains one idea, then gives you puzzles that get harder (some take several moves) and a practice game against a bot.</p>
    </div>
    ${next ? `<section class="card stack" style="margin-bottom:14px">
      <div class="eyebrow" style="color:var(--aqua)">${lessonsDone() ? 'Continue' : 'Start here'} · Unit ${next.unitId.slice(1)} · ${esc(next.unitTitle)}</div>
      <div><h2 style="font-size:23px">${esc(next.id)} · ${esc(next.title)}</h2><p class="muted" style="margin:4px 0 0">${esc(next.summary)}</p></div>
      <a class="btn primary" href="#/learn/${esc(next.id)}" style="align-self:flex-start">${lessonsDone() ? 'Continue' : 'Start'} ${ICON.arrow}</a>
    </section>` : '<section class="card" style="margin-bottom:14px"><h2 style="font-size:22px">All lessons complete</h2><p class="muted" style="margin:4px 0 0">Replay any lesson to sharpen up, or test yourself against Vega and Orion.</p></section>'}
    <div class="units">
      ${UNITS.map((u, ui) => {
        const done = u.lessons.filter((l) => lessonState(l.id).done).length;
        return `<section class="card unit">
          <div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px">
            <div><div class="eyebrow">Unit ${ui + 1}</div><h2 style="font-size:22px;margin-top:2px">${esc(u.title)}</h2></div>
            <span class="mono muted" style="font-size:12px">${done}/${u.lessons.length}</span>
          </div>
          <p class="muted" style="margin:4px 0 0;font-size:14px">${esc(u.blurb)}</p>
          ${bar(Math.round((done / u.lessons.length) * 100))}
          <div class="lesson-list">${u.lessons.map((l) => {
            const ls = lessonState(l.id);
            const n = lessonStepsDone(l), total = practiceSteps(l);
            return `<a class="lesson-row ${ls.done ? 'done' : ''}" href="#/learn/${esc(l.id)}">
              <span class="lesson-num mono">${ls.done ? '✓' : esc(l.id)}</span>
              <span style="flex:1;min-width:0"><b>${esc(l.title)}</b><small class="muted">${esc(l.summary)}</small></span>
              <span class="mono muted" style="font-size:12px">${n}/${total}</span></a>`;
          }).join('')}</div>
        </section>`;
      }).join('')}
    </div>`;
}

let ls = null; // the open lesson's state

function leaveLesson() {
  if (!ls) return;
  ls.token++;
  ls = null;
}

const GOAL_FAIL = {
  win: 'That doesn\'t win yet.', block: 'Blue can still win after that.', capture: 'That doesn\'t capture a pair.',
  blockTria: 'Blue can still make an open four.', tria: 'That doesn\'t make an open three.', openFour: 'That isn\'t an open four.',
  split3: 'That isn\'t a split three.', four: 'That doesn\'t make a four.', safe: 'That leaves stones Blue can capture.',
  noCaptures: 'Blue can still capture something.', capThreat: 'That doesn\'t threaten a capture.',
  forcedWin: 'Blue has a defence against that.', stopForced: 'Blue still has a forced win after that.',
  c6block: 'Blue can still make six next turn.', c6four: 'That doesn\'t make a threat (four in a line with room for six).',
  c6double: 'Two stones are still enough for Blue to block that.',
  quiet: 'That makes a direct threat; look for a quieter move.', doubleCapThreat: 'That doesn\'t threaten two pairs.', bank: 'That doesn\'t make a new five.',
  points: 'Not that one.', legal: 'That isn\'t allowed.',
};
function failReason(state, x, y, goal) {
  const opp = state.toMove === P1 ? 'Blue' : 'Gold';
  const say = (t) => t.replace(/Blue/g, opp);
  if (goal.all) {
    for (const g of goal.all) if (!checkMove(state, x, y, g).ok) return say(GOAL_FAIL[g.kind] || 'Not quite.');
    return 'Not quite.';
  }
  return say(GOAL_FAIL[goal.kind] || 'Not quite.');
}

function renderLesson(id, params) {
  const lesson = getLesson(id);
  if (!lesson) { location.hash = '#/learn'; return; }
  const stepIdx = Math.min(lesson.steps.length - 1, Math.max(0, Number(params.get('s')) || 0));
  ls = { lesson, stepIdx, token: 1 };
  const step = lesson.steps[stepIdx];
  const prog = lessonState(lesson.id);
  const nextL = nextLesson(lesson.id);
  const goStep = (i) => `#/learn/${encodeURIComponent(lesson.id)}?s=${i}`;

  app.innerHTML = `
    <div class="game-head" style="margin-bottom:10px">
      <a class="icon-btn" href="#/learn" aria-label="All lessons">${ICON.back}</a>
      <div class="title">
        <div class="eyebrow">Unit ${lesson.unitId.slice(1)} · ${esc(lesson.unitTitle)} · Lesson ${esc(lesson.id)}</div>
        <h1 style="font-size:22px">${esc(lesson.title)}</h1>
      </div>
    </div>
    <nav class="step-dots" aria-label="Lesson steps">
      ${lesson.steps.map((st, i) => {
        const d = prog.steps[i] && prog.steps[i].done;
        const label = st.type === 'read' ? 'Read' : st.type === 'play' ? 'Game' : `Puzzle`;
        return `<a href="${goStep(i)}" class="step-dot ${i === stepIdx ? 'on' : ''} ${d ? 'done' : ''}" aria-label="Step ${i + 1}: ${label}${d ? ', done' : ''}" ${i === stepIdx ? 'aria-current="step"' : ''}>
          <span>${d ? '✓' : st.type === 'read' ? '¶' : st.type === 'play' ? '▶' : i + 1}</span></a>`;
      }).join('')}
    </nav>
    <div class="lesson-body" id="lesson-body"></div>
    <div class="lesson-foot">
      ${stepIdx > 0 ? `<a class="btn" href="${goStep(stepIdx - 1)}">${ICON.back} Back</a>` : '<span></span>'}
      ${stepIdx < lesson.steps.length - 1
        ? `<a class="btn primary" id="lesson-next" href="${goStep(stepIdx + 1)}">Next ${ICON.arrow}</a>`
        : nextL ? `<a class="btn primary" id="lesson-next" href="#/learn/${esc(nextL.id)}">Next lesson: ${esc(nextL.title)} ${ICON.arrow}</a>`
          : '<a class="btn primary" id="lesson-next" href="#/learn">All lessons</a>'}
    </div>`;

  const body = $('#lesson-body');
  if (step.type === 'read') {
    body.innerHTML = `<section class="card lesson-read ${step.board ? 'with-board' : ''}">
      <div><h2 style="font-size:24px">${esc(step.title)}</h2>${step.text.map((t) => `<p>${esc(t)}</p>`).join('')}</div>
      ${step.board ? '<div class="board-wrap small" id="board"></div>' : ''}
    </section>`;
    if (step.board) {
      const s = setupPosition(step.board); // first: it sets the board size for the diagram
      view = new BoardView($('#board'), { onPoint: () => {}, onHover: null });
      view.setLabels(false);
      view.render(s, { hints: (step.board.hints || []).map(parseCoord) });
    }
    markStep(lesson.id, stepIdx, 3);
    return;
  }
  if (step.type === 'play') {
    const d = prog.steps[stepIdx] && prog.steps[stepIdx].done;
    const bot = LEVELS[step.game.level];
    body.innerHTML = `<section class="card stack" style="max-width:720px">
      <div class="eyebrow">Practice game</div>
      <h2 style="font-size:24px">${esc(step.title)}</h2>
      <p style="margin:0">${esc(step.text)}</p>
      <div class="player" style="max-width:420px"><span class="stone p2" aria-hidden="true"></span>
        <div class="who"><div class="name">${esc(bot.name)} · Level ${step.game.level}</div><div class="status">${esc(bot.title)} · ${esc(getVariant(step.game.variantId).name)} · ${isAdvanced(lesson) ? 'you play Gold or Blue, picked at random each game' : `you play ${step.game.side === 'p2' ? 'Blue' : 'Gold'}`}</div></div></div>
      ${d ? `<p style="margin:0;color:var(--good);font-weight:600">✓ Completed. You can play it again any time.</p>` : '<p class="muted" style="margin:0">Win the game to complete the lesson. Every game is saved, so you can review it afterwards.</p>'}
      <button class="btn primary" type="button" id="start-practice" style="align-self:flex-start">${d ? 'Play again' : 'Start the game'} ${ICON.arrow}</button>
    </section>`;
    $('#start-practice').addEventListener('click', () => startLessonGame(lesson.id, stepIdx));
    return;
  }
  renderPuzzle(lessonLook(lesson, step), body);
}

function renderPuzzle(step, body) {
  const r = ls;
  const lesson = r.lesson;
  r.puzzle = { stage: 0, state: setupPosition(step.setup), wrong: 0, hinted: false, shown: false, solved: false, preview: null, msg: null, busy: false };
  const P = r.puzzle;
  const done = lessonState(lesson.id).steps[r.stepIdx];
  body.innerHTML = `
    <div class="game">
      <div class="stack" style="gap:12px"><div class="board-wrap" id="board"></div></div>
      <div class="side">
        <section class="card" id="pz-card" aria-live="polite"></section>
        <div id="confirm" class="confirm-bar"></div>
        <div class="actions" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <button class="btn" type="button" id="pz-hint">${ICON.hint}<span>Hint</span></button>
          <button class="btn" type="button" id="pz-show">Show answer</button>
          <button class="btn" type="button" id="pz-reset">${ICON.undo}<span>Reset</span></button>
        </div>
        ${done ? `<p class="muted" style="margin:0;font-size:13px">Solved before ${starsHtml(done.stars || 1)}</p>` : ''}
      </div>
    </div>`;
  view = new BoardView($('#board'), {
    onPoint: (x, y, type) => {
      if (P.solved || P.busy || P.state.toMove !== r.you) return;
      const why = illegalReason(P.state, x, y);
      if (why) { toast(why); return; }
      if (type === 'mouse' || (P.preview && P.preview[0] === x && P.preview[1] === y)) { attempt(x, y); return; }
      P.preview = [x, y]; draw();
    },
    onHover: null,
  });
  r.you = P.state.toMove;
  const youName = r.you === P1 ? 'Gold' : 'Blue';

  function draw(extra = {}) {
    const sg = step.stages[P.stage];
    const last = P.lastMove || null;
    view.render(P.state, {
      last,
      ghost: P.preview ? [P.preview[0], P.preview[1], r.you] : null,
      hints: P.shown && !P.solved ? [parseCoord(sg.answer)] : [],
      ...extra,
    });
    const multi = step.stages.length > 1;
    let feedback = '';
    if (P.msg) feedback = `<div class="note ${P.msg.kind}" style="margin-top:12px"><p>${esc(P.msg.text)}</p></div>`;
    $('#pz-card').innerHTML = `
      <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
        <div class="eyebrow">Puzzle · Level ${step.level}${multi ? ` · Step ${Math.min(P.stage + 1, step.stages.length)} of ${step.stages.length}` : ''}</div>
        <span class="badge">YOU: ${youName.toUpperCase()}</span>
      </div>
      <h2 style="font-size:22px;margin-top:6px">${esc(step.title)}</h2>
      <p style="margin:8px 0 0">${esc(P.solved ? 'Solved!' : sg.prompt)}</p>
      ${P.hinted && !P.solved ? `<p class="muted" style="margin:8px 0 0;font-size:14px">Hint: ${esc(sg.hint)}</p>` : ''}
      ${feedback}
      ${P.solved ? `<div style="margin-top:12px">${starsHtml(P.stars)}</div>` : ''}`;
    const conf = $('#confirm');
    if (P.preview && !P.solved && !P.busy) {
      conf.innerHTML = `<div style="display:grid;grid-template-columns:1fr 2fr;gap:8px">
        <button class="btn" type="button" id="pz-cancel">Cancel</button>
        <button class="btn primary" type="button" id="pz-confirm">Play <span class="mono">${coordName(...P.preview)}</span></button></div>`;
      $('#pz-confirm').addEventListener('click', () => attempt(...P.preview));
      $('#pz-cancel').addEventListener('click', () => { P.preview = null; draw(); });
    } else conf.innerHTML = P.busy ? '<div class="muted" style="font-size:13px;text-align:center">Checking…</div>' : '';
    $('#pz-hint').disabled = P.solved;
    $('#pz-show').disabled = P.solved || P.wrong < 2;
    $('#pz-show').title = P.wrong < 2 ? 'Available after two tries' : '';
  }

  function attempt(x, y) {
    const sg = step.stages[P.stage];
    P.preview = null; P.busy = true; draw();
    const token = r.token;
    setTimeout(() => {
      if (ls !== r || r.token !== token) return;
      // The stage's own answer is verified by the tests, so accept it without re-running a slow search.
      const res = coordName(x, y) === sg.answer ? checkMove(P.state, x, y, { kind: 'legal' }) : checkMove(P.state, x, y, sg.goal);
      P.busy = false;
      if (!res.ok) {
        P.wrong++;
        P.msg = { kind: 'threat', text: `${coordName(x, y)}: ${failReason(P.state, x, y, sg.goal)}${P.wrong >= 2 && !P.shown ? ' You can ask to see the answer now.' : ''}` };
        draw();
        return;
      }
      if (res.record) {
        if (res.record.captured.length) view.flashRemoved(res.record.captured, r.you === P1 ? '#3C5FD6' : '#E8B54A');
      }
      P.state = res.after;
      P.lastMove = [x, y];
      P.msg = { kind: 'opportunity', text: sg.success };
      // Connect6: a stage without a reply is the first stone of a two-stone turn.
      if (!sg.reply && P.stage < step.stages.length - 1) { P.stage++; draw(); return; }
      if (sg.reply && P.stage < step.stages.length - 1) {
        P.busy = true; draw();
        setTimeout(() => {
          if (ls !== r || r.token !== token) return;
          const [rx, ry] = parseCoord(sg.reply);
          const rec = applyMove(P.state, rx, ry);
          if (rec.captured.length) view.flashRemoved(rec.captured, r.you === P1 ? '#E8B54A' : '#3C5FD6');
          P.lastMove = [rx, ry];
          P.stage++;
          P.busy = false;
          P.msg = { kind: 'opportunity', text: `${sg.success} ${r.you === P1 ? 'Blue' : 'Gold'} played ${sg.reply}.` };
          draw();
        }, 800);
        return;
      }
      P.solved = true;
      P.stars = P.shown ? 1 : P.hinted || P.wrong ? 2 : 3;
      markStep(lesson.id, r.stepIdx, P.stars);
      draw();
      $('#lesson-next')?.focus();
    }, 30);
  }

  $('#pz-hint').addEventListener('click', () => { P.hinted = true; draw(); });
  $('#pz-show').addEventListener('click', () => { P.shown = true; draw(); });
  $('#pz-reset').addEventListener('click', () => { if (ls === r) { r.token++; renderLesson(lesson.id, new URLSearchParams(`s=${r.stepIdx}`)); } });
  draw();
}


// ---------------------------------------------------------------------------
// Puzzle trainer

let pz = null; // the trainer's state

function leavePuzzles() {
  if (!pz) return;
  pz.token++;
  pz = null;
}

function puzzleItems() {
  return collection(saved.all(), store.get(KEYS.analysis, {}));
}

function renderPuzzles(params) {
  const src = params.get('src') || 'all';
  const theme = params.get('t') || '';
  const level = Number(params.get('lv')) || 0;
  const all = puzzleItems();
  const items = all.filter((i) => (src === 'all' || i.source === src) && (!theme || i.theme === theme) && (!level || i.level === level));
  const progress = store.get(KEYS.puzzles, null) || emptyProgress();
  const sum = puzzleSummary(all, progress);
  const link = (o) => {
    const q = new URLSearchParams();
    const v = { src, t: theme, lv: level || '', ...o };
    if (v.src && v.src !== 'all') q.set('src', v.src);
    if (v.t) q.set('t', v.t);
    if (v.lv) q.set('lv', v.lv);
    const qs = q.toString();
    return '#/puzzles' + (qs ? '?' + qs : '');
  };
  const counts = { champions: all.filter((i) => i.source === 'champions').length, lessons: all.filter((i) => i.source === 'lessons').length, mine: all.filter((i) => i.source === 'mine').length };
  const chip = (key, label) => `<a class="chip ${src === key ? 'on' : ''}" href="${link({ src: key, t: '' })}">${label}</a>`;
  const themesHere = Object.keys(THEMES).filter((t) => all.some((i) => i.theme === t && (src === 'all' || i.source === src)));

  app.innerHTML = `
    <div style="margin-bottom:14px">
      <div class="eyebrow">Practice</div>
      <h1 style="font-size:28px;margin-top:4px">Puzzles</h1>
      <p class="muted" style="margin:6px 0 0;max-width:760px">${all.length} puzzles: positions from the 1983 World Championship, every lesson puzzle, and wins you missed in your own games. Championship puzzles come up rotated or mirrored, so each one has eight variations. Puzzles you miss come back a few puzzles later until you get them.</p>
    </div>
    <div class="pz-stats">
      <div><div class="eyebrow">Solved</div><div class="big-num">${sum.solved}<span class="muted" style="font-size:16px"> / ${sum.total}</span></div></div>
      <div><div class="eyebrow">Streak</div><div class="big-num">${sum.streak}</div></div>
      <div><div class="eyebrow">Best streak</div><div class="big-num">${sum.best}</div></div>
      <div><div class="eyebrow">To retry</div><div class="big-num">${sum.due}</div></div>
    </div>
    <div class="filters">
      ${chip('all', 'All')}${chip('champions', `Champions <span class="muted">${counts.champions}</span>`)}${chip('lessons', `Lessons <span class="muted">${counts.lessons}</span>`)}${chip('mine', `Your games <span class="muted">${counts.mine}</span>`)}
      <label class="sr-only" for="pz-theme">Theme</label>
      <select id="pz-theme" class="select"><option value="">All themes</option>${themesHere.map((t) => `<option value="${t}" ${t === theme ? 'selected' : ''}>${esc(THEMES[t].name)}</option>`).join('')}</select>
      <label class="sr-only" for="pz-level">Level</label>
      <select id="pz-level" class="select"><option value="">All levels</option>${[1, 2, 3, 4, 5].map((l) => `<option value="${l}" ${l === level ? 'selected' : ''}>Level ${l}</option>`).join('')}</select>
    </div>
    ${items.length ? `
    <div class="game">
      <div class="stack" style="gap:12px"><div class="board-wrap" id="board"></div></div>
      <div class="side">
        <section class="card" id="pz-card" aria-live="polite"></section>
        <div id="confirm" class="confirm-bar"></div>
        <div class="actions" style="grid-template-columns:repeat(3,minmax(0,1fr))">
          <button class="btn" type="button" id="pz-hint">${ICON.hint}<span>Hint</span></button>
          <button class="btn" type="button" id="pz-show">Show answer</button>
          <button class="btn primary" type="button" id="pz-next"><span>Next</span>${ICON.arrow}</button>
        </div>
        <section class="card">
          <h2 style="font-size:18px">Themes</h2>
          <div class="theme-list">${themesHere.map((t) => {
            const b = sum.byTheme[t] || { total: 0, solved: 0 };
            const pct = b.total ? Math.round((100 * b.solved) / b.total) : 0;
            return `<a class="theme-row ${t === theme ? 'on' : ''}" href="${link({ t: t === theme ? '' : t })}">
              <span><b>${esc(THEMES[t].name)}</b><small class="muted">${esc(THEMES[t].blurb)}</small></span>
              <span class="mono muted" style="font-size:12px">${b.solved}/${b.total}</span>
              <span class="bar"><i style="width:${pct}%"></i></span></a>`;
          }).join('')}</div>
        </section>
      </div>
    </div>` : `<div class="card stack" style="max-width:640px"><p style="margin:0">${src === 'mine' ? 'No puzzles from your games yet. When you review a game and the analysis finds a forced win you missed, it becomes a puzzle here.' : 'No puzzles match these filters.'}</p>
      ${src === 'mine' ? '<a class="btn" href="#/review">Review your games</a>' : `<a class="btn" href="#/puzzles">Show all puzzles</a>`}</div>`}`;
  $('#pz-theme')?.addEventListener('change', (e) => { location.hash = link({ t: e.target.value }); });
  $('#pz-level')?.addEventListener('change', (e) => { location.hash = link({ lv: e.target.value }); });
  if (!items.length) return;

  pz = { items, progress, token: 1, current: null };
  pz.handlers = {
    onPoint: (x, y, type) => {
      const P = pz && pz.current;
      if (!P || P.solved || P.busy || P.state.toMove !== P.you) return;
      const why = illegalReason(P.state, x, y);
      if (why) { toast(why); return; }
      if (type === 'mouse' || (P.preview && P.preview[0] === x && P.preview[1] === y)) { pzAttempt(x, y); return; }
      P.preview = [x, y]; pzDraw();
    },
    onHover: null,
  };
  view = new BoardView($('#board'), pz.handlers);
  const ro = new ResizeObserver(() => view && view.setLabels(view.svg.getBoundingClientRect().width >= 460));
  ro.observe($('#board'));
  $('#pz-hint').addEventListener('click', () => { const P = pz.current; if (P && !P.solved) { P.hinted = true; pzDraw(); } });
  $('#pz-show').addEventListener('click', () => {
    const P = pz.current;
    if (!P || P.solved) return;
    P.shown = true;
    if (!P.recorded) { P.recorded = true; recordPuzzle(pz.progress, P.item.id, false); store.set(KEYS.puzzles, pz.progress); }
    pzDraw();
  });
  $('#pz-next').addEventListener('click', () => {
    const P = pz.current;
    if (P && !P.solved && P.wrong && !P.recorded) { recordPuzzle(pz.progress, P.item.id, false); store.set(KEYS.puzzles, pz.progress); }
    pzLoad(pickNext(pz.items, pz.progress, { exclude: P && P.item.id }));
  });
  pzLoad(pickNext(items, progress));
}

function pzLoad(item) {
  // Every replay of the same puzzle gets a look that hasn't been used recently.
  const look = nextVariation(item, pz.progress);
  store.set(KEYS.puzzles, pz.progress);
  const puzzle = buildPuzzle(item, look);
  const state = setupPosition(puzzle.setup);
  // A Renju puzzle needs the smaller board (setupPosition has set the coordinate frame).
  if (view && view.n !== frameSize()) { $('#board').replaceChildren(); view = new BoardView($('#board'), pz.handlers); view.setLabels(view.svg.getBoundingClientRect().width >= 460); }
  pz.token++;
  pz.current = { item, puzzle, state, you: state.toMove, stage: 0, wrong: 0, hinted: false, shown: false, solved: false, recorded: false, preview: null, msg: null, busy: false, lastMove: null, seed: Math.floor(Math.random() * 1e6) };
  pzDraw();
}

function pzDraw() {
  const P = pz && pz.current;
  if (!P || !view) return;
  const sg = P.puzzle.stages[P.stage];
  const isEmpty = (x, y) => P.state.board[y * 19 + x] === 0;
  const rings = P.hinted && !P.solved && !P.shown ? hintRing(sg.answer, isEmpty, P.seed).map(([x, y]) => ({ x, y, color: '#1E7F79' })) : [];
  view.render(P.state, {
    last: P.lastMove,
    ghost: P.preview ? [P.preview[0], P.preview[1], P.you] : null,
    hints: P.shown && !P.solved ? [parseCoord(sg.answer)] : [],
    rings,
  });
  const item = P.item;
  const o = item.origin;
  const youName = P.you === P1 ? 'Gold' : 'Blue';
  const multi = P.puzzle.stages.length > 1;
  let origin = '';
  if (P.solved || P.shown) {
    if (o.kind === 'master') origin = `<p class="muted" style="margin:10px 0 0;font-size:13px">From game ${o.n}, ${esc(o.round)}: ${esc(o.mover)} vs ${esc(o.opp)} (${esc(o.opening)}). <a href="#/review/wc83-${o.n}?side=${o.ply % 2 ? 'B' : 'W'}&at=${o.ply}">Replay the game</a>${P.puzzle.look.sym || P.puzzle.look.swap ? ` · shown ${[P.puzzle.look.sym ? 'rotated or mirrored' : '', P.puzzle.look.swap ? 'with colours swapped' : ''].filter(Boolean).join(' and ')}` : ''}</p>`;
    else if (o.kind === 'lesson') origin = `<p class="muted" style="margin:10px 0 0;font-size:13px">From lesson ${esc(o.lessonId)}, ${esc(o.lessonTitle)}. <a href="#/learn/${encodeURIComponent(o.lessonId)}?s=${o.step}">Open the lesson</a></p>`;
    else origin = `<p class="muted" style="margin:10px 0 0;font-size:13px">From your game on ${esc(fmtDate(o.at))}. You played ${esc(o.played)}. <a href="#/review/${encodeURIComponent(o.gameId)}">Review the game</a></p>`;
  }
  const feedback = P.msg ? `<div class="note ${P.msg.kind}" style="margin-top:12px"><p>${esc(P.msg.text)}</p></div>` : '';
  $('#pz-card').innerHTML = `
    <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
      <div class="eyebrow">${esc(THEMES[item.theme] ? THEMES[item.theme].name : 'Puzzle')} · Level ${item.level}${multi ? ` · Step ${Math.min(P.stage + 1, P.puzzle.stages.length)} of ${P.puzzle.stages.length}` : ''}</div>
      <span class="badge">YOU: ${youName.toUpperCase()}</span>
    </div>
    <h2 style="font-size:22px;margin-top:6px">${esc(item.source === 'champions' ? 'Championship position' : item.title)}</h2>
    <p style="margin:8px 0 0">${esc(P.solved ? 'Solved!' : sg.prompt)}</p>
    ${P.hinted && !P.solved && sg.hint ? `<p class="muted" style="margin:8px 0 0;font-size:14px">Hint: ${esc(sg.hint)} The answer is one of the four ringed points.</p>` : ''}
    ${P.shown && !P.solved ? `<p class="muted" style="margin:8px 0 0;font-size:14px">The answer is <span class="mono">${esc(sg.answer)}</span>. Play it to see what happens, or go to the next puzzle.</p>` : ''}
    ${feedback}${origin}
    ${(P.solved || P.shown) && variationsOf(item).length > 1 ? '<button class="btn" type="button" id="pz-again" style="margin-top:12px">Same puzzle, new look</button>' : ''}`;
  $('#pz-again')?.addEventListener('click', () => pzLoad(P.item));
  const conf = $('#confirm');
  if (P.preview && !P.solved && !P.busy) {
    conf.innerHTML = `<div style="display:grid;grid-template-columns:1fr 2fr;gap:8px">
      <button class="btn" type="button" id="pz-cancel">Cancel</button>
      <button class="btn primary" type="button" id="pz-confirm">Play <span class="mono">${coordName(...P.preview)}</span></button></div>`;
    $('#pz-confirm').addEventListener('click', () => pzAttempt(...P.preview));
    $('#pz-cancel').addEventListener('click', () => { P.preview = null; pzDraw(); });
  } else conf.innerHTML = P.busy ? '<div class="muted" style="font-size:13px;text-align:center">Checking…</div>' : '';
  $('#pz-hint').disabled = P.solved || P.shown;
  $('#pz-show').disabled = P.solved;
  $('#pz-next').classList.toggle('primary', P.solved || P.shown);
}

function pzAttempt(x, y) {
  const P = pz.current;
  const sg = P.puzzle.stages[P.stage];
  P.preview = null; P.busy = true; pzDraw();
  const token = pz.token;
  setTimeout(() => {
    if (!pz || pz.token !== token) return;
    const res = coordName(x, y) === sg.answer ? checkMove(P.state, x, y, { kind: 'legal' }) : checkMove(P.state, x, y, sg.goal);
    P.busy = false;
    if (!res.ok) {
      P.wrong++;
      P.msg = { kind: 'threat', text: `${coordName(x, y)}: ${failReason(P.state, x, y, sg.goal)}` };
      pzDraw();
      return;
    }
    if (res.record && res.record.captured.length) view.flashRemoved(res.record.captured, P.you === P1 ? '#3C5FD6' : '#E8B54A');
    P.state = res.after;
    P.lastMove = [x, y];
    P.msg = { kind: 'opportunity', text: sg.success };
    if (!sg.reply && P.stage < P.puzzle.stages.length - 1) { P.stage++; pzDraw(); return; }
    if (sg.reply && P.stage < P.puzzle.stages.length - 1) {
      P.busy = true; pzDraw();
      setTimeout(() => {
        if (!pz || pz.token !== token) return;
        const rec = applyMove(P.state, ...parseCoord(sg.reply));
        if (rec.captured.length) view.flashRemoved(rec.captured, P.you === P1 ? '#E8B54A' : '#3C5FD6');
        P.lastMove = parseCoord(sg.reply);
        P.stage++;
        P.busy = false;
        P.msg = { kind: 'opportunity', text: `${sg.success} ${P.you === P1 ? 'Blue' : 'Gold'} played ${sg.reply}.` };
        pzDraw();
      }, 800);
      return;
    }
    P.solved = true;
    if (!P.recorded) {
      P.recorded = true;
      recordPuzzle(pz.progress, P.item.id, !P.wrong && !P.shown);
      store.set(KEYS.puzzles, pz.progress);
    }
    pzDraw();
    $('#pz-next')?.focus();
  }, 30);
}

// ---------------------------------------------------------------------------
// Patterns, play style and openings

/** A small board diagram around the centre. stones: [{ o: [dx, dy], c: 1|2, ring?: true }] */
function openingSvg(stones, size = 118) {
  const reach = Math.max(3, ...stones.map((st) => Math.max(Math.abs(st.o[0]), Math.abs(st.o[1])))) + 1;
  const n = reach * 2;
  const cell = (size - 12) / n;
  const pos = (v) => 6 + (v + reach) * cell;
  let lines = '';
  for (let i = 0; i <= n; i++) {
    const v = 6 + i * cell;
    lines += `<line x1="6" y1="${v}" x2="${size - 6}" y2="${v}"></line><line x1="${v}" y1="6" x2="${v}" y2="${size - 6}"></line>`;
  }
  const r = Math.min(cell * 0.42, 9);
  const dots = stones.map((st) => `
    <circle cx="${pos(st.o[0])}" cy="${pos(st.o[1])}" r="${r}" fill="${st.c === 1 ? 'url(#og1)' : 'url(#og2)'}" ${st.ring ? 'opacity=".55"' : ''}></circle>
    ${st.ring ? `<circle cx="${pos(st.o[0])}" cy="${pos(st.o[1])}" r="${r + 2.5}" fill="none" stroke="#D9661C" stroke-width="2" stroke-dasharray="3 2"></circle>` : ''}`).join('');
  return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true" class="opening-svg">
    <defs>
      <radialGradient id="og1" cx="34%" cy="28%" r="75%"><stop offset="0%" stop-color="#FFF6DA"/><stop offset="40%" stop-color="#F2C55C"/><stop offset="100%" stop-color="#9A6410"/></radialGradient>
      <radialGradient id="og2" cx="34%" cy="28%" r="75%"><stop offset="0%" stop-color="#E3EAFF"/><stop offset="40%" stop-color="#5C7FE6"/><stop offset="100%" stop-color="#1B2F8C"/></radialGradient>
    </defs>
    <rect x="0" y="0" width="${size}" height="${size}" rx="8" fill="#F7F5EE"></rect>
    <g stroke="#C3C9DC" stroke-width="1">${lines}</g>${dots}</svg>`;
}

function replyBar(replies) {
  const parts = [['blocked', 'var(--accent)'], ['captured', '#D9661C'], ['counter', '#B08900'], ['elsewhere', 'var(--track)']];
  return `<div class="stackbar" role="img" aria-label="${parts.map(([k]) => `${REPLY_LABELS[k]} ${replies[k] || 0}%`).join(', ')}">
    ${parts.map(([k, c]) => (replies[k] ? `<span style="width:${replies[k]}%;background:${c}"></span>` : '')).join('')}</div>
    <div class="legend">${parts.filter(([k]) => replies[k]).map(([k, c]) => `<span><i style="background:${c}"></i>${REPLY_LABELS[k]} ${replies[k]}%</span>`).join('')}</div>`;
}

function renderPatterns(head, params) {
  const vf = params.get('v') || '';
  const pt = computePatterns(saved.games(), { variantId: vf || undefined });
  const st = pt.style;
  const filter = pt.variants.length > 1 ? `
    <label class="sr-only" for="pvf">Variant</label>
    <select id="pvf" class="select" style="margin-bottom:12px"><option value="">All variants</option>
      ${pt.variants.map((v) => `<option value="${esc(v.id)}" ${v.id === vf ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select>` : '';
  const few = pt.games < 5 ? `<p class="muted" style="margin:0 0 12px;font-size:14px">Based on ${pt.games} game${pt.games === 1 ? '' : 's'}. Patterns get more reliable after 10 or more.</p>` : '';
  const metric = (label, value, note) => `<div class="stat-row" style="display:flex;justify-content:space-between;gap:10px"><span>${label}${note ? `<br><small class="muted">${note}</small>` : ''}</span><b class="mono">${value}</b></div>`;

  const openingCards = (list, asGold) => list.length ? list.slice(0, 6).map((o) => {
    const base = asGold
      ? [{ o: [0, 0], c: 1 }, { o: o.offsets[0], c: 2 }, { o: o.offsets[1], c: 1 }]
      : [{ o: [0, 0], c: 1 }, { o: o.offsets[0], c: 2 }];
    const top = o.replies.slice(0, 3);
    return `<div class="opening">
      <div class="opening-main">${openingSvg(base)}
        <div><b>${esc(asGold ? `Your 2nd stone: ${o.parts[1]}` : `Your reply: ${o.parts[0]}`)}</b>
          <div class="muted" style="font-size:13px">${asGold ? `after Blue played ${esc(o.parts[0])}` : 'to the centre stone'}</div>
          <div style="margin-top:6px"><span class="mono">${o.wins}–${o.games - o.wins}</span> · <b>${o.winPct}%</b> wins · ${o.games} game${o.games > 1 ? 's' : ''}</div>
          ${bar(o.winPct)}</div>
      </div>
      <div class="eyebrow" style="margin:12px 0 6px">How the bots answer</div>
      <div class="replies">${top.map((r) => `<div class="reply">${openingSvg([...base, { o: r.offset, c: asGold ? 2 : 1, ring: true }], 84)}
        <div style="font-size:12px"><b>${esc(r.name)}</b><br><span class="muted">${r.games}× · you won ${r.winPct}%</span></div></div>`).join('')}</div>
    </div>`;
  }).join('') : '<p class="muted" style="margin:6px 0 0;font-size:14px">No games yet with these colours.</p>';

  app.innerHTML = head + filter + few + `
    <div class="home-grid">
      <section class="card">
        <div class="eyebrow">Your play style</div>
        <h2 style="font-size:28px;margin-top:4px">${esc(st.label)}</h2>
        <p style="margin:6px 0 0;font-size:14px">${esc(st.blurb)}</p>
        <div class="stat-rows">
          ${metric('Forcing moves', `${st.aggression ?? 0}%`, 'threats, captures and capture threats')}
          ${metric('Defensive moves', `${st.defence ?? 0}%`, 'blocking fours, open threes and captures')}
          ${metric('Captures per game', st.capturesPerGame)}
          ${metric('Capture threats per game', st.capThreatsPerGame)}
          ${metric('Pairs left exposed per game', st.exposedPerGame, 'lower is better')}
          ${metric('Double threats per game', st.doubleThreatsPerGame, 'two threats in one move: usually winning')}
        </div>
      </section>
      <section class="card">
        <h2 style="font-size:20px">Shapes you build</h2>
        <p class="muted" style="margin:4px 0 0;font-size:13px">How often you make each shape, how those games went, and how the bots respond.</p>
        ${pt.shapes.length ? pt.shapes.map((sh) => `
          <div class="shape-row">
            <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap"><b>${esc(sh.label)}</b><span class="mono" style="font-size:12px">${sh.perGame}/game</span></div>
            <div class="muted" style="font-size:12px;margin:2px 0 6px">Won ${sh.winPctWith ?? '—'}% of games with it · kept the initiative ${sh.keptInitiativePct ?? '—'}% of the time</div>
            ${replyBar(sh.replies)}
          </div>`).join('') : '<p class="muted" style="margin:6px 0 0;font-size:14px">No shapes recorded yet.</p>'}
      </section>
    </div>
    <section class="card" style="margin-top:14px">
      <h2 style="font-size:20px">Your openings as Gold</h2>
      <p class="muted" style="margin:4px 0 0;font-size:13px">Where you put your second stone, grouped so mirror images and rotations count as the same opening. The faded ring shows each bot answer.</p>
      <div class="openings">${openingCards(pt.openings.asGold, true)}</div>
    </section>
    <section class="card" style="margin-top:14px">
      <h2 style="font-size:20px">Your openings as Blue</h2>
      <p class="muted" style="margin:4px 0 0;font-size:13px">How you answer Gold's centre stone, and where the bots put their second stone in reply.</p>
      <div class="openings">${openingCards(pt.openings.asBlue, false)}</div>
    </section>`;
  $('#pvf')?.addEventListener('change', (e) => { location.hash = `#/stats?tab=patterns${e.target.value ? `&v=${encodeURIComponent(e.target.value)}` : ''}`; });
}

// ---------------------------------------------------------------------------
// Game archive and review

const RESULT_LABEL = { win: 'Won', loss: 'Lost', resigned: 'Resigned', draw: 'Draw', unfinished: 'Unfinished' };
const CLASS_COLOR = {
  best: '#16706A', excellent: '#2F7C77', good: '#5B8E8A', inaccuracy: '#B08900', mistake: '#D9661C', missedWin: '#D9661C', blunder: '#C0392B',
};
const ANALYSIS_VERSION = 2; // 2: a move that keeps a forced win is no longer marked "missed win"
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

function archiveTabs(tab) {
  return `<div class="filters" role="tablist" aria-label="Game collections">
      <a class="chip ${tab === 'mine' ? 'on' : ''}" role="tab" aria-selected="${tab === 'mine'}" href="#/review">Your games</a>
      <a class="chip ${tab === 'masters' ? 'on' : ''}" role="tab" aria-selected="${tab === 'masters'}" href="#/review?tab=masters">1983 World Championship</a>
    </div>`;
}

function renderArchive(params) {
  if (params.get('tab') === 'masters') { renderMasters(params); return; }
  const all = saved.games().filter(reviewable);
  const shown = Math.max(100, Number(params.get('n')) || 100);
  const varCount = {};
  for (const e of saved.all()) if (e.parent) varCount[e.parent] = (varCount[e.parent] || 0) + 1;
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
    ${archiveTabs('mine')}
    ${all.length ? `
    <div class="filters">
      ${chip('all', 'All')}${chip('wins', 'Wins')}${chip('losses', 'Losses')}${chip('unfinished', 'Unfinished')}
      ${variantsUsed.length > 1 ? `<label class="sr-only" for="vf">Variant</label>
      <select id="vf" class="select"><option value="">All variants</option>${variantsUsed.map((v) => `<option value="${esc(v)}" ${v === vf ? 'selected' : ''}>${esc(getVariant(v).name)}</option>`).join('')}</select>` : ''}
    </div>
    <p class="muted" style="margin:0 0 10px;font-size:13px">${list.length} game${list.length === 1 ? '' : 's'}${saved.retiredCount() ? ` · ${saved.retiredCount()} older games are counted in your stats but can no longer be opened (the newest ${ACCESS_LIMIT} are kept)` : ''}</p>
    <div class="game-list">
      ${list.slice(0, shown).map((h) => {
        const c = cachedAnalysis(h.id);
        const bot = LEVELS[h.level];
        const res = RESULT_LABEL[h.result] || h.result;
        return `<a class="game-row" href="#/review/${encodeURIComponent(h.id)}">
          <span class="stone ${h.you === P2 ? 'p2' : 'p1'}" aria-hidden="true" style="width:22px;height:22px"></span>
          <span class="gr-main"><b>${esc(h.variantName || getVariant(h.variantId).name)} vs ${esc(bot ? bot.name : h.botName)}</b>
            <small class="muted">${esc(fmtDate(h.at))} · ${Math.ceil(h.moves.length / 2)} moves${c && c.acc !== null ? ` · accuracy ${c.acc}` : ''}${h.lesson ? ` · lesson ${esc(h.lesson.id)}` : ''}${varCount[h.id] ? ` · ${varCount[h.id]} variation${varCount[h.id] > 1 ? 's' : ''}` : ''}</small></span>
          <span class="pill ${h.result === 'win' ? 'win' : h.result === 'loss' || h.result === 'resigned' ? 'loss' : ''}">${esc(res)}</span>
        </a>`;
      }).join('') || '<p class="muted">No games match these filters.</p>'}
    </div>
    ${list.length > shown ? `<a class="btn" style="margin-top:12px" href="${link(f, vf)}&n=${shown + 200}">Show more games</a>` : ''}` : `
    <div class="card stack" style="max-width:640px"><p style="margin:0">No saved games yet. Every game you play from now on is kept here.</p>
      <a class="btn primary" href="#/setup">Play a game ${ICON.arrow}</a></div>`}`;
  $('#vf')?.addEventListener('change', (e) => { location.hash = link(f, e.target.value); });
}

function mastersTabs(view) {
  return `<div class="filters" role="tablist" aria-label="1983 views">
      <a class="chip ${view === 'games' ? 'on' : ''}" role="tab" aria-selected="${view === 'games'}" href="#/review?tab=masters">Games</a>
      <a class="chip ${view === 'insights' ? 'on' : ''}" role="tab" aria-selected="${view === 'insights'}" href="#/review?tab=masters&view=insights">Insights</a>
    </div>`;
}

function renderMasters(params) {
  if (params.get('view') === 'insights') { renderMasterInsights(params); return; }
  const pf = params.get('p') || '';
  const of = params.get('o') || '';
  const players = [...new Set(PLAYABLE_1983.flatMap((g) => [g.white, g.black]))].sort((a, b) => a.split(' ').pop().localeCompare(b.split(' ').pop()));
  const openings = Object.keys(OPENING_MOVES).concat('Irregular');
  let list = PLAYABLE_1983;
  if (pf) list = list.filter((g) => g.white === pf || g.black === pf);
  if (of) list = list.filter((g) => openingOf(g.n) === of);
  const link = (np, no) => `#/review?tab=masters${np ? `&p=${encodeURIComponent(np)}` : ''}${no ? `&o=${encodeURIComponent(no)}` : ''}`;
  const surname = (n) => n.split(' ').pop();

  // Openings table: how often the first player won with each.
  const rows = openings.map((name) => {
    const gs = PLAYABLE_1983.filter((g) => openingOf(g.n) === name);
    const w = gs.filter((g) => g.winner === 'W').length;
    return { name, n: gs.length, pct: gs.length ? Math.round((100 * w) / gs.length) : null };
  }).filter((r) => r.n).sort((a, b) => b.n - a.n);
  const firstWins = Math.round((100 * PLAYABLE_1983.filter((g) => g.winner === 'W').length) / PLAYABLE_1983.length);
  const sideView = pf ? (g) => (g.white === pf ? 'W' : 'B') : () => '';

  app.innerHTML = `
    <div style="margin-bottom:14px">
      <div class="eyebrow">Review</div>
      <h1 style="font-size:28px;margin-top:4px">1983 World Championship</h1>
      <p class="muted" style="margin:6px 0 0;max-width:760px">${PLAYABLE_1983.length} games between twenty of the world's best players (Boston, March 1983; Rollie Tesh won). Replay any game with the engine's analysis, follow either player, and play on from any position. Moves from the U.S. Pente Association's booklet <i>Championship Pente</i>.</p>
    </div>
    ${archiveTabs('masters')}
    ${mastersTabs('games')}
    <div class="filters">
      <label class="sr-only" for="mp">Player</label>
      <select id="mp" class="select"><option value="">All players</option>${players.map((n) => `<option value="${esc(n)}" ${n === pf ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
      <label class="sr-only" for="mo">Opening</label>
      <select id="mo" class="select"><option value="">All openings</option>${openings.map((n) => `<option value="${esc(n)}" ${n === of ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    </div>
    <div class="game" style="align-items:start">
      <div class="game-list">
        ${list.map((g) => {
          const winName = g.winner === 'W' ? g.white : g.black;
          const side = sideView(g);
          return `<a class="game-row" href="#/review/${encodeURIComponent(masterId(g.n))}${side ? `?side=${side}` : ''}">
            <span class="stone ${g.winner === 'W' ? 'p1' : 'p2'}" aria-hidden="true" style="width:22px;height:22px"></span>
            <span class="gr-main"><b>${esc(surname(g.white))} – ${esc(surname(g.black))}</b>
              <small class="muted">Game ${g.n} · ${esc(roundOf(g.n))} · ${esc(openingOf(g.n))} · ${Math.ceil(g.moves.trim().split(/\s+/).length / 2)} moves</small></span>
            <span class="pill ${g.winner === 'W' ? 'win' : ''}">${esc(surname(winName))} won</span>
          </a>`;
        }).join('') || '<p class="muted">No games match these filters.</p>'}
      </div>
      <aside class="side">
        <section class="card">
          <h2 style="font-size:20px">Openings played</h2>
          <p class="muted" style="margin:6px 0 10px;font-size:14px">The booklet's own names. Gold (the first player) won ${firstWins}% of these games overall.</p>
          <table class="mini-table"><thead><tr><th>Opening</th><th class="num">Games</th><th class="num">Gold won</th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td><a href="${link(pf, r.name)}">${esc(r.name)}</a>${OPENING_MOVES[r.name] ? `<div class="mono muted" style="font-size:11px">${esc(OPENING_MOVES[r.name].split(' ').map(toCoord).join(' '))}</div>` : ''}</td><td class="num mono">${r.n}</td><td class="num mono">${r.pct}%</td></tr>`).join('')}
          </tbody></table>
        </section>
      </aside>
    </div>`;
  $('#mp').addEventListener('change', (e) => { location.hash = link(e.target.value, of); });
  $('#mo').addEventListener('change', (e) => { location.hash = link(pf, e.target.value); });
}


// Chart colours (validated with the dataviz palette checker for light and dark surfaces):
// winners = teal, losers = amber, Gold-first-player figures = cobalt.
const VIZ = () => (document.documentElement.dataset.theme === 'dark'
  ? { win: '#159C8F', lose: '#C08A1C', gold: '#6A82EA', mid: '#2A3368', ink: '#EEF0FA', faint: '#A6ADD0', surface: '#151B42' }
  : { win: '#0E8F84', lose: '#B07C10', gold: '#2F44B0', mid: '#DDE1EE', ink: '#161B3D', faint: '#555D80', surface: '#FFFFFF' });

function mixHex(a, b, t) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/** A board-shaped heatmap. cell(dx, dy) -> { t: -1..1 or 0..1, title }. */
function heatSvg(reach, cell, { diverging = false, size = 300, label = '' } = {}) {
  const c = VIZ();
  const n = 2 * reach + 1, pad = 6, step = (size - 2 * pad) / n, gap = 2;
  let rects = '';
  for (let y = -reach; y <= reach; y++) for (let x = -reach; x <= reach; x++) {
    const { t, title } = cell(x, y);
    let fill;
    if (diverging) fill = t >= 0 ? mixHex(c.mid, c.win, Math.min(1, t)) : mixHex(c.mid, c.lose, Math.min(1, -t));
    else fill = mixHex(c.mid, c.win, Math.min(1, t));
    rects += `<rect x="${pad + (x + reach) * step + gap / 2}" y="${pad + (y + reach) * step + gap / 2}" width="${step - gap}" height="${step - gap}" rx="3" fill="${fill}"><title>${esc(title)}</title></rect>`;
  }
  const mid = pad + reach * step + step / 2;
  return `<svg viewBox="0 0 ${size} ${size}" class="heat" role="img" aria-label="${esc(label)}">${rects}
    <circle cx="${mid}" cy="${mid}" r="3" fill="none" stroke="${c.ink}" stroke-width="1.5" opacity=".7"><title>Centre (K10)</title></circle></svg>`;
}

function heatLegend(diverging) {
  const c = VIZ();
  const stops = diverging ? [c.lose, c.mid, c.win] : [c.mid, c.win];
  return `<div class="heat-legend"><span>${diverging ? 'Losers more' : 'Fewer'}</span><i style="background:linear-gradient(90deg,${stops.join(',')})"></i><span>${diverging ? 'Winners more' : 'More stones'}</span></div>`;
}

function renderMasterInsights(params = new URLSearchParams()) {
  const st = masterStats();
  const c = VIZ();
  const o = st.overview, f = st.findings;
  const ends = [['resigned', 'Resigned', c.gold], ['captures', 'Five captures', c.lose], ['five', 'Five in a row', c.win]];
  const segBar = `<div class="seg" role="img" aria-label="${ends.map(([k, l]) => `${l} ${o.endings[k]}`).join(', ')}">${ends.map(([k, l, col]) => `<span style="flex:${o.endings[k]};background:${col}" title="${l}: ${o.endings[k]} games"></span>`).join('')}</div>
    <div class="legend">${ends.map(([k, l, col]) => `<span><i style="background:${col}"></i>${l} ${o.endings[k]}</span>`).join('')}</div>`;

  // Winners vs losers: dumbbells on a shared scale per row.
  const dumb = st.habits.map((h) => {
    const max = h.unit === '%' ? 100 : Math.max(1, Math.ceil(Math.max(h.winners, h.losers) * 1.25));
    const xw = (100 * h.winners) / max, xl = (100 * h.losers) / max;
    const [lo, hi] = [Math.min(xw, xl), Math.max(xw, xl)];
    return `<div class="db-row" title="${esc(h.note)}">
      <div class="db-label"><b>${esc(h.label)}</b><small class="muted">${esc(h.note)}</small></div>
      <div class="db-track"><span class="db-line" style="left:${lo}%;width:${hi - lo}%"></span>
        <span class="db-dot" style="left:${xl}%;background:${c.lose}" title="Losers: ${h.losers}${h.unit}"></span>
        <span class="db-dot" style="left:${xw}%;background:${c.win}" title="Winners: ${h.winners}${h.unit}"></span></div>
      <div class="db-vals mono"><span style="color:var(--text)">${h.winners}${h.unit}</span> <span class="muted">vs ${h.losers}${h.unit}</span></div>
    </div>`;
  }).join('');

  const shapeRows = st.shapes.map((sh) => {
    const max = Math.max(...st.shapes.flatMap((x) => [x.winners, x.losers]));
    return `<div class="gb-row"><div class="gb-label">${esc(sh.label)}</div><div class="gb-bars">
      <span style="width:${(100 * sh.winners) / max}%;background:${c.win}" title="Winners: ${sh.winners} per game"></span>
      <span style="width:${(100 * sh.losers) / max}%;background:${c.lose}" title="Losers: ${sh.losers} per game"></span></div>
      <div class="gb-vals mono">${sh.winners} <span class="muted">/ ${sh.losers}</span></div></div>`;
  }).join('');

  // Heatmaps
  const H = st.heat, R0 = st.reach;
  // Smoothed over each point and its neighbours, so the broad pattern shows rather than noise.
  const smooth = (g, total) => (x, y) => {
    let sum = 0, w = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const yy = y + dy + R0, xx = x + dx + R0;
      if (yy < 0 || xx < 0 || yy > 2 * R0 || xx > 2 * R0) continue;
      const k = dx || dy ? 1 : 2;
      sum += g[yy][xx] * k; w += k;
    }
    return sum / w / total;
  };
  const wFreq = smooth(H.winners, H.winnerTotal);
  const lFreq = smooth(H.losers, H.loserTotal);
  let maxW = 0, maxD = 0;
  for (let y = -R0; y <= R0; y++) for (let x = -R0; x <= R0; x++) { maxW = Math.max(maxW, wFreq(x, y)); maxD = Math.max(maxD, Math.abs(wFreq(x, y) - lFreq(x, y))); }
  const name = (x, y) => coordName(x + 9, y + 9);
  const heatWin = heatSvg(R0, (x, y) => ({ t: wFreq(x, y) / maxW, title: `${name(x, y)}: ${H.winners[y + R0][x + R0]} winners' stones` }), { label: 'Where winners placed stones' });
  const heatDiff = heatSvg(R0, (x, y) => {
    const d = wFreq(x, y) - lFreq(x, y);
    return { t: d / maxD, title: `${name(x, y)}: winners ${H.winners[y + R0][x + R0]}, losers ${H.losers[y + R0][x + R0]}` };
  }, { diverging: true, label: 'Where winners played more than losers' });

  // Gold's second stone (folded to one eighth of the board)
  const sec = st.second;
  const maxSec = Math.max(...sec.map((x) => x.games));
  const secRows = sec.map((x) => `<div class="mt-row"><span class="mono">${x.dx} out${x.dy ? `, ${x.dy} across` : ', in line'}</span>
    <span class="mt-bar"><i style="width:${(100 * x.games) / maxSec}%;background:${c.gold}"></i></span>
    <span class="mono">${x.games} games · Gold won ${Math.round((100 * x.goldWins) / x.games)}%</span></div>`).join('');

  const maxOp = Math.max(...st.openings.map((x) => x.games));
  const opRows = st.openings.map((x) => `<a class="mt-row" href="#/review?tab=masters&o=${encodeURIComponent(x.name)}" title="${x.moves ? esc(x.moves.join(' ')) : 'Openings that fit none of the named lines'}">
    <span><b>${esc(x.name)}</b></span>
    <span class="mt-bar"><i style="width:${(100 * x.games) / maxOp}%;background:${c.gold}"></i></span>
    <span class="mono">${x.games} · Gold ${x.goldPct}%</span></a>`).join('');

  const pl = st.players;
  const plRows = pl.map((p) => `<tr>
    <td><a href="#/review?tab=masters&p=${encodeURIComponent(p.name)}">${esc(p.name)}</a></td>
    <td class="num mono">${p.wins}–${p.games - p.wins}</td>
    <td class="num"><span class="mt-bar small"><i style="width:${p.winPct}%;background:${c.win}"></i></span> <span class="mono">${p.winPct}%</span></td>
    <td class="num mono">${p.gold.wins}/${p.gold.games}</td><td class="num mono">${p.blue.wins}/${p.blue.games}</td>
    <td class="num mono">${p.style.aggression}%</td><td class="num mono">${p.capturesPerGame}</td>
    <td>${esc(p.style.label)}</td></tr>`).join('');

  app.innerHTML = `
    <div style="margin-bottom:14px">
      <div class="eyebrow">Review</div>
      <h1 style="font-size:28px;margin-top:4px">1983 World Championship</h1>
      <p class="muted" style="margin:6px 0 0;max-width:760px">What separated winners from losers across ${o.games} games between ${o.players} of the world's best players. Hover or tap any mark for its numbers.</p>
    </div>
    ${archiveTabs('masters')}
    ${mastersTabs('insights')}
    <div class="ins-kpis">
      <div class="card"><div class="eyebrow">Gold (moved first) won</div><div class="big-num">${o.goldPct}%</div><small class="muted">${o.goldWins} of ${o.games} games</small></div>
      <div class="card"><div class="eyebrow">Captured first, then won</div><div class="big-num">${f.firstCapture.winPct}%</div><small class="muted">of ${f.firstCapture.games} games with a capture</small></div>
      <div class="card"><div class="eyebrow">Made the first four, then won</div><div class="big-num">${f.firstFour.winPct}%</div><small class="muted">of ${f.firstFour.games} games</small></div>
      <div class="card"><div class="eyebrow">Ahead on captures at move 10</div><div class="big-num">${f.leadAt20.winPct}%</div><small class="muted">won, in ${f.leadAt20.games} games with a lead</small></div>
    </div>
    <div class="ins-grid">
      <section class="card ins-wide">
        <h2 style="font-size:20px">What winners do differently</h2>
        <p class="muted" style="margin:4px 0 12px;font-size:14px">Every game seen twice: once from the winner's side and once from the loser's. Winners force; losers react.</p>
        <div class="legend" style="margin-bottom:8px"><span><i style="background:${c.win}"></i>Winners</span><span><i style="background:${c.lose}"></i>Losers</span></div>
        ${dumb}
      </section>
      <section class="card">
        <h2 style="font-size:20px">Shapes built per game</h2>
        <p class="muted" style="margin:4px 0 12px;font-size:14px">Winners build threes and fours. Losers build pairs, which give the other side something to capture.</p>
        <div class="legend" style="margin-bottom:8px"><span><i style="background:${c.win}"></i>Winners</span><span><i style="background:${c.lose}"></i>Losers</span></div>
        ${shapeRows}
      </section>
      <section class="card">
        <h2 style="font-size:20px">How games ended</h2>
        <p class="muted" style="margin:4px 0 12px;font-size:14px">Masters resign as soon as a win can't be stopped. Average game: ${o.avgMoves} moves each. Winners captured ${f.capturesWinner} pairs a game, losers ${f.capturesLoser}.</p>
        ${segBar}
      </section>
      <section class="card">
        <h2 style="font-size:20px">Where winners played</h2>
        <p class="muted" style="margin:4px 0 8px;font-size:14px">Every stone the winners placed, within 6 points of the centre (ringed).</p>
        ${heatWin}${heatLegend(false)}
      </section>
      <section class="card">
        <h2 style="font-size:20px">Winners vs losers, point by point</h2>
        <p class="muted" style="margin:4px 0 8px;font-size:14px">Teal where winners put more of their stones than losers did, amber where losers did (smoothed over neighbouring points). The booklet records most games with Gold's second stone to the right of the centre, so the shape follows that layout: winners' extra stones run up and down through the centre, across the line of the opening.</p>
        ${heatDiff}${heatLegend(true)}
      </section>
      <section class="card">
        <h2 style="font-size:20px">Gold's second stone</h2>
        <p class="muted" style="margin:4px 0 12px;font-size:14px">Distance from the centre, counting mirror images together. Under the tournament rule it has to be at least 3 out.</p>
        ${secRows}
      </section>
      <section class="card">
        <h2 style="font-size:20px">Openings</h2>
        <p class="muted" style="margin:4px 0 12px;font-size:14px">Games per opening and how often Gold won. Tap one to see its games.</p>
        ${opRows}
      </section>
      <section class="card ins-wide" id="explorer">${explorerHtml(params.get('ex') || 'Wedge')}</section>
      <section class="card ins-wide">
        <h2 style="font-size:20px">Players</h2>
        <p class="muted" style="margin:4px 0 12px;font-size:14px">Every game each player played in this collection, including playoffs. "Forcing" is the share of their moves that made a threat.</p>
        <div style="overflow-x:auto"><table class="mini-table"><thead><tr><th>Player</th><th class="num">W–L</th><th class="num">Win %</th><th class="num">As Gold</th><th class="num">As Blue</th><th class="num">Forcing</th><th class="num">Caps/game</th><th>Style</th></tr></thead><tbody>${plRows}</tbody></table></div>
      </section>
    </div>`;
  const bindExplorer = () => $('#ex-op')?.addEventListener('change', (e) => {
    $('#explorer').innerHTML = explorerHtml(e.target.value);
    history.replaceState(null, '', `#/review?tab=masters&view=insights&ex=${encodeURIComponent(e.target.value)}`);
    bindExplorer();
  });
  bindExplorer();
}

function explorerHtml(name) {
  const named = Object.keys(OPENING_MOVES).filter((n) => (openingTree(n) || {}).games);
  if (!named.includes(name)) name = named[0];
  const t = openingTree(name);
  const c = VIZ();
  const top = t.next.slice(0, 3);
  const plyNo = (ply) => `${Math.floor(ply / 2) + 1}${ply % 2 ? '…' : '.'}`;
  const stones = t.prefixOffsets.map(([x, y], i) => ({ o: [x, -y], c: i % 2 === 0 ? 1 : 2 }))
    .concat(top.map((n) => ({ o: [n.offset[0], -n.offset[1]], c: n.ply % 2 === 0 ? 1 : 2, ring: true })));
  // Main line: follow the most played move while at least two games share it.
  const main = [];
  let node = { next: t.next };
  while (node.next.length && node.next[0].games >= 2 && main.length < 6) { node = node.next[0]; main.push(node); }
  const sideTo = top.length ? (top[0].ply % 2 === 0 ? 'Gold' : 'Blue') : '';
  return `
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:baseline">
      <h2 style="font-size:20px">Opening explorer</h2>
      <label class="sr-only" for="ex-op">Opening</label>
      <select id="ex-op" class="select">${named.map((n) => `<option ${n === name ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>
    </div>
    <p class="muted" style="margin:4px 0 12px;font-size:14px">What the masters played after the opening's defining moves (<span class="mono">${esc(t.prefix.join(' '))}</span>), with games turned to line up. ${t.games} games; Gold won ${t.goldPct}%.</p>
    <div class="ex-wrap">
      <div>${openingSvg(stones, 220)}<p class="muted" style="font-size:12px;margin:6px 0 0;text-align:center">Dashed rings: ${esc(sideTo)}'s most played next moves</p></div>
      <div>
        <table class="mini-table"><thead><tr><th>Next move (${esc(sideTo)})</th><th class="num">Games</th><th class="num">${esc(sideTo)} won</th><th>Example</th></tr></thead><tbody>
        ${t.next.slice(0, 6).map((n) => `<tr><td class="mono">${esc(n.move)}</td><td class="num mono">${n.games}</td>
          <td class="num"><span class="mt-bar small"><i style="width:${n.moverWinPct}%;background:${c.win}"></i></span> <span class="mono">${n.moverWinPct}%</span></td>
          <td><a href="#/review/wc83-${n.gameNumbers[0]}?at=${n.ply + 1}">Game ${n.gameNumbers[0]}</a></td></tr>`).join('')}
        </tbody></table>
        ${main.length ? `<p style="margin:12px 0 0;font-size:14px"><b>Main line:</b> <span class="mono">${main.map((m) => `${plyNo(m.ply)} ${m.move}`).join(' ')}</span> <span class="muted">(${main[main.length - 1].games} games got this far; the side that played the last move won ${main[main.length - 1].moverWinPct}%)</span></p>` : ''}
      </div>
    </div>`;
}

// Above a reviewed game: the lesson it belongs to (next lesson / try again), and its variations.
function reviewExtras(entry, originId) {
  let html = '';
  if (entry.lesson && !entry.master) {
    const lesson = getLesson(entry.lesson.id);
    if (lesson) {
      const nextL = nextLesson(lesson.id);
      const won = entry.result === 'win';
      const next = nextL ? `<a class="btn ${won ? 'primary' : ''}" href="#/learn/${encodeURIComponent(nextL.id)}">Next lesson: ${esc(nextL.title)} ${ICON.arrow}</a>` : '<a class="btn" href="#/learn">All lessons</a>';
      const again = `<button class="btn ${won ? '' : 'primary'}" type="button" data-lesson-again="${esc(lesson.id)}|${entry.lesson.step}">${won ? 'Play again' : 'Try again'}</button>`;
      html += `<section class="card lesson-panel">
        <div><div class="eyebrow">Lesson ${esc(lesson.id)} · practice game${entry.parent ? ' (variation)' : ''}</div>
          <p style="margin:4px 0 0">${won ? `You won${entry.parent ? '' : ', so the lesson is complete'}. Look through the key moments, then carry on.` : 'Look through the key moments to see where it turned, then try again.'}</p></div>
        <div class="row">${won ? next + again : again + next}<a class="btn" href="#/learn/${encodeURIComponent(lesson.id)}?s=${entry.lesson.step}">Back to the lesson</a></div>
      </section>`;
    }
  }
  if (entry.parent && !entry.master) {
    html += `<p class="muted" style="margin:0 0 12px;font-size:14px">This is a variation, replayed from move ${Math.floor((entry.fromPly || 0) / 2) + 1}. <a href="#/review/${encodeURIComponent(entry.parent)}">Open the original game</a></p>`;
  }
  const vars = saved.variationsOf(originId);
  if (vars.length) {
    html += `<details class="card variations" ${entry.parent ? '' : 'open'}><summary><b>Variations of this game</b> <span class="muted">${vars.length} · saved with this game, not counted as separate games</span></summary>
      <div class="game-list" style="margin-top:8px">${vars.map((v) => `<a class="game-row ${v.id === entry.id ? 'on' : ''}" href="#/review/${encodeURIComponent(v.id)}">
        <span class="stone ${v.you === P2 ? 'p2' : 'p1'}" aria-hidden="true" style="width:18px;height:18px"></span>
        <span class="gr-main"><b>From move ${Math.floor((v.fromPly || 0) / 2) + 1}</b><small class="muted">${esc(fmtDate(v.at))} · ${Math.ceil((v.moves.length - (v.fromPly || 0)) / 2)} new moves</small></span>
        <span class="pill ${v.result === 'win' ? 'win' : v.result === 'loss' || v.result === 'resigned' ? 'loss' : ''}">${esc(RESULT_LABEL[v.result] || v.result)}</span></a>`).join('')}</div></details>`;
  }
  return html;
}

let rv = null; // the review screen's state

function leaveReview() {
  if (!rv) return;
  document.removeEventListener('keydown', rv.onKey);
  rv.token++;
  rv = null;
}

function renderReview(id, params = new URLSearchParams()) {
  const isMaster = id.startsWith('wc83-');
  const entry = isMaster ? masterEntry(Number(id.slice(5)), params.get('side')) : saved.find(id);
  if (!reviewable(entry)) {
    app.innerHTML = `<div class="card stack" style="max-width:640px"><p style="margin:0">That game isn't available. Games played before the archive existed only kept their result.</p><a class="btn" href="#/review">Back to your games</a></div>`;
    return;
  }
  const variant = resolveVariant(entry.variantId, entry.options || {});
  setFrame(variant.boardSize || 19);
  const bot = LEVELS[entry.level] || LEVELS[1];
  const g = entry.master;
  const viewName = g ? (entry.you === P1 ? g.white : g.black) : 'You';
  const otherName = g ? (entry.you === P1 ? g.black : g.white) : bot.name;
  const names = { you: viewName, them: otherName };
  const labels = g
    ? { mine: `${viewName.split(' ').pop()}'s accuracy`, theirs: otherName.split(' ').pop(), chances: `${viewName.split(' ').pop()}'s winning chances`, none: `No big mistakes by ${viewName.split(' ').pop()}.`, retry: 'Play on from here (vs Vega)' }
    : { mine: 'Your accuracy', theirs: bot.name, chances: 'Your winning chances', none: 'No mistakes big enough to count as key moments. Well played.', retry: 'Retry from here' };
  rv = { entry, variant, bot, names, labels, cursor: params.has('at') ? Math.max(0, Math.min(entry.moves.length, Number(params.get('at')) || 0)) : entry.moves.length, review: null, showBest: true, token: 1, onKey: null };

  const head = g ? `
    <div class="game-head" style="margin-bottom:12px">
      <a class="icon-btn" href="#/review?tab=masters" aria-label="Back to the 1983 games">${ICON.back}</a>
      <div class="title">
        <h1>${esc(g.white)} – ${esc(g.black)}</h1>
        <div class="eyebrow">1983 World Championship · Game ${g.n} · ${esc(roundOf(g.n))} · ${esc(openingOf(g.n))} · ${esc((g.winner === 'W' ? g.white : g.black).split(' ').pop())} won</div>
      </div>
    </div>
    <div class="filters" role="radiogroup" aria-label="Follow a player">
      <span class="muted" style="font-size:14px">Follow:</span>
      <a class="chip ${entry.you === P1 ? 'on' : ''}" href="#/review/${encodeURIComponent(id)}?side=W"><span class="stone p1" style="width:14px;height:14px;display:inline-block;vertical-align:-2px"></span> ${esc(g.white)}</a>
      <a class="chip ${entry.you === P2 ? 'on' : ''}" href="#/review/${encodeURIComponent(id)}?side=B"><span class="stone p2" style="width:14px;height:14px;display:inline-block;vertical-align:-2px"></span> ${esc(g.black)}</a>
    </div>
    ${g.note || g.uncertain ? `<p class="muted" style="margin:0 0 12px;font-size:13px">Note on the record: ${esc(g.note || '')}</p>` : ''}` : `
    <div class="game-head" style="margin-bottom:12px">
      <a class="icon-btn" href="#/review" aria-label="Back to your games">${ICON.back}</a>
      <div class="title">
        <h1>${esc(getVariant(entry.variantId).name)} vs ${esc(bot.name)}</h1>
        <div class="eyebrow">${esc(fmtDate(entry.at))} · ${esc(RESULT_LABEL[entry.result] || entry.result)} · you played ${entry.you === P2 ? 'Blue' : 'Gold'}</div>
      </div>
    </div>`;

  app.innerHTML = head + reviewExtras(entry, isMaster ? id : (entry.parent || entry.id)) + `
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
    box.innerHTML = `<h2 style="font-size:20px">Analysing the game</h2>
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
  // A retry is a variation of this game, not a new game: it is saved under the original.
  const origin = e.parent || e.id;
  if (e.master) {
    startGame({ variantId: 'pente', level: 4, side: e.you === P2 ? 'p2' : 'p1', coach: true, coachMode: last.coachMode || 'quiet', tournamentRule: true, capturePairs: 5 }, e.moves.slice(0, ply), { parent: origin });
    return;
  }
  startGame({
    variantId: e.variantId, level: e.level, side: e.you === P2 ? 'p2' : 'p1', coach: true,
    coachMode: last.coachMode || 'quiet', tournamentRule: (e.options || {}).tournamentRule !== false,
    capturePairs: (e.options || {}).capturePairs || 5,
  }, e.moves.slice(0, ply), { parent: origin, lesson: e.lesson ? { ...e.lesson, goal: 'variation' } : null, seat: e.seat, decisions: e.decisions });
}

function rvUpdate(full = false) {
  const r = rv;
  if (!r || !view) return;
  const { entry, review } = r;
  const n = entry.moves.length;
  const k = r.cursor;
  const state = replay(r.variant, entry.moves.slice(0, k));
  const m = k > 0 ? (review ? review.moves[k - 1] : { ply: k - 1, x: entry.moves[k - 1][0], y: entry.moves[k - 1][1], name: coordName(...entry.moves[k - 1]), isYou: moverOf(r.variant, k - 1) === (entry.you || P1) }) : null;
  const rings = m && m.cls ? [{ x: m.x, y: m.y, color: CLASS_COLOR[m.cls] }] : [];
  const showBest = m && m.best && m.cls && m.cls !== 'best' && r.showBest && state.board[m.best[1] * 19 + m.best[0]] === 0;
  view.render(state, { last: m ? [m.x, m.y] : null, rings, hints: showBest ? [m.best] : [] });
  $('#rv-counter').textContent = `${k} / ${n}`;

  // Move card
  const who = (mv) => (mv.isYou ? r.names.you : r.names.them);
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
        ${m.isYou && rank >= 3 ? `<button class="btn primary" type="button" id="rv-retry">${esc(rv.labels.retry)}</button>` : ''}
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
      const gold = moverOf(r.variant, i) === P1;
      const num = r.variant.twoStones ? '' : i % 2 === 0 ? `<span class="n">${i / 2 + 1}.</span>` : '';
      return `<button type="button" class="mv ${gold ? 'g' : 'b'}" data-ply="${i + 1}">${num}${dot}${coordName(mv[0], mv[1])}</button>`;
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
        <div><div class="eyebrow">${esc(r.labels.mine)}</div><div class="big-num">${review.accuracy ?? '—'}</div></div>
        <div><div class="eyebrow">${esc(r.labels.theirs)}</div><div class="big-num muted" style="font-size:24px">${review.theirAccuracy ?? '—'}</div></div>
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
      <div style="display:flex;justify-content:space-between;align-items:baseline"><h2 style="font-size:20px">${esc(r.labels.chances)}</h2><span class="muted" style="font-size:12px">tap to jump</span></div>
      <svg id="rv-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="width:100%;height:120px;margin-top:8px;cursor:pointer;display:block" role="img" aria-label="${esc(r.labels.chances)} through the game">
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
          <button class="btn primary" type="button" data-retry="${km.ply}">${esc(rv.labels.retry)}</button>
        </div>
      </div>`).join('') : `<p class="muted" style="margin:6px 0 0;font-size:14px">${esc(r.labels.none)}</p>`}`;
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
    ${COMING_LATER.length ? `<section class="card" style="margin-top:14px">
      <h2 style="font-size:20px">Coming later</h2>
      <ul class="rules">${COMING_LATER.map((c) => `<li><b>${esc(c.name)}:</b> ${esc(c.note)}</li>`).join('')}</ul>
    </section>` : ''}`;
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
          <b id="side-title">Your stones</b><div class="muted" id="side-sub" style="font-size:13px;margin-bottom:8px">Gold always moves first.</div>
          <div class="segmented" role="radiogroup" aria-label="Your stones">
            <label><input type="radio" name="side" value="p1" ${sel.side === 'p1' ? 'checked' : ''}><span id="side-p1">Gold · 1st</span></label>
            <label><input type="radio" name="side" value="p2" ${sel.side === 'p2' ? 'checked' : ''}><span id="side-p2">Blue · 2nd</span></label>
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
    const ch = v.config.choice;
    $('#side-title').textContent = ch ? 'Your seat' : 'Your stones';
    $('#side-sub').textContent = ch ? 'The opener sets up the first stones; the chooser then picks a colour.' : 'Gold always moves first.';
    $('#side-p1').textContent = ch ? 'Opener' : 'Gold · 1st';
    $('#side-p2').textContent = ch ? 'Chooser' : 'Blue · 2nd';
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
// A game started from the middle of another (Retry from here) is saved as a variation of it.
function archiveGame(g, result, reason) {
  const id = (g.startedAt || Date.now()).toString(36) + Math.random().toString(36).slice(2, 6);
  const choice = getVariant(g.variantId).config.choice || null;
  const setup = choice ? openingStatus(choice, g.moves.length, g.decisions || []).setup : 0;
  saved.add({
    id,
    variantId: g.variantId, options: g.options, you: g.you || (g.seat === 2 ? P2 : P1), level: g.level, result, reason,
    moves: g.moves, plies: g.moves.length, undos: g.undos || 0,
    startedAt: g.startedAt || null, at: Date.now(),
    lesson: g.lesson ? { id: g.lesson.id, step: g.lesson.step } : null,
    parent: g.parent || null, fromPly: g.parent ? g.fromPly : null,
    ...(choice ? { seat: g.seat || 1, decisions: g.decisions || [], setup } : {}),
  });
  return id;
}

function startGame(settings, initialMoves = [], meta = {}) {
  let you = settings.side === 'random' ? (Math.random() < 0.5 ? P1 : P2) : settings.side === 'p2' ? P2 : P1;
  // Choose-your-side openings: the side setting picks a seat (1 = opener, 2 = chooser);
  // your colour is only known once the opening has been decided.
  const choice = getVariant(settings.variantId).config.choice || null;
  let seat = null, decisions = [];
  if (choice) {
    seat = meta.seat || (you === P1 ? 1 : 2);
    decisions = (meta.decisions || []).slice();
    you = seatColour(choice, decisions, seat);
  }
  const options = { tournamentRule: settings.tournamentRule, capturePairs: settings.capturePairs };
  // A game left unfinished is kept in the archive rather than thrown away.
  const previous = store.get(KEYS.game, null);
  if (previous && previous.moves && previous.moves.length) archiveGame(previous, 'unfinished', null);
  const fresh = { variantId: settings.variantId, options, you, level: settings.level, coach: settings.coach, coachMode: settings.coachMode || 'quiet', moves: initialMoves.slice(), startedAt: Date.now(), lesson: meta.lesson || null, parent: meta.parent || null, fromPly: meta.parent ? initialMoves.length : null, ...(choice ? { seat, decisions } : {}) };
  store.set(KEYS.game, fresh);
  game = null;
  if (location.hash === '#/play') route(); else location.hash = '#/play';
}

function loadGame() {
  const cur = store.get(KEYS.game, null);
  if (!cur) return null;
  try {
    const variant = resolveVariant(cur.variantId, cur.options);
    const state = replay(variant, cur.moves);
    return {
      ...cur, state, variant, def: getVariant(cur.variantId), bot: LEVELS[cur.level] || LEVELS[1],
      preview: null, hover: null, warn: null, hints: [], notes: [], thinking: false, resignArmed: false, undos: cur.undos || 0,
      coachMode: cur.coachMode || 'quiet', revealed: false,
      choice: variant.choice || null, seat: cur.seat || null, decisions: (cur.decisions || []).slice(), judged: null,
    };
  } catch {
    store.del(KEYS.game);
    return null;
  }
}

function saveGame() {
  if (!game) return;
  store.set(KEYS.game, {
    variantId: game.variantId, options: game.options, you: game.you, level: game.level, coach: game.coach, coachMode: game.coachMode, lesson: game.lesson || null,
    parent: game.parent || null, fromPly: game.fromPly ?? null,
    moves: game.state.history.map((h) => [h.x, h.y]), startedAt: game.startedAt, undos: game.undos,
    ...(game.choice ? { seat: game.seat, decisions: game.decisions } : {}),
  });
}

// --- Whose turn is it? Normal play goes by colour; a choose-your-side opening goes by seat.

function openingNow(g) {
  return g.choice ? openingStatus(g.choice, g.state.history.length, g.decisions) : { phase: 'play', setup: 0 };
}

/** { who: 'you'|'bot', kind: 'move'|'place'|'decide', st } or null once the game is over. */
function turnOf(g) {
  const s = g.state;
  if (s.winner !== null) return null;
  const st = openingNow(g);
  if (st.phase === 'play') return { who: s.toMove === g.you ? 'you' : 'bot', kind: 'move', st };
  const mine = (st.by === 'opener') === (g.seat === 1);
  return { who: mine ? 'you' : 'bot', kind: st.phase, st };
}
/** Is it your turn to put a stone on the board (a move, or a set-up stone)? */
const myStone = (g) => { const t = turnOf(g); return !!t && t.who === 'you' && t.kind !== 'decide'; };
/** Your colour, or your seat's starting colour while the opening is undecided. */
const myColour = (g) => g.you || (g.seat === 2 ? P2 : P1);

/** Hand the turn to whoever is next. */
function nextTurn() {
  const g = game;
  if (!g) return;
  if (g.state.winner !== null) { finishGame(); return; }
  const t = turnOf(g);
  if (t.who === 'bot') { botTurn(); return; }
  refreshNotes();
  updateGame();
}

/** Your decision in a choose-your-side opening. */
function decide(choice) {
  const g = game;
  const t = turnOf(g);
  if (!t || t.kind !== 'decide' || t.who !== 'you' || !t.st.choices.includes(choice)) return;
  g.decisions.push(choice);
  g.judged = null;
  g.you = seatColour(g.choice, g.decisions, g.seat);
  saveGame();
  if (g.you) toast(`You play ${g.you === P1 ? 'Gold' : 'Blue'}.`);
  nextTurn();
}

function leaveGame() {
  gameToken++;
  if (game) game.thinking = false;
  view = null;
}

function renderGame() {
  game = loadGame();
  if (!game) { location.hash = '#/setup'; return; }
  setFrame(game.variant.boardSize || 19);
  gameToken++;
  const g = game;
  const optsBits = [];
  if (g.variant.opening === 'tournament') optsBits.push('Tournament rule');
  if (g.variant.opening === 'center' && g.def.config.opening === 'tournament') optsBits.push('No tournament rule');
  if (g.variantId === 'five-captures') optsBits.push(`${g.options.capturePairs} pairs`);
  if (g.choice) optsBits.push(g.seat === 1 ? 'You open' : 'You choose');

  app.innerHTML = `
    <div class="game-head" style="margin-bottom:12px">
      <a class="icon-btn" href="${g.lesson ? `#/learn/${encodeURIComponent(g.lesson.id)}?s=${g.lesson.step}` : '#/'}" aria-label="${g.lesson ? 'Back to the lesson' : 'Back to home'}">${ICON.back}</a>
      <div class="title">
        <h1>${esc(g.def.name)} vs ${esc(g.bot.name)}</h1>
        <div class="eyebrow">${esc([`Level ${g.level} · ${g.bot.title}`].concat(optsBits).join(' · '))}</div>
      </div>
      <a class="icon-btn" href="#/variants" aria-label="Rules for this variant">${ICON.book}</a>
    </div>
    ${g.lesson ? `<a class="lesson-banner" href="#/learn/${encodeURIComponent(g.lesson.id)}?s=${g.lesson.step}">${ICON.book}<span><b>Lesson ${esc(g.lesson.id)} practice:</b> ${esc(g.lesson.goal || 'win the game')}</span></a>` : ''}
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
          ${g.lesson ? `<button class="btn" type="button" id="btn-restart">${ICON.plus}<span>Restart</span></button>` : `<a class="btn" href="#/setup">${ICON.plus}<span>New</span></a>`}
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
  $('#btn-restart')?.addEventListener('click', () => {
    if (g.state.history.length > (g.parent ? g.fromPly : 0) + 1 && !confirm('Restart this practice game from the beginning?')) return;
    startLessonGame(g.lesson.id, g.lesson.step);
  });

  if (g.state.winner !== null) { updateGame(); showResult(); return; }
  nextTurn();
}

// --- Rendering the dynamic parts

function seatCard(mine) {
  const g = game;
  const t = turnOf(g);
  const active = t && (t.who === 'you') === mine;
  const role = (g.seat === 1) === mine ? 'Opener' : 'Chooser';
  const name = mine ? `You · ${role}` : `${g.bot.name} · ${role}`;
  let status = mine ? (active ? (t.kind === 'decide' ? 'Pick a side' : 'Your turn') : 'Waiting') : (active ? `<span class="thinking">Thinking</span>` : g.bot.title);
  return `
    <div class="player ${active ? 'active' : ''}">
      <span class="stone mixed" aria-hidden="true"></span>
      <div class="who"><div class="name">${esc(name)}</div><div class="status">${status}</div></div>
      <div class="counts">SIDE NOT CHOSEN</div>
    </div>`;
}

function playerCard(p) {
  const g = game, s = g.state, v = g.variant;
  const isYou = p === g.you;
  const active = s.winner === null && s.toMove === p;
  const name = isYou ? `You · ${p === P1 ? 'Gold' : 'Blue'}` : `${g.bot.name} · ${p === P1 ? 'Gold' : 'Blue'}`;
  const turnWord = v.twoStones && s.ply > 0 ? ` · stone ${firstOfTurn(v, s.ply) ? 1 : 2} of 2` : '';
  let status = isYou ? (active ? `Your turn${turnWord}` : 'Waiting') : (active ? `<span class="thinking">Thinking</span>` : g.bot.title);
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
    ghost: ghostAt && s.winner === null ? [ghostAt[0], ghostAt[1], s.toMove] : null,
    ghostWarn: !!(g.preview && g.warn && coachVisible(g)),
    threats: threatNote ? threatNote.points.slice(0, 4) : [],
    hints: g.hints,
  });
}

function updateGame() {
  if (!game || !view) return;
  const g = game, s = g.state;
  if (g.you) {
    const opp = other(g.you);
    $('#opp-phone').innerHTML = playerCard(opp);
    $('#opp-desk').innerHTML = playerCard(opp);
    $('#me').innerHTML = playerCard(g.you);
  } else {
    $('#opp-phone').innerHTML = seatCard(false);
    $('#opp-desk').innerHTML = seatCard(false);
    $('#me').innerHTML = seatCard(true);
  }

  renderBoard();

  // Coach (or, during a choose-your-side opening, the opening panel)
  const coach = $('#coach');
  const turn = turnOf(g);
  if (turn && turn.kind !== 'move') {
    coach.innerHTML = openingPanel(g, turn);
    coach.querySelectorAll('[data-choice]').forEach((b) => b.addEventListener('click', () => decide(b.dataset.choice)));
    $('#judge', coach)?.addEventListener('click', () => judgeOpening(g));
  } else if (!g.coach) {
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
  } else if (s.winner === null && !g.thinking && myStone(g)) {
    conf.innerHTML = `<div class="muted" style="font-size:12px;text-align:center">Tap a point to preview your move, then confirm. With a mouse, just click.</div>`;
  } else {
    conf.innerHTML = '';
  }

  // Buttons
  const floor = g.choice ? (turn && turn.kind === 'move' ? turn.st.setup : s.history.length) : 0;
  $('#btn-undo').disabled = g.thinking || s.history.length <= floor || (!g.choice && s.history.length === 1 && g.you === P2);
  $('#btn-hint').disabled = g.thinking || !turn || turn.who !== 'you' || turn.kind !== 'move';
  $('#btn-resign').disabled = s.winner !== null;
  const rb = $('#btn-resign');
  rb.classList.toggle('danger-armed', g.resignArmed);
  rb.querySelector('span').textContent = g.resignArmed ? 'Sure?' : 'Resign';

  // Move list
  const rows = [];
  const fmt = (h) => (h ? coordName(h.x, h.y) + (h.captured.length ? ` ×${h.captured.length}` : '') + (h.poofed.length ? ` poof${h.poofed.length}` : '') : '');
  if (g.variant.twoStones) {
    // Connect6: one row per round (Gold's turn, then Blue's), two stones a turn.
    const turns = [];
    s.history.forEach((h, i) => { if (firstOfTurn(g.variant, i)) turns.push([h]); else turns[turns.length - 1].push(h); });
    const t2 = (t) => (t ? t.map(fmt).join(' ') : '');
    rows.push(`<span class="n">1.</span><span>${t2(turns[0])}</span><span>${t2(turns[1])}</span>`);
    for (let i = 2; i < turns.length; i += 2) rows.push(`<span class="n">${i / 2 + 1}.</span><span>${t2(turns[i])}</span><span>${t2(turns[i + 1])}</span>`);
    if (!s.history.length) rows.length = 0;
  } else {
    for (let i = 0; i < s.history.length; i += 2) {
      rows.push(`<span class="n">${i / 2 + 1}.</span><span>${fmt(s.history[i])}</span><span>${fmt(s.history[i + 1])}</span>`);
    }
  }
  $('#moves').innerHTML = rows.join('') || '<span class="muted" style="grid-column:1/-1">No moves yet.</span>';
}

function refreshNotes() {
  const g = game;
  const t = turnOf(g);
  g.notes = g.coach && t && t.kind === 'move' ? analyse(g.state, g.you, g.bot.name) : [];
  g.revealed = false; // Quiet mode starts hidden again each turn.
}

// --- Input

function onBoardHover(x, y) {
  const g = game;
  if (!g || g.thinking || !myStone(g) || g.preview) return;
  const next = x === null || illegalReason(g.state, x, y) ? null : [x, y];
  if (String(next) === String(g.hover)) return;
  g.hover = next;
  renderBoard();
}

function onBoardPoint(x, y, pointerType) {
  const g = game;
  if (!g || g.thinking || !myStone(g)) return;
  const why = illegalReason(g.state, x, y);
  if (why) { toast(why); return; }
  if (pointerType === 'mouse') { placeMine(x, y); return; }
  if (g.preview && g.preview[0] === x && g.preview[1] === y) { placeMine(x, y); return; }
  g.preview = [x, y];
  g.warn = g.coach && turnOf(g).kind === 'move' ? previewWarning(g.state, x, y, g.bot.name) : null;
  updateGame();
}

function announce(rec, mover, whoOverride) {
  const who = whoOverride || (mover === game.you ? 'You' : game.bot.name);
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
  if (!g || g.thinking || !myStone(g)) return;
  if (illegalReason(g.state, x, y)) return;
  g.preview = null; g.hover = null; g.warn = null; g.hints = []; g.resignArmed = false;
  const mover = g.state.toMove;
  const rec = applyMove(g.state, x, y);
  saveGame();
  updateGame();
  announce(rec, mover, 'You');
  nextTurn();
}

async function botTurn() {
  const g = game;
  const turn = turnOf(g);
  if (turn && turn.kind !== 'move') { botOpening(g, turn); return; }
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
  else if (turnOf(g).who === 'bot') botTurn();
}

// The bot's part of a choose-your-side opening: set-up stones, Swap2's two extra stones, or a choice.
async function botOpening(g, turn) {
  const token = gameToken;
  g.thinking = true;
  updateGame();
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));
  try {
    if (turn.kind === 'place') {
      const action = turn.st.by === 'opener' ? 'setup' : 'more';
      const stones = await askOpening(g.state, action, { level: g.level });
      for (const [x, y] of stones) {
        await pause(380);
        if (token !== gameToken || game !== g) return;
        if (illegalReason(g.state, x, y)) break;
        const mover = g.state.toMove;
        const rec = applyMove(g.state, x, y);
        saveGame();
        renderBoard();
        announce(rec, mover, g.bot.name);
      }
    } else {
      const choice = await askOpening(g.state, 'decide', { choices: turn.st.choices, level: g.level });
      await pause(450);
      if (token !== gameToken || game !== g) return;
      g.decisions.push(choice);
      g.you = seatColour(g.choice, g.decisions, g.seat);
      saveGame();
      if (choice === 'more') toast(`${g.bot.name} added two stones. Now you pick a side.`);
      else if (g.you) toast(`${g.bot.name} took ${g.you === P1 ? 'Blue' : 'Gold'}, so you play ${g.you === P1 ? 'Gold' : 'Blue'}.`);
    }
  } catch (err) {
    console.error(err);
    toast('The bot hit a problem. Start a new game to try again.');
    g.thinking = false; updateGame();
    return;
  }
  if (token !== gameToken || game !== g) return;
  g.thinking = false;
  nextTurn();
}

/** The opening panel shown in place of the coach until the sides are settled. */
function openingPanel(g, turn) {
  const st = turn.st, s = g.state;
  const o = OPENINGS[g.choice];
  const total = st.setup;
  const name = o.name;
  if (turn.kind === 'place') {
    const k = s.history.length + 1;
    const colour = s.toMove === P1 ? 'Gold' : 'Blue';
    if (turn.who === 'bot') return `<div class="note"><div class="eyebrow">${esc(name)}</div><p class="muted">${esc(g.bot.name)} is setting up stone ${k} of ${total}…</p></div>`;
    const extra = st.by === 'chooser'
      ? 'You chose to add two stones. When they are down, your opponent picks a side, so keep it even.'
      : 'You place stones for both sides. Your opponent then picks a side, so set up a position you would be happy to play from either side.';
    return `<div class="note opening-note"><div class="eyebrow">${esc(name)} · stone ${k} of ${total}</div>
      <p>Place a <b>${colour}</b> stone${k === 1 && g.choice === 'swap2' ? ' on the centre point' : ''}.</p><p class="muted" style="margin-top:6px">${esc(extra)}</p></div>`;
  }
  // Decide
  if (turn.who === 'bot') return `<div class="note"><div class="eyebrow">${esc(name)}</div><p class="muted">${esc(g.bot.name)} is choosing a side…</p></div>`;
  const nextColour = s.toMove === P1 ? 'Gold' : 'Blue';
  const btns = st.choices.map((c) => {
    const l = CHOICE_LABELS[c];
    const sub = c === 'gold' || c === 'blue' ? ((c === 'gold') === (s.toMove === P1) ? 'You move next' : `${nextColour} moves next`) : l.sub;
    return `<button class="btn choice-btn ${c}" type="button" data-choice="${c}"><span class="stone ${c === 'more' ? 'mixed' : (c === 'gold' || c === 'swap') ? 'p1' : 'p2'}" aria-hidden="true"></span><span><b>${esc(l.title)}</b><small>${esc(sub)}</small></span></button>`;
  }).join('');
  const judged = g.judged === 'pending' ? '<p class="muted" style="margin-top:8px">Vega is looking…</p>'
    : g.judged !== null && g.judged !== undefined ? `<p style="margin-top:8px"><b>Vega:</b> ${esc(describeChances(g.judged))}</p>`
      : '<button class="link" type="button" id="judge">What does Vega think?</button>';
  return `<div class="note opening-note"><div class="eyebrow">${esc(name)} · your choice</div>
    <p>${g.seat === 2 && g.decisions.length === 0 ? `${esc(g.bot.name)} has set up the opening.` : 'The stones are down.'} Which side would you rather play?</p>
    <div class="choice-btns">${btns}</div>${judged}</div>`;
}

async function judgeOpening(g) {
  const token = gameToken;
  g.judged = 'pending';
  updateGame();
  const v = await askOpening(g.state, 'judge');
  if (token !== gameToken || game !== g) return;
  g.judged = v;
  updateGame();
}

function onUndo() {
  const g = game;
  if (!g || g.thinking) return;
  const t0 = turnOf(g);
  const floor = g.choice ? (t0 && t0.kind === 'move' ? t0.st.setup : g.state.history.length) : 0;
  if (g.state.history.length <= floor) return;
  undoMove(g.state);
  // Step back to your own turn (taking back the bot's reply and your move).
  while (g.state.history.length > floor && g.state.toMove !== g.you) undoMove(g.state);
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
  const t = g && turnOf(g);
  if (!g || g.thinking || !t || t.who !== 'you' || t.kind !== 'move') return;
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
  if (!g.you) g.you = myColour(g);
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
    lesson: g.lesson, parent: g.parent, fromPly: g.fromPly,
    seat: g.seat, decisions: g.decisions,
  }, result, s.winReason);
  store.del(KEYS.game);
  if (g.lesson && result === 'win' && !g.parent) completeLessonByGame(g.lesson.id, g.lesson.step);
  updateGame();
  showResult(result);
}

function showResult(result) {
  const g = game, s = g.state;
  if (!result) result = s.winner === g.you ? 'win' : s.winner === 0 ? 'draw' : 'loss';
  const won = result === 'win';
  const title = won ? 'You win!' : result === 'draw' ? 'Draw' : `${g.bot.name} wins`;
  const sub = REASONS[s.winReason] || '';
  const lesson = g.lesson ? getLesson(g.lesson.id) : null;
  const nextL = lesson ? nextLesson(lesson.id) : null;
  const tip = g.parent
    ? 'This was a variation of an earlier game, so it is saved with that game rather than as a new one.'
    : lesson
      ? (won ? `Practice complete: lesson ${lesson.id} is done. Review the game, then move on.` : 'Review the game to see where it turned, then try again.')
      : won
        ? (LEVELS[g.level + 1] ? `Ready for ${LEVELS[g.level + 1].name} (Level ${g.level + 1})?` : 'Try a variant that trains a different skill.')
        : 'Review the game to see where it turned.';
  const review = g.archivedId && s.ply > 0 ? `<a class="btn primary" href="#/review/${encodeURIComponent(g.archivedId)}">Review game</a>` : '';
  const nextBtn = lesson ? (nextL ? `<a class="btn" href="#/learn/${encodeURIComponent(nextL.id)}">Next lesson: ${esc(nextL.title)} ${ICON.arrow}</a>` : '<a class="btn" href="#/learn">All lessons</a>') : '';
  const againLabel = lesson ? (won ? 'Play again' : 'Try again') : 'Play again';
  const again = `<button class="btn" type="button" id="again">${againLabel}</button>`;
  const home = '<a class="btn" href="#/">Back to home</a>';
  let buttons;
  if (g.parent) buttons = [review, g.parent.startsWith('wc83-') ? `<a class="btn" href="#/review/${encodeURIComponent(g.parent)}">Back to the 1983 game</a>` : `<a class="btn" href="#/review/${encodeURIComponent(g.parent)}">Back to the original game</a>`, home];
  else if (lesson) buttons = won ? [review, nextBtn, again, home] : [review, again, nextBtn, home];
  else buttons = [review, again, '<a class="btn" href="#/setup">Change settings</a>', home];
  const wrap = document.createElement('div');
  wrap.className = 'result';
  wrap.innerHTML = `
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div class="eyebrow">${lesson ? `Lesson ${esc(lesson.id)} practice · ` : ''}${esc(g.def.name)} · ${s.ply} moves</div>
      <h2 id="result-title">${esc(title)}</h2>
      <p class="muted" style="margin:0">${esc(sub)}</p>
      <p style="margin:12px 0 0;font-size:14px">${esc(tip)}</p>
      <div class="row result-actions">${buttons.filter(Boolean).join('')}</div>
    </div>`;
  document.body.appendChild(wrap);
  const close = () => wrap.remove();
  $('#again', wrap)?.addEventListener('click', () => {
    close();
    if (lesson) { startLessonGame(lesson.id, g.lesson.step); return; }
    startGame({ variantId: g.variantId, level: g.level, side: g.choice ? (g.seat === 1 ? 'p1' : 'p2') : g.you === P1 ? 'p1' : 'p2', coach: g.coach, coachMode: g.coachMode,
      tournamentRule: g.options.tournamentRule, capturePairs: g.options.capturePairs });
  });
  wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
  window.addEventListener('hashchange', close, { once: true });
  ($('.btn.primary', wrap) || $('#again', wrap))?.focus();
}

// ---------------------------------------------------------------------------
route();
