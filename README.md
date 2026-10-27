# Agentic Design System

Public, static design-system catalog for [airvio.co/agentic-design-system](https://airvio.co/agentic-design-system/).

The catalog stays empty until each entry has a verified owner, source revision, license, attribution,
permission evidence, and digest. The site uses local assets, needs no server or database, and keeps its
catalog search in the browser.

## Private archive

This public repository is canonical. `agentic-design-system-private-archive` is a private, frozen
history copy only; it is not a build or release source. See the [private archive policy](https://github.com/huijoohwee/agentic-os/blob/main/guides/PRIVATE-ARCHIVE-POLICY.md).

## Verify

The GitHub Actions **Integration Gate** checks JavaScript syntax, the catalog contract, release profile,
license notices, and the public file allowlist. It uses Node.js only; no secrets or paid services are
required.

```sh
node scripts/check-public-release.mjs
```
