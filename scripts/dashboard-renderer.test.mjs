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
