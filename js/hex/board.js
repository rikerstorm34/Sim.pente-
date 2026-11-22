// Hex board (SVG): a rhombus of hexagons with Gold's edges (top and bottom) and Blue's edges
// (left and right) marked in their colours.
import { el, addDefs, bindPointer } from '../games/svg.js';
import { EMPTY, GOLD, BLUE } from './rules.js';

const S = 20;                        // hexagon "radius" (centre to corner)
const W = Math.sqrt(3) * S;          // width of a hexagon
const LETTERS = 'abcdefghijklmnopqrs';

export function createBoard(host, handlers, options = {}) {
  const n = options.size || 9;
  const cx = (i) => { const r = Math.floor(i / n), c = i % n; return W * (c + r / 2); };
  const cy = (i) => 1.5 * S * Math.floor(i / n);
  const corner = (x, y, k) => { const a = (Math.PI / 180) * (60 * k - 90); return [x + S * Math.cos(a), y + S * Math.sin(a)]; };
  // Bounds
  const minX = -W / 2 - 34, maxX = W * (n - 1 + (n - 1) / 2) + W / 2 + 34;
  const minY = -S - 34, maxY = 1.5 * S * (n - 1) + S + 34;
  const svg = el('svg', { viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`, class: 'board-svg hex-svg', role: 'img' });
  const refs = addDefs(svg);
  // Edge bands: thick strokes along the outer edges of boundary cells.
  const edges = el('g', { 'stroke-linecap': 'round' }, svg);
  const seg = (i, k1, k2, color) => {
    const [x1, y1] = corner(cx(i), cy(i), k1), [x2, y2] = corner(cx(i), cy(i), k2);
    el('line', { x1, y1, x2, y2, stroke: color, 'stroke-width': 9 }, edges);
  };
  // corners k: 0 top, 1 upper-right, 2 lower-right, 3 bottom, 4 lower-left, 5 upper-left
  for (let c = 0; c < n; c++) { seg(c, 5, 0, '#E0A92B'); seg(c, 0, 1, '#E0A92B'); }
  for (let c = 0; c < n; c++) { const i = (n - 1) * n + c; seg(i, 2, 3, '#E0A92B'); seg(i, 3, 4, '#E0A92B'); }
  for (let r = 0; r < n; r++) { const i = r * n; seg(i, 3, 4, '#3C5FD6'); seg(i, 4, 5, '#3C5FD6'); }
  for (let r = 0; r < n; r++) { const i = r * n + n - 1; seg(i, 0, 1, '#3C5FD6'); seg(i, 1, 2, '#3C5FD6'); }
  const cells = el('g', {}, svg);
  const polys = [];
  for (let i = 0; i < n * n; i++) {
    const pts = [0, 1, 2, 3, 4, 5].map((k) => corner(cx(i), cy(i), k).join(',')).join(' ');
    polys.push(el('polygon', { points: pts, fill: '#F7F5EE', stroke: '#A3ABC6', 'stroke-width': 1.2 }, cells));
  }
  const labels = el('g', { fill: '#6E7899', 'font-size': 11, 'font-family': 'JetBrains Mono, monospace', 'text-anchor': 'middle' }, svg);
  for (let c = 0; c < n; c++) el('text', { x: cx(c), y: cy(c) - S - 12 }, labels).textContent = LETTERS[c];
  for (let r = 0; r < n; r++) el('text', { x: cx(r * n) - W / 2 - 14, y: cy(r * n) + 4 }, labels).textContent = String(r + 1);
  const layers = { stones: el('g', {}, svg), marks: el('g', {}, svg) };
  host.appendChild(svg);
  bindPointer(svg, (x, y) => {
    let best = null, bd = Infinity;
    for (let i = 0; i < n * n; i++) { const d = (cx(i) - x) ** 2 + (cy(i) - y) ** 2; if (d < bd) { bd = d; best = i; } }
    return bd <= (S * 0.95) ** 2 ? best : null;
  }, handlers);
  const R = S * 0.72;
  return {
    svg,
    setLabels(show) { labels.style.display = show ? '' : 'none'; },
    render(s, ov = {}) {
      layers.stones.replaceChildren();
      layers.marks.replaceChildren();
      const chain = new Set(ov.chain || []);
      for (let i = 0; i < n * n; i++) {
        polys[i].setAttribute('fill', chain.has(i) ? (s.board[i] === GOLD ? '#F6E2B0' : '#D5DEFA') : '#F7F5EE');
        const v = s.board[i];
        if (v === EMPTY) continue;
        el('circle', { cx: cx(i), cy: cy(i), r: R, fill: v === GOLD ? refs.p1 : refs.p2, filter: refs.shadow }, layers.stones);
      }
      const mk = layers.marks;
      if (ov.last !== undefined && ov.last !== null && ov.last >= 0 && s.board[ov.last] !== EMPTY) el('circle', { cx: cx(ov.last), cy: cy(ov.last), r: 3.4, fill: '#FFFFFF', stroke: '#141A3A', 'stroke-opacity': 0.35, 'stroke-width': 0.8 }, mk);
      for (const i of ov.threats || []) el('circle', { cx: cx(i), cy: cy(i), r: R, fill: 'none', stroke: '#D9661C', 'stroke-width': 2.4, 'stroke-dasharray': '4 3', class: 'pulse' }, mk);
      for (const i of ov.hints || []) el('circle', { cx: cx(i), cy: cy(i), r: R, fill: 'rgba(142,214,207,0.35)', stroke: '#1E7F79', 'stroke-width': 2.4, class: 'pulse' }, mk);
      for (const r of ov.rings || []) el('circle', { cx: cx(r.cell), cy: cy(r.cell), r: R + 3, fill: 'none', stroke: r.color, 'stroke-width': 3 }, mk);
      if (ov.ghost !== undefined && ov.ghost !== null && ov.ghost >= 0) {
        el('circle', { cx: cx(ov.ghost), cy: cy(ov.ghost), r: R, fill: s.toMove === GOLD ? refs.p1 : refs.p2, opacity: 0.55 }, mk);
        el('circle', { cx: cx(ov.ghost), cy: cy(ov.ghost), r: R + 2.5, fill: 'none', stroke: ov.ghostWarn ? '#D9661C' : '#2F44B0', 'stroke-width': 2.2 }, mk);
      }
      svg.setAttribute('aria-label', `Hex board ${n} by ${n}, ${s.history.length} moves played.`);
    },
  };
}

export { BLUE };
