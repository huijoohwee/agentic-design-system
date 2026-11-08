// Container thresholds are projected from the validated profile because CSS queries
// cannot read a custom property in their condition.
export function dashboardLayoutCss(profile) {
  const value = key => profile.tokens.find(token => token.key === key).value
  const medium = value('dashboard.breakpoint.medium')
  const wide = value('dashboard.breakpoint.wide')
  return `
.agentic-dashboard-layout {
  box-sizing: border-box; display: grid; align-content: start; grid-template-columns: minmax(0, 1fr);
  container: agentic-dashboard / inline-size; gap: var(--agentic-dashboard-section-gap);
  width: 100%; max-width: var(--agentic-dashboard-max-width); min-width: 0; margin-inline: auto;
  padding: var(--agentic-dashboard-inset); padding-block-start: var(--agentic-dashboard-top-inset, var(--agentic-dashboard-inset));
}
.agentic-dashboard-header {
  display: grid; grid-template-columns: minmax(0, 1fr); align-items: center;
  gap: var(--agentic-dashboard-card-gap); padding-block-end: var(--agentic-dashboard-card-gap);
  border-block-end: 1px solid var(--agentic-base-dashboard-border, var(--kg-border, ButtonBorder));
}
.agentic-dashboard-header > *, .agentic-dashboard-layout > *, .agentic-dashboard-grid > * { min-width: 0; }
.agentic-dashboard-hero { height: var(--agentic-dashboard-hero-height); }
.agentic-dashboard-observation { margin: 0; color: var(--agentic-base-dashboard-text-tertiary, var(--kg-text-tertiary, GrayText)); font-size: .75rem; }
.agentic-dashboard-sections > section { display: grid; grid-template-columns: minmax(0, 1fr); gap: var(--agentic-dashboard-inset); }
.agentic-dashboard-region { min-width: 0; container: agentic-dashboard-cards / inline-size; }
.agentic-dashboard-grid { display: grid; min-width: 0; grid-template-columns: minmax(0, 1fr); gap: var(--agentic-dashboard-card-gap); padding: 0; margin: 0; list-style: none; }
.agentic-dashboard-card {
  --agentic-dashboard-accent: var(--agentic-base-dashboard-border, var(--kg-border, ButtonBorder));
  border: 1px solid var(--agentic-dashboard-accent); border-radius: var(--agentic-control-radius); padding: var(--agentic-dashboard-card-gap);
}
.agentic-dashboard-card[data-accent="primary"] { --agentic-dashboard-accent: var(--agentic-dashboard-primary); }
.agentic-dashboard-card[data-accent="secondary"] { --agentic-dashboard-accent: var(--agentic-dashboard-secondary); }
.agentic-dashboard-card[data-accent="success"] { --agentic-dashboard-accent: var(--agentic-dashboard-success); }
.agentic-dashboard-card[data-accent]:where(:not([data-accent="neutral"],[data-accent="warning"])) { border-color: color-mix(in srgb, var(--agentic-dashboard-accent) 48%, transparent); }
.agentic-dashboard-eyebrow, .agentic-dashboard-description, .agentic-dashboard-detail { font-size: .75rem; line-height: 1rem; }
.agentic-dashboard-eyebrow { color: var(--agentic-dashboard-accent); }
.agentic-dashboard-description { padding-block: var(--agentic-control-padding-block); }
.agentic-dashboard-detail { padding-block-end: var(--agentic-control-padding-inline); }
.agentic-dashboard-actions { display: flex; flex-wrap: wrap; gap: var(--agentic-control-padding-inline); }
.agentic-dashboard-board { min-width: 0; container: agentic-dashboard-widgets / inline-size; }
.agentic-dashboard-rows { display: flex; flex-wrap: wrap; align-items: flex-start; }
.agentic-dashboard-cell { min-width: 0; width: 100%; flex: 0 0 100%; }
.agentic-dashboard-break { flex: 0 0 100%; height: 0; }
@container agentic-dashboard-widgets (min-width: ${medium}) {
  .agentic-dashboard-cell { width: var(--agentic-base-dashboard-column-width); flex-basis: var(--agentic-base-dashboard-column-width); }
}
@container agentic-dashboard-cards (min-width: ${medium}) {
  .agentic-dashboard-grid:is([data-columns="2"],[data-columns="4"]) { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container agentic-dashboard-cards (min-width: ${wide}) {
  .agentic-dashboard-grid[data-columns="3"] { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .agentic-dashboard-grid[data-columns="4"] { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
@container agentic-dashboard (min-width: ${wide}) {
  .agentic-dashboard-header:has(> .agentic-dashboard-hero) { grid-template-columns: minmax(0, 1fr) minmax(200px, 28%); }
  .agentic-dashboard-hero { height: var(--agentic-dashboard-hero-height-wide); }
}`
}
