export type ViewerSurfaceOptions = {
  editable?:boolean; activation?:'click'|'manual'; readValue?:(root:HTMLElement)=>string;
  onEditingChange?:(editing:boolean)=>void; onInput?:(value:string)=>void; onCommit?:(value:string)=>void;
  onCancel?:(state:{dirty:boolean;baseline:string})=>void;
};
export function attachViewerSurface(root:HTMLElement,options?:ViewerSurfaceOptions):{
  setEditing(editing:boolean,options?:{focus?:boolean}):void;commit():boolean|undefined;cancel():void;
  readonly editing:boolean;readonly dirty:boolean;destroy():void;
};
export function readViewerCaretRange(root:HTMLElement,point:{x:number;y:number}):{range:Range|null;supported:boolean};
export function applyViewerSelection(root:HTMLElement,range:Range,options?:{focus?:boolean}):boolean;
