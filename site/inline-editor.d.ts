export interface InlineEditorOptions {
  value: string
  label: string
  describedBy?: string
  onInput(value: string): void
  onCommit(): void
  onCancel(): void
}
export function mountInlineEditor(host: HTMLElement, options: InlineEditorOptions): {
  readonly input: HTMLInputElement
  destroy(): void
}
