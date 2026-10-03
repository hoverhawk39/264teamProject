// Install the message handler before loading the asynchronous WASM engine.
const engine=import('./pdf-engine.js');
self.onmessage=async({data})=>{
 const {id,method,bytes,...args}=data;
 try{const api=await engine;let result;
  if(method==='inspect')result=api.inspectPDF(bytes);
  else if(method==='render')result=api.renderPDF(bytes,args.pageIndex,args.width,args.page);
  else if(method==='export')result=api.exportPDF(bytes,args.pages);
  else throw Error('不支援的操作');
  self.postMessage({id,result});
 }catch(error){self.postMessage({id,error:error.message||'PDF 處理失敗'});}
};
engine.then(()=>self.postMessage({type:'ready'}),error=>self.postMessage({type:'init-error',error:error.message||'PDF 引擎無法載入'}));
