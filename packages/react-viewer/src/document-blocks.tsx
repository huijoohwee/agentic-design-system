import React from 'react'
import '../../../site/viewer-surface.css'
import '../../../site/collection-layout.css'

export type CodeBlockHeaderProps = {
  language: string
  selector?: {
    value: string
    options: readonly { value: string; label: string }[]
    onChange: (language: string) => void
  }
  actions?: React.ReactNode
  actionsLabel?: string
}

export function CodeBlockHeader({ language, selector, actions, actionsLabel = 'Code block actions' }: CodeBlockHeaderProps) {
  return <header className="agentic-code-header">
    {selector ? <select className="agentic-code-language" aria-label="Code fence language" value={selector.value}
      onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}
      onMouseDown={event => event.stopPropagation()} onChange={event => selector.onChange(event.currentTarget.value)}>
      {selector.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select> : <span className="agentic-code-language">{language || 'text'}</span>}
    {actions && <menu className="agentic-code-actions" aria-label={actionsLabel}>{actions}</menu>}
  </header>
}

/** Children can contain syntax-highlighted tokens. Text and tokenization stay with the host. */
export function CodeBlockText({ children, wrap = false }: { children: React.ReactNode; wrap?: boolean }) {
  return <pre className="agentic-code-text" data-wrap={wrap || undefined}>{children}</pre>
}

export function CodeBlock({ children, wrap, ...header }: CodeBlockHeaderProps & { children: React.ReactNode; wrap?: boolean }) {
  return <figure className="agentic-code-frame">
    <CodeBlockHeader {...header} />
    <CodeBlockText wrap={wrap}><code>{children}</code></CodeBlockText>
  </figure>
}

export function TableToolbar({ children, label }: { children: React.ReactNode; label: string }) {
  return <section role="toolbar" aria-label={label} className="agentic-table-toolbar">{children}</section>
}

export function TableColumnHeader({ children, ...props }: Omit<React.ThHTMLAttributes<HTMLTableCellElement>, 'className'>) {
  return <th scope="col" {...props} className="agentic-table-column-header">{children}</th>
}
