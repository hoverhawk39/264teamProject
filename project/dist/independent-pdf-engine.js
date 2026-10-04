// Independent drawing editor export: true redaction with retained PDF page objects.
import * as mupdf from './vendor/mupdf/mupdf.js';
const RGB=mupdf.ColorSpace.DeviceRGB;
let latin,cjk;
function glyphFont(code){
 latin??=new mupdf.Font('Helvetica');
 if(code<256)return latin;
 cjk??=new mupdf.Font('zh-Hant');
 return cjk;
}
const color=hex=>(/^#[0-9a-f]{6}$/i.test(hex)?hex:'#ffeb3b').slice(1).match(/../g).map(part=>parseInt(part,16)/255);
function boundsRect(item,page,edit){
 const b=page.getBounds(), sx=(b[2]-b[0])/edit.origW, sy=(b[3]-b[1])/edit.origH;
 return [b[0]+item.x*sx,b[1]+item.y*sy,b[0]+(item.x+item.w)*sx,b[1]+(item.y+item.h)*sy];
}
function addNote(page,note,edit){
 const box=boundsRect(note,page,edit),list=new mupdf.DisplayList(box),device=new mupdf.DisplayListDevice(list);
 let annotation,path;
 try{
  path=new mupdf.Path();path.rect(...box);device.fillPath(path,false,mupdf.Matrix.identity,RGB,color(note.color),1);
  device.clipPath(path,false,mupdf.Matrix.identity);
  const pageWidth=page.getBounds()[2]-page.getBounds()[0];
  const scale=pageWidth/edit.origW;
  const width=box[2]-box[0],height=box[3]-box[1],pad=Math.max(0,(note.padding??6)*scale);
  const fontSize=Math.max(0.1,(note.fontSize??13)*scale),lineHeight=fontSize*1.35;
  let x=box[0]+pad,y=box[1]+pad+fontSize;
  if(Array.isArray(note.visualLines)){
   for(const [lineIndex,line] of note.visualLines.entries()){
    const glyphs=Array.from(line,character=>{
     const code=character.codePointAt(0),font=glyphFont(code),gid=font.encodeCharacter(code);
     if(!gid)throw Error('便利貼含無法輸出的字元，請移除特殊符號後重試。');
     return {code,font,gid,advance:font.advanceGlyph(gid)*fontSize};
    });
    x=box[0]+pad;
    if(y>box[3]-pad+0.1)break;
    // Match each PDF line's advance to the browser's measured line width.
    // Fitting only overlong lines made Helvetica text much narrower than the
    // editor and left a conspicuous empty strip at the note's right edge.
    const advance=glyphs.reduce((sum,glyph)=>sum+glyph.advance,0);
    const measured=note.visualWidths?.[lineIndex];
    const target=Number.isFinite(measured) && measured>0
     ? Math.min(Math.max(0,width-2*pad),measured*scale)
     : Math.min(advance,Math.max(0,width-2*pad));
    const horizontalScale=advance>0?target/advance:1;
    for(const glyph of glyphs){
     const text=new mupdf.Text();
     try{text.showGlyph(glyph.font,[fontSize*horizontalScale,0,0,-fontSize,x,y],glyph.gid,glyph.code);device.fillText(text,mupdf.Matrix.identity,RGB,[0.07,0.07,0.07],1);}finally{text.destroy();}
     x+=glyph.advance*horizontalScale;
    }
    y+=lineHeight;
   }
  }else for(const char of note.text||''){
   if(char==='\n'){x=box[0]+pad;y+=lineHeight;continue;}
   const code=char.codePointAt(0),font=glyphFont(code),gid=font.encodeCharacter(code);
   if(!gid)throw Error('便利貼含無法輸出的字元，請移除特殊符號後重試。');
   const advance=font.advanceGlyph(gid)*fontSize;
   if(x+advance>box[2]-pad&&x>box[0]+pad){x=box[0]+pad;y+=lineHeight;}
   if(y>box[3]-pad+0.1)break;
   const text=new mupdf.Text();
   try{text.showGlyph(font,[fontSize,0,0,-fontSize,x,y],gid,code);device.fillText(text,mupdf.Matrix.identity,RGB,[0.07,0.07,0.07],1);}finally{text.destroy();}
   x+=advance;
  }
  device.popClip();
  device.close();
  annotation=page.createAnnotation('Stamp');
  annotation.setRect(box);
  annotation.setContents(note.text||'');
  annotation.setColor(color(note.color));
  annotation.setFlags(mupdf.PDFAnnotation.IS_PRINT);
  annotation.setAppearanceFromDisplayList('N',null,mupdf.Matrix.identity,list);
  // Preserve the custom colored appearance; regenerating the annotation replaces it.
 }finally{annotation?.destroy();path?.destroy();device.destroy();list.destroy();}
}
export function exportIndependentPDF(bytes,edits){
 const source=mupdf.Document.openDocument(bytes,'application/pdf');
 if(!source.isPDF()||source.needsPassword()){source.destroy();throw Error('無法輸出此 PDF。');}
 const output=new mupdf.PDFDocument();
 try{
  if(source.countPages()!==edits.length)throw Error('PDF 頁數與編輯資料不符。');
  for(let index=0;index<edits.length;index++){
   output.graftPage(-1,source,index);
   const page=output.loadPage(index),edit=edits[index];
   try{
    for(const mask of edit.bakedRects){
     const annotation=page.createAnnotation('Redact');
     try{annotation.setRect(boundsRect(mask,page,edit));annotation.update();}finally{annotation.destroy();}
    }
    if(edit.bakedRects.length){
     // Remove covered pixels, text, and intersecting vector paths; do not paint a reversible box.
     page.applyRedactions(false,2,2,0);
    }
    for(const note of edit.stickyNotes)addNote(page,note,edit);
   }finally{page.destroy();}
  }
  const saved=output.saveToBuffer('garbage=4,compress');
  try{return saved.asUint8Array().slice();}finally{saved.destroy();}
 }finally{output.destroy();source.destroy();}
}
