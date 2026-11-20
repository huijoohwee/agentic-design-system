import test from 'node:test';
import assert from 'node:assert/strict';
import { createDashboardRenderer, createNativeDashboard } from '../site/dashboard.mjs';

const tree = createDashboardRenderer((tag, props, ...children) => ({ tag, props, children: children.filter(item => item != null) }));

test('Mission shell preserves slot ordering, optional regions and widget attributes', () => {
  const props = { beforeHeader: 'toolbar', title: 'Mission', hero: 'series', observation: 'Partial trace', overview: 'cards',
    insights: 'insights', metrics: 'count', sections: 'spans', children: 'footer', metricsAttributes: { 'data-widget': 'count' },
    sectionsAttributes: { 'data-widget': 'spans' }, 'data-source': 'fixture' };
  const shell = tree.DashboardCanvasLayout(props);
  const [toolbar, header, observation, overview, insights, metrics, sections, footer] = shell.children;
  assert.equal(shell.props['aria-label'], 'Dashboard content');
  assert.equal(shell.props['data-source'], 'fixture');
  assert.equal(shell.props['data-agentic-base-dashboard-layout'], 'true');
  assert.deepEqual([toolbar, header.children[1].children[0], observation.children[0], overview.children[0], insights,
    metrics.props['data-widget'], sections.props['data-widget'], footer], ['toolbar','series','Partial trace','cards','insights','count','spans','footer']);
  assert.equal(tree.DashboardCanvasLayout({title:'Ticket'}).children.length, 1);
});

test('Mission card content, keys and actions remain host supplied', () => {
  const eventTarget = {};
  const [list] = tree.DashboardCardGrid({ ariaLabel:'Evidence', cards:[{
    id:'observe', accent:'success', title:'Evaluation', actions:eventTarget,
  }] }).children;
  const [card] = list.children;
  assert.equal(list.props['data-columns'],3);
  assert.equal(card.props.key,'observe');
  assert.equal(card.props['data-accent'],'success');
  assert.deepEqual(card.children.map(node=>node.tag),['h3','div']);
  assert.equal(card.children[1].children[0],eventTarget);
});

test('native adapter moves host nodes and appends literal text', () => {
  const document = { createElement(tag) { return { tag, attrs:{}, children:[],
    setAttribute(name,value){ this.attrs[name]=value; }, append(value){this.children.push(value);} }; } };
  const { DashboardCanvasLayout, DashboardPrimitive } = createNativeDashboard(document);
  const heading = DashboardPrimitive({kind:'heading',level:1,children:'<literal>'});
  const shell = DashboardCanvasLayout({title:heading});
  assert.equal(shell.attrs.class, 'agentic-dashboard-layout agentic-base-dashboard-layout');
  assert.equal(shell.children[0].children[0].children[0], heading);
  assert.deepEqual(heading.children,['<literal>']);
});

test('range widget preserves intervals, handles a flat series and navigates the source index', async () => {
  const { createDashboardRange } = await import('../site/dashboard-range.mjs');
  const el = () => ({ children: [], dataset: {}, attrs: {}, append(...nodes) { this.children.push(...nodes); },
    setAttribute(key, value) { this.attrs[key] = value; }, focus() { this.focused = true; } });
  const document = { createElement: el, createElementNS: el };
  const first = { label: 'First', open: 5, high: 5, low: 5, close: 5 };
  const second = { label: 'Next', open: 5, high: 8, low: 3, close: 7 };
  let selected;
  const draw = points => createDashboardRange(document, { label: 'Observed range', points, onSelect: value => { selected = value; } });
  assert.throws(() => draw([]), RangeError);
  assert.throws(() => draw([{ ...first, low: 6 }]), RangeError);
  assert.throws(() => draw([{ ...first, open: NaN }]), RangeError);
  const flatLine = draw([first]).children[1].children[0].children[0].children[0].children[0];
  assert.equal(flatLine.attrs.y1, '50');
  const buttons = draw([first, second]).children[1].children[0].children;
  assert.deepEqual(buttons.map(button => button.tabIndex), [-1, 0]);
  buttons[1].onkeydown({ key: 'Home', preventDefault() {} });
  assert.equal(selected, first);
  assert.deepEqual(buttons.map(button => button.attrs['aria-pressed']), ['true', 'false']);
  assert.equal(buttons[0].focused, true);
  buttons[1].onclick();
  assert.equal(selected, second);
});
