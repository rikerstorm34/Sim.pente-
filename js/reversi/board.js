// Reversi board (SVG): 8×8 squares on the ivory board with the Greek-key frame.
import { el, addDefs, keyFrame, bindPointer } from '../games/svg.js';
import { N, EMPTY, GOLD, PASS } from './rules.js';

const S = 56;            // square size
const BAND = 16;         // key frame
const M = 22;            // label margin
const O = BAND + M;      // board origin
const TOTAL = O * 2 + S * N;
const R = 22;            // disc radius
const COLS = 'abcdefgh';
const cx = (c) => O + (c % N) * S + S / 2;
const cy = (c) => O + Math.floor(c / N) * S + S / 2;

export function createBoard(host, handlers) {
  const svg = el('svg', { viewBox: `0 0 ${TOTAL} ${TOTAL}`, class: 'board-svg', role: 'img' });
  const refs = addDefs(svg);
  keyFrame(svg, refs, 0, 0, TOTAL, TOTAL);
  el('rect', { x: BAND, y: BAND, width: TOTAL - BAND * 2, height: TOTAL - BAND * 2, rx: 4, fill: '#F7F5EE', stroke: '#2F44B0', 'stroke-width': 2 }, svg);
  const grid = el('g', { stroke: '#A3ABC6', 'stroke-width': 1.2, 'shape-rendering': 'crispEdges' }, svg);
  for (let i = 0; i <= N; i++) {
    el('line', { x1: O, y1: O + i * S, x2: O + N * S, y2: O + i * S }, grid);
    el('line', { x1: O + i * S, y1: O, x2: O + i * S, y2: O + N * S }, grid);
  }
  for (const [x, y] of [[2, 2], [6, 2], [2, 6], [6, 6]]) el('circle', { cx: O + x * S, cy: O + y * S, r: 3.6, fill: '#6E7899' }, svg);
  const labels = el('g', { fill: '#6E7899', 'font-size': 13, 'font-family': 'JetBrains Mono, monospace', 'text-anchor': 'middle' }, svg);
  for (let i = 0; i < N; i++) {
    el('text', { x: O + i * S + S / 2, y: BAND + 15 }, labels).textContent = COLS[i];
    el('text', { x: BAND + 11, y: O + i * S + S / 2 + 5 }, labels).textContent = String(i + 1);
  }
  const layers = { discs: el('g', {}, svg), marks: el('g', {}, svg) };
  host.appendChild(svg);
  bindPointer(svg, (x, y) => {
    const c = Math.floor((x - O) / S), r = Math.floor((y - O) / S);
    if (c < 0 || r < 0 || c >= N || r >= N) return null;
    return r * N + c;
  }, handlers);

  return {
    svg,
    setLabels(show) { labels.style.display = show ? '' : 'none'; },
    /**
     * @param {object} s  Reversi state
     * @param {object} ov { last, ghost, legal: [], hints: [], threats: [], rings: [{cell,color}], flipped: [] }
     */
    render(s, ov = {}) {
      layers.discs.replaceChildren();
      layers.marks.replaceChildren();
      for (let c = 0; c < N * N; c++) {
        const d = s.board[c];
        if (d === EMPTY) continue;
        el('circle', { cx: cx(c), cy: cy(c), r: R, fill: d === GOLD ? refs.p1 : refs.p2, filter: refs.shadow }, layers.discs);
      }
      const mk = layers.marks;
      for (const c of ov.flipped || []) el('circle', { cx: cx(c), cy: cy(c), r: R - 6, fill: 'none', stroke: '#FFFFFF', 'stroke-opacity': 0.55, 'stroke-width': 2, class: 'gone' }, mk);
      for (const c of ov.legal || []) el('circle', { cx: cx(c), cy: cy(c), r: 5, fill: '#1E7F79', opacity: 0.45 }, mk);
      if (ov.last !== undefined && ov.last !== null && ov.last !== PASS && s.board[ov.last] !== EMPTY) {
        el('circle', { cx: cx(ov.last), cy: cy(ov.last), r: 4.5, fill: '#FFFFFF', stroke: '#141A3A', 'stroke-opacity': 0.35, 'stroke-width': 0.8 }, mk);
      }
      for (const c of ov.threats || []) el('rect', { x: cx(c) - S / 2 + 4, y: cy(c) - S / 2 + 4, width: S - 8, height: S - 8, rx: 8, fill: 'none', stroke: '#D9661C', 'stroke-width': 2.6, 'stroke-dasharray': '5 4', class: 'pulse' }, mk);
      for (const c of ov.hints || []) el('circle', { cx: cx(c), cy: cy(c), r: R - 2, fill: 'rgba(142,214,207,0.35)', stroke: '#1E7F79', 'stroke-width': 2.6, class: 'pulse' }, mk);
      for (const r of ov.rings || []) el('circle', { cx: cx(r.cell), cy: cy(r.cell), r: R + 3, fill: 'none', stroke: r.color, 'stroke-width': 3 }, mk);
      if (ov.ghost !== undefined && ov.ghost !== null) {
        el('circle', { cx: cx(ov.ghost), cy: cy(ov.ghost), r: R, fill: s.toMove === GOLD ? refs.p1 : refs.p2, opacity: 0.55 }, mk);
        el('circle', { cx: cx(ov.ghost), cy: cy(ov.ghost), r: R + 3, fill: 'none', stroke: ov.ghostWarn ? '#D9661C' : '#2F44B0', 'stroke-width': 2.4 }, mk);
      }
      svg.setAttribute('aria-label', `Reversi board, ${s.history.length} moves played.`);
    },
  };
}
