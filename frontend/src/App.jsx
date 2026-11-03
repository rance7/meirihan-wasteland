import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {loadWorkspace,saveWorkspace} from './api.js';
import {demoState,download,fmt,normalize} from './domain.js';
import {Icon,Modal} from './components.jsx';
import {BloggerForm,RecordDetail,RecordForm,ReviewForm} from './forms.jsx';
import {Bloggers,labels,Settings} from './views.jsx';
import Workbench from './Workbench.jsx';
import OpinionCalendar from './OpinionCalendar.jsx';
import {EMPTY_FILTERS,filterRecords,reviewRecords as selectReviewRecords,sortRecords} from './workbench.js';

const initialFilter=EMPTY_FILTERS;
export default function App(){
  const [workspace,setWorkspace]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[busy,setBusy]=useState(false),[preview,setPreview]=useState(false);
  const [view,setView]=useState(()=>Object.hasOwn(labels,location.hash.slice(1))?location.hash.slice(1):'overview');
  const [query,setQuery]=useState(''),[filter,setFilter]=useState(initialFilter),[tab,setTab]=useState('pending'),[modal,setModal]=useState(null),[message,setMessage]=useState(''),[draft,setDraft]=useState(null);
  const [sort,setSort]=useState({key:'date',direction:'desc'}),[reviewSort,setReviewSort]=useState({key:'due',direction:'asc'});
  const [legacy]=useState(()=>{try{const raw=localStorage.getItem('jianwei.local.v1');if(!raw)return null;const data=normalize(JSON.parse(raw));return data.mode==='personal'&&(data.records.length||data.bloggers.length)?data:null}catch{return null}});
  const lock=useRef(false),search=useRef(null),importInput=useRef(null),demo=useMemo(()=>demoState(),[]);
  const notify=useCallback(text=>setMessage(text),[]);
  useEffect(()=>{if(!message)return;const timer=setTimeout(()=>setMessage(''),4000);return()=>clearTimeout(timer)},[message]);
  const refresh=useCallback(async(signal)=>{setLoading(true);try{const result=normalize(await loadWorkspace(signal));setWorkspace(result);setError('');setDraft(null);setModal(null);return true}catch(err){if(err.name!=='AbortError')setError(err.message);return false}finally{if(!signal?.aborted)setLoading(false)}},[]);
  useEffect(()=>{const controller=new AbortController();refresh(controller.signal);return()=>controller.abort()},[refresh]);
  useEffect(()=>{const handler=()=>{const name=location.hash.slice(1);if(Object.hasOwn(labels,name))setView(name)};window.addEventListener('hashchange',handler);return()=>window.removeEventListener('hashchange',handler)},[]);
  useEffect(()=>{document.title=`${labels[view]} · 见微`;},[view]);
  useEffect(()=>{function handler(ev){if(ev.key==='/'&&!modal&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)){ev.preventDefault();search.current?.focus()}}window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler)},[modal]);
  const data=preview?demo:workspace;
  function navigate(name){setView(name);location.hash=name;window.scrollTo({top:0});}
  function open(value){setError('');setModal(value)}
  function close(){if(!busy){setModal(null);setError('')}}
  async function persist(next,{keepOpen=false}={}){
    if(preview){notify('当前是只读演示，请返回我的数据库后记录。');return false}
    if(lock.current||!workspace)return false;
    let normalized;
    try{normalized=normalize({...next,revision:workspace.revision});}catch(err){setError(err.message);return false}
    lock.current=true;setBusy(true);setError('');setDraft(normalized);
    try{const saved=normalize(await saveWorkspace(normalized,workspace.revision));setWorkspace(saved);setDraft(null);if(!keepOpen)setModal(null);notify('已保存到 MongoDB');return true}
    catch(err){setError(err.message);return false}
    finally{lock.current=false;setBusy(false)}
  }
  async function change(changeFn,options){const next=structuredClone(workspace);changeFn(next);return persist(next,options)}
  function addRecord(){if(preview){setPreview(false);notify('已返回个人空间，请添加真实记录。');return}open(data?.bloggers.length?{type:'record'}:{type:'blogger',thenRecord:true})}
  function addBlogger(){if(preview){setPreview(false);return}open({type:'blogger'})}
  function openBlogger(id){setQuery('');setFilter({...initialFilter,blogger:id});navigate('ledger')}
  function askDelete(kind,id){if(preview)return;open({type:'confirm',title:kind==='record'?'删除这条观点？':kind==='review'?'撤销这次复盘？':'删除这个博主档案？',text:kind==='record'?'原始记录和关联复盘将一并删除。请先导出备份。':kind==='review'?'原始观点保留，评分和复盘备注将删除，并返回待复盘队列。':'只能删除没有关联观点的博主档案。',confirm:()=>change(s=>{if(kind==='record')s.records=s.records.filter(r=>r.id!==id);else if(kind==='review')s.records.find(r=>r.id===id).review=null;else {if(s.records.some(r=>r.bloggerId===id))throw Error('请先处理关联观点');s.bloggers=s.bloggers.filter(b=>b.id!==id)}})})}
  function prepareImport(raw){if(preview)return;try{const imported=normalize(raw);if(imported.mode==='demo')return notify('这是一份演示备份，不能恢复到个人数据库。');open({type:'confirm',title:'恢复这份备份？',text:`已校验：${imported.bloggers.length} 位博主、${imported.records.length} 条记录。确认后会替换当前数据库中的 ${workspace.bloggers.length} 位博主、${workspace.records.length} 条记录。旧版浏览器原始数据不会删除。`,confirm:()=>persist({...imported,mode:'personal'})})}catch(err){notify('导入失败：'+err.message)}}
  async function importFile(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;if(file.size>8*1024*1024)return notify('备份不能超过 8 MiB');try{prepareImport(JSON.parse(await file.text()))}catch(err){notify('导入失败：'+err.message)}}
  const tableProps={bloggers:data?.bloggers||[],onDetail:r=>open({type:'detail',value:r}),onEdit:r=>open({type:'record',value:r}),onReview:r=>open({type:'review',value:r}),onAdd:addRecord};
  const scope=data?filterRecords(data,query,view==='reviews'?{...filter,status:''}:filter):[];
  const currentSort=view==='reviews'?reviewSort:sort;
  const records=sortRecords(scope,sort,data?.bloggers);
  const reviewRecords=sortRecords(selectReviewRecords(scope,tab),reviewSort,data?.bloggers);
  function changeSort(key){const setter=view==='reviews'?setReviewSort:setSort;setter(previous=>({key,direction:previous.key===key?(previous.direction==='desc'?'asc':'desc'):['due','blogger','target'].includes(key)?'asc':'desc'}));}
  function changeReviewTab(next){setTab(next);setReviewSort({key:next==='completed'?'reviewDate':'due',direction:next==='completed'?'desc':'asc'});}
  function resetFilters(){setFilter(initialFilter);setQuery('');}
  const exportCurrent=()=>data&&download(data);
  const saveDisabled=busy||preview;
  const saveButton=form=><button className="button primary" form={form} type="submit" disabled={saveDisabled}>{busy?'保存中…':'保存'}</button>;
  let modalTitle='',modalSubtitle='',modalBody=null,modalFooter=null;
  if(modal){
    const value=modal.value;
    if(modal.type==='blogger'){
      modalTitle=value?'编辑博主档案':'添加一位博主';modalSubtitle='记录名字、主题和你对其判断方式的观察。';
      modalBody=<BloggerForm value={value} disabled={saveDisabled} onError={setError} onSubmit={async b=>{if(workspace.bloggers.some(x=>x.name===b.name&&x.id!==b.id))return setError('已存在同名博主');const ok=await change(s=>{const i=s.bloggers.findIndex(x=>x.id===b.id);i<0?s.bloggers.push(b):s.bloggers[i]=b},{keepOpen:modal.thenRecord});if(ok&&modal.thenRecord)setModal({type:'record',preferredBlogger:b.id})}}/>;
      modalFooter=<>{value&&<button className="button danger" disabled={saveDisabled||data.records.some(r=>r.bloggerId===value.id)} onClick={()=>askDelete('blogger',value.id)}>删除档案</button>}<button className="button" disabled={busy} onClick={close}>取消</button>{saveButton('blogger-form')}</>;
    }else if(modal.type==='record'){
      modalTitle=value?'编辑观点记录':'记下一个观点';modalSubtitle='保留当时的原话和条件，不用事后结果改写判断。';
      modalBody=<RecordForm value={value} bloggers={data.bloggers} preferredBlogger={modal.preferredBlogger} disabled={saveDisabled} onError={setError} onSubmit={r=>change(s=>{const i=s.records.findIndex(x=>x.id===r.id);i<0?s.records.push(r):s.records[i]=r})}/>;
      modalFooter=<>{value&&<button className="button danger" disabled={saveDisabled} onClick={()=>askDelete('record',value.id)}>删除记录</button>}<button className="button" disabled={busy} onClick={close}>取消</button>{saveButton('record-form')}</>;
    }else if(modal.type==='review'){
      modalTitle='回看与评分';modalSubtitle=`${data.bloggers.find(b=>b.id===value.bloggerId)?.name} · ${value.title}`;
      modalBody=<ReviewForm record={value} disabled={saveDisabled} onError={setError} onSubmit={review=>change(s=>s.records.find(r=>r.id===value.id).review=review)}/>;
      modalFooter=<>{value.review&&<button className="button danger" disabled={saveDisabled} onClick={()=>askDelete('review',value.id)}>撤销复盘</button>}<button className="button" onClick={close} disabled={busy}>取消</button>{saveButton('review-form')}</>;
    }else if(modal.type==='detail'){
      modalTitle=value.title;modalSubtitle=`${fmt(value.date)} · ${value.kind}`;modalBody=<RecordDetail record={value} blogger={data.bloggers.find(b=>b.id===value.bloggerId)}/>;
      modalFooter=<><button className="button" disabled={preview} onClick={()=>open({type:'record',value})}>编辑原始记录</button>{value.verified&&<button className="button primary" disabled={preview} onClick={()=>open({type:'review',value})}>{value.review?'修改复盘':'开始复盘'}</button>}</>;
    }else if(modal.type==='notes'){
      modalTitle='手写笔记参考';modalSubtitle='保留原始证据，姓名和日期请逐条核对。';modalBody=<><img className="photo-preview" src="/assets/handwritten-notes.jpg" alt="用户提供的手写博主观点笔记"/><p className="note-details">照片中的模糊文字和「+1」不会自动转为评分。核对后再录入原话、日期和成立条件。</p><a className="help-link" href="/assets/handwritten-notes.jpg" target="_blank" rel="noreferrer">打开原图查看 ↗</a></>;modalFooter=<><button className="button" onClick={close}>关闭</button><button className="button primary" onClick={addRecord} disabled={preview}>核对后录入</button></>;
    }else{
      modalTitle=modal.title;modalBody=<div className="confirmation">{modal.text}</div>;modalFooter=<><button className="button" onClick={exportCurrent}>先导出当前数据</button><button className="button" disabled={busy} onClick={close}>取消</button><button className="button primary" disabled={busy} onClick={modal.confirm}>{busy?'保存中…':'确认'}</button></>;
    }
  }
  const pageTitles={overview:'观点工作台',ledger:'观点台账',calendar:'观点日历',bloggers:'博主档案',reviews:'复盘工作台',settings:'数据与评分规则'};
  const subtitles={overview:'观点、依据与结果，在同一张工作台里回看。',ledger:'按日期整理每个判断，保留完整的原始依据。',calendar:'沿着发表日期，回看每一天的原始判断。',bloggers:'观察每位博主的判断方式与长期记录。',reviews:'对照原始条件和后续事实，完成一次有依据的复盘。',settings:'透明的评分规则，以及始终属于你的研究数据。'};
  return <>
    <aside className="sidebar">
      <a className="brand" href="#overview" title="见微 · 观点复盘簿" aria-label="见微首页" onClick={()=>navigate('overview')}><span className="brand-mark">见</span></a>
      <nav aria-label="主导航">{['overview','ledger','calendar','bloggers','reviews'].map(v=><button key={v} title={labels[v]} aria-current={view===v?'page':undefined} className={`nav-item ${view===v?'active':''}`} onClick={()=>navigate(v)}><Icon name={v}/><span>{v==='overview'?'工作台':labels[v]}</span></button>)}</nav>
      <div className="sidebar-bottom"><button title="手写笔记参考" aria-label="手写笔记参考" onClick={()=>open({type:'notes'})}><Icon name="note"/><span>笔记</span></button><button title="数据与评分规则" aria-label="数据与评分规则" className={view==='settings'?'active':''} onClick={()=>navigate('settings')}><Icon name="settings"/><span>设置</span></button><div className="rail-profile" title="本地个人空间">我</div></div>
    </aside>
    <div className="app-shell">
      <header className="topbar"><div className="workspace-heading"><div className="app-wordmark">见微<span>JIANWEI</span></div><span className="heading-divider"/><div><div className="eyebrow">RESEARCH WORKSPACE</div><h1>{pageTitles[view]}</h1></div></div><div className="top-tools"><label className="search"><Icon name="search"/><input ref={search} value={query} onChange={ev=>setQuery(ev.target.value)} placeholder="搜索博主、标的或观点" aria-label="搜索博主、标的或观点"/><kbd>/</kbd></label><button className="icon-button" title="刷新数据库记录" aria-label="刷新数据库记录" disabled={busy||loading} onClick={()=>refresh()}><Icon name="refresh"/></button><button className="button secondary add-blogger-button" onClick={addBlogger} disabled={!data||busy}><Icon name="bloggers"/><span>添加博主</span></button><button className="button primary" onClick={view==='bloggers'?addBlogger:addRecord} disabled={!data||busy}><Icon name="plus"/>{view==='bloggers'?'新建档案':'记录观点'}</button></div></header>
      <main>
        <div className="workspace-meta"><span>{subtitles[view]}</span><div className="workspace-connection"><i className={error?'connection-dot error':'connection-dot'}/><span>{preview?'只读演示':loading?'连接中':workspace?'MongoDB 已连接':'数据库未连接'}</span>{workspace&&!preview&&<span className="revision-label">修订 {workspace.revision}</span>}<span className="meta-divider"/><button onClick={()=>setPreview(!preview)}>{preview?'返回我的数据库':'查看演示'}</button><button className="export-shortcut" onClick={exportCurrent} disabled={!data}><Icon name="download"/>导出</button></div></div>
        {!data?<section className="panel connection-empty"><div className="empty"><div className="empty-icon"><Icon name="ledger"/></div><strong>{loading?'正在连接你的研究空间…':'数据库尚未连接'}</strong><p>{loading?'从 MongoDB 读取博主、观点和复盘记录。':error}</p><div className="actions center"><button className="button primary" onClick={()=>refresh()} disabled={loading}>重新连接</button><button className="button" onClick={()=>{setPreview(true);setError('')}}>查看只读演示</button></div></div></section>:<>
          {preview&&<div className="demo-banner"><span><Icon name="note"/>只读演示 · 所有博主、观点和评分均为虚构，不写入 MongoDB。</span><button onClick={()=>setPreview(false)}>返回我的数据库 <Icon name="arrowRight"/></button></div>}
          {error&&!modal&&<div className="error-box" role="alert">{error}<div className="actions"><button className="button small" onClick={()=>draft&&download(draft)}>导出待保存数据</button><button className="button small" onClick={()=>refresh()}>载入最新数据</button></div></div>}
          {legacy&&!preview&&<div className="demo-banner"><span>检测到旧版浏览器个人记录，可手动迁入 MongoDB。</span><button onClick={()=>prepareImport(legacy)}>核对并迁移 →</button></div>}
          {['overview','ledger','reviews'].includes(view)&&<Workbench data={data} records={view==='reviews'?reviewRecords:records} analyticsRecords={scope} filter={view==='reviews'?{...filter,status:''}:filter} setFilter={setFilter} onReset={resetFilters} tableProps={tableProps} onBlogger={openBlogger} onManage={b=>b?open({type:'blogger',value:b}):navigate('bloggers')} sort={currentSort} onSort={changeSort} reviewMode={view==='reviews'} tab={tab} setTab={changeReviewTab}/>}
          {view==='calendar'&&<OpinionCalendar data={data} records={scope} filter={filter} setFilter={setFilter} onReset={resetFilters} onDetail={tableProps.onDetail} onTable={()=>navigate('ledger')}/>}
          {view==='bloggers'&&<Bloggers data={data} query={query} onView={openBlogger} onEdit={b=>open({type:'blogger',value:b})} onAdd={addBlogger}/>}
          {view==='settings'&&<Settings data={data} preview={preview} onImport={()=>importInput.current.click()} onNotes={()=>open({type:'notes'})} onDemo={()=>setPreview(!preview)} legacy={legacy} onLegacy={()=>prepareImport(legacy)}/>}
        </>}
      </main>
      <footer><span>见微 <i/> 记录判断，检验判断</span><div><span>本地个人研究空间</span><button onClick={()=>navigate('settings')}>数据与评分规则</button></div></footer>
    </div>
    {modal&&<Modal variant={modal.type==='detail'?'drawer':'dialog'} key={`${modal.type}-${modal.value?.id||''}`} title={modalTitle} subtitle={modalSubtitle} busy={busy} onClose={close} error={error} onExportDraft={()=>download(draft||workspace)} onReload={()=>refresh()} footer={modalFooter}>{modalBody}</Modal>}<input hidden ref={importInput} type="file" accept="application/json,.json" onChange={importFile}/><div id="toast" className={message?'visible':''} role="status" aria-live="polite">{message}</div>
  </>;
}
