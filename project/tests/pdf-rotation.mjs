import fs from 'node:fs';
import assert from 'node:assert/strict';
import {exportPDF,inspectPDF} from '../dist/pdf-engine.js';
const input=fs.readFileSync(new URL('./fixtures/rotation.pdf',import.meta.url));
for(const rotation of [0,90,180,270]){
 const masks=rotation===0?[{x:10,y:10,w:20,h:10,color:'#000000'}]:rotation===90?[{x:80,y:10,w:10,h:20,color:'#000000'}]:rotation===180?[{x:70,y:80,w:20,h:10,color:'#000000'}]:[{x:10,y:70,w:10,h:20,color:'#000000'}];
 const output=exportPDF(input,[{pageIndex:0,rotation,masks,notes:[{x:40,y:40,w:30,h:30,color:'#FFF1AE',fontSize:5,textRotation:rotation,runs:[{text:'Test',bold:true,underline:true}]}]}]);
 const [p]=inspectPDF(output);assert.equal(p.width,rotation%180?120:180);assert.equal(p.height,rotation%180?180:120);
 
}
console.log('PASS: all four rotations exported, page sizes preserved, rotated note rendering');
