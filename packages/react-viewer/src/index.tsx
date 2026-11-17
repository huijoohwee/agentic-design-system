import React from 'react'
import { attachViewerSurface, type ViewerSurfaceOptions } from '../../../site/viewer-surface.js'
import '../../../site/viewer-surface.css'
export type ViewerSurfaceProps = Omit<React.HTMLAttributes<HTMLElement>,'onInput'> & Omit<ViewerSurfaceOptions,'onInput'> & {
  as?:React.ElementType;editing?:boolean;surfaceRef?:(node:HTMLElement|null)=>void;
  onInput?:React.FormEventHandler<HTMLElement>;
};
/** One mounted host in view and edit modes; mode changes never replace its rendered children. */
export const ViewerSurface=React.forwardRef<HTMLElement,ViewerSurfaceProps>(function ViewerSurface({as:Tag='article',editing,editable=true,activation='click',readValue,onEditingChange,onCommit,onCancel,surfaceRef,className='',children,...attributes},ref){
  const root=React.useRef<HTMLElement|null>(null),controller=React.useRef<ReturnType<typeof attachViewerSurface>|null>(null)
  const latest=React.useRef({readValue,onEditingChange,onCommit,onCancel});latest.current={readValue,onEditingChange,onCommit,onCancel}
  const [localEditing,setLocalEditing]=React.useState(false),[generation,setGeneration]=React.useState(0)
  const active=editing??localEditing,wasActive=React.useRef(false),baselineHtml=React.useRef(''),renderedChildren=React.useRef(children)
  if(!active&&!wasActive.current)renderedChildren.current=children
  React.useLayoutEffect(()=>{
    if(!root.current)return
    const mounted=attachViewerSurface(root.current,{editable,activation,
      readValue:node=>latest.current.readValue?.(node)??node.textContent??'',
      onEditingChange:next=>{setLocalEditing(next);latest.current.onEditingChange?.(next)},
      onCommit:value=>latest.current.onCommit?.(value),
      ...(onCancel?{onCancel:state=>latest.current.onCancel?.(state)}:{})})
    controller.current=mounted
    return()=>{controller.current=null;mounted.destroy()}
  },[editable,activation,Boolean(onCancel),generation])
  React.useLayoutEffect(()=>{
    if(active&&!wasActive.current)baselineHtml.current=root.current?.innerHTML??''
    const changed=wasActive.current&&!active&&root.current?.innerHTML!==baselineHtml.current
    wasActive.current=active
    controller.current?.setEditing(active)
    if(changed){renderedChildren.current=children;setGeneration(value=>value+1)}
  },[active,children,generation])
  return <Tag key={generation} {...attributes} ref={(node:HTMLElement|null)=>{root.current=node;surfaceRef?.(node);if(typeof ref==='function')ref(node);else if(ref)ref.current=node}}
    suppressContentEditableWarning className={`agentic-viewer-surface ${className}`}>{renderedChildren.current}</Tag>
})
