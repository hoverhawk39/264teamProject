// Progress v11 predates half-padding; tag the archive rather than changing the storage key.
export function migrateNotePadding(saved) {
  if (saved.notePaddingVersion === 2) return saved;
  for (const file of saved.files || []) {
    for (const state of [file,...(file.history || []),...(file.future || [])]) {
      for (const page of state.pages || []) {
        for (const note of page.stickyNotes || []) {
          note.padding = (Number.isFinite(note.padding) ? note.padding : 6) / 2;
          note.manualH = note.h; // Preserve the visible size after removing auto-height.
        }
      }
    }
  }
  saved.notePaddingVersion = 2;
  return saved;
}

function rotatedSize(page) {
  return page.rotation % 180
    ? {w:page.origH,h:page.origW,pdfW:page.pdfH,pdfH:page.pdfW}
    : {w:page.origW,h:page.origH,pdfW:page.pdfW,pdfH:page.pdfH};
}
function toNativeRect(rect,page) {
  const steps=((360-(page.rotation||0))/90)%4;
  const size=rotatedSize(page);
  function point(x,y) {
    let w=size.w,h=size.h;
    for(let n=0;n<steps;n++){[x,y]=[h-y,x];[w,h]=[h,w];}
    return {x,y};
  }
  const a=point(rect.x,rect.y),b=point(rect.x+rect.w,rect.y+rect.h);
  return {x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),w:Math.abs(a.x-b.x),h:Math.abs(a.y-b.y)};
}
function sameRect(a,b){return ['x','y','w','h'].every(key=>Math.abs(a[key]-b[key])<0.01);}
export function planCrossFileMasks(files,sourceIndex,pageIndex) {
  const source=files[sourceIndex]?.pages[pageIndex];
  if(!source?.pendingRects?.length)return [];
  const sourceSize=rotatedSize(source);
  const normalized=source.pendingRects.map(rect=>({x:rect.x/sourceSize.w,y:rect.y/sourceSize.h,w:rect.w/sourceSize.w,h:rect.h/sourceSize.h}));
  return files.flatMap((file,fileIndex)=>{
    const targetIndex=fileIndex===sourceIndex?pageIndex:0;
    const page=file.pages[targetIndex];
    if(!page)return [];
    const targetSize=rotatedSize(page);
    const matching=Math.abs(targetSize.pdfW-sourceSize.pdfW)<0.01&&Math.abs(targetSize.pdfH-sourceSize.pdfH)<0.01;
    const kind=fileIndex===sourceIndex||matching?'bakedRects':'pendingRects';
    const visibleRects=normalized.map(area=>({x:area.x*targetSize.w,y:area.y*targetSize.h,w:area.w*targetSize.w,h:area.h*targetSize.h}));
    const rects=visibleRects.map(visible=>kind==='bakedRects'?toNativeRect(visible,page):visible)
      .filter(rect=>!page[kind].some(old=>sameRect(old,rect)));
    const pendingToRemove=kind==='bakedRects'&&fileIndex!==sourceIndex
      ?page.pendingRects.filter(old=>visibleRects.some(rect=>sameRect(old,rect))):[];
    const entry={fileIndex,pageIndex:targetIndex,kind,rects};
    if(pendingToRemove.length)entry.pendingToRemove=pendingToRemove;
    return rects.length||pendingToRemove.length||fileIndex===sourceIndex?[entry]:[];
  });
}
