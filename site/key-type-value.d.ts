export type FieldType = 'text' | 'number' | 'boolean' | 'datetime' | 'list' | 'object'
export function createFieldTypeIcon(type: FieldType, ownerDocument?: Document): HTMLSpanElement
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
/** One independently editable value per descriptor; IDs remain stable across updates. */
export function validateKeyTypeValueRows<T extends { id: string; align?: 'center' | 'start' }>(rows: readonly T[]): readonly T[]
export function createKeyTypeValueRows(options: {
  rows: readonly (Omit<NativeKeyTypeValueRowOptions, 'ownerDocument'> & { id: string })[]
  ownerDocument?: Document
}): HTMLElement
