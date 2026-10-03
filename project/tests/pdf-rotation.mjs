import fs from 'node:fs';
import assert from 'node:assert/strict';
import {exportPDF,inspectPDF} from '../dist/pdf-engine.js';
import * as mupdf from '../dist/vendor/mupdf/mupdf.js';
const input=fs.readFileSync(new URL('./fixtures/rotation.pdf',import.meta.url));
for(const rotation of [0,90,180,270]){
 const masks=rotation===0?[{x:10,y:10,w:20,h:10,color:'#000000'}]:rotation===90?[{x:80,y:10,w:10,h:20,color:'#000000'}]:rotation===180?[{x:70,y:80,w:20,h:10,color:'#000000'}]:[{x:10,y:70,w:10,h:20,color:'#000000'}];
 const output=exportPDF(input,[{pageIndex:0,rotation,masks,notes:[{x:40,y:40,w:30,h:30,color:'#FFF1AE',fontSize:5,textRotation:rotation,runs:[{text:'Test',bold:true,underline:true}]}]}]);
 const [p]=inspectPDF(output);assert.equal(p.width,rotation%180?120:180);assert.equal(p.height,rotation%180?180:120);
 const doc=mupdf.Document.openDocument(output,'application/pdf');
 try{const page=doc.loadPage(0);try{
  const annotations=[...page.getAnnotations()];
  assert.equal(annotations.length,1);
  assert.equal(annotations[0].getType(),'Text');
  assert.equal(annotations[0].getContents(),'Test');
  for(const annotation of annotations)annotation.destroy();
  assert.equal(page.toStructuredText().asText().includes('SECRET'),false,'masked source text must be irreversible');
  assert.equal(page.toStructuredText().asText().includes('Test'),false,'note must not be baked into page text');
 }finally{page.destroy();}}finally{doc.destroy();}

}
const vector=exportPDF(input,[{pageIndex:0,rotation:0,masks:[],notes:[{x:40,y:40,w:20,h:20,text:'Editable'}]}]);
const vectorDoc=mupdf.Document.openDocument(vector,'application/pdf');
try{const page=vectorDoc.loadPage(0);try{
 assert.equal(page.toStructuredText().asText().includes('SECRET'),true,'unmasked page must preserve original text/vector content');
 const annotations=[...page.getAnnotations()];assert.equal(annotations.length,1);assert.equal(annotations[0].getType(),'Text');assert.equal(annotations[0].getContents(),'Editable');annotations.forEach(a=>a.destroy());
}finally{page.destroy();}}finally{vectorDoc.destroy();}
console.log(`PASS: unmasked vector/text retained; masked text removed; editable Text annotations; four rotations (${vector.byteLength} bytes unmasked)`);
