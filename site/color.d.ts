export type ColorHsv = {h:number;s:number;v:number}
export const DEFAULT_COLOR_SWATCHES:readonly string[]
export function normalizeHexColor(value:string):string|null
export function colorChannel(value:number,max?:number):number
export function rgbToHex(rgb:readonly number[]):string
export function hexToRgb(hex:string):number[]
export function hexToHsv(hex:string):ColorHsv
export function hsvToHex(hsv:ColorHsv):string
export function resolvePaletteColor(value:string):string|null
export function createColorPalette(root:HTMLElement,props:{value:string;onValueChange:(value:string)=>void;swatches?:readonly string[]}):{update(value:string):void;destroy():void}
