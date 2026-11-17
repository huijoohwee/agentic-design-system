import React, { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { attachMarkdownEditor, createMarkdownToolbar, type MarkdownToolbarOptions } from '../../../site/markdown.js'
import { createColorPalette, resolvePaletteColor, DEFAULT_COLOR_SWATCHES } from '../../../site/color.js'
import '../../../site/vendor/shared-ui-profile.css'
import '../../../site/toolbar.css'
import '../../../site/rich-text.css'

export type MarkdownToolbarProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> & Omit<MarkdownToolbarOptions, 'document'>
export function MarkdownToolbar({ onCommand, onInteractionStart, onInteractionEnd, commands, swatches, ...props }: MarkdownToolbarProps) {
  const root = useRef<HTMLDivElement>(null), latest = useRef({ onCommand, onInteractionStart, onInteractionEnd })
  latest.current = { onCommand, onInteractionStart, onInteractionEnd }
  useEffect(() => {
    const node = root.current
    if (!node) return
    const toolbar = createMarkdownToolbar({ document:node.ownerDocument, commands, swatches,
      onCommand:(...args)=>latest.current.onCommand(...args),
      onInteractionStart:()=>latest.current.onInteractionStart?.(), onInteractionEnd:()=>latest.current.onInteractionEnd?.() })
    node.append(toolbar.element)
    return () => toolbar.destroy()
  }, [commands, swatches])
  return <div {...props} ref={root} />
}
export type MarkdownEditorProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  onValueChange?:(value:string)=>void; onSlashCommand?:()=>void; onVariableCommand?:()=>void
}
export function MarkdownEditor({ onValueChange, onSlashCommand, onVariableCommand, ...props }: MarkdownEditorProps) {
  const field = useRef<HTMLTextAreaElement>(null), latest = useRef({ onValueChange, onSlashCommand, onVariableCommand })
  latest.current = { onValueChange, onSlashCommand, onVariableCommand }
  useEffect(() => {
    if (!field.current) return
    const mounted = attachMarkdownEditor(field.current, {
      ...(onSlashCommand ? { onSlashCommand:()=>latest.current.onSlashCommand?.() } : {}),
      ...(onVariableCommand ? { onVariableCommand:()=>latest.current.onVariableCommand?.() } : {}) })
    return () => mounted.destroy()
  }, [Boolean(onSlashCommand), Boolean(onVariableCommand)])
  return <div className="agentic-rich-text"><textarea {...props} ref={field} onInput={event=>{ props.onInput?.(event); latest.current.onValueChange?.(event.currentTarget.value) }} /></div>
}
export type ColorPaletteProps = {value:string;onValueChange:(value:string)=>void;swatches?:readonly string[]}
export function ColorPalette({ value, onValueChange, swatches }:ColorPaletteProps) {
  const root = useRef<HTMLDivElement>(null), current = useRef(onValueChange)
  current.current = onValueChange
  const palette = useRef<ReturnType<typeof createColorPalette>|null>(null)
  useEffect(() => {
    if (!root.current) return
    const mounted = createColorPalette(root.current,{value,onValueChange:next=>current.current(next),swatches})
    palette.current = mounted
    return () => { palette.current = null; mounted.destroy() }
  }, [swatches])
  useEffect(() => { palette.current?.update(value) }, [value])
  return <div className="agentic-rich-text" ref={root} />
}
export type ColorPickerOverlay = {anchorRef:React.RefObject<HTMLButtonElement|null>;onClose:()=>void;children:React.ReactNode}
export type ColorPickerProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'value'|'onChange'|'type'> & ColorPaletteProps & {
  renderOverlay?:(props:ColorPickerOverlay)=>React.ReactNode
  onOpenChange?:(open:boolean,id:string)=>void
  closeSignal?:unknown
}
export function ColorPicker({ value, onValueChange, swatches=DEFAULT_COLOR_SWATCHES, renderOverlay, onOpenChange, closeSignal, disabled, onClick, onKeyDown, className='', ...props }:ColorPickerProps) {
  const [open,setOpen] = useState(false), [inferredLabel,setInferredLabel] = useState('Colour')
  const anchorRef = useRef<HTMLButtonElement>(null), id = useId()
  const color = resolvePaletteColor(value) || '#000000', label = props['aria-label'] || props.title || inferredLabel
  const close = (focus=false) => { setOpen(false); onOpenChange?.(false,id); if(focus) anchorRef.current?.focus({preventScroll:true}) }
  useLayoutEffect(() => {
    const field=anchorRef.current?.labels?.[0] || anchorRef.current?.closest('dd')?.parentElement?.querySelector('dt')
    if(!field) return
    const copy=field.cloneNode(true) as Element
    copy.querySelectorAll('button,input,svg').forEach(node=>node.remove())
    setInferredLabel(copy.textContent?.trim() || 'Colour')
  })
  useEffect(()=>{ if(disabled) setOpen(false) },[disabled])
  useEffect(()=>{ setOpen(false) },[closeSignal])
  const show=()=>{ setOpen(true);onOpenChange?.(true,id) }
  const palette=<section id={`${id}-palette`} role="dialog" aria-modal="false" aria-label={`${label} palette`} className="agentic-color-palette"
    onClick={event=>event.stopPropagation()} onPointerDown={event=>event.stopPropagation()}
    onKeyDown={event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close(true)}}}>
    <header><strong>{label}</strong><button type="button" className="agentic-toolbar-item" onClick={()=>close(true)}>Done</button></header>
    <ColorPalette value={color} onValueChange={onValueChange} swatches={swatches} />
  </section>
  return <><button {...props} ref={anchorRef} type="button" disabled={disabled} value={color} aria-label={label} aria-haspopup="dialog" aria-expanded={open}
    aria-controls={open?`${id}-palette`:undefined} className={`agentic-color-picker-trigger ${className}`}
    onKeyDown={event=>{onKeyDown?.(event);if(event.defaultPrevented||!['Enter',' ','ArrowDown'].includes(event.key))return;event.preventDefault();event.stopPropagation();show()}}
    onClick={event=>{event.stopPropagation();onClick?.(event);if(event.defaultPrevented)return;if(open)close();else show()}}>
    <span role="img" aria-label={`Current colour ${color}`} style={{backgroundColor:color}} />
  </button>{open?(renderOverlay?renderOverlay({anchorRef,onClose:()=>close(),children:palette}):palette):null}</>
}
