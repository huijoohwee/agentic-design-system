import React from 'react'
import type { FloatingPanelShellProps as CanonicalFloatingPanelShellProps } from '../../../site/floating-panel-contract'
import '../../../site/vendor/shared-ui-profile.css'
import '../../../site/toolbar.css'
import '../../../site/floating-panel.css'

type PlacementStyle = Pick<React.CSSProperties,
  | 'position' | 'inset' | 'insetBlock' | 'insetInline' | 'insetBlockStart' | 'insetInlineEnd'
  | 'top' | 'right' | 'bottom' | 'left' | 'zIndex'
>

/** Consumers may position the shared shell but cannot replace its canonical size or visuals. */
export type FloatingPanelShellProps = Omit<CanonicalFloatingPanelShellProps, 'rootStyle' | 'panelStyle'> & {
  rootStyle?: PlacementStyle
  panelStyle?: PlacementStyle
  theme?: 'system' | 'light' | 'dark'
}

/** One Design System shell for MainPanel, FloatingPanel, and BottomPanel content. */
export const FloatingPanelShell = React.forwardRef<HTMLElement, FloatingPanelShellProps>(function FloatingPanelShell({
  rootPlacement = 'flow', rootStyle, panelStyle, theme = 'system', ariaLabel = 'Floating panel', minimized = false,
  pinned = true, rowHeight, fieldLine, onHeaderPointerDown, onPointerDownCapture, onFocusCapture,
  panelLayer, header, children,
}, ref) {
  return <section className="agentic-base-floating-panel-root" style={{ ...rootStyle, colorScheme: theme === 'system' ? 'light dark' : theme }}
    data-agentic-floating-panel-placement={rootPlacement === 'flow' ? undefined : rootPlacement}
    data-agentic-base-panel-layer={panelLayer} onPointerDownCapture={onPointerDownCapture} onFocusCapture={onFocusCapture}>
    <aside ref={ref} className="agentic-base-floating-panel agentic-form-controls" style={panelStyle}
      data-agentic-base-floating-panel="true" data-agentic-base-panel-minimized={minimized ? 'true' : undefined}
      data-agentic-base-row-height={rowHeight} data-agentic-base-field-line={fieldLine}>
      <section className={['agentic-base-floating-panel-inner', minimized ? '' : 'agentic-base-floating-panel-expanded'].filter(Boolean).join(' ')}
        aria-label={ariaLabel}>
        <header className={['agentic-panel-header', 'agentic-base-floating-panel-header', !pinned ? 'agentic-base-floating-panel-draggable' : ''].filter(Boolean).join(' ')}
          onPointerDown={onHeaderPointerDown}>{header}</header>
        {minimized ? null : children}
      </section>
    </aside>
  </section>
})
