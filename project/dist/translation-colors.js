export const TRANSLATION_RED='#e03024';
export const TRANSLATION_GREEN='#168a38';
export const TRANSLATION_BLACK='#111111';
export const TRANSLATION_COLORS=[TRANSLATION_RED,TRANSLATION_GREEN,TRANSLATION_BLACK];

// UTF-16 offsets match textarea selectionStart/selectionEnd and JS string slicing.
export function colorAt(note,index){
 const runs=note.colorRuns||[];
 return runs.find(run=>run.start<=index&&index<run.end)?.color || note.textColor || TRANSLATION_RED;
}
export function recolorRange(note,start,end,color){
 if(!note.aiStatus||!TRANSLATION_COLORS.includes(color)||start<0||end>note.text.length||start>=end)return false;
 const runs=[];
 for(const run of note.colorRuns||[]){
  if(run.end<=start||run.start>=end)runs.push({...run});
  else{
   if(run.start<start)runs.push({...run,end:start});
   if(run.end>end)runs.push({...run,start:end});
  }
 }
 runs.push({start,end,color});
 runs.sort((a,b)=>a.start-b.start);
 note.colorRuns=runs.reduce((acc,run)=>{
  const last=acc.at(-1);
  if(last?.end===run.start&&last.color===run.color)last.end=run.end;
  else acc.push(run);
  return acc;
 },[]);
 return true;
}
export function adjustColorRuns(note,start,removed,inserted){
 if(!note.colorRuns?.length)return;
 const end=start+removed,delta=inserted-removed;
 note.colorRuns=note.colorRuns.flatMap(run=>{
  const parts=[];
  if(run.start<start)parts.push({start:run.start,end:Math.min(run.end,start),color:run.color});
  if(run.end>end)parts.push({start:Math.max(end,run.start)+delta,end:run.end+delta,color:run.color});
  return parts.filter(part=>part.start<part.end);
 });
}
export function colorSegments(note){
 const points=new Set([0,note.text.length]);
 for(const run of note.colorRuns||[]){points.add(run.start);points.add(run.end);}
 const edges=[...points].sort((a,b)=>a-b);
 return edges.slice(0,-1).map((start,i)=>({text:note.text.slice(start,edges[i+1]),color:colorAt(note,start)}));
}
