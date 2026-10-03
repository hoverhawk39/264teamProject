const {JSDOM,VirtualConsole}=require('jsdom');
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const vc=new VirtualConsole(),errors=[];
vc.on('jsdomError',e=>{if(!/Could not parse CSS|Not implemented: window.getComputedStyle/.test(e.message))errors.push(e);});
vc.on('error',e=>errors.push(e));
const dom=new JSDOM(fs.readFileSync('dist/index.html','utf8'),{url:'https://test.example/',runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc});
const channels=[];const w=dom.window;w.MessageChannel=class extends require("worker_threads").MessageChannel{constructor(){super();channels.push(this);}};w.matchMedia=q=>({matches:false,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});const observers=[];w.ResizeObserver=class{constructor(callback){this.callback=callback;observers.push(this);}observe(target){this.target=target;}disconnect(){this.target=null;}unobserve(){}};w.scrollTo=()=>{};w.HTMLElement.prototype.scrollIntoView=()=>{};w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};w.HTMLDialogElement.prototype.close=function(){this.open=false;};w.structuredClone=structuredClone;w.TextEncoder=TextEncoder;w.TextDecoder=TextDecoder;w.URL.createObjectURL=()=> 'blob:https://test.example/test';w.URL.revokeObjectURL=()=>{};
const ctx=dom.getInternalVMContext();const run=s=>vm.runInContext(s,ctx);
for(const src of [...w.document.querySelectorAll('script[src]')].map(x=>x.getAttribute('src')))vm.runInContext(fs.readFileSync('dist/'+src,'utf8'),ctx,{filename:src});
const pause=()=>new Promise(r=>setTimeout(r,35));
const text=()=>w.document.querySelector('#app').textContent;
(async()=>{
 await pause();assert(w.document.querySelector('.ant-menu'));assert(w.document.querySelector('.ant-statistic'));assert(text().includes('最近案件'));
 const descriptions=[];
 for(const button of w.document.querySelectorAll('.desk-metric button')){
  button.click();await new Promise(r=>setTimeout(r,160));
  assert.equal(run('route'),'dashboard','info icon must not navigate');
  const visible=[...w.document.querySelectorAll('.ant-tooltip:not(.ant-tooltip-hidden) [role="tooltip"]')];
  assert(visible.length);descriptions.push(visible.at(-1).textContent);
  button.click();await new Promise(r=>setTimeout(r,160));
 }
 assert.equal(new Set(descriptions).size,4,'each metric has its own description');
 assert(descriptions[1].includes('處理失敗'));assert(descriptions[3].includes('下載要求'));
 const chartObserver=observers.filter(o=>o.target?.classList.contains('desk-chart-frame')).at(-1);
 assert(chartObserver);
 for(const [width,height,expected] of [[420,300,300],[190,300,190],[420,240,240]]){
  chartObserver.callback([{contentRect:{width,height}}]);run("DrawingDeskAnt.update(DrawingDeskUI.snapshot())");await pause();
  const circle=w.document.querySelector('.desk-chart-frame .ant-progress-body');
  assert.equal(circle.style.width,expected+'px');assert.equal(circle.style.height,expected+'px');
 }
 const allCases=[...w.document.querySelectorAll('button')].find(b=>b.textContent.includes('全部案件'));
 assert(allCases.querySelector('.anticon-arrow-right'));
 run("cases=Array.from({length:23},(_,i)=>({...seed()[0],id:'test-'+i,name:'案件'+i,files:[{name:'page.pdf',status:i%2?'待確認':'可匯出',accepted:true,notes:[],masks:[]}]}));render()");await pause();assert.equal(w.document.querySelectorAll('.ant-table-tbody .ant-table-row').length,10);
 run("DrawingDeskUI.actions.recent('可匯出')");await pause();assert.equal(w.document.querySelectorAll('.ant-table-tbody .ant-table-row').length,10);
 run("DrawingDeskUI.actions.allRecent()");await pause();assert(text().includes('案件管理'));assert.equal(run('filter'),'可匯出');assert.equal(w.document.querySelectorAll('.ant-table-tbody .ant-table-row').length,10);
 run('DrawingDeskUI.actions.page(2)');await pause();assert.equal(w.document.querySelectorAll('.ant-table-tbody .ant-table-row').length,2);
 const search=w.document.querySelector('input[aria-label="搜尋案件"]');search.focus();run("DrawingDeskUI.actions.filters({query:'案件22'})");await pause();assert.equal(w.document.activeElement,search);assert.equal(w.document.querySelectorAll('.ant-table-tbody .ant-table-row').length,1);
 run("DrawingDeskUI.actions.openCase('test-22')");await pause();assert(text().includes('圖面處理清單'));w.document.querySelector('.ant-table-tbody .ant-table-row').dispatchEvent(new w.KeyboardEvent('keydown',{key:'Enter',bubbles:true}));await pause();assert.equal(run('route'),'work');assert(w.document.querySelector('#drawingViewport'));assert(w.document.querySelector('.canvasbar .ant-btn'));const noteButton=[...w.document.querySelectorAll('.canvasbar .ant-btn')].find(b=>b.textContent.includes('備註色塊'));assert(noteButton);noteButton.click();await pause();assert.equal(run('file().notes.length'),1);assert.equal(run('file().accepted'),false);
 run("go('new')");await pause();assert(w.document.querySelector('.ant-form'));w.document.querySelector('.ant-form').dispatchEvent(new w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,150));assert.equal(run('route'),'import');assert(run('current().name').length>0);
 run("wizardDraft=null;cid='test-22';go('export')");await pause();assert(text().includes('成果與匯出'));assert(w.document.querySelector('.ant-collapse'));
 run("pdfPreparedDownload={caseId:cid,url:'blob:https://test.example/test',name:pdfZipName(current()),size:100,requested:false,files:[],selectionKey:exportSelectionKey()};render()");await pause();const link=w.document.querySelector('#exportSelected');assert.equal(link.tagName,'A');assert(link.download.includes('_NL_'));assert.equal(link.getAttribute('href'),'blob:https://test.example/test');
 run("go('appearance')");await pause();run("DrawingDeskUI.actions.theme('forest')");await pause();assert.equal(w.document.documentElement.dataset.theme,'forest');assert(text().includes('目前使用'));
 for(const route of ['settings','cases','case','dashboard','appearance']){run(`go('${route}')`);await pause();assert(w.document.querySelector('.ant-menu'));assert(w.document.querySelector('#antd-page .ant-card'));}
 assert.deepEqual(errors.map(e=>String(e)),[]);console.log('PASS: Ant navigation, 10-row filters/pagination, search focus, drawing-row keyboard, legacy workspace, wizard, native ZIP link, theme and route remounts');w.close();channels.forEach(c=>{c.port1.close();c.port2.close();});
})().catch(e=>{console.error(e);console.error(errors);w.close();channels.forEach(c=>{c.port1.close();c.port2.close();});process.exitCode=1;});
