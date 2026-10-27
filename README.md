# Agentic Design System

Public, static design-system catalog for [airvio.co/agentic-design-system](https://airvio.co/agentic-design-system/).

The catalog stays empty until each entry has a verified owner, source revision, license, attribution,
permission evidence, and digest. The site uses local assets, needs no server or database, and keeps its
catalog search in the browser.

## Verify

The GitHub Actions **Integration Gate** checks JavaScript syntax, the catalog contract, release profile,
license notices, and the public file allowlist. It uses Node.js only; no secrets or paid services are
required.

```sh
node scripts/check-public-release.mjs
```
