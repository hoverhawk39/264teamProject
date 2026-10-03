// Local PDF engine: preserve unmasked vector pages; rasterize redacted pages only.
import * as mupdf from './vendor/mupdf/mupdf.js';
const RGB=mupdf.ColorSpace.DeviceRGB, I=mupdf.Matrix.identity;
const color=h=>(/^#[0-9a-f]{6}$/i.test(h)?h:'#000000').slice(1).match(/../g).map(n=>parseInt(n,16)/255);
const rect=(o,b)=>[b[0]+o.x/100*(b[2]-b[0]),b[1]+o.y/100*(b[3]-b[1]),b[0]+(o.x+o.w)/100*(b[2]-b[0]),b[1]+(o.y+o.h)/100*(b[3]-b[1])];
function open(bytes){const d=mupdf.Document.openDocument(bytes,'application/pdf');if(!d.isPDF()){d.destroy();throw Error('檔案不是有效的 PDF。')}if(d.needsPassword()){d.destroy();throw Error('此 PDF 有密碼保護，請先解除保護再匯入。')}return d;}
export function inspectPDF(bytes){const d=open(bytes);try{return Array.from({length:d.countPages()},(_,i)=>{const p=d.loadPage(i);try{const b=p.getBounds();return {width:b[2]-b[0],height:b[3]-b[1]};}finally{p.destroy();}});}finally{d.destroy();}}
function rectangle(dev,r,c,matrix=I){const path=new mupdf.Path();path.rect(...r);dev.fillPath(path,false,matrix,RGB,color(c),1);path.destroy();}
let cjk,regular,bold;
function fonts(){cjk??=new mupdf.Font('zh-Hant');regular??=new mupdf.Font('Helvetica');bold??=new mupdf.Font('Helvetica-Bold');}
function overlay(page,data){const b=page.getBounds();const list=new mupdf.DisplayList(b),dev=new mupdf.DisplayListDevice(list);try{
 for(const mask of data.masks||[])rectangle(dev,rect(mask,b),'#FFFFFF');
 for(const note of data.notes||[]){const box=rect(note,b),angle=(note.textRotation||0)%360,bw=box[2]-box[0],bh=box[3]-box[1],nw=angle%180?bh:bw,nh=angle%180?bw:bh,mat=angle===90?[0,1,-1,0,box[2],box[1]]:angle===180?[-1,0,0,-1,box[2],box[3]]:angle===270?[0,-1,1,0,box[0],box[3]]:[1,0,0,1,box[0],box[1]],r=[0,0,nw,nh],size=note.fontSize||10,pad=4,line=size*1.45;rectangle(dev,box,note.color);fonts();let x=r[0]+pad,y=r[1]+pad+size;const maxX=r[2]-pad,maxY=r[3]-pad;
 for(const run of note.runs||[{text:note.text||'',bold:false}])for(const ch of run.text){if(ch==='\r')continue;if(ch==='\n'){x=r[0]+pad;y+=line;continue;}const code=ch.codePointAt(0),font=code<256?(run.bold?bold:regular):cjk,gid=font.encodeCharacter(code),advance=font.advanceGlyph(gid)*size;if(!gid)throw Error('備註包含不支援的字元，請移除表情符號或特殊字元後重試。');if(x+advance>maxX){x=r[0]+pad;y+=line;}if(y>maxY+.1)throw Error('備註文字超出色塊：請加高或加寬備註，再重新確認。');const t=new mupdf.Text();t.showGlyph(font,[size,0,0,-size,x,y],gid,code);const c=color(note.textColor||'#18212A');dev.fillText(t,mat,RGB,c,1);if(run.bold&&code>=256){const t2=new mupdf.Text();t2.showGlyph(font,[size,0,0,-size,x+.25,y],gid,code);dev.fillText(t2,mat,RGB,c,1);t2.destroy();}t.destroy();if(run.underline)rectangle(dev,[x,y+size*.12,x+advance,y+size*.12+Math.max(.5,size*.055)],note.textColor||'#18212A',mat);x+=advance;}
 }
 dev.close();const a=page.createAnnotation('Stamp');a.setRect(b);a.setAppearanceFromDisplayList('N',null,I,list);a.destroy();
 }finally{dev.destroy();list.destroy();}}
function processPage(page,data){const masks=data.masks||[];for(const o of masks){const a=page.createAnnotation('Redact');a.setRect(rect(o,page.getBounds()));a.update();a.destroy();}if(masks.length)page.applyRedactions(false,2,2,0); // Remove text, covered image pixels, and touched vector paths.
 if(masks.length||(data.notes||[]).length)overlay(page,data);
}
function processed(bytes,pages){const source=open(bytes),out=new mupdf.PDFDocument();try{source.bake(true,true);for(const data of pages){out.graftPage(-1,source,data.pageIndex);let p=out.loadPage(out.countPages()-1);try{if(data.rotation){const obj=p.getObject(),old=obj.getInheritable('Rotate');obj.put('Rotate',((old.asNumber()||0)+data.rotation)%360);old.destroy();obj.destroy();p.destroy();p=out.loadPage(out.countPages()-1);}processPage(p,data);}finally{p.destroy();}}out.bake(true,true);return out;}catch(e){out.destroy();throw e;}finally{source.destroy();}}
function addStickyNotes(page,notes){
 for(const note of notes||[]){
  const a=page.createAnnotation('Text');
  try{
   // /Text annotations remain independently editable in Acrobat, even above rasterized pages.
   a.setRect(rect(note,page.getBounds()));
   a.setContents((note.runs||[{text:note.text||''}]).map(run=>run.text||'').join(''));
   a.setIcon('Note');
   a.setColor(color(note.color||'#FFF1AE'));
   a.update();
  }finally{a.destroy();}
 }
}
export function exportPDF(bytes,pages){
 const source=open(bytes),out=new mupdf.PDFDocument(),scale=600/72;
 try{
  if(pages.length!==source.countPages()||pages.some((p,i)=>p.pageIndex!==i))throw Error('頁面數量或順序不完整，請重新確認整份 PDF。');
  for(let i=0;i<pages.length;i++){
   const data=pages[i],masked=(data.masks||[]).length>0;
   out.graftPage(-1,source,i);
   let p=out.loadPage(i);
   try{
    if(data.rotation){const obj=p.getObject(),old=obj.getInheritable('Rotate');obj.put('Rotate',((old.asNumber()||0)+data.rotation)%360);old.destroy();obj.destroy();p.destroy();p=out.loadPage(i);}
    if(masked){
     const b=p.getBounds(),w=b[2]-b[0],h=b[3]-b[1];
     if(Math.ceil(w*scale)*Math.ceil(h*scale)>80000000)throw Error(`第 ${i+1} 頁超過此裝置版的 600 dpi 合併上限（8,000 萬像素）。未降低解析度或匯出部分頁面；請改用桌面端處理大型紙張。`);
     for(const mask of data.masks){const a=p.createAnnotation('Redact');a.setRect(rect(mask,b));a.update();a.destroy();}
     p.applyRedactions(false,2,2,0);
     overlay(p,{masks:data.masks.map(mask=>({...mask,color:'#FFFFFF'})),notes:[]});
     // Render only sanitized page content. Never overlay an opaque box over recoverable source data.
     let pix,image,ref,replacement;
     try{
      pix=p.toPixmap(mupdf.Matrix.scale(scale,scale),RGB,false,true);
      image=new mupdf.Image(pix);ref=out.addImage(image);
      replacement=out.addPage([0,0,w,h],0,{XObject:{MergedPage:ref}},`q ${w} 0 0 ${h} 0 0 cm /MergedPage Do Q`);
      out.insertPage(i,replacement);
     }finally{replacement?.destroy();ref?.destroy();image?.destroy();pix?.destroy();}
     p.destroy();p=null;
     out.deletePage(i+1);
     p=out.loadPage(i);
    }
    addStickyNotes(p,data.notes);
   }finally{p?.destroy();}
  }
  const buffer=out.saveToBuffer('garbage=4,compress');
  try{return buffer.asUint8Array().slice();}finally{buffer.destroy();}
 }finally{out.destroy();source.destroy();}
}
export function renderPDF(bytes,pageIndex,width=1400,data=null){const d=data?processed(bytes,[{...data,pageIndex}]):open(bytes);let p,pix;try{p=d.loadPage(data?0:pageIndex);const b=p.getBounds(),w=b[2]-b[0],h=b[3]-b[1],scale=Math.min(width/w,Math.sqrt(12000000/(w*h)));pix=p.toPixmap(mupdf.Matrix.scale(scale,scale),RGB,false,true);return {png:pix.asPNG(),width:w,height:h};}finally{pix?.destroy();p?.destroy();d.destroy();}}
