import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as mupdf from '../dist/vendor/mupdf/mupdf.js';
import {exportIndependentPDF} from '../dist/independent-pdf-engine.js';
const input=fs.readFileSync(new URL('./fixtures/rotation.pdf',import.meta.url));
const empty={origW:900,origH:600,bakedRects:[],stickyNotes:[]};
const note={id:'n1',x:400,y:220,w:250,h:150,padding:8,fontSize:30,text:'NOTE',color:'#ffeb3b'};
for(const [kind,edit] of Object.entries({original:empty,note:{...empty,stickyNotes:[note]},masked:{...empty,bakedRects:[{x:0,y:0,w:900,h:600}]},both:{...empty,bakedRects:[{x:0,y:0,w:200,h:160}],stickyNotes:[note]}})){
 const result=exportIndependentPDF(input,[edit]);
 const doc=mupdf.Document.openDocument(result,'application/pdf');
 try{
  assert.equal(doc.countPages(),1);
  const page=doc.loadPage(0);
  try{
   const bounds=page.getBounds();assert.deepEqual(bounds,[0,0,180,120]);
   const text=page.toStructuredText().asText();
   if(kind==='masked')assert.ok(!text.includes('SECRET'),'covered text must be removed');
   if(kind==='original'||kind==='note')assert.ok(text.includes('SECRET'),'unmasked source text retained');
   const annotations=page.getAnnotations();assert.equal(annotations.length,edit.stickyNotes.length);
   for(const annot of annotations){assert.equal(annot.getType(),'Stamp');assert.equal(annot.getContents(),'NOTE');annot.destroy();}
   if(kind==='note'){
    const pix=page.toPixmap([4,0,0,4,0,0],mupdf.ColorSpace.DeviceRGB);
    try{
     const pixels=pix.getPixels(),stride=pix.getStride(),n=pix.getNumberOfComponents();
     // The note begins at PDF (80,44); text baseline is around y=52.
     // At 4x raster size, glyphs must occupy several rows (not the former tiny 1.7pt).
     const rows=new Set();
     for(let y=180;y<230;y++)for(let x=340;x<500;x++){
      const p=y*stride+x*n;
      if(pixels[p]<100&&pixels[p+1]<100&&pixels[p+2]<100)rows.add(y);
     }
     assert.ok(rows.size>=12,`exported note text is too small (${rows.size} occupied rows)`);
    }finally{pix.destroy();}
   }
   console.log(kind,result.byteLength,text.slice(0,70).replaceAll('\n',' '));
  }finally{page.destroy();}
 }finally{doc.destroy();}
}
for(const fontSize of [13,24]){
 const variant={...note,text:'圖面 ABC',fontSize};
 const result=exportIndependentPDF(input,[{...empty,stickyNotes:[variant]}]);
 const doc=mupdf.Document.openDocument(result,'application/pdf');
 try{
  const page=doc.loadPage(0);
  try{
   const annots=page.getAnnotations();
   assert.equal(annots.length,1);
   assert.equal(annots[0].getContents(),'圖面 ABC');
   annots.forEach(a=>a.destroy());
   const pix=page.toPixmap([4,0,0,4,0,0],mupdf.ColorSpace.DeviceRGB);
   try{
    const pixels=pix.getPixels(),stride=pix.getStride(),n=pix.getNumberOfComponents();
    const rows=new Set();
    for(let y=180;y<245;y++)for(let x=340;x<590;x++){
     const p=y*stride+x*n;
     if(pixels[p]<100&&pixels[p+1]<100&&pixels[p+2]<100)rows.add(y);
    }
    assert.ok(rows.size>=fontSize*0.45,`CJK + Latin note at ${fontSize} is too small: ${rows.size} rows`);
   }finally{pix.destroy();}
  }finally{page.destroy();}
 }finally{doc.destroy();}
}
const wrapped={...note,x:400,y:220,w:100,h:280,fontSize:30,text:'hello my friend ss',visualLines:['hello','my','friend','ss']};
const wrappedDoc=mupdf.Document.openDocument(exportIndependentPDF(input,[{...empty,stickyNotes:[wrapped]}]),'application/pdf');
try{
 const page=wrappedDoc.loadPage(0);
 try{
  const annotation=page.getAnnotations()[0],display=annotation.toDisplayList();
  try{
   const actual=display.toStructuredText().asText().trim().split(/\n+/);
   assert.deepEqual(actual,['hello','my','friend','ss'],'preview appearance must preserve editor visual lines');
   assert.equal(annotation.getContents(),'hello my friend ss','editable annotation retains original text');
  }finally{display.destroy();annotation.destroy();}
 }finally{page.destroy();}
}finally{wrappedDoc.destroy();}
const narrowPageNote={...note,x:800,y:440,w:500,h:250,fontSize:6,text:'x',visualLines:['x']};
const narrowDoc=mupdf.Document.openDocument(exportIndependentPDF(input,[{...empty,origW:1800,origH:1200,stickyNotes:[narrowPageNote]}]),'application/pdf');
try{
 const page=narrowDoc.loadPage(0);
 try{
  const annotation=page.getAnnotations()[0],display=annotation.toDisplayList(),structured=display.toStructuredText();
  try{
   const sizes=[];
   structured.walk({onChar(_character,_origin,_font,size){sizes.push(size);}});
   assert.ok(Math.abs(sizes[0]-0.6)<0.01,`6px note must map to 0.6pt on 180pt/1800px page; got ${sizes[0]}`);
  }finally{structured.destroy();display.destroy();annotation.destroy();}
 }finally{page.destroy();}
}finally{narrowDoc.destroy();}
const clipped={...note,x:400,y:220,w:100,h:50,fontSize:30,padding:8,text:'hello my friend ss',visualLines:['hello','my','friend','ss']};
const clippedDoc=mupdf.Document.openDocument(exportIndependentPDF(input,[{...empty,stickyNotes:[clipped]}]),'application/pdf');
try{
 const page=clippedDoc.loadPage(0);
 try{
  const annotation=page.getAnnotations()[0],display=annotation.toDisplayList();
  try{
   assert.equal(annotation.getContents(),clipped.text,'hidden characters remain in annotation contents');
   assert.deepEqual(display.toStructuredText().asText().trim().split(/\n+/),['hello'],'appearance draws only fully visible lines');
  }finally{display.destroy();annotation.destroy();}
 }finally{page.destroy();}
}finally{clippedDoc.destroy();}
const pinkLines=[
 'i like to eat hamburger every moring.',
 'i like to eat hamburger every moring.',
 '',
 'i like to eat hamburger every moring.',
 'i like to eat hamburger every moring.i like to',
 'eat hamburger every moring.i like to eat'
];
const pink={...note,x:100,y:100,w:390,h:150,padding:3,fontSize:16,text:pinkLines.join('\n'),visualLines:pinkLines};
const pinkDoc=mupdf.Document.openDocument(exportIndependentPDF(input,[{...empty,stickyNotes:[pink]}]),'application/pdf');
try{
 const page=pinkDoc.loadPage(0);
 try{
  const annotation=page.getAnnotations()[0],display=annotation.toDisplayList();
  try{
   const actual=display.toStructuredText().asText().trim().split(/\n+/);
   assert.deepEqual(actual,pinkLines.filter(Boolean),'pink note must not lose characters or rewrap in PDF');
   assert.equal(annotation.getContents(),pink.text);
  }finally{display.destroy();annotation.destroy();}
 }finally{page.destroy();}
}finally{pinkDoc.destroy();}
const measuredNote={...note,x:100,y:100,w:390,h:100,padding:3,fontSize:16,text:'i like to eat hamburger every moring.i like to',visualLines:['i like to eat hamburger every moring.i like to'],visualWidths:[380]};
const measuredDoc=mupdf.Document.openDocument(exportIndependentPDF(input,[{...empty,stickyNotes:[measuredNote]}]),'application/pdf');
try{
 const page=measuredDoc.loadPage(0);
 try{
  const annotation=page.getAnnotations()[0],display=annotation.toDisplayList(),structured=display.toStructuredText();
  try{
   const origins=[];
   structured.walk({onChar(_char,origin){origins.push(origin[0]);}});
   assert.ok(origins.length>40,'entire browser visual line must remain visible');
   const span=origins.at(-1)-origins[0];
   assert.ok(span>60 && span<77,`PDF text should span browser-measured width, not leave a wide blank strip: ${span}`);
  }finally{structured.destroy();display.destroy();annotation.destroy();}
 }finally{page.destroy();}
}finally{measuredDoc.destroy();}
console.log('PASS: independent PDF masked/vector/note paths, scaled text, editor wraps and clipped overflow');
