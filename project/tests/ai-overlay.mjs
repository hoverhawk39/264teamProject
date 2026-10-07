import assert from 'node:assert/strict';
import {sourceCandidates, mapSourceRect, mergeDrafts, exportableNotes, noteNeedsReview, parseGlossary, nativeItemRect, translateInBatches} from '../dist/independent-ai-overlay.js';

const blocks = [
 {text:'MATERIAL STEEL',x:100,y:30,w:170,h:16,confidence:.95},
 {text:'MATERIAL STEEL',x:101,y:30,w:168,h:16,confidence:.80},
 {text:'孔徑 Ø12 ±0.1 mm',x:100,y:60,w:160,h:16,confidence:.9},
 {text:'PART-123A',x:100,y:90,w:100,h:16,confidence:.9},
 {text:'表面處理',x:100,y:120,w:100,h:16,confidence:.9}
];
const candidates=sourceCandidates(blocks,0);
assert.deepEqual(candidates.map(b=>b.text),['MATERIAL STEEL']);
assert.deepEqual(sourceCandidates([{text:'LENGTH 25',x:10,y:10,w:80,h:14},{text:'Finish',x:20,y:40,w:60,h:14}],0).map(b=>b.text),['LENGTH 25','Finish'],'mixed engineering prose must reach the backend for token protection');
assert.deepEqual(sourceCandidates([{text:'Ø12 ±0.1 mm',x:1,y:1,w:80,h:10},{text:'06 ‡0.01 mm',x:1,y:11,w:80,h:10},{text:'.100 O/A',x:1,y:15,w:80,h:10},{text:'.777O/A',x:1,y:18,w:80,h:10},{text:'PPP. .020±.00.2 X 30° CHF.',x:1,y:19,w:80,h:10},{text:'PART-123A',x:1,y:20,w:80,h:10},{text:'表面處理',x:1,y:40,w:80,h:10}],0),[],'pure protected values, terse numeric callouts, OCR misreads, and Han stay untouched');
assert.deepEqual(sourceCandidates([{text:'研磨方向',x:1,y:1,w:60,h:10},{text:'研磨方向 DRAW POLISH',x:1,y:20,w:120,h:10},{text:'表面仕上げ',x:1,y:40,w:80,h:10}],0).map(b=>b.text),['表面仕上げ'],'Japanese is non-Chinese; mixed Chinese run requires manual segmentation');
assert.deepEqual(sourceCandidates([
 {text:'MATERIAL',x:100,y:30,w:85,h:16},
 {text:'MATERIAL STEEL',x:100,y:30,w:170,h:16}
],0).map(b=>b.text),['MATERIAL STEEL'],'OCR aggregate supersedes overlapping native fragment');
assert.deepEqual(nativeItemRect([0,10,-10,0,100,200],50),{x:90,y:200,w:10,h:50});
assert.deepEqual(nativeItemRect([10,0,0,-10,100,200],50),{x:100,y:190,w:50,h:10});
assert.match(sourceCandidates([{text:'\"QUOTE\"',x:15,y:5,w:55,h:10}],0)[0].id,/^[a-z0-9-]+$/);
assert.equal(candidates[0].id,sourceCandidates(blocks,0)[0].id);
assert.notEqual(candidates[0].id,sourceCandidates(blocks,1)[0].id);
assert.deepEqual(mapSourceRect({x:100,y:30,w:170,h:16},900,600,900,600,90),{x:554,y:100,w:16,h:170});
assert.deepEqual(mapSourceRect({x:100,y:30,w:170,h:16},900,600,900,600,0),{x:100,y:30,w:170,h:16});
assert.deepEqual(parseGlossary('STEEL=鋼材\nMATERIAL = 材質'),{STEEL:'鋼材',MATERIAL:'材質'});
assert.throws(()=>parseGlossary('bad line'),/詞彙/);
const protectedPage={origW:900,origH:600,rotation:0,stickyNotes:[]};
const protectedDraft=mergeDrafts(protectedPage,[{...candidates[0],translation:'材質：鋼材'}],900,600,[{text:'25mm',x:90,y:35,w:180,h:20}])[0];
assert.equal(protectedDraft.aiNeedsReview,true,'protected dimension underneath source line requires review');
assert.equal(noteNeedsReview(protectedDraft,900,600,[]),true);
assert.equal(noteNeedsReview({...protectedDraft,x:400,y:300},900,600,[]),false);
const base={origW:900,origH:600,rotation:0,stickyNotes:[{id:'user',text:'hello',color:'#ffeb3b'}]};
const result=mergeDrafts(base,[{...candidates[0],translation:'材質：鋼材'}],900,600);
assert.equal(result.length,1);
assert.equal(base.stickyNotes.length,2);
assert.equal(base.stickyNotes[0].id,'user');
assert.equal(base.stickyNotes[1].aiStatus,'draft');
assert.equal(base.stickyNotes[1].color,'transparent');
assert.equal(base.stickyNotes[1].textColor,'#e03024');
assert.equal(base.stickyNotes[1].fontSize,6);
assert.equal(mergeDrafts(base,[{...candidates[0],translation:'材質：鋼材'}],900,600).length,0);
assert.deepEqual(exportableNotes(base.stickyNotes).map(n=>n.id),['user']);
base.stickyNotes[1].aiStatus='confirmed';
assert.deepEqual(exportableNotes(base.stickyNotes).map(n=>n.id),['user',base.stickyNotes[1].id]);
assert.equal(noteNeedsReview({...base.stickyNotes[1],w:10,h:4},900,600,base.stickyNotes),true);
assert.equal(noteNeedsReview({...base.stickyNotes[1],x:890,w:100},900,600,[]),true);
const spacious={origW:900,origH:600,rotation:0,stickyNotes:[]};
const terminologyDraft=mergeDrafts(spacious,[{text:'FINISH',id:'p0-term',x:100,y:100,w:120,h:30,translation:'表面處理',warning:'Unverified terminology'}],900,600)[0];
assert.equal(terminologyDraft.aiNeedsReview,false,'terminology warning alone must allow human to approve a fitting draft');
assert.match(terminologyDraft.aiWarning,/Unverified terminology/);
const many=Array.from({length:21},(_,i)=>({id:`block-${i}`,text:`Translate ${i}`}));
const batchSizes=[];
const batches=await translateInBatches(many,{},async(path,body)=>{
 batchSizes.push(body.items.length);
 return {items:body.items.map(item=>({...item,translation:'測試',warning:'review'}))};
});
assert.deepEqual(batchSizes,[20,1]);
assert.deepEqual(batches.items.map(x=>x.id),many.map(x=>x.id));
const repeated=Array.from({length:22},(_,i)=>({id:`same-${i}`,text:i%2?'DRAW POLISH':'SURFACES'}));
const repeatedSizes=[];
const repeatedResults=await translateInBatches(repeated,{},async(path,body)=>{
 repeatedSizes.push(body.items.length);
 return {items:body.items.map(item=>({...item,translation:item.text==='SURFACES'?'表面':'沿模方向拋光'}))};
});
assert.deepEqual(repeatedSizes,[2],'repeated callouts must not cause repeated local model requests');
assert.deepEqual(repeatedResults.items.map(x=>x.id),repeated.map(x=>x.id));
await assert.rejects(()=>translateInBatches(many,{},async(path,body)=>({items:body.items.slice(1)})),/回傳缺少/);
const delivered=[];
const mixed=await translateInBatches([
 {id:'p0-a',text:'MATERIAL STEEL'}, {id:'p0-b',text:'DRAW POLISH'},
 {id:'p1-a',text:'MATERIAL STEEL'}
],{},async(path,body)=>({items:body.items.map(item=>item.text==='DRAW POLISH'
 ? {...item,error:'local model did not produce Traditional Chinese'}
 : {...item,translation:'材質鋼材'})}),()=>{},batch=>delivered.push(batch));
assert.equal(delivered.length,1);
assert.deepEqual(delivered[0].map(item=>item.id),['p0-a','p0-b','p1-a']);
assert.equal(mixed.items[0].translation,'材質鋼材');
assert.equal(mixed.items[2].translation,'材質鋼材');
assert.equal(mixed.items[1].translation,undefined,'failed model output must not become a sticker');
assert.match(mixed.items[1].error,/Traditional Chinese/);
const pageBatch=[];
await translateInBatches(many,{},async(path,body)=>({items:body.items.map(item=>({...item,translation:'測試'}))}),()=>{},batch=>pageBatch.push(batch));
assert.deepEqual(pageBatch.map(batch=>batch.length),[20,1],'publish each batch before slow full drawing completes');
const stoppedBatches=[];
const stopped=await translateInBatches(many,{},async(path,body)=>({items:body.items.map(item=>({...item,translation:'測試'}))}),()=>{},batch=>{
 stoppedBatches.push(batch);
 return false;
});
assert.deepEqual(stoppedBatches.map(batch=>batch.length),[20],'stop after current batch, not after full drawing');
assert.equal(stopped.items.length,20);
assert.equal(stopped.stopped,true);
console.log('PASS: AI source filtering, dedupe, rotation, draft lifecycle, glossary, review and batching');
