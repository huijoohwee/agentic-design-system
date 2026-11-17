export type MarkdownSelectionOffsets = { startOffset: number; endOffset: number }
export type MarkdownFormatAction = 'heading1'|'heading2'|'heading3'|'bold'|'italic'|'strike'|'inlineCode'|'link'|'bulletList'|'numberedList'|'blockquote'|'slashCommands'|'variableCommands'|'indent'|'outdent'|'underline'|'superscript'|'subscript'|'math'|'highlight'|'comment'|'clearFormatting'|'colorPalette'
export type MarkdownCommand = Readonly<{id: MarkdownFormatAction; label: string; glyph: string; wrap?: readonly [string,string]; prefix?:string}>
export type MarkdownFormatResult = {nextText:string;nextSelection:MarkdownSelectionOffsets}
export const MARKDOWN_COMMANDS: readonly MarkdownCommand[]
export function getMarkdownCommand(id:string): MarkdownCommand
export function markdownCommandMatches(query?:string): readonly MarkdownCommand[]
export function clampMarkdownSelection(text:string,selection?:Partial<MarkdownSelectionOffsets>):MarkdownSelectionOffsets
export function wrapMarkdownSelection(text:string,selection:MarkdownSelectionOffsets,left:string,right:string):MarkdownFormatResult
export function toggleHeadingAcrossLines(args:{text:string;level:number}):string
export function clearMarkdownFormatting(text:string):string
export function applyMarkdownFormatAction(args:{text:string;selection:MarkdownSelectionOffsets;action:MarkdownFormatAction;value?:string}):MarkdownFormatResult
export type MarkdownToolbarOptions = {document?:Document;onCommand:(id:MarkdownFormatAction,value?:string)=>void;onInteractionStart?:()=>void;onInteractionEnd?:()=>void;commands?:readonly (MarkdownCommand|MarkdownFormatAction)[];swatches?:readonly string[]}
export function createMarkdownToolbar(options:MarkdownToolbarOptions):{element:HTMLDivElement;destroy():void}
export function attachMarkdownEditor(field:HTMLTextAreaElement|HTMLInputElement,options?:Partial<MarkdownToolbarOptions>&{onChange?:(value:string)=>void;onSlashCommand?:()=>void;onVariableCommand?:()=>void}):{destroy():void}
