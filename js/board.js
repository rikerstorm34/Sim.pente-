// Draws the board as SVG and turns taps/clicks into board coordinates.
import { SIZE, CENTER, EMPTY, P1, P2, idx, coordName, frameSize } from './rules.js';

const NS = 'http://www.w3.org/2000/svg';
const CELL = 32;
const MARGIN = 31;           // room for coordinate labels
const BAND = 16;             // decorative Greek-key frame
const R = 13.5;              // stone radius
const COLS = 'ABCDEFGHJKLMNOPQRST';

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
const px = (i) => BAND + MARGIN + i * CELL;

export class BoardView {
  /**
   * @param {HTMLElement} host
   * @param {{ onPoint: (x:number, y:number, pointerType:string) => void, onHover?: (x:number|null, y:number|null) => void }} handlers
   */
  constructor(host, handlers) {
    this.host = host;
    this.handlers = handlers;
    // A smaller board (Renju, 15×15) is the middle of the 19×19 grid: the view is cropped to it.
    this.n = frameSize();
    this.off = (SIZE - this.n) / 2;
    const o = this.off * CELL, total = MARGIN * 2 + CELL * (this.n - 1) + BAND * 2;
    this.svg = el('svg', { viewBox: `${o} ${o} ${total} ${total}`, class: 'board-svg', role: 'img' });
    this.buildStatic();
    this.layers = {
      stones: el('g', {}, this.svg),
      marks: el('g', {}, this.svg),
      fx: el('g', {}, this.svg),
    };
    host.appendChild(this.svg);
    this.bindPointer();
  }

  buildStatic() {
    const defs = el('defs', {}, this.svg);
    const grad = (id, stops) => {
      const g = el('radialGradient', { id, cx: '34%', cy: '28%', r: '75%' }, defs);
      for (const [o, c] of stops) el('stop', { offset: o, 'stop-color': c }, g);
    };
    grad('gts-p1', [['0%', '#FFF6DA'], ['30%', '#F2C55C'], ['62%', '#D59A2A'], ['100%', '#9A6410']]);
    grad('gts-p2', [['0%', '#E3EAFF'], ['28%', '#7D9BF2'], ['60%', '#3C5FD6'], ['100%', '#1B2F8C']]);
    const keyH = el('pattern', { id: 'gts-keyH', x: 0, y: 2, width: 12, height: 12, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M0 10.5H10.5V1.5H2.5V7.5H7.5V4.5H5', fill: 'none', stroke: '#2E8C86', 'stroke-width': 1.2 }, keyH);
    const keyV = el('pattern', { id: 'gts-keyV', x: 2, y: 0, width: 12, height: 12, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M10.5 0V10.5H1.5V2.5H7.5V7.5H4.5V5', fill: 'none', stroke: '#2E8C86', 'stroke-width': 1.2 }, keyV);
    const shadow = el('filter', { id: 'gts-shadow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
    el('feDropShadow', { dx: 0, dy: 1.2, stdDeviation: 1.1, 'flood-color': '#141A3A', 'flood-opacity': 0.45 }, shadow);

    // Frame
    const n = this.n, off = this.off, o = off * CELL;
    const inner = MARGIN * 2 + CELL * (n - 1), total = inner + BAND * 2;
    el('rect', { x: o, y: o, width: total, height: total, rx: 14, fill: '#8ED6CF' }, this.svg);
    el('rect', { x: o + 14, y: o + 2, width: total - 28, height: 12, fill: 'url(#gts-keyH)' }, this.svg);
    el('rect', { x: o + 14, y: o + total - 14, width: total - 28, height: 12, fill: 'url(#gts-keyH)' }, this.svg);
    el('rect', { x: o + 2, y: o + 14, width: 12, height: total - 28, fill: 'url(#gts-keyV)' }, this.svg);
    el('rect', { x: o + total - 14, y: o + 14, width: 12, height: total - 28, fill: 'url(#gts-keyV)' }, this.svg);
    el('rect', { x: o + BAND, y: o + BAND, width: inner, height: inner, rx: 4, fill: '#F7F5EE', stroke: '#2F44B0', 'stroke-width': 2 }, this.svg);

    // Grid
    const lo = off, hi = off + n - 1;
    const grid = el('g', { stroke: '#A3ABC6', 'stroke-width': 1.1, 'shape-rendering': 'crispEdges' }, this.svg);
    for (let i = lo; i <= hi; i++) {
      el('line', { x1: px(lo), y1: px(i), x2: px(hi), y2: px(i) }, grid);
      el('line', { x1: px(i), y1: px(lo), x2: px(i), y2: px(hi) }, grid);
    }
    // Star points: the centre, plus the tournament-rule square (19×19) or the four corner points (15×15).
    const stars = n === SIZE ? [[6, 6], [6, 12], [12, 6], [12, 12]] : [[lo + 3, lo + 3], [lo + 3, hi - 3], [hi - 3, lo + 3], [hi - 3, hi - 3]];
    for (const [x, y] of [[CENTER, CENTER], ...stars]) {
      el('circle', { cx: px(x), cy: px(y), r: 3.6, fill: '#6E7899' }, this.svg);
    }
    // Labels
    this.labels = el('g', { class: 'board-labels', fill: '#6E7899', 'font-size': 10.5, 'font-family': 'JetBrains Mono, monospace', 'text-anchor': 'middle' }, this.svg);
    for (let i = 0; i < n; i++) {
      el('text', { x: px(lo + i), y: o + BAND + 14 }, this.labels).textContent = COLS[i];
      el('text', { x: px(lo + i), y: o + BAND + inner - 5 }, this.labels).textContent = COLS[i];
      el('text', { x: o + BAND + 10, y: px(lo + i) + 4 }, this.labels).textContent = String(n - i);
      el('text', { x: o + BAND + inner - 10, y: px(lo + i) + 4 }, this.labels).textContent = String(n - i);
    }
  }

  bindPointer() {
    const toPoint = (evt) => {
      const pt = this.svg.createSVGPoint();
      pt.x = evt.clientX; pt.y = evt.clientY;
      const m = this.svg.getScreenCTM();
      if (!m) return null;
      const p = pt.matrixTransform(m.inverse());
      const x = Math.round((p.x - BAND - MARGIN) / CELL);
      const y = Math.round((p.y - BAND - MARGIN) / CELL);
      if (x < this.off || y < this.off || x >= this.off + this.n || y >= this.off + this.n) return null;
      // Ignore taps far from any intersection (e.g. on the frame).
      if (Math.hypot(p.x - px(x), p.y - px(y)) > CELL * 0.75) return null;
      return [x, y];
    };
    this.svg.addEventListener('pointerup', (evt) => {
      if (evt.button !== undefined && evt.button > 0) return;
      const p = toPoint(evt);
      if (p) this.handlers.onPoint(p[0], p[1], evt.pointerType || 'mouse');
    });
    this.svg.addEventListener('pointermove', (evt) => {
      if (evt.pointerType !== 'mouse' || !this.handlers.onHover) return;
      const p = toPoint(evt);
      this.handlers.onHover(p ? p[0] : null, p ? p[1] : null);
    });
    this.svg.addEventListener('pointerleave', () => this.handlers.onHover && this.handlers.onHover(null, null));
  }

  /**
   * @param {object} s  game state
   * @param {{ ghost?: [number, number, number] | null, last?: [number, number] | null,
   *           threats?: number[][], hints?: number[][], ghostWarn?: boolean }} marks
   */
  render(s, marks = {}) {
    const { stones, marks: mk } = this.layers;
    stones.replaceChildren();
    mk.replaceChildren();
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      const c = s.board[idx(x, y)];
      if (c !== P1 && c !== P2) continue; // empty, or outside a smaller board
      el('circle', { cx: px(x), cy: px(y), r: R, fill: c === P1 ? 'url(#gts-p1)' : 'url(#gts-p2)', filter: 'url(#gts-shadow)' }, stones);
    }
    if (marks.last) {
      const [x, y] = marks.last;
      if (s.board[idx(x, y)] !== EMPTY) el('circle', { cx: px(x), cy: px(y), r: 3.4, fill: '#FFFFFF', stroke: '#141A3A', 'stroke-opacity': 0.35, 'stroke-width': 0.8 }, mk);
    }
    for (const [x, y] of marks.threats || []) {
      el('circle', { cx: px(x), cy: px(y), r: R - 1, fill: 'none', stroke: '#D9661C', 'stroke-width': 2.4, 'stroke-dasharray': '4 3', class: 'pulse' }, mk);
    }
    for (const [x, y] of marks.hints || []) {
      el('circle', { cx: px(x), cy: px(y), r: R - 1, fill: 'rgba(142,214,207,0.35)', stroke: '#1E7F79', 'stroke-width': 2.4, class: 'pulse' }, mk);
    }
    for (const r of marks.rings || []) {
      el('circle', { cx: px(r.x), cy: px(r.y), r: R + 3, fill: 'none', stroke: r.color, 'stroke-width': 3 }, mk);
    }
    if (marks.ghost) {
      const [x, y, who] = marks.ghost;
      el('circle', { cx: px(x), cy: px(y), r: R, fill: who === P1 ? 'url(#gts-p1)' : 'url(#gts-p2)', opacity: 0.55 }, mk);
      el('circle', { cx: px(x), cy: px(y), r: R + 2.5, fill: 'none', stroke: marks.ghostWarn ? '#D9661C' : '#2F44B0', 'stroke-width': 2.2 }, mk);
    }
    this.svg.setAttribute('aria-label', `Board, move ${s.ply + 1}. ${s.ply} stones placed.`);
  }

  /** Brief fading rings where stones were just removed, so captures are easy to follow. */
  flashRemoved(indexes, color) {
    for (const i of indexes) {
      const x = i % SIZE, y = (i - x) / SIZE;
      const c = el('circle', { cx: px(x), cy: px(y), r: R, fill: color, opacity: 0.85, class: 'gone' }, this.layers.fx);
      setTimeout(() => c.remove(), 1400);
    }
  }

  setLabels(show) {
    this.labels.style.display = show ? '' : 'none';
  }
}

export const pointName = (x, y) => coordName(x, y);
