import React, { useCallback, useEffect, useId, useRef, useState } from 'react'
import { PANEL_SECTION, recoverSectionFocus, isSectionGroupCollapsed, updateSectionGroup } from '../../../site/panel-section.js'
import { createDesignIcon } from '../../../site/toolbar-icons.js'
import '../../../site/vendor/shared-ui-profile.css'
import '../../../site/panel-section.css'

const classes = (...values: Array<string | false | undefined>) => values.filter(Boolean).join(' ')
export type SettingsSectionHeaderProps = Omit<React.HTMLAttributes<HTMLElement>, 'title' | 'children'> & {
  title: React.ReactNode; actions?: React.ReactNode; ariaLabel?: string; fontClassName?: string
  titleClassName?: string; actionsClassName?: string; stickyHeader?: boolean
}
export function SettingsSectionHeader({ title, actions, ariaLabel, fontClassName, className,
  titleClassName, actionsClassName, stickyHeader = false, ...props }: SettingsSectionHeaderProps) {
  return <header {...props} aria-label={ariaLabel ?? props['aria-label']} data-agentic-sticky={stickyHeader}
    className={classes(PANEL_SECTION.header, fontClassName, className)}>
    <section className={classes(PANEL_SECTION.title, titleClassName)}>{title}</section>
    {actions != null && <section className={classes(PANEL_SECTION.actions, actionsClassName)}>{actions}</section>}
  </header>
}
function SectionChevron() {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const host = ref.current
    if (!host) return
    const icon = createDesignIcon('ChevronDown', host.ownerDocument)
    host.append(icon)
    return () => icon.remove()
  }, [])
  return <span ref={ref} aria-hidden="true" />
}
export type CollapsibleSectionProps = {
  title: React.ReactNode; children: React.ReactNode; actions?: React.ReactNode
  defaultCollapsed?: boolean; collapsed?: boolean; onToggle?: (collapsed: boolean) => void
  id?: string; className?: string; headerClassName?: string; stickyHeader?: boolean
  stickyOffset?: string; flushTop?: boolean; toolbarAligned?: boolean
}
/** Mount on first expansion, then retain children and scroll positions until owner unmount. */
export function CollapsibleSection({ title, children, actions, defaultCollapsed = PANEL_SECTION.defaultCollapsed,
  collapsed, onToggle, id, className, headerClassName, stickyHeader = true, stickyOffset, flushTop = false,
}: CollapsibleSectionProps) {
  const generatedId = useId(), contentId = id || `section-${generatedId}`
  const [innerCollapsed, setInnerCollapsed] = useState(defaultCollapsed)
  const isCollapsed = collapsed ?? innerCollapsed
  const [hasExpanded, setHasExpanded] = useState(!isCollapsed)
  const body = useRef<HTMLElement>(null), trigger = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!isCollapsed) setHasExpanded(true)
    else recoverSectionFocus(body.current, trigger.current)
  }, [isCollapsed])
  const toggle = () => {
    if (isCollapsed === false) recoverSectionFocus(body.current, trigger.current)
    if (collapsed === undefined) setInnerCollapsed(!isCollapsed)
    onToggle?.(!isCollapsed)
  }
  return <section className={classes(PANEL_SECTION.section, className)} data-agentic-flush-top={flushTop}
    style={stickyOffset === undefined ? undefined : { '--agentic-section-offset': stickyOffset } as React.CSSProperties}>
    <SettingsSectionHeader stickyHeader={stickyHeader} className={headerClassName} actions={actions}
      title={<button ref={trigger} type="button" role="button" className="agentic-panel-section-toggle"
        aria-expanded={!isCollapsed} aria-controls={contentId} onClick={toggle}>
        <span>{title}</span><SectionChevron />
      </button>} />
    <section ref={body} id={contentId} hidden={isCollapsed} className={classes(PANEL_SECTION.body, isCollapsed && 'hidden')}>
      {hasExpanded || !isCollapsed ? children : null}
    </section>
  </section>
}
export type PanelDisclosureProps = Omit<React.DetailsHTMLAttributes<HTMLDetailsElement>, 'title' | 'onToggle' | 'open'> & {
  id: string; title: React.ReactNode; expanded: boolean; onExpandedChange: (expanded: boolean) => void
  summaryClassName?: string; stickyHeader?: boolean
}
/** Native disclosure for content that must be mounted before its first expansion. */
export function PanelDisclosure({ id, title, children, expanded, onExpandedChange, className,
  summaryClassName, stickyHeader = true, ...props }: PanelDisclosureProps) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (!expanded && ref.current) recoverSectionFocus(ref.current.querySelector(':scope > section'), ref.current.querySelector(':scope > summary'))
  }, [expanded])
  return <details {...props} ref={ref} id={id} data-agentic-section="" data-agentic-sticky={stickyHeader}
    className={classes(PANEL_SECTION.section, className)} open={expanded}
    onToggle={event => { if (event.currentTarget.open !== expanded) onExpandedChange(event.currentTarget.open) }}>
    <summary data-agentic-sticky={stickyHeader} className={classes(PANEL_SECTION.header, summaryClassName)}>{title}</summary>
    <section className={PANEL_SECTION.body}>{children}</section>
  </details>
}
export function PanelScrollRegion({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section tabIndex={0} {...props} className={classes(PANEL_SECTION.scroll, className)} />
}
export function useCollapsibleSectionGroup(visibleKeys: readonly string[]) {
  const [collapsedKeys, setCollapsedKeys] = useState<ReadonlySet<string>>(() => new Set())
  const allCollapsed = isSectionGroupCollapsed(visibleKeys, collapsedKeys)
  const expandAll = useCallback(() => setCollapsedKeys(previous => previous.size ? new Set<string>() : previous), [])
  const collapseAll = useCallback(() => setCollapsedKeys(previous => {
    const next = new Set(visibleKeys)
    return next.size === previous.size && isSectionGroupCollapsed(visibleKeys, previous) ? previous : next
  }), [visibleKeys])
  const setCollapsed = useCallback((key: string, value: boolean) => setCollapsedKeys(previous => updateSectionGroup(previous, key, value)), [])
  return { allCollapsed, expandAll, collapseAll, collapsedKeys, setCollapsed, setCollapsedKeys }
}
export type ExpandCollapseAllButtonProps = {
  allCollapsed: boolean; onExpandAll?: () => void; onCollapseAll?: () => void
  titleExpand?: string; titleCollapse?: string
}
export function ExpandCollapseAllButton({ allCollapsed, onExpandAll, onCollapseAll,
  titleExpand = PANEL_SECTION.expandAll, titleCollapse = PANEL_SECTION.collapseAll }: ExpandCollapseAllButtonProps) {
  const label = allCollapsed ? titleExpand : titleCollapse
  return <button type="button" className="agentic-toolbar-item" title={label} aria-label={label}
    disabled={allCollapsed ? !onExpandAll : !onCollapseAll} onClick={allCollapsed ? onExpandAll : onCollapseAll}>{label}</button>
}
