// Shared SVG pieces for the Reversi and Hex boards: the glass stone gradients, the Greek-key
// frame and pointer handling, in the same style as the Pente board.

export const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

export const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};

/** Adds gradients, the key pattern and a shadow to `svg`; returns their url() references. */
export function addDefs(svg) {
  const id = 'g' + (++uid);
  const defs = el('defs', {}, svg);
  const grad = (gid, stops) => {
    const g = el('radialGradient', { id: gid, cx: '34%', cy: '28%', r: '75%' }, defs);
    for (const [o, c] of stops) el('stop', { offset: o, 'stop-color': c }, g);
  };
  grad(id + 'p1', [['0%', '#FFF6DA'], ['30%', '#F2C55C'], ['62%', '#D59A2A'], ['100%', '#9A6410']]);
  grad(id + 'p2', [['0%', '#E3EAFF'], ['28%', '#7D9BF2'], ['60%', '#3C5FD6'], ['100%', '#1B2F8C']]);
  const keyH = el('pattern', { id: id + 'kh', x: 0, y: 2, width: 12, height: 12, patternUnits: 'userSpaceOnUse' }, defs);
  el('path', { d: 'M0 10.5H10.5V1.5H2.5V7.5H7.5V4.5H5', fill: 'none', stroke: '#2E8C86', 'stroke-width': 1.2 }, keyH);
  const keyV = el('pattern', { id: id + 'kv', x: 2, y: 0, width: 12, height: 12, patternUnits: 'userSpaceOnUse' }, defs);
  el('path', { d: 'M10.5 0V10.5H1.5V2.5H7.5V7.5H4.5V5', fill: 'none', stroke: '#2E8C86', 'stroke-width': 1.2 }, keyV);
  const shadow = el('filter', { id: id + 'sh', x: '-30%', y: '-30%', width: '160%', height: '160%' }, defs);
  el('feDropShadow', { dx: 0, dy: 1.2, stdDeviation: 1.1, 'flood-color': '#141A3A', 'flood-opacity': 0.45 }, shadow);
  return { p1: `url(#${id}p1)`, p2: `url(#${id}p2)`, keyH: `url(#${id}kh)`, keyV: `url(#${id}kv)`, shadow: `url(#${id}sh)` };
}

/** The aqua frame with a Greek-key band, around a square area [x, y, w, h]. */
export function keyFrame(svg, refs, x, y, w, h) {
  el('rect', { x, y, width: w, height: h, rx: 14, fill: '#8ED6CF' }, svg);
  el('rect', { x: x + 14, y: y + 2, width: w - 28, height: 12, fill: refs.keyH }, svg);
  el('rect', { x: x + 14, y: y + h - 14, width: w - 28, height: 12, fill: refs.keyH }, svg);
  el('rect', { x: x + 2, y: y + 14, width: 12, height: h - 28, fill: refs.keyV }, svg);
  el('rect', { x: x + w - 14, y: y + 14, width: 12, height: h - 28, fill: refs.keyV }, svg);
}

/**
 * Pointer handling: `hit(svgX, svgY)` maps a point to a cell (or null); taps report 'touch',
 * clicks report 'mouse'.
 */
export function bindPointer(svg, hit, handlers) {
  const toSvg = (e) => {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const p = pt.matrixTransform(m.inverse());
    return hit(p.x, p.y);
  };
  svg.addEventListener('pointerup', (e) => {
    const c = toSvg(e);
    if (c !== null && c !== undefined) handlers.onCell(c, e.pointerType === 'mouse' ? 'mouse' : 'touch');
  });
  if (handlers.onHover) {
    svg.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') handlers.onHover(toSvg(e)); });
    svg.addEventListener('pointerleave', () => handlers.onHover(null));
  }
}
