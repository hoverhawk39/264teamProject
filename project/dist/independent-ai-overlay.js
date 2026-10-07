// Pure source-coordinate and draft policy for the independent editor.
const dimensions = /(?:[Ø⌀Φφ±°°′″]\s*\d|\d\s*(?:mm|cm|m²|kg|g|in|inch|ft|µm|μm|°|°C|N·m|MPa|psi|%|±|×|x\s*\d|\/\s*\d)\b|\b(?:M\d+(?:[x×]\d+)?|R\d+|\d+(?:\.\d+)?\s*[+-]\s*\d+(?:\.\d+)?)\b)/iu;
const partNumber = /\b(?=[A-Z0-9-]*\d)[A-Z]{1,}[A-Z0-9]*[-_/][A-Z0-9][A-Z0-9-]*\b|\b[A-Z]{2,}\d{2,}[A-Z0-9]*\b/iu;
const chinese = /[\u3400-\u9fff]/u;
const kana = /[\u3040-\u30ff]/u;
const pureEngineeringValue = /^[\d+−.,\s±‡Ø⌀Φφ°%/()×xXµμmMcCiInNoO-]+$/iu;
const pureUnit = /^(?:mm|cm|µm|μm|um|in|inch|kg|g|psi|MPa|°C)$/iu;
const dimensionCode = /^\.?\d+(?:\.\d+)?\s*(?:O\/A|TYP\.?)$/iu;
const terseDimensionNote = text => /\d/u.test(text) && !/[A-Za-z]{4}/u.test(text) && /^(?:[A-Z]{2,4}\.\s*)?[\d.]/iu.test(text);
const rect = b => ({x:Number(b.x),y:Number(b.y),w:Number(b.w),h:Number(b.h)});
function overlap(a,b) {
 const w=Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x));
 const h=Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
 return w*h;
}
export function sourceCandidates(blocks,pageIndex) {
 const out=[];
 for (const block of blocks) {
  const text=String(block.text||'').trim();
  if (!text || (chinese.test(text) && !kana.test(text)) || pureEngineeringValue.test(text) ||
      pureUnit.test(text) || dimensionCode.test(text) || terseDimensionNote(text) ||
      (partNumber.test(text) && /^[A-Z0-9_\-/]+$/iu.test(text)) ||
      !/\p{L}/u.test(text)) continue;
  const r=rect(block);
  if (![r.x,r.y,r.w,r.h].every(Number.isFinite) || r.w<=0 || r.h<=0) continue;
  const duplicate=out.findIndex(other=>{
   const area=overlap(r,other);
   return area>Math.min(r.w*r.h,other.w*other.h)*.55 &&
     (other.text.toLowerCase().includes(text.toLowerCase()) || text.toLowerCase().includes(other.text.toLowerCase()));
  });
  if (duplicate>=0 && out[duplicate].text.length>=text.length) continue;
  // Rounded source geometry makes repeated OCR calls stable within a few pixels.
  const fingerprint=[pageIndex,text.toLowerCase(),...['x','y','w','h'].map(k=>Math.round(r[k]/5))].join(':');
  let hash=2166136261;
  for(const code of fingerprint)hash=Math.imul(hash^code.codePointAt(0),16777619)>>>0;
  const id=`p${pageIndex}-${hash.toString(16)}`;
  const candidate={...block,...r,text,id};
  if(duplicate>=0)out[duplicate]=candidate;
  else out.push(candidate);
 }
 return out;
}
export function nativeItemRect(t,advance) {
 const baseline=Math.hypot(t[0],t[1])||1;
 const dx=t[0]/baseline*advance,dy=t[1]/baseline*advance;
 const xs=[t[4],t[4]+dx,t[4]+t[2],t[4]+dx+t[2]];
 const ys=[t[5],t[5]+dy,t[5]+t[3],t[5]+dy+t[3]];
 const x=Math.min(...xs),y=Math.min(...ys);
 return {x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};
}
export function mapSourceRect(r,pixelW,pixelH,logicalW,logicalH,rotation=0) {
 let {x,y,w,h}=r;
 x=x*logicalW/pixelW;y=y*logicalH/pixelH;
 w=w*logicalW/pixelW;h=h*logicalH/pixelH;
 let pageW=logicalW,pageH=logicalH;
 for(let step=0;step<(((rotation%360)+360)%360)/90;step++) {
  [x,y,w,h,pageW,pageH]=[pageH-y-h,x,h,w,pageH,pageW];
 }
 return {x,y,w,h};
}
export function parseGlossary(value) {
 const result={};
 for(const line of String(value).split(/\r?\n/u)) {
  if(!line.trim())continue;
  const index=line.indexOf('=');
  if(index<1||!line.slice(index+1).trim())throw Error('詞彙表每行請使用「原文=繁體中文」。');
  result[line.slice(0,index).trim()]=line.slice(index+1).trim();
 }
 return result;
}
export async function translateInBatches(items,glossary,post,onProgress=()=>{},onBatch=()=>{}) {
 const unique=[...new Map(items.map(item=>[item.text,item])).values()];
 const byText=new Map();
 let stopped=false;
 for(let offset=0;offset<unique.length;offset+=20) {
  const batch=unique.slice(offset,offset+20);
  const reply=await post('/api/ai/translate',{items:batch,glossary});
  if(!Array.isArray(reply?.items))throw Error('翻譯回傳缺少 items；未套用不完整結果');
  const byId=new Map(reply.items.map(item=>[item.id,item]));
  if(byId.size!==batch.length || reply.items.length!==batch.length ||
     batch.some(item=>!byId.has(item.id) ||
       (typeof byId.get(item.id).translation!=='string' && typeof byId.get(item.id).error!=='string')))
   throw Error('翻譯回傳缺少來源項目；未套用不完整結果');
  for(const item of batch)byText.set(item.text,byId.get(item.id));
  onProgress(items.filter(item=>byText.has(item.text)).length,items.length);
  const delivered=items.filter(item=>batch.some(source=>source.text===item.text))
    .map(item=>({...byText.get(item.text),id:item.id,text:item.text}));
  if(onBatch(delivered)===false){stopped=true;break;}
 }
 return {items:items.filter(item=>byText.has(item.text))
   .map(item=>({...byText.get(item.text),id:item.id,text:item.text})),stopped};
}

export function exportableNotes(notes) {return notes.filter(note=>!note.aiStatus||note.aiStatus==='confirmed');}
function estimatedSize(note) {
 const pad=note.padding??2, font=note.fontSize??6;
 const chars=[...String(note.text||'')];
 const width=Math.max(1,note.w-2*pad);
 let lines=1, line=0;
 for(const c of chars) {
  if(c==='\n'){lines++;line=0;continue;}
  const advance=(/[\u3400-\u9fff]/u.test(c)?1:.7)*font;
  if(line+advance>width && line){lines++;line=0;}
  line+=advance;
 }
 return {h:lines*font*1.35+2*pad,w:Math.max(note.w,Math.ceil(Math.min(note.text.length*font+2*pad,100000)))};
}
export function noteNeedsReview(note,pageW,pageH,notes=[]) {
 if(note.x<0||note.y<0||note.x+note.w>pageW+.01||note.y+note.h>pageH+.01)return true;
 if(estimatedSize(note).h>note.h+.01)return true;
 return notes.some(other=>other!==note && other.id!==note.id && overlap(note,other)>0) ||
   (note.aiProtected||[]).some(other=>overlap(note,other)>0);
}
export function mergeDrafts(page,translations,pixelW,pixelH,protectedBlocks=[]) {
 const added=[];
 const logicalW=page.origW,logicalH=page.origH;
 const pageW=page.rotation%180?logicalH:logicalW, pageH=page.rotation%180?logicalW:logicalH;
 for(const item of translations) {
  if(item.skipped||!item.translation?.trim()||page.stickyNotes.some(n=>n.aiSource===item.id))continue;
  const source=mapSourceRect(item,pixelW,pixelH,logicalW,logicalH,page.rotation||0);
  const text=item.translation.trim();
  const note={id:`ai-${item.id}`,aiSource:item.id,aiStatus:'draft',color:'transparent',textColor:'#e03024',
   x:Math.max(0,Math.min(source.x,pageW-4)),y:Math.max(0,Math.min(source.y,pageH-4)),
   w:Math.max(4,Math.min(source.w,pageW-source.x)),h:Math.max(4,Math.min(source.h,pageH-source.y)),
   fontSize:6,padding:2,borderWidth:1,text,sourceText:item.text};
  note.aiProtected=protectedBlocks.filter(block=>{
   const r=rect(block),same=String(block.text||'').toLowerCase();
   const own=String(item.text||'').toLowerCase();
   return [r.x,r.y,r.w,r.h].every(Number.isFinite) && r.w>0 && r.h>0 &&
     !(overlap(r,item)>.55*Math.min(r.w*r.h,item.w*item.h) && (same.includes(own)||own.includes(same)));
  }).map(block=>mapSourceRect(block,pixelW,pixelH,logicalW,logicalH,page.rotation||0));
  const ideal=estimatedSize(note);
  // Only expand when a clean rectangle fits. Never reduce font size or truncate text.
  if(ideal.h>note.h && note.y+ideal.h<=pageH && !page.stickyNotes.some(n=>overlap({...note,h:ideal.h},n)>0) &&
     !note.aiProtected.some(n=>overlap({...note,h:ideal.h},n)>0))note.h=ideal.h;
  note.manualH=note.h;
  note.aiWarning=item.warning||'';
  note.aiNeedsReview=noteNeedsReview(note,pageW,pageH,page.stickyNotes);
  page.stickyNotes.push(note);added.push(note);
 }
 return added;
}
