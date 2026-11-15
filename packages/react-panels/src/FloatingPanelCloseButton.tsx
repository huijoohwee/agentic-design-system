import React from 'react'
import { PanelControlButton } from './PanelControlButton'
import type { FloatingPanelCloseButtonProps } from '../../../site/floating-panel-contract'

export type { FloatingPanelCloseButtonProps } from '../../../site/floating-panel-contract'

/** Store-free close control using the canonical semantic role. */
export function FloatingPanelCloseButton({ onClose, disabled = false }: FloatingPanelCloseButtonProps) {
  return <PanelControlButton control="close" onAction={onClose} disabled={disabled} />
}
