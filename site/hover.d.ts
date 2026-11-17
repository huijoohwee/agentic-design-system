export type HoverOptions = {
  id?: string; content?: string | number | Node; open?: boolean; interactive?: boolean
  maxWidthPx?: number; maxWidthFromPrevSibling?: boolean; widthRole?: 'label'
  contentClassName?: string; contentStyle?: Record<string, string | number | null | undefined>
  contentOffset?: { x: number; y: number } | null
  contentSize?: { width: number; height?: number } | null
  contentDataAttrs?: Record<string, string | undefined>
  onContentMouseEnter?: () => void; onContentMouseLeave?: () => void
  onVisibilityChange?: (element: HTMLElement | null) => void
}
export type HoverController = {
  readonly element: HTMLElement; readonly contentElement: HTMLElement; readonly visible: boolean
  update(options: HoverOptions): void; reposition(): void; destroy(): void
}
export function createHoverPanel(anchor: Element, options?: HoverOptions): HoverController
export function dismissHoverPanels(ownerDocument?: Document): void
export function installHoverLabels(ownerDocument?: Document, options?: { fallbackAttribute?: string }): () => void
