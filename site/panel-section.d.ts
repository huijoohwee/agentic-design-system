export const PANEL_SECTION: Readonly<{
  section: string; header: string; title: string; actions: string; body: string; scroll: string
  defaultCollapsed: boolean; expand: string; collapse: string; expandAll: string; collapseAll: string
}>
export function recoverSectionFocus(body: Element | null, trigger: Element | null): void
export function isSectionGroupCollapsed(keys: readonly string[], collapsedKeys: ReadonlySet<string>): boolean
export function updateSectionGroup(previous: ReadonlySet<string>, key: string, collapsed: boolean): ReadonlySet<string>
export function setPanelSectionExpanded(section: HTMLDetailsElement, expanded: boolean): void
export function installPanelSections(root?: Document | Element): () => void
