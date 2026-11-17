import React from 'react'
import { createPortal } from 'react-dom'
import { createHoverPanel, installHoverLabels, type HoverController } from '../../../site/hover.js'
import '../../../site/vendor/shared-ui-profile.css'
import '../../../site/hover.css'

export type TooltipProps = {
  id?: string; anchorElement?: Element | null; content: React.ReactNode; children?: React.ReactNode
  className?: string; anchorStyle?: React.CSSProperties
  maxWidthFromPrevSibling?: boolean; maxWidthPx?: number
  contentClassName?: string; contentStyle?: React.CSSProperties; contentRef?: React.Ref<HTMLElement>
  contentOffset?: { x: number; y: number } | null; contentSize?: { width: number; height?: number } | null
  contentDataAttrs?: Record<string, string | undefined>; open?: boolean
  onContentMouseEnter?: () => void; onContentMouseLeave?: () => void; interactive?: boolean
}
const useLayout = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect
const assignRef = (ref: React.Ref<HTMLElement> | undefined, node: HTMLElement | null) => {
  if (typeof ref === 'function') ref(node)
  else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node
}

/** React owns content only. The native owner supplies placement, events, accessibility and disposal. */
export default function Tooltip(props: TooltipProps) {
  const generatedId = React.useId(), anchorRef = React.useRef<HTMLSpanElement | null>(null)
  const controller = React.useRef<HoverController | null>(null), latest = React.useRef(props)
  const [host, setHost] = React.useState<HTMLElement | null>(null), [visible, setVisible] = React.useState(false)
  latest.current = props
  useLayout(() => {
    const anchor = props.anchorElement || anchorRef.current
    if (!anchor) return
    let mounted = true
    const instance = createHoverPanel(anchor, {
      id: props.id || generatedId,
      onVisibilityChange: node => {
        assignRef(latest.current.contentRef, node)
        if (mounted) setVisible(Boolean(node))
      },
    })
    controller.current = instance; setHost(instance.contentElement)
    return () => { mounted = false; instance.destroy(); controller.current = null }
  }, [props.anchorElement, props.id, generatedId])
  useLayout(() => {
    controller.current?.update({
      open: props.open, interactive: props.interactive,
      maxWidthFromPrevSibling: props.maxWidthFromPrevSibling, maxWidthPx: props.maxWidthPx,
      contentClassName: props.contentClassName, contentStyle: props.contentStyle as Record<string, string | number | undefined>,
      contentOffset: props.contentOffset, contentSize: props.contentSize, contentDataAttrs: props.contentDataAttrs,
      onContentMouseEnter: () => latest.current.onContentMouseEnter?.(),
      onContentMouseLeave: () => latest.current.onContentMouseLeave?.(),
    })
  })
  useLayout(() => {
    assignRef(props.contentRef, controller.current?.visible ? controller.current.element : null)
    return () => assignRef(props.contentRef, null)
  }, [props.contentRef, host])
  useLayout(() => { controller.current?.reposition() }, [props.content, visible, host])
  return <>
    {!props.anchorElement && <span ref={anchorRef} className={['agentic-hover-anchor', props.className].filter(Boolean).join(' ')} style={props.anchorStyle}>{props.children}</span>}
    {host && visible ? createPortal(props.content, host) : null}
  </>
}

export function NativeTitleTooltip({ fallbackAttribute }: { fallbackAttribute?: string } = {}) {
  React.useEffect(() => installHoverLabels(document, { fallbackAttribute }), [fallbackAttribute])
  return null
}
