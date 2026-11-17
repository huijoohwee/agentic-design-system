export const KTV_CONTAINER_CLASS: 'agentic-ktv-container'
export const KTV_ROW_CLASS: 'agentic-ktv-row'
export const KTV_ROW_PARTS: readonly Readonly<{ slot: 'key' | 'type' | 'value'; tag: 'dt' | 'dd'; className: string }>[]
export function validateKeyTypeValueAlign(align: 'center' | 'start'): 'center' | 'start'
export type NativeKeyTypeValueRowOptions = {
  keyNode: Node | string | number
  typeNode: Node | string | number
  valueNode: Node | string | number
  id?: string
  dataKgAnchor?: string
  align?: 'center' | 'start'
  ownerDocument?: Document
}
export function createKeyTypeValueRow(options: NativeKeyTypeValueRowOptions): HTMLElement
