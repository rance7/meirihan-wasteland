import {useMemo,useState} from 'react';
import {dateToday,fmt} from './domain.js';
import {Icon,Person,Status,Direction} from './components.jsx';
import {FilterBar} from './Workbench.jsx';
import {groupByPublicationDate,monthDays,shiftMonth} from './calendar.js';
import './calendar.css';

const weekdays=['日','一','二','三','四','五','六'];

export default function OpinionCalendar({data,records,filter,setFilter,onReset,onDetail,onTable}) {
  const today=dateToday();
  const [month,setMonth]=useState(()=>today.slice(0,7));
  const [selected,setSelected]=useState(today);
  const groups=useMemo(()=>groupByPublicationDate(records),[records]);
  const days=useMemo(()=>monthDays(month),[month]);
  const bloggers=new Map(data.bloggers.map(b=>[b.id,b]));
  const monthRecords=records.filter(r=>r.date.startsWith(month));
  const selectedRecords=groups.get(selected)||[];
  const publishedDays=new Set(monthRecords.map(r=>r.date)).size;
  function chooseDate(date){setSelected(date);setMonth(date.slice(0,7));}
  function moveMonth(amount){const next=shiftMonth(month,amount);setMonth(next);setSelected(`${next}-01`);}
  return <section className="opinion-calendar" aria-label="按发表日期查看观点">
    <FilterBar data={data} filter={filter} setFilter={setFilter} onReset={onReset}/>
    <div className="calendar-layout">
      <section className="calendar-panel">
        <header className="calendar-toolbar">
          <div className="calendar-month-navigation">
            <button className="icon-button calendar-previous" aria-label="上个月" onClick={()=>moveMonth(-1)}><Icon name="arrowRight"/></button>
            <h2 aria-live="polite">{month.slice(0,4)} 年 {Number(month.slice(5))} 月</h2>
            <button className="icon-button" aria-label="下个月" onClick={()=>moveMonth(1)}><Icon name="arrowRight"/></button>
          </div>
          <div className="calendar-toolbar-actions"><span className="calendar-month-total">{monthRecords.length} 条观点 · {publishedDays} 个发表日</span><button className="button small" onClick={()=>chooseDate(today)}>今天</button><button className="button small" onClick={onTable}><Icon name="ledger"/>表格视图</button></div>
        </header>
        <div className="calendar-weekdays" aria-hidden="true">{weekdays.map((day,i)=><span className={i===0||i===6?'weekend':''} key={day}>{day}</span>)}</div>
        <div className="calendar-grid">
          {days.map(day=>{
            const items=groups.get(day.key)||[];
            return <section key={day.key} className={`calendar-day ${day.inMonth?'':'outside-month'} ${selected===day.key?'selected':''} ${today===day.key?'is-today':''}`} aria-label={`${fmt(day.key)}，${items.length} 条观点`}>
              <button className="calendar-date" aria-label={`选择 ${day.key}，${items.length} 条观点`} aria-pressed={selected===day.key} aria-current={today===day.key?'date':undefined} onClick={()=>chooseDate(day.key)}><span>{day.day}</span>{items.length>0&&<small>{items.length} 条</small>}</button>
              <div className="calendar-events">{items.slice(0,3).map(record=><button key={record.id} className="calendar-event" onClick={()=>onDetail(record)} title={`${bloggers.get(record.bloggerId)?.name||'未知博主'} · ${record.title}`}><span>{bloggers.get(record.bloggerId)?.name||'未知博主'}</span><strong>{record.title}</strong></button>)}{items.length>3&&<button className="calendar-more" onClick={()=>chooseDate(day.key)}>还有 {items.length-3} 条 · 查看全部</button>}</div>
              {items.length>0&&<button className="calendar-mobile-count" onClick={()=>chooseDate(day.key)}>{items.length} 条观点</button>}
            </section>;
          })}
        </div>
        <div className="calendar-caption"><span><i/>今天</span><span>按原始发表日期归档 · 点击观点查看详情</span></div>
      </section>
      <aside className="calendar-agenda" aria-label="所选日期的观点">
        <header><div className="eyebrow">DAILY OPINIONS</div><h2>{fmt(selected)}{selected===today&&<span>今天</span>}</h2><p>当日发表 <b>{selectedRecords.length}</b> 条观点{filter.blogger||filter.direction||filter.from||filter.to||filter.status||filter.target||filter.kind||filter.horizon?' · 已应用筛选':''}</p></header>
        <div className="calendar-agenda-list">{selectedRecords.length?selectedRecords.map(record=><button className="calendar-agenda-record" key={record.id} onClick={()=>onDetail(record)}><div className="calendar-agenda-meta"><Person blogger={bloggers.get(record.bloggerId)}/><Status record={record}/></div><h3>{record.title}</h3><p>{record.quote||'未填写原话'}</p><div className="calendar-agenda-bottom"><span>{record.target}</span><Direction record={record}/></div><span className="calendar-detail-link">查看完整观点 <Icon name="arrowRight"/></span></button>):<div className="calendar-day-empty"><Icon name="calendar"/><strong>当天没有观点</strong><p>选择其他日期查看，或调整当前筛选条件。</p></div>}</div>
        <div className="calendar-agenda-note"><Icon name="note"/><span>发表日期与计划回看日期分别记录，日历仅使用发表日期。</span></div>
      </aside>
    </div>
  </section>;
}
