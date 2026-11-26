import { contentSecurityPolicyHeaderName, validateContentSecurityPolicy } from 'agentic-os/content-security-policy';

const CSP_META_PATTERN = /<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)"\s*\/?\s*>/giu;

// Browser annotation overlays inject a shadow-root stylesheet; scope that exception to local HTML.
export function prepareLocalDevHtml(relativePath, contentType, body) {
  if (relativePath !== "index.html" || !contentType?.toLowerCase().startsWith("text/html")) return null;
  const html = Buffer.isBuffer(body) ? body.toString("utf8") : String(body);
  const policies = [...html.matchAll(CSP_META_PATTERN)];
  if (policies.length !== 1) throw new Error("Local HTML must contain exactly one production CSP meta policy");

  let policy;
  try { policy = validateContentSecurityPolicy(policies[0][1]); } catch {
    throw new Error("Local HTML must contain one valid production CSP policy");
  }
  const names = policy.split(";").map(value => value.trim().split(/\s+/u, 1)[0].toLowerCase());
  if (!names.includes("style-src") || names.includes("style-src-elem")
    || /(?:^|\s)'unsafe-inline'(?:\s|;|$)/iu.test(policy)) {
    throw new Error("Local annotation CSP requires one strict base policy without inline-style exceptions");
  }

  return {
    body: Buffer.from(html.replace(CSP_META_PATTERN, "")),
    headerName: contentSecurityPolicyHeaderName('report-only'),
    reportOnlyPolicy: validateContentSecurityPolicy(`${policy}; style-src-elem 'self' 'unsafe-inline'`),
  };
}
