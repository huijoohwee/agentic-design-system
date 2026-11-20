// A range uses a shared vertical scale. Native buttons expose each interval to
// pointer, touch and keyboard users without making the SVG itself interactive.
export function createDashboardRange(document, { label, points, formatValue = String, onSelect }) {
  if (!Array.isArray(points) || !points.length) throw new RangeError('Expected an observed range');
  let min = Infinity, max = -Infinity;
  for (const { label: interval, open, high, low, close } of points) {
    if (!interval || ![open, high, low, close].every(Number.isFinite) ||
        low > Math.min(open, close) || high < Math.max(open, close)) throw new RangeError('Invalid range interval');
    min = Math.min(min, low);
    max = Math.max(max, high);
  }
  const span = max - min;
  if (!Number.isFinite(span)) throw new RangeError('Range exceeds the supported numeric scale');
  const y = value => span === 0 ? 50 : 96 - 92 * ((value - min) / span);
  function element(tag, className, text) {
    const el = document.createElement(tag);
    el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function svg(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, String(value));
    return el;
  }
  const root = element('div', 'agentic-dashboard-range');
  const axis = element('div', 'agentic-range-axis agentic-mono-detail');
  axis.setAttribute('aria-hidden', 'true');
  for (const value of [max, min + span / 2, min]) axis.append(element('span', '', formatValue(value)));
  const timeline = element('div', 'agentic-range-timeline');
  const plot = element('div', 'agentic-range-plot');
  plot.setAttribute('role', 'toolbar');
  plot.setAttribute('aria-label', label);
  let current = points.length - 1;
  const buttons = points.map((point, i) => {
    const button = element('button', 'agentic-range-interval');
    button.type = 'button';
    button.tabIndex = i === current ? 0 : -1;
    button.setAttribute('aria-pressed', String(i === current));
    button.setAttribute('aria-label', point.label + ', open ' + formatValue(point.open) +
      ', high ' + formatValue(point.high) + ', low ' + formatValue(point.low) + ', close ' + formatValue(point.close));
    const graphic = svg('svg', { viewBox: '0 0 100 100', preserveAspectRatio: 'none', 'aria-hidden': true });
    graphic.append(svg('line', { x1: 50, x2: 50, y1: y(point.low), y2: y(point.high) }));
    const top = y(Math.max(point.open, point.close)), bottom = y(Math.min(point.open, point.close));
    graphic.append(svg('rect', { x: 27, width: 46, y: top, height: Math.max(0.8, bottom - top) }));
    button.dataset.direction = point.close >= point.open ? 'up' : 'down';
    button.append(graphic);
    button.onclick = () => select(i);
    button.onkeydown = event => {
      const next = { ArrowLeft: Math.max(0, i - 1), ArrowRight: Math.min(points.length - 1, i + 1),
        Home: 0, End: points.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      buttons[next].focus();
      select(next);
    };
    plot.append(button);
    return button;
  });
  function select(i) {
    buttons[current].tabIndex = -1;
    buttons[current].setAttribute('aria-pressed', 'false');
    current = i;
    buttons[i].tabIndex = 0;
    buttons[i].setAttribute('aria-pressed', 'true');
    onSelect?.(points[i], i);
  }
  const labels = element('div', 'agentic-range-labels agentic-text-detail');
  labels.setAttribute('aria-hidden', 'true');
  for (const point of points) labels.append(element('span', '', point.tickLabel ?? point.label));
  timeline.append(plot, labels);
  root.append(axis, timeline);
  return root;
}
