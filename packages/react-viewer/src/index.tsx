import React from 'react'
import { attachViewerSurface, type ViewerSurfaceOptions } from '../../../site/viewer-surface.js'
import '../../../site/viewer-surface.css'
export type ViewerSurfaceProps = Omit<React.HTMLAttributes<HTMLElement>,'onInput'> & Omit<ViewerSurfaceOptions,'onInput'> & {
  as?:React.ElementType;editing?:boolean;surfaceRef?:(node:HTMLElement|null)=>void;
  resolveEditRoot?:(host:HTMLElement)=>HTMLElement;editorRef?:React.Ref<HTMLElement>;
  onInput?:React.FormEventHandler<HTMLElement>;
};
/** One mounted host in view and edit modes; mode changes never replace its rendered children. */
export const ViewerSurface=React.forwardRef<HTMLElement,ViewerSurfaceProps>(function ViewerSurface({as:Tag='article',editing,editable=true,activation='click',readValue,onEditingChange,onCommit,onCancel,surfaceRef,resolveEditRoot,editorRef,className='',children,...attributes},ref){
  const root=React.useRef<HTMLElement|null>(null),editRoot=React.useRef<HTMLElement|null>(null),controller=React.useRef<ReturnType<typeof attachViewerSurface>|null>(null)
  const latest=React.useRef({readValue,onEditingChange,onCommit,onCancel});latest.current={readValue,onEditingChange,onCommit,onCancel}
  const [localEditing,setLocalEditing]=React.useState(false),[generation,setGeneration]=React.useState(0)
  const active=editing??localEditing,wasActive=React.useRef(false),baselineHtml=React.useRef(''),renderedChildren=React.useRef(children)
  if(!active&&!wasActive.current)renderedChildren.current=children
  React.useLayoutEffect(()=>{
    if(!editRoot.current)return
    const mounted=attachViewerSurface(editRoot.current,{editable,activation,
      readValue:node=>latest.current.readValue?.(node)??node.textContent??'',
      onEditingChange:next=>{setLocalEditing(next);latest.current.onEditingChange?.(next)},
      onCommit:value=>latest.current.onCommit?.(value),
      ...(onCancel?{onCancel:state=>latest.current.onCancel?.(state)}:{})})
    controller.current=mounted
    return()=>{controller.current=null;mounted.destroy()}
  },[editable,activation,Boolean(onCancel),generation])
  React.useLayoutEffect(()=>{
    if(active&&!wasActive.current)baselineHtml.current=editRoot.current?.innerHTML??''
    const changed=wasActive.current&&!active&&editRoot.current?.innerHTML!==baselineHtml.current
    wasActive.current=active
    controller.current?.setEditing(active)
    if(changed){renderedChildren.current=children;setGeneration(value=>value+1)}
  },[active,children,generation])
  return <Tag key={generation} {...attributes} ref={(node:HTMLElement|null)=>{root.current=node;const target=node?(resolveEditRoot?.(node)??node):null;editRoot.current=target;surfaceRef?.(node);if(typeof editorRef==='function')editorRef(target);else if(editorRef)(editorRef as React.MutableRefObject<HTMLElement|null>).current=target;if(typeof ref==='function')ref(node);else if(ref)ref.current=node}}
    suppressContentEditableWarning className={`agentic-viewer-surface ${className}`}>{renderedChildren.current}</Tag>
})
