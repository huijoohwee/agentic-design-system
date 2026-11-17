import test from 'node:test'
import assert from 'node:assert/strict'
import {attachViewerSurface,readViewerCaretRange,applyViewerSelection} from '../site/viewer-surface.js'
function fixture(){
 const attrs=new Map(),events=new Map(),children=[{identity:'heading'},{identity:'table'}]
 const root={nodeType:1,children,textContent:'Rendered text',ownerDocument:{defaultView:{getSelection:()=>null}},focus(options){this.focusOptions=options},contains:()=>true,
 getAttribute:name=>attrs.get(name)??null,setAttribute:(name,value)=>attrs.set(name,value),removeAttribute:name=>attrs.delete(name),hasAttribute:name=>attrs.has(name),
 addEventListener:(name,fn)=>events.set(name,fn),removeEventListener:name=>events.delete(name)}
 Object.defineProperty(root,'innerHTML',{get:()=>'<h2>Rendered text</h2><table></table>',set:()=>assert.fail('activation must not write rendered HTML')})
 return {root,attrs,events,children}
}
test('activation preserves rendered nodes, HTML and source callbacks',()=>{
 const f=fixture();let writes=0;const surface=attachViewerSurface(f.root,{onCommit:()=>writes++})
 const html=f.root.innerHTML;surface.setEditing(true,{focus:true});assert.equal(f.root.children,f.children);assert.equal(f.root.innerHTML,html);assert.equal(writes,0)
 assert.equal(f.attrs.get('contenteditable'),'true');assert.deepEqual(f.root.focusOptions,{preventScroll:true});surface.commit();assert.equal(writes,0)
 surface.destroy();assert.equal(f.events.size,0);assert.equal(f.attrs.size,0)
})
test('only a changed input commits; no-op edits and repeated activation do not publish',()=>{
 const f=fixture(),values=[];const surface=attachViewerSurface(f.root,{onCommit:value=>values.push(value)})
 surface.setEditing(true);surface.setEditing(true);f.events.get('input')();surface.commit();assert.deepEqual(values,[])
 surface.setEditing(true);f.root.textContent='Changed';f.events.get('input')();assert.equal(surface.dirty,true);surface.commit();assert.deepEqual(values,['Changed'])
 surface.destroy();assert.throws(()=>surface.setEditing(true),/disposed/)
})
test('read-only and manual hosts keep product actions in their own owner',()=>{
 const f=fixture();const readonly=attachViewerSurface(f.root,{editable:false});readonly.setEditing(true);assert.equal(readonly.editing,false);readonly.destroy()
 const manual=attachViewerSurface(f.root,{activation:'manual'});f.events.get('click')({detail:1,target:{closest:()=>null}});assert.equal(manual.editing,false);manual.destroy()
})
test('interactive links and double click do not implicitly activate',()=>{
 const f=fixture(),s=attachViewerSurface(f.root);f.events.get('click')({detail:1,target:{closest:()=>({})}});assert.equal(s.editing,false)
 f.events.get('click')({detail:2,target:{closest:()=>null}});assert.equal(s.editing,false);s.destroy()
})
test('cancellation delegates source restoration without rewriting view DOM',()=>{
 const f=fixture(),cancel=[];const s=attachViewerSurface(f.root,{onCancel:state=>cancel.push(state)});s.setEditing(true);f.root.textContent='Draft';f.events.get('input')();s.cancel();assert.deepEqual(cancel,[{dirty:true,baseline:'Rendered text'}]);s.destroy()
})
test('caret fallbacks fail closed without replacing selection or content',()=>{
 const f=fixture();assert.deepEqual(readViewerCaretRange(f.root,{x:0,y:0}),{range:null,supported:false});assert.equal(applyViewerSelection(f.root,{}),false)
})
