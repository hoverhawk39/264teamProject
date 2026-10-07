const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM,VirtualConsole}=require('jsdom');
const errors=[],vc=new VirtualConsole();
vc.on('jsdomError',error=>errors.push(error.message));
const html=fs.readFileSync('dist/index.html','utf8');
for(const old of ['app.js','pdf-workspace.js','pdf-worker.js','pdf-engine.js','workflow-tools.js','project-backup.js','glossary.js','glossary-data.js','ai-settings.js','ui-adapter.js','style.css'])
 assert.ok(!fs.existsSync('dist/'+old),`unused legacy module should be removed: ${old}`);
const dom=new JSDOM(html,{url:'http://127.0.0.1:8765/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
const {window:w}=dom;
assert.equal(w.document.querySelector('#nav'),null,'remove sidebar/navigation entirely');
w.localStorage.setItem('drawing-desk-independent-editor-v11-progress','saved-editor-state');
w.localStorage.setItem('drawing-desk-cases-v1','old-case-state');
w.matchMedia=q=>({matches:false,media:q,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
w.HTMLElement.prototype.scrollIntoView=()=>{};
for(const script of w.document.querySelectorAll('script[src]')){
 const src=script.getAttribute('src').split('?')[0];
 assert.ok(fs.existsSync('dist/'+src),src+' should exist');
 w.eval(fs.readFileSync('dist/'+src,'utf8'));
}
setTimeout(()=>{
 try{
  const text=w.document.body.textContent;
  const frame=w.document.querySelector('iframe[title="圖面編輯區工具"]');
  assert.ok(frame,'editor is the only application view');
  assert.equal(frame.getAttribute('src'),'drawing-editor.html','preserve same-origin editor and storage');
  assert.equal(w.document.querySelector('#nav'),null,'remove sidebar/navigation entirely');
  for(const obsolete of ['工作總覽','案件管理','圖面編輯工作區','專業翻譯知識庫','估價審批','SQ 資料整理','設定'])
   assert.ok(!text.includes(obsolete),`obsolete page ${obsolete} still in document`);
  const actions=[...w.document.querySelectorAll('button')].map(button=>button.textContent.replace(/\s+/g,'').trim());
  assert.deepEqual(actions,['復原','重做','清除進度且重新作業','預覽本檔完工圖','暫存目前進度','匯出所有完工圖']);
  assert.equal(w.localStorage.getItem('drawing-desk-independent-editor-v11-progress'),'saved-editor-state');
  assert.equal(w.localStorage.getItem('drawing-desk-cases-v1'),'old-case-state');
  assert.deepEqual(errors,[]);
  console.log('PASS: only editor view, original header controls, no old routes, existing storage untouched');
 }catch(error){console.error(error);process.exitCode=1}
 finally{w.close()}
},150);
