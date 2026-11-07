# Agentic Design System

Public, static design-system catalog for [airvio.co/agentic-design-system](https://airvio.co/agentic-design-system/).

The public catalog stays empty until each entry has a verified owner, source revision, license,
attribution, permission evidence, and digest. The local ownership map pins the four native source
repositories and keeps rights and adoption state explicit. External consumers remain source-mapped
until their owners review a migration; no adoption or cross-repository parity is implied.

Four candidate profiles hold 137 globally unique keys and CSS variables: Commerce has 36
product-scoped values, Base has 9 shared data-view values, Graph has 69 color, typography, and
font values across light, dark, and black modes, and Design System owns two shared icon sizes and the desktop/touch row heights shared with the Graph toolbar.
Profile bytes, source revisions, generated output,
rights, and consumer pins are checked independently. The exact Graph grant covers only its four
pinned token/typography files; the repository-wide private classification remains in force. No
consumer migration or whole-repository parity is claimed. Component behavior and icon artwork stay
with their native product owners; no copied Base component runtime is shipped.

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
