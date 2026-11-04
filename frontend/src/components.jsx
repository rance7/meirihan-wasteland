import {useEffect,useRef} from 'react';
import {average,dayOffset,eligible,fmt,formatSuccessRate,recordStage,score,successRate} from './domain.js';

export function SuccessRateStat({records}){
 const stats=successRate(records);
 return <div className="success-statistic" aria-label="成功率统计" title="仅统计已复盘且明确标记成功或失败的观点；评分选填，每条观点等权。"><div><span>成功率</span><strong>{formatSuccessRate(stats)}</strong></div><small>{stats.judged?`${stats.success} 成功 / ${stats.judged} 已判定 · ${stats.failure} 失败`:'尚无已判定观点'}{stats.unjudged>0&&` · ${stats.unjudged} 未判定`}</small></div>;
}

const paths={
 overview:<><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
 ledger:<><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
 bloggers:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6M18 15a5 5 0 0 1 3 5"/></>,
 reviews:<><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16m-11 5 2 2 4-4"/></>,
 score:<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>,
 search:<><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
 filter:<path d="M3 5h18l-7 8v6l-4 2v-8Z"/>,
 chevron:<path d="m8 10 4 4 4-4"/>,
 arrowRight:<path d="M4 12h15m-5-5 5 5-5 5"/>,
 refresh:<><path d="M20 8a8 8 0 0 0-13-3L3 8m0-5v5h5M4 16a8 8 0 0 0 13 3l4-3m0 5v-5h-5"/></>,
 download:<><path d="M12 3v12m-4-4 4 4 4-4M4 16v5h16v-5"/></>,
 plus:<path d="M12 4v16M4 12h16"/>,
 close:<path d="m6 6 12 12M6 18 18 6"/>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
 calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h3m4 0h3m-10 3h3"/></>,
 note:<><path d="M5 3h14v18H5ZM9 7h6M9 11h6M9 15h3"/></>,
 settings:<><path d="m9 3-.5 3-2 1L4 6 2 10l2.5 2v2L2 16l2 4 2.5-1 2 1L9 23h6l.5-3 2-1 2.5 1 2-4-2.5-2v-2L22 10l-2-4-2.5 1-2-1L15 3Z" transform="translate(1 -1) scale(.92)"/><circle cx="12" cy="12" r="3"/></>
};
export function Icon({name,className=''}){return <svg className={`icon ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]||paths.ledger}</svg>}
export function Avatar({blogger}){return <span className={`avatar ${blogger?.color||'purple'}`}>{blogger?.name?.slice(0,1)||'?'}</span>}
export function Person({blogger}){return <div className="person-cell"><Avatar blogger={blogger}/><span>{blogger?.name||'未知博主'}</span></div>}
export function Direction({record}){return <span className={`badge ${record.direction==='看多'?'long':record.direction==='看空'?'short':'neutral'}`}>{record.direction}</span>}
export function Status({record}){return recordStage(record)==='pending'?<span className="badge pending">待复盘</span>:<span className="judged-status"><span className={`badge verdict-${record.review.verdict}`}>{record.review.verdict==='success'?'成功':'失败'}</span><small>已复盘</small></span>}
export function Empty({title='还没有观点记录',detail='从一个博主、一个观点开始，慢慢建立自己的判断档案。',onAdd,actionLabel='记录观点'}){return <div className="empty"><div className="empty-icon"><Icon name="ledger"/></div><strong>{title}</strong><p>{detail}</p>{onAdd&&<button className="button soft" onClick={onAdd}><Icon name="plus"/>{actionLabel}</button>}</div>}
export function Chart({records}){
  const buckets=Array.from({length:6},(_,i)=>{const start=dayOffset(-41+i*7),end=dayOffset(-35+i*7);const items=records.filter(r=>eligible(r)&&r.review.date>=start&&r.review.date<=end);return {label:start.slice(5).replace('-','/'),value:average(items),count:items.length}});
  const points=buckets.map((b,i)=>b.value===null?null:[42+i*85,148-b.value*1.2]);
  const segments=[];let current=[];for(const p of points){if(p)current.push(p);else if(current.length){segments.push(current);current=[]}}if(current.length)segments.push(current);
  return <><div className="chart"><svg viewBox="0 0 500 180" role="img" aria-label="近六周复盘平均分，无样本的周留空"><defs><linearGradient id="score-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ab94e7" stopOpacity=".18"/><stop offset="100%" stopColor="#ab94e7" stopOpacity=".01"/></linearGradient></defs>{[0,25,50,75,100].map(v=><g key={v}><path d={`M30 ${148-v*1.2}H480`} stroke="#273243" strokeDasharray="3 5"/><text x="2" y={151-v*1.2}>{v}</text></g>)}{segments.filter(s=>s.length>1).map((s,i)=><g key={i}><path d={`M${s[0][0]} 148 L${s.map(p=>p.join(' ')).join(' L')} L${s.at(-1)[0]} 148Z`} fill="url(#score-area)"/><path d={`M${s.map(p=>p.join(' ')).join(' L')}`} fill="none" stroke="#a087d7" strokeWidth="2.5"/></g>)}{points.map((p,i)=>p&&<circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#151d29" stroke="#a087d7" strokeWidth="2"><title>{buckets[i].label} 起这一周：{buckets[i].value} 分 / {buckets[i].count} 条</title></circle>)}{buckets.map((b,i)=><text key={i} x={42+i*85} y="174" textAnchor="middle">{b.label}</text>)}{points.every(p=>!p)&&<text x="250" y="85" textAnchor="middle">完成复盘后，这里会留下判断的轨迹</text>}</svg></div><div className="chart-legend"><span/>每周复盘均分 · 无样本时留空</div></>;
}

export function Modal({title,subtitle,onClose,busy,error,onExportDraft,onReload,children,footer,variant='dialog'}){
 const ref=useRef(null);
 useEffect(()=>{const dialog=ref.current;dialog.showModal();return ()=>dialog.close()},[]);
 function backdrop(event){if(event.target!==event.currentTarget||busy)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)onClose();}
 return <dialog className={variant==='drawer'?'detail-drawer':''} ref={ref} aria-label={title} onClick={backdrop} onCancel={event=>{event.preventDefault();if(!busy)onClose()}}><div className="modal-head"><div><div className="eyebrow">{variant==='drawer'?'观点详情 / ORIGINAL RECORD':'美日韩废土 · 研究工作台'}</div><h2>{title}</h2>{subtitle&&<p>{subtitle}</p>}</div><button className="close" aria-label="关闭弹窗" disabled={busy} onClick={onClose}><Icon name="close"/></button></div><div className="modal-body">{error&&<div className="error-box" role="alert">{error}<div className="actions"><button type="button" className="button small" onClick={onExportDraft}>导出待保存数据</button><button type="button" className="button small" onClick={onReload}>载入最新并关闭表单</button></div></div>}{children}</div>{footer&&<div className="modal-foot">{footer}</div>}</dialog>
}
