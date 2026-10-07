import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {App,Button,ConfigProvider} from 'antd';
import zhTW from 'antd/locale/zh_TW';
import {deskTheme} from './theme';
import './ui.css';

const brand={primary:'#245c89',ink:'#243447',muted:'#68788b',line:'#d9e1ea',bg:'#f5f7fa',soft:'#eef4f8'};
const ids=['undoBtn','redoBtn','clearProgressBtn','previewBtn','saveProgressBtn','exportBtn'];

function DrawingEditor(){
 const frame=useRef(null),observer=useRef(null);
 const [ready,setReady]=useState({});
 const forward=id=>{
  const button=frame.current?.contentDocument?.getElementById(id);
  if(button&&!button.disabled)button.click();
 };
 const onFrameLoad=()=>{
  observer.current?.disconnect();
  const doc=frame.current?.contentDocument;
  if(!doc){setReady({});return;}
  frame.current.contentWindow.postMessage({type:'drawing-editor-theme',color:brand.primary},location.origin);
  const buttons=ids.map(id=>doc.getElementById(id));
  if(buttons.some(button=>!button)){setReady({});return;}
  const sync=()=>setReady(Object.fromEntries(ids.map((id,index)=>[id,!buttons[index].disabled])));
  sync();
  observer.current=new MutationObserver(sync);
  buttons.forEach(button=>observer.current.observe(button,{attributes:true,attributeFilter:['disabled']}));
 };
 useEffect(()=>()=>observer.current?.disconnect(),[]);
 return <ConfigProvider locale={zhTW} theme={deskTheme(brand)}><App className="desk-ant">
  <header className="app-header"><div className="brand"><img src="assets/mold-logo.png" width="34" height="34" alt=""/><span>圖面編輯區</span></div>
   <div className="header-actions" aria-label="圖面編輯操作">
    <Button disabled={!ready.undoBtn} onClick={()=>forward('undoBtn')}>復原</Button>
    <Button disabled={!ready.redoBtn} onClick={()=>forward('redoBtn')}>重做</Button>
    <Button danger disabled={!ready.clearProgressBtn} onClick={()=>forward('clearProgressBtn')}>清除進度且重新作業</Button>
    <Button type="primary" disabled={!ready.previewBtn} onClick={()=>forward('previewBtn')}>預覽本檔完工圖</Button>
    <Button type="primary" disabled={!ready.saveProgressBtn} onClick={()=>forward('saveProgressBtn')}>暫存目前進度</Button>
    <Button type="primary" disabled={!ready.exportBtn} onClick={()=>forward('exportBtn')}>匯出所有完工圖</Button>
   </div>
  </header>
  <main><h1>圖面編輯區</h1><iframe ref={frame} onLoad={onFrameLoad} title="圖面編輯區工具" src="drawing-editor.html"/></main>
 </App></ConfigProvider>;
}
createRoot(document.getElementById('root')).render(<DrawingEditor/>);
