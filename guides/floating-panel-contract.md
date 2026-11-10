# FloatingPanel shared contract

Agentic Design System owns the FloatingPanel prop types and the shared shell, tab, focus, icon-size, and icon-stroke visuals. The exact declarations live in `site/floating-panel-contract.d.ts`; the central stylesheet is `site/floating-panel.css`. Icons reuse the existing shared `.agentic-icon` class and its centrally owned size and stroke tokens.

Base owns the React rendering adapter. Graph, Commerce, and other products own tab content, icon artwork, actions, state, placement, and lifecycle. They consume the pinned contract and stylesheet without redefining tab layout, icon dimensions, shell colors, radius, or focus treatment.

`FloatingPanelPanelStyle` accepts positioning and sizing only. The shell root additionally accepts the named Base theme-token bridge properties. Shell and tab controls do not accept consumer classes, visual CSS overrides, icon-size props, stroke-width props, or arbitrary icon nodes. Tab props accept an icon component and product-owned data attributes. The close action uses Base's shared icon. Tabs use one selected state, keyboard navigation, and automatic scrolling to the selected tab. Mobile control sizing comes from the shared `--agentic-control-height` token; consumers do not add a panel-specific touch-size variant.

Consumer projections bind the exact Design System revision and file digests. Rollback restores those exact prior files and pins together. This source contract does not select package publication, deployment, or production activation.
