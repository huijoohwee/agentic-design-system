import React from 'react'
import { KTV_CONTAINER_CLASS, KTV_ROW_CLASS, KTV_ROW_PARTS, validateKeyTypeValueAlign, validateKeyTypeValueRows } from '../../../site/key-type-value.js'

export type KeyTypeValueRowProps = {
  keyNode: React.ReactNode; typeNode: React.ReactNode; valueNode: React.ReactNode
  align?: 'center' | 'start'; className?: string; keyClassName?: string; typeClassName?: string; valueClassName?: string
  id?: string; dataKgAnchor?: string; onClick?: () => void
}

export function KeyTypeValueContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`${KTV_CONTAINER_CLASS} ${className}`.trim()}>{children}</section>
}

/** Framework bridge: shared slot identities and tags remain in the native contract. */
export function KeyTypeValueRow({ keyNode, typeNode, valueNode, align = 'center', className = '', keyClassName = '', typeClassName = '', valueClassName = '', id, dataKgAnchor, onClick }: KeyTypeValueRowProps) {
  validateKeyTypeValueAlign(align)
  const content = { key: keyNode, type: typeNode, value: valueNode }
  const decorations = { key: keyClassName, type: typeClassName, value: valueClassName }
  return <KeyTypeValueContainer><dl id={id} data-panel-field-row="true" data-kg-anchor={dataKgAnchor} data-align={align}
    className={`${KTV_ROW_CLASS} ${className}`.trim()} onClick={onClick}>
    {KTV_ROW_PARTS.map(part => React.createElement(part.tag, { key: part.slot, className: `${part.className} ${decorations[part.slot]}`.trim() }, content[part.slot]))}
  </dl></KeyTypeValueContainer>
}

/** One existing KTV row per independent value; stable IDs preserve control state on reorder. */
export function KeyTypeValueRows({ rows }: { rows: readonly (KeyTypeValueRowProps & { id: string })[] }) {
  validateKeyTypeValueRows(rows)
  return <KeyTypeValueContainer>{rows.map(row => <KeyTypeValueRow {...row} key={row.id} />)}</KeyTypeValueContainer>
}
