# Agentic Design System

Public, static design-system catalog for [airvio.co/agentic-design-system](https://airvio.co/agentic-design-system/).

The public catalog stays empty until each entry has a verified owner, source revision, license,
attribution, permission evidence, and digest. The local ownership map pins the four native source
repositories and keeps rights and adoption state explicit. External consumers remain source-mapped
until their owners review a migration; no adoption or cross-repository parity is implied.

Four candidate profiles centrally own Commerce, Base, Graph and shared interface tokens.
Profile bytes, source revisions, generated output, rights and consumer pins are checked independently.
The Graph grant covers its eight pinned token sources; the private classification remains in force
outside that scope. Consumers use immutable projections and native component behavior. Base owns the
shared KTV renderer and dropdown adapters; this registry supplies no copied component runtime.

The central Icon Library owns the verified artwork inventory. Shared interface roles own glyph size,
stroke, typography, responsive row/control geometry and icon presentation. Local appearance settings
show these roles read-only; glyph-scale and animation preferences stay explicit. Checks prove the
registered profiles and listed consumer pins, rather than whole-repository parity.

## Private archive

This public repository is canonical. `agentic-design-system-private-archive` is a private, frozen
history copy only; it is not a build or release source. See the [private archive policy](https://github.com/huijoohwee/agentic-os/blob/main/guides/PRIVATE-ARCHIVE-POLICY.md).

## Run locally

Node.js 20.11 or newer is required. The server uses Node.js built-ins; no install step or package
download is needed:

```sh
npm run dev
```

The server prints its local URL. It serves only the static site on `127.0.0.1`; the browser reads the
same catalog and pinned profile files used by the registry check. No backend or runtime network
service is used.

## Verify

The GitHub Actions **Integration Gate** checks JavaScript syntax, the catalog and owner-registry
contracts, singleton and override guards, strict content security policy, license notices, and the
public file allowlist. It uses Node.js only; no secrets or paid services are required.

```sh
node scripts/check-public-release.mjs
npm run check:design-system
```

For a local read-only MCP client, run `npm run mcp`; the process speaks newline-delimited JSON-RPC
over stdin/stdout and reads only the checked-in catalog. Browser WebMCP registration is a progressive
enhancement; regular search remains available when a browser does not expose that API.

The shared UI profile centrally owns body typography (14px/20px), font families, responsive KTV column tracks, icon sizes and row geometry. Consumers pin its generated projection; Graph retains the shared KTV React renderer.

KTV sizing adapts to the shared row container; the shared profile owns tracks, the stacking breakpoint and the default field-panel width. Consumer projections remain immutable local artifacts.

Dropdowns and textboxes reuse the generated `agentic-form-control` utility; native fields opt in through `agentic-form-controls`. Shared geometry is 28px desktop and 48px on coarse pointers or viewports up to 768px, with 8px inline padding, a 6px radius and body typography. Focus color stays with the local theme; native select behavior, labels, validation and Graph menu behavior stay with their existing owners.

Opened dropdown menus also reuse the generated shared surface, option, hover, selected, focus and touch styles. Base owns the neutral menu behavior and native/React adapters; this registry adds no runtime dependency on Base.

Icon presentation uses the same shared profile: stroke width, control padding, pills, badge chips and text consume central roles. Consumer settings show these roles read-only; saved local appearance classes cannot replace the owner. Glyph scale and animation remain explicit user preferences.

[Toolbar](site/toolbar.css) owns the compact navigation surface, action states and sticky dock. Use an accessible name on the navigation element and the shared `agentic-toolbar-item` class for links and buttons. For an icon-only action, add `data-icon-only`, give the button an accessible name and put `agentic-icon` on its SVG. Use [the shared icon helpers](site/toolbar-icons.js) to create native buttons or apply the same button props and glyph classes in a component host. Place floating actions directly in the dock with `data-dock-edge="start"` or `"end"`. The toolbar stays centered when either action is hidden. A dock sits below an open FloatingPanel. Graph retains its canvas placement.

FloatingPanel presentation is owned by [the portable shell](site/floating-panel.css). The existing Base class names are its markup contract: surface, inner column, header, scroll body, and close control. Base supplies the React adapter for Graph; native HTML consumers pin the same stylesheet. Use the optional dock for side placement, or let the host position the shell. Hosts own open/close, focus, drag, and domain actions. See **Components → Preview FloatingPanel** in the registry.
