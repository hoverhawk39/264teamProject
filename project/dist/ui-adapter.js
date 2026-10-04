/* Explicit UI adapter: React owns presentation; legacy modules own PDF and storage. */
(() => {
 if(!window.DrawingDeskAnt)return;
 const managed=['dashboard','cases','drawing-workspace','drawing-editor','case','export','settings','appearance','new','edit-case'];
 const placeholder=()=>'<div id="antd-page"></div>';
 dashboard=casesPage=casePage=exportPage=settingsPage=appearancePage=newPage=placeholder;
 const snapshot=()=>{
  if(route==='dashboard'){filter=recentCaseStatus;query='';creatorFilter='';casePageIndex=0;}
  const c=current(),groups=c?pdfGroups(c).map(g=>({...g,done:g.pages.filter(isExportReady).length,index:c.files.indexOf(g.pages.find(f=>!isExportReady(f))||g.pages[0])})):[];
  const p=pdfPreparedDownload,prepared=route==='export'&&p&&p.caseId===c?.id&&p.selectionKey===exportSelectionKey(c)?{name:pdfZipName(c),url:p.url,size:p.size,requested:p.requested,pdfSizes:p.pdfSizes||[]}:null;
  return {route,cases,c,groups,rows:visibleCaseRows(),total:matchingCases(filter).length,filter,query,creatorFilter,page:casePageIndex+1,sortKey:caseSortKey,sortDirection:caseSortDirection,deleteMode:caseDeleteMode,selected:[...selectedCaseIds],recentCaseStatus,logs:logs.filter(l=>l.caseId===c?.id),themes,themeKey,theme:themes[themeKey],nav,collapsed:document.body.classList.contains('sidebar-collapsed')&&innerWidth>760,localProjectService,unsaved:unsavedCases.has(c?.id),weeks:dashboardWeeks(),weekKey:dashboardWeekKey,counts:Object.fromEntries(['全部','待確認','處理失敗','可匯出','已匯出'].map(s=>[s,matchingCases(s).length])),stats:['待確認','處理失敗','可匯出','已匯出'].map(s=>all().filter(f=>f.status===s).length),pageCount:all().length,prepared,busy:pdfBusy,exportState:pdfExportState?.caseId===c?.id?pdfExportState:null,exportIds:route==='export'?selectedExportIds(c):[],exportAttempt:route==='export'&&pdfExportAttempt===exportSelectionKey(c),draft:wizardDraft||(route==='edit-case'?c:null),defaultName:defaultCaseName(),defaultDue:defaultDueDate(),owner:demoUser.name};
 };
 function update(){window.DrawingDeskAnt.update(snapshot());}
 const actions={
  go:r=>{go(r);closeSidebar();},openCase,openFile,back:requestPageBack,save:saveCaseProgress,rename:openRenameCase,deleteCase,importFiles:openCaseImport,backup:backupProject,restore:openProjectRestore,saveLocal:saveLocalProject,openLocal:openLocalProjects,ruleLabel,
  openWorkspaceFile:(caseId,index)=>{openCase(caseId);openFile(index);},
  filters:values=>{if('query' in values)query=values.query;if('filter' in values)filter=values.filter;if('owner' in values)creatorFilter=values.owner;casePageIndex=0;selectedCaseIds.clear();update();},
  page:n=>{casePageIndex=n-1;selectedCaseIds.clear();update();},
  sort:(key,order)=>{caseSortKey=order?key:'';caseSortDirection=order==='descend'?-1:1;update();},
  select:ids=>{selectedCaseIds=new Set(ids);update();},toggleDelete:()=>{caseDeleteMode=!caseDeleteMode;selectedCaseIds.clear();update();},deleteSelected:deleteSelectedCases,
  recent:status=>{recentCaseStatus=status;update();},allRecent:openAllRecentCases,
  metric:status=>{filter=status;query='';creatorFilter='';casePageIndex=0;go('cases');},
  week:key=>{dashboardWeekKey=key;update();},theme:key=>applyTheme(key,true),
  due:value=>{updateCaseDueDate({value});update();},
  exportSelect:ids=>{if(pdfBusy)return;pdfExportSelection.set(current().id,ids);pdfExportAttempt='';render();},
  prepare:()=>{pdfExportAttempt='';doExport();},cancelExport:cancelInlineExport,download:link=>pdfDownloadRequested(link),
  create:values=>{const form=document.createElement('form');for(const [name,value] of Object.entries(values)){const input=document.createElement('input');input.name=name;input.value=value;form.append(input);}createCase({preventDefault(){},target:form});},
  cancelWizard:cancelCaseWizard
 };
 window.DrawingDeskUI={snapshot,actions,managed};
 const legacyRender=render;
 render=function(){window.DrawingDeskAnt.unmount();legacyRender();window.DrawingDeskAnt.mount(snapshot(),actions);};
 const legacyProgress=updateInlineExport;
 updateInlineExport=function(text,value){legacyProgress(text,value);if(route==='export')update();};
 new MutationObserver(()=>window.DrawingDeskAnt.updateNav(snapshot())).observe(document.body,{attributes:true,attributeFilter:['class']});
 window.addEventListener('resize',()=>window.DrawingDeskAnt.updateNav(snapshot()));
 render();
})();
