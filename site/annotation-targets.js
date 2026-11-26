export const SELECTION_TARGET_ATTRIBUTE = 'data-selection-target';
export const SELECTION_TARGET_SELECTOR = `[${SELECTION_TARGET_ATTRIBUTE}]`;
export function assertAnnotationTargets(rootOrOptions = globalThis.document, options = {}) {
  const auditSchema = 'agentic-design-system/annotation-target-audit/v1';
  const hasRoot = typeof rootOrOptions?.querySelectorAll === 'function';
  const root = hasRoot ? rootOrOptions : globalThis.document;
  const { minTargets = 1, scrollIntoView = false } = hasRoot ? options : rootOrOptions ?? {};
  if (!Number.isSafeInteger(minTargets) || minTargets < 0) throw new TypeError('Minimum annotation target count must be non-negative');
  const visibleText = node => {
    if (node.nodeType === 3) return node.nodeValue ?? node.textContent ?? '';
    if (node.nodeType !== 1 || node.hidden || node.inert || node.getAttribute('aria-hidden') === 'true') return '';
    return [...node.childNodes].map(visibleText).join(' ');
  };
  const attribute = 'data-selection-target';
  const selector = `[${attribute}]`;
  const elements = [...root.querySelectorAll(selector)];
  if (root.matches?.(selector)) elements.unshift(root);
  const names = new Map();
  const targets = elements.map(element => {
    const name = element.getAttribute(attribute)?.trim() ?? '';
    names.set(name, (names.get(name) ?? 0) + 1);
    return { name, element };
  });
  const issues = [];
  const rows = targets.map(({ name, element }) => {
    const tag = element?.tagName?.toLowerCase() ?? '';
    const role = element?.getAttribute?.('role')?.trim().toLowerCase() ?? '';
    const itemIssues = [];
    if (!/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/u.test(name)) itemIssues.push('invalid-target-name');
    if ((names.get(name) ?? 0) !== 1) itemIssues.push('duplicate-target-name');
    if (!element || typeof element.getAttribute !== 'function' || typeof element.hasAttribute !== 'function') {
      itemIssues.push('invalid-target-element');
      return { name, tag, accessibleName: '', ok: false, issues: itemIssues };
    }
    if (tag === 'div' || tag === 'span') itemIssues.push('generic-target-element');
    const nativeInteractive = tag === 'button' || tag === 'a' && element.hasAttribute('href')
      || ['details', 'input', 'select', 'textarea', 'summary'].includes(tag) && element.getAttribute('type') !== 'hidden';
    const landmark = ['article', 'aside', 'figure', 'footer', 'header', 'main', 'nav'].includes(tag)
      || tag === 'section' && (role === 'region' || element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby'));
    if (!nativeInteractive && !landmark) itemIssues.push('semantic-target-required');
    if (['generic', 'none', 'presentation'].includes(role)) itemIssues.push('presentation-role');

    const doc = element.ownerDocument ?? globalThis.document;
    let accessibleName = element.getAttribute('aria-label')?.trim() ?? '';
    if (!accessibleName && element.hasAttribute('aria-labelledby')) {
      accessibleName = element.getAttribute('aria-labelledby').split(/\s+/u)
        .map(id => doc?.getElementById(id)?.textContent?.trim() ?? '').filter(Boolean).join(' ');
    }
    if (!accessibleName) accessibleName = [...(element.labels ?? [])].map(label => label.textContent?.trim() ?? '').filter(Boolean).join(' ');
    if (!accessibleName) accessibleName = element.getAttribute('alt')?.trim() ?? '';
    if (!accessibleName) accessibleName = visibleText(element).trim();
    if (!accessibleName) itemIssues.push('accessible-name-required');

    if (scrollIntoView) {
      if (typeof element.scrollIntoView !== 'function') itemIssues.push('scroll-into-view-unavailable');
      else element.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
    }
    const bounds = element.getBoundingClientRect();
    if (!element.isConnected || !bounds.width || !bounds.height) itemIssues.push('no-visible-bounds');
    let visible = true;
    for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.hidden || ancestor.inert || ancestor.getAttribute('aria-hidden') === 'true') visible = false;
      const style = doc?.defaultView?.getComputedStyle(ancestor);
      if (style && (style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse'
        || Number.parseFloat(style.opacity) === 0)) visible = false;
    }
    if (doc?.defaultView?.getComputedStyle(element).pointerEvents === 'none') visible = false;
    if (!visible) itemIssues.push('hidden-or-not-hit-testable');
    const view = doc?.defaultView;
    const points = [
      [bounds.left + bounds.width / 2, bounds.top + bounds.height / 2],
      [bounds.left + bounds.width * 0.25, bounds.top + bounds.height * 0.25],
      [bounds.left + bounds.width * 0.75, bounds.top + bounds.height * 0.25],
      [bounds.left + bounds.width * 0.25, bounds.top + bounds.height * 0.75],
      [bounds.left + bounds.width * 0.75, bounds.top + bounds.height * 0.75],
    ];
    const visiblePoints = points.filter(([x, y]) => x >= 0 && y >= 0 && x < (view?.innerWidth ?? 0)
      && y < (view?.innerHeight ?? 0));
    const hitTestable = visible && visiblePoints.length > 0 && typeof doc?.elementFromPoint === 'function'
      && visiblePoints.some(([x, y]) => {
        const hit = doc.elementFromPoint(x, y);
        return hit === element || element.contains(hit);
      });
    if (visible && visiblePoints.length > 0 && typeof doc?.elementFromPoint !== 'function') itemIssues.push('hit-test-unavailable');
    if (visible && visiblePoints.length === 0) itemIssues.push('outside-viewport');
    if (!hitTestable) itemIssues.push('not-hit-testable');
    return { name, tag, accessibleName, ok: itemIssues.length === 0, issues: itemIssues };
  });
  for (const row of rows) issues.push(...row.issues.map(issue => `${row.name || '(unnamed)'}:${issue}`));
  const report = { schema: auditSchema, targetCount: rows.length,
    ok: issues.length === 0, targets: rows, issues };
  if (report.targetCount < minTargets) throw new Error(`Expected at least ${minTargets} annotation target(s); found ${report.targetCount}`);
  if (!report.ok) throw new Error(`Annotation targets violate the shared contract: ${report.issues.join(', ')}`);
  return report;
}
