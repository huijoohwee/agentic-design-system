import React from 'react'
import library from '../../../site/icons.json'
import { createDesignIcon } from '../../../site/toolbar-icons.js'

export const canvasTools = Object.freeze(library.canvasTools)
export type CanvasToolId = keyof typeof canvasTools

export function CanvasToolIcon({ tool, className }: { tool: CanvasToolId; className?: string }) {
  const host = React.useRef<HTMLSpanElement>(null)
  React.useLayoutEffect(() => {
    const element = host.current
    if (element) element.replaceChildren(createDesignIcon(canvasTools[tool].icon, element.ownerDocument))
  }, [tool])
  return <span ref={host} aria-hidden="true" className={className} />
}
