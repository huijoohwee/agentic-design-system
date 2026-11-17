import test from 'node:test'
import assert from 'node:assert/strict'
import { MARKDOWN_COMMANDS, applyMarkdownFormatAction, markdownCommandMatches, clearMarkdownFormatting } from '../site/markdown.js'
import { createMarkdownParser } from '../site/markdown-parser.js'
import { normalizeHexColor, hexToHsv, hsvToHex, hexToRgb, rgbToHex } from '../site/color.js'
const apply=(text,action,start=0,end=text.length,value)=>applyMarkdownFormatAction({text,action,selection:{startOffset:start,endOffset:end},value})
test('all requested commands have unique stable labels and safe lookup',()=>{
 assert.equal(new Set(MARKDOWN_COMMANDS.map(c=>c.id)).size,MARKDOWN_COMMANDS.length)
 assert(MARKDOWN_COMMANDS.every(Object.isFrozen)); assert(MARKDOWN_COMMANDS.every(command=>!command.wrap||Object.isFrozen(command.wrap))); assert(Object.isFrozen(MARKDOWN_COMMANDS))
 assert.equal(markdownCommandMatches('/math')[0].id,'math'); assert.throws(()=>apply('x','unknown'),RangeError)
})
for(const [action,left,right] of [['bold','**','**'],['italic','*','*'],['strike','~~','~~'],['inlineCode','`','`'],['underline','<u>','</u>'],['superscript','^','^'],['subscript','~','~'],['math','$','$'],['highlight','==','=='],['comment','<!-- ',' -->']])
 test(`${action} preserves Unicode and unwraps the exact selection`,()=>{const first=apply('前🙂後',action,1,3);assert.equal(first.nextText,`前${left}🙂${right}後`);assert.equal(applyMarkdownFormatAction({text:first.nextText,selection:first.nextSelection,action}).nextText,'前🙂後')})
test('line transforms exclude a trailing unselected line and preserve existing heading text',()=>{
 assert.equal(apply('alpha\nbeta','bulletList',0,6).nextText,'- alpha\nbeta')
 assert.equal(apply('#### title','heading2').nextText,'## title')
 assert.equal(apply('a\nb','numberedList').nextText,'1. a\n2. b')
 assert.equal(apply('  a\n\tb','outdent').nextText,'a\nb')
})
test('links place caret in destination; colors cannot inject attributes; clear keeps content',()=>{
 assert.deepEqual(apply('word','link').nextSelection,{startOffset:7,endOffset:7})
 assert.throws(()=>apply('x','colorPalette',0,1,'red" onclick="x'),TypeError)
 assert.equal(clearMarkdownFormatting('## **Title**\n- [label](https://example.test)\n<u>under</u>'),'Title\nlabel\nunder')
})
test('canonical parser modes preserve default link safety and install one superscript owner',()=>{
 class Engine { constructor(options){this.options=options;this.rules=[];this.inline={ruler:{after:(...a)=>this.rules.push(a)}};this.validateLink=url=>!url.startsWith('javascript:')} use(plugin,...args){plugin(this,...args);return this} }
 const md=createMarkdownParser(Engine); assert.equal(md.rules.length,1);assert(!md.validateLink('javascript:alert(1)'));assert(md.validateLink('https://example.test'))
 assert.equal(createMarkdownParser(Engine,{mode:'fast'}).options.html,false)
 assert.throws(()=>createMarkdownParser(Engine,{mode:'unknown'}),TypeError)
})
test('palette conversions roundtrip extrema and representative RGB values',()=>{
 assert.equal(normalizeHexColor('#AbC'),'#aabbcc'); assert.equal(normalizeHexColor('red'),null)
 for(const color of ['#000000','#ffffff','#ff0000','#60a5fa','#808080','#13c789']){assert.equal(hsvToHex(hexToHsv(color)),color);assert.equal(rgbToHex(hexToRgb(color)),color)}
})
