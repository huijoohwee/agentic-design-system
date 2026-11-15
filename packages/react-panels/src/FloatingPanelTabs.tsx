import React, { createContext, useContext, useId, useLayoutEffect, useRef } from 'react'
import type { FloatingPanelTabProps, FloatingPanelTabsProps } from '../../../site/floating-panel-contract'

type TabsContextValue = Pick<FloatingPanelTabsProps, 'activeKey' | 'onSelect'>
const TabsContext = createContext<TabsContextValue | null>(null)
const useBrowserLayoutEffect = typeof window === 'undefined' ? React.useEffect : useLayoutEffect

function revealSelectedTab(rail: HTMLElement) {
  const tab = rail.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]')
  if (!tab) return
  const railBounds = rail.getBoundingClientRect()
  const tabBounds = tab.getBoundingClientRect()
  const delta = tabBounds.left < railBounds.left ? tabBounds.left - railBounds.left
    : tabBounds.right > railBounds.right ? tabBounds.right - railBounds.right : 0
  if (delta) rail.scrollLeft += delta
}

/** One controlled tab rail; active state and navigation are shared across consumers. */
export function FloatingPanelTabs({ label, activeKey, onSelect, children, ...attributes }: FloatingPanelTabsProps) {
  const railRef = useRef<HTMLElement>(null)

  useBrowserLayoutEffect(() => {
    const rail = railRef.current
    if (!rail) return
    revealSelectedTab(rail)
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => revealSelectedTab(rail))
    observer.observe(rail)
    return () => observer.disconnect()
  }, [activeKey])

  const handleKeyDown: React.KeyboardEventHandler<HTMLElement> = event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const tabs = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'))
    if (!tabs.length) return
    const currentTab = (event.target as Element).closest<HTMLButtonElement>('[role="tab"]')
    const currentIndex = currentTab ? tabs.indexOf(currentTab) : -1
    const nextIndex = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
      : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
    event.preventDefault()
    tabs[nextIndex].focus()
    onSelect(tabs[nextIndex].dataset.agenticFloatingPanelTabKey ?? '')
  }

  return <TabsContext.Provider value={{ activeKey, onSelect }}>
    <nav {...attributes} ref={railRef} className="agentic-floating-panel-tabs" aria-label={label} aria-orientation="horizontal"
      role="tablist" onKeyDown={handleKeyDown}>{children}</nav>
  </TabsContext.Provider>
}

/** Tab selection is derived only from the parent rail's activeKey. */
export function FloatingPanelTab({ tabKey, label, id, ariaControls, disabled = false, icon: Icon, dataAttributes }: FloatingPanelTabProps) {
  const tabs = useContext(TabsContext)
  if (!tabs) throw new Error('FloatingPanelTab must be rendered inside FloatingPanelTabs')
  const generatedId = useId()
  const selected = tabs.activeKey === tabKey

  return <button {...dataAttributes} id={id ?? generatedId} type="button" role="tab" disabled={disabled}
    data-agentic-floating-panel-tab-key={tabKey} aria-controls={ariaControls} aria-selected={selected}
    aria-label={label} title={label} tabIndex={selected ? 0 : -1} className="agentic-floating-panel-tab"
    onClick={() => tabs.onSelect(tabKey)}>
    {Icon && <Icon aria-hidden="true" className="agentic-icon" focusable="false" />}
    <span>{label}</span>
  </button>
}
