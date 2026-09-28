// Enkla SVG-diagram utan bibliotek. Två linjer skiljs åt av linjemönster (heldragen/streckad), inte bara av färg.
const NS = 'http://www.w3.org/2000/svg';
const svg = (tag, attrs = {}, ...kids) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  kids.forEach((k) => el.append(k));
  return el;
};
const text = (attrs, content) => {
  const t = svg('text', attrs);
  t.textContent = content;
  return t;
};

export const SERIES_STYLE = {
  train: { name: 'Training', stroke: '#1b6b45', dash: '', width: 3 },
  validation: { name: 'Validation', stroke: '#22303c', dash: '8 5', width: 3 },
};

/**
 * series: [{ key: 'train'|'validation', values: number[] }] (ett värde per epok)
 * yMax: övre gräns på y-axeln. percent: visa som procent.
 */
export function lineChart({ series, yMax = 1, percent = true, title, description, marker = null }) {
  const W = 520;
  const H = 260;
  const m = { l: 52, r: 14, t: 14, b: 38 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const n = Math.max(...series.map((s) => s.values.length));
  const x = (i) => m.l + (n <= 1 ? 0 : (i / (n - 1)) * pw);
  const y = (v) => m.t + ph - (Math.min(v, yMax) / yMax) * ph;

  const root = svg('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': title, class: 'chart' });
  root.append(svg('title', {}), svg('desc', {}));
  root.firstChild.textContent = title;
  root.lastChild.textContent = description;

  // y-linjer och etiketter
  for (let k = 0; k <= 4; k++) {
    const v = (yMax * k) / 4;
    const label = percent ? `${Math.round(v * 100)} %` : v.toFixed(2).replace('.', ',');
    root.append(svg('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), stroke: '#d6dbd8', 'stroke-width': 1 }));
    root.append(text({ x: m.l - 8, y: y(v) + 4, 'text-anchor': 'end', class: 'chart-label' }, label));
  }
  // x-etiketter (epok)
  const ticks = n <= 10 ? Array.from({ length: n }, (_, i) => i) : [0, Math.round((n - 1) / 4), Math.round((n - 1) / 2), Math.round(((n - 1) * 3) / 4), n - 1];
  for (const i of [...new Set(ticks)]) {
    root.append(text({ x: x(i), y: H - 16, 'text-anchor': 'middle', class: 'chart-label' }, String(i + 1)));
  }
  root.append(text({ x: m.l + pw / 2, y: H - 2, 'text-anchor': 'middle', class: 'chart-label' }, 'Epok'));
  root.append(svg('line', { x1: m.l, x2: m.l, y1: m.t, y2: m.t + ph, stroke: '#5b6661', 'stroke-width': 1.5 }));
  root.append(svg('line', { x1: m.l, x2: W - m.r, y1: m.t + ph, y2: m.t + ph, stroke: '#5b6661', 'stroke-width': 1.5 }));

  for (const s of series) {
    const st = SERIES_STYLE[s.key];
    const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v ?? 0).toFixed(1)}`).join(' ');
    root.append(
      svg('polyline', {
        points: pts,
        fill: 'none',
        stroke: st.stroke,
        'stroke-width': st.width,
        'stroke-dasharray': st.dash,
        'stroke-linejoin': 'round',
        'stroke-linecap': 'round',
      }),
    );
  }
  if (marker) {
    // Ring runt en enskild punkt (t.ex. epoken med högst validation accuracy)
    const s = series.find((x) => x.key === marker.key);
    const v = s?.values[marker.index];
    if (v !== undefined && v !== null) {
      root.append(svg('circle', { cx: x(marker.index).toFixed(1), cy: y(v).toFixed(1), r: 7, fill: '#ffffff', stroke: '#22303c', 'stroke-width': 3 }));
      root.append(svg('circle', { cx: x(marker.index).toFixed(1), cy: y(v).toFixed(1), r: 2.5, fill: '#22303c' }));
    }
  }
  return root;
}

/** Teckenförklaring som vanlig HTML-text med små SVG-linjer. */
export function legend(h, { marker = false } = {}) {
  const markerItem = marker
    ? h('li', {}, svg('svg', { width: 20, height: 20, 'aria-hidden': 'true' }, svg('circle', { cx: 10, cy: 10, r: 7, fill: '#fff', stroke: '#22303c', 'stroke-width': 3 }), svg('circle', { cx: 10, cy: 10, r: 2.5, fill: '#22303c' })), ' Epok med högst validation accuracy (osäkert val)')
    : null;
  return h(
    'ul',
    { class: 'legend', 'aria-label': 'Teckenförklaring' },
    ...['train', 'validation'].map((k) => {
      const st = SERIES_STYLE[k];
      const sample = svg('svg', { width: 36, height: 10, 'aria-hidden': 'true' }, svg('line', { x1: 0, x2: 36, y1: 5, y2: 5, stroke: st.stroke, 'stroke-width': st.width, 'stroke-dasharray': st.dash }));
      return h('li', {}, sample, ` ${st.name} (${k === 'validation' ? 'streckad' : 'heldragen'} linje)`);
    }),
    markerItem,
  );
}
