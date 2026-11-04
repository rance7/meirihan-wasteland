import {useState} from 'react';
import {dateToday,dayOffset,fmt,hasRatings,priceReturn,recordTitle,REVIEW_VERDICTS,safeURL,score,uid} from './domain.js';
import {Direction,Status} from './components.jsx';

function Field({label,full=false,children}){return <label className={`field ${full?'full':''}`}>{label}{children}</label>}
const str=(data,key)=>String(data.get(key)||'').trim();
export function BloggerForm({value,disabled,onSubmit,onError}){
  const b=value||{name:'',platform:'',tags:'',bio:'',color:'purple'};
  function submit(event){event.preventDefault();const f=new FormData(event.target);const next={id:b.id||uid(),name:str(f,'name'),platform:str(f,'platform'),tags:str(f,'tags').replaceAll('，',','),bio:str(f,'bio'),color:str(f,'color')};if(!next.name)return onError('请填写博主名称');onSubmit(next)}
  return <form id="blogger-form" onSubmit={submit}><fieldset disabled={disabled}><div className="form-grid"><Field label="博主名称 *"><input name="name" defaultValue={b.name} required maxLength={60} placeholder="例如：你关注的博主"/></Field><Field label="平台 / 主页名称"><input name="platform" defaultValue={b.platform} maxLength={100} placeholder="微博、小红书、公众号…"/></Field><Field label="关注主题" full><input name="tags" defaultValue={b.tags} maxLength={180} placeholder="用逗号分隔，例如：科技，宏观，趋势"/></Field><Field label="观察备注" full><textarea name="bio" defaultValue={b.bio} maxLength={1000}/></Field><Field label="档案颜色"><select name="color" defaultValue={b.color}>{[['purple','紫罗兰'],['blue','雾蓝'],['green','鼠尾草'],['orange','暖砂'],['pink','浅蔷薇']].map(([v,t])=><option key={v} value={v}>{t}</option>)}</select></Field></div></fieldset></form>
}
export function RecordForm({value,bloggers,preferredBlogger,disabled,onSubmit,onError}){
  const r=value||{id:'',bloggerId:preferredBlogger||bloggers[0]?.id,title:'',target:'',quote:'',direction:'观望',kind:'观点',date:dateToday(),due:dayOffset(7),horizon:'一周',condition:'',invalidation:'',source:'',verified:false};
  function submit(event){event.preventDefault();const f=new FormData(event.target),next={id:r.id||uid(),review:null};for(const k of ['bloggerId','title','target','quote','direction','kind','date','due','horizon','condition','invalidation','source'])next[k]=str(f,k);next.verified=false;next.status='draft';if(next.due&&next.due<next.date)return onError('计划回看日期不能早于发表日期');if(next.source&&!safeURL(next.source))return onError('原文来源仅支持不含登录凭据的 HTTP / HTTPS 链接');if(!next.target)return onError('请填写标的 / 主题');onSubmit(next)}
  return <form id="record-form" onSubmit={submit}><fieldset disabled={disabled}>{r.review&&<div className="note-callout">保存原始记录的修改会撤销已有结果判定和评分，请根据修改后的观点重新复盘。</div>}<div className="form-grid"><Field label="博主 *"><select name="bloggerId" defaultValue={r.bloggerId} required>{bloggers.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}</select></Field><Field label="记录类型"><select name="kind" defaultValue={r.kind}>{['观点','操作'].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="一句话概括（可选）" full><input name="title" defaultValue={r.title} maxLength={180} placeholder="他对什么做出了怎样的判断？"/></Field><Field label="标的 / 主题 *"><input name="target" defaultValue={r.target} required maxLength={100}/></Field><Field label="观点方向"><select name="direction" defaultValue={r.direction}>{['看多','看空','观望'].map(v=><option key={v}>{v}</option>)}</select></Field><Field label="原始发表日期 *"><input name="date" type="date" defaultValue={r.date} required max={dateToday()}/></Field><Field label="计划回看日期"><input name="due" type="date" defaultValue={r.due}/></Field><Field label="判断周期"><select name="horizon" defaultValue={r.horizon}>{Array.from(new Set(['日内','一天','一周','一个月','一个季度','长期','未明确',r.horizon])).map(v=><option key={v}>{v}</option>)}</select></Field><Field label="原文来源"><input name="source" type="url" defaultValue={r.source} maxLength={2000} placeholder="https://…"/><small>仅保存链接，不自动抓取。</small></Field>{[['quote','原话 / 原始操作（可选）',10000,false],['condition','成立条件',3000,false],['invalidation','失效条件 / 风险',3000,false]].map(([k,t,max,required])=><Field label={t} full key={k}><textarea name={k} defaultValue={r[k]} required={required} maxLength={max}/></Field>)}</div></fieldset></form>
}
export function ReviewForm({record,disabled,onSubmit,onError}){
  const value=record.review||{date:dateToday(),ratings:[],outcome:'',lesson:'',entry:null,exit:null,benchmark:null};
  const [verdict,setVerdict]=useState(value.verdict??null);
  const [withRatings,setWithRatings]=useState(hasRatings(record));
  const [ratings,setRatings]=useState(hasRatings(record)?value.ratings:[3,3,3,3]);
  function submit(event){
    event.preventDefault();
    if(verdict===null)return onError('请选择成功、失败或暂不判定');
    const f=new FormData(event.currentTarget);
    const next={date:str(f,'date'),verdict,ratings:withRatings?[...ratings]:[],outcome:str(f,'outcome'),lesson:str(f,'lesson')};
    for(const k of ['entry','exit','benchmark'])next[k]=f.get(k)===''?null:Number(f.get(k));
    if((next.entry===null)!==(next.exit===null))return onError('起始和结束价格需要同时填写');
    if(next.benchmark!==null&&next.benchmark < -100)return onError('基准涨跌幅不能低于 -100%');
    onSubmit(next);
  }
  const dims=[['方向与结果',40,'是否兑现事先说明的判断？观望按其目标评估。'],['时点与节奏',25,'是否在约定周期内兑现？避免无限延长周期。'],['风险与条件',20,'前置条件、仓位和失效条件是否明确有效？'],['表达与可验证性',15,'原话能否被检验，是否含糊或事后改写？']];
  return <form id="review-form" onSubmit={submit}><fieldset disabled={disabled}>
    <div className="result-context"><Direction record={record}/><strong>{recordTitle(record)}</strong><small>发表于 {fmt(record.date)} · 判断周期 {record.horizon||'未明确'} · 计划回看 {fmt(record.due)}</small>{record.quote&&<p>{record.quote}</p>}{record.condition&&<p>成立条件：{record.condition}</p>}{record.invalidation&&<p>失效条件 / 风险：{record.invalidation}</p>}</div>
    <div className="result-options" role="group" aria-label="复盘结果">{[['success','成功','判断符合预期'],['failure','失败','判断未按预期兑现'],['','暂不判定','条件或时间还不足']].map(([key,label,hint])=><label className={`result-option ${key||'unjudged'} ${verdict===key?'selected':''}`} key={key}><input type="radio" name="verdict" value={key} checked={verdict===key} onChange={()=>setVerdict(key)} required/><span><b>{label}</b><small>{hint}</small></span></label>)}</div>
    <p className="result-help">成功或失败即为已复盘，并计入博主成功率；暂不判定留在待复盘。以下评分、依据和心得均可留空。</p>
    <div className="form-grid"><Field label="复盘日期 *" full><input name="date" type="date" defaultValue={value.date} min={record.date} max={dateToday()} required/></Field><Field label="实际结果与依据（可选）" full><textarea name="outcome" defaultValue={value.outcome} maxLength={10000} placeholder="对照原始方向、条件和约定周期，记下判断依据。"/></Field><Field label="复盘心得（可选）" full><textarea name="lesson" defaultValue={value.lesson} maxLength={5000}/></Field></div>
    <label className="review-rating-toggle"><input type="checkbox" checked={withRatings} onChange={ev=>setWithRatings(ev.target.checked)}/>填写四项评分（可选）</label>
    {withRatings&&<div className="review-optional-ratings"><div className="score-total">本次复盘得分 <strong>{score({review:{ratings}})}</strong> / 100</div>{dims.map(([t,w,h],i)=><div className="score-row" key={t}><label htmlFor={`rating-${i}`}>{t}<b>{ratings[i]} / 5 · 权重 {w}%</b></label><input id={`rating-${i}`} type="range" min="0" max="5" step="1" value={ratings[i]} onChange={ev=>setRatings(ratings.map((n,j)=>j===i?Number(ev.target.value):n))}/><small>{h}</small></div>)}</div>}
    <details className="review-price-fields"><summary>价格与基准（可选）</summary><div className="form-grid"><Field label="起始价格（可选）"><input name="entry" type="number" defaultValue={value.entry??''} min="0.000001" step="any"/></Field><Field label="结束价格（可选）"><input name="exit" type="number" defaultValue={value.exit??''} min="0" step="any"/></Field><Field label="基准同期涨跌幅 %（可选）" full><input name="benchmark" type="number" defaultValue={value.benchmark??''} min="-100" step="any"/><small>请填写同一时间区间的基准涨跌，价格回报与主观评分分别展示。</small></Field></div></details>
  </fieldset></form>;
}
export function RecordDetail({record:r,blogger}){
  const v=r.review,returns=priceReturn(v);
  return <><Direction record={r}/> <Status record={r}/><blockquote className="detail-quote">{r.quote||'未填写原话 / 原始操作'}</blockquote>
    <div className="detail-meta">{[['博主',blogger?.name],['标的 / 主题',r.target],['判断周期',r.horizon],['计划回看日期',fmt(r.due)],['成立条件',r.condition||'未记录'],['失效条件 / 风险',r.invalidation||'未记录']].map(([key,value])=><div key={key}>{key}<b>{value}</b></div>)}<div>原文来源<b>{safeURL(r.source)?<a href={r.source} target="_blank" rel="noopener noreferrer">打开原文 ↗</a>:'未保存链接'}</b></div></div>
    {v&&<><div className={`verdict-summary ${v.verdict||'unjudged'}`}><span>复盘结果 · {fmt(v.date)}</span><strong>{REVIEW_VERDICTS[v.verdict]||'暂不判定'}</strong></div>
      {hasRatings(r)&&<div className="review-score"><strong>{score(r)}</strong><div>复盘日期 {fmt(v.date)}<br/>方向 {v.ratings[0]} · 时点 {v.ratings[1]} · 风险 {v.ratings[2]} · 表达 {v.ratings[3]}</div></div>}
      <h4>实际结果与依据</h4><p className="result-note">{v.outcome||'未填写'}</p>
      <h4>复盘心得</h4><p className="result-note">{v.lesson||'未填写'}</p>
      {returns!==null&&<div className="note-callout">价格区间回报：{returns>=0?'+':''}{returns.toFixed(2)}%{v.benchmark!==null&&<> · 基准 {v.benchmark}% · 简单差值 {(returns-v.benchmark).toFixed(2)} 个百分点</>}<br/>按（结束价 ÷ 起始价 − 1）计算，未扣费用；不代表空头收益或实际账户回报。</div>}
    </>}
  </>;
}
