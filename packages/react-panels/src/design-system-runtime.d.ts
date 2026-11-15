/** Type bridge for the adjacent Design System-owned JavaScript runtime. */
declare module '*site/toolbar-icons.js' {
  export function updatePanelControlButton(
    button: HTMLButtonElement,
    control: string,
    options?: { action?: () => void; disabled?: boolean; pressed?: boolean },
  ): HTMLButtonElement

  export function updatePanelControlGroup(
    group: HTMLElement,
    options?: {
      actions?: Record<string, (() => void) | undefined>
      disabled?: Record<string, boolean | undefined>
      minimized?: boolean
      pinned?: boolean
    },
  ): HTMLElement
}

declare module '*.css'
