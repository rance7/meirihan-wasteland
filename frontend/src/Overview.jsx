import {useMemo} from 'react';
import {Avatar,Chart,Icon,Status,SuccessRateStat} from './components.jsx';
import {dateToday,fmt,formatSuccessRate,recordTitle} from './domain.js';
import {Metrics} from './Workbench.jsx';
import {buildOverview,reviewDeadline} from './overview.js';
import './overview.css';

export default function Overview({data,query,onClearSearch,onQueue,onLedger,onCalendar,onBlogger,onManage,tableProps}){
  const today=dateToday();
  const overview=useMemo(()=>buildOverview(data,query,today),[data,query,today]);
  const tasks=overview.pending;
  const bloggerById=new Map(data.bloggers.map(blogger=>[blogger.id,blogger]));
  return <div className="overview-dashboard" aria-label="工作台总览">
    <div className="overview-toolbar"><div className="overview-scope"><Icon name="overview"/><span>{query?'当前搜索结果':'全部历史记录'}</span><span className="overview-scope-count">{overview.bloggers.length} 位博主 · {overview.records.length} 条观点</span>{query&&<button onClick={onClearSearch}>清除搜索 <Icon name="close"/></button>}</div><div className="overview-shortcuts"><button className="button small" onClick={onCalendar}><Icon name="calendar"/>观点日历</button><button className="button primary small" onClick={onLedger}>打开完整台账 <Icon name="arrowRight"/></button></div></div>
    <Metrics records={overview.records}/>
    <div className="overview-grid">
      <div className="overview-column">
        <section className="overview-panel overview-todos" aria-label="待办清单">
          <header className="overview-panel-heading"><div><span className="overview-kicker">NEXT ACTIONS</span><h2>待办清单</h2></div><span className={`overview-due-count ${overview.dueCount?'has-due':''}`}><Icon name="clock"/>{overview.dueCount} 条已到期复盘</span></header>
          <div className="overview-task-list">{tasks.length?tasks.slice(0,4).map(record=>{
            const blogger=bloggerById.get(record.bloggerId),deadline=reviewDeadline(record,today);
            return <article className="overview-task" key={record.id}><Avatar blogger={blogger}/><div className="overview-task-content"><button className="overview-record-title" onClick={()=>tableProps.onDetail(record)}>{recordTitle(record)}</button><div className="overview-record-meta"><span>{blogger?.name||'未知博主'}</span><span>发表于 {fmt(record.date)}</span><span className={`deadline ${deadline.tone}`}>{deadline.text}</span></div></div><button className="overview-task-action" onClick={()=>tableProps.onReview(record)}>复盘<Icon name="arrowRight"/></button></article>;
          }):<div className="overview-empty"><Icon name="reviews"/><strong>暂无待复盘观点</strong><p>{query?'可以清除搜索，查看全部待办。':'新记录和暂不判定的观点会出现在这里，标记成功或失败即完成复盘。'}</p>{query?<button className="button small" onClick={onClearSearch}>清除搜索</button>:<button className="button small" onClick={tableProps.onAdd}>记录观点</button>}</div>}</div>
          <button className="overview-panel-link" onClick={onQueue}>查看全部待复盘 <span>{tasks.length} 条 <Icon name="arrowRight"/></span></button>
        </section>
        <section className="overview-panel" aria-label="近期观点"><header className="overview-panel-heading"><div><span className="overview-kicker">LATEST OPINIONS</span><h2>近期观点</h2></div><span className="overview-panel-caption">按发表日期 · 最近 4 条</span></header>{overview.recent.length?<div className="overview-recent-list">{overview.recent.map(record=><button className="overview-recent-record" key={record.id} onClick={()=>tableProps.onDetail(record)}><span className="overview-recent-date">{fmt(record.date).slice(5)}</span><span className="overview-recent-content"><strong>{recordTitle(record)}</strong><small>{bloggerById.get(record.bloggerId)?.name||'未知博主'} · {record.target}</small></span><Status record={record}/><Icon name="arrowRight"/></button>)}</div>:<div className="overview-empty compact"><strong>{query?'没有符合搜索的观点':'还没有观点记录'}</strong><p>记下一个判断，开始积累自己的研究记录。</p></div>}<button className="overview-panel-link" onClick={onLedger}>查看完整观点台账 <Icon name="arrowRight"/></button></section>
      </div>
      <div className="overview-column">
        <section className="overview-panel overview-performance" aria-label="博主表现"><header className="overview-panel-heading"><div><span className="overview-kicker">BLOGGER PERFORMANCE</span><h2>博主表现</h2></div><span className="overview-panel-caption">{overview.bloggers.length} 位博主</span></header><div className="overview-performance-summary"><SuccessRateStat records={overview.records}/><p>按已判定样本数排列 · 每条观点等权</p></div><div className="overview-performance-labels"><span>博主 / 样本</span><span>成功率</span><span>均分</span></div>{overview.bloggers.length?<div className="overview-performance-list">{overview.bloggers.slice(0,5).map(({blogger,total,reviewed,average,success})=><button className="overview-blogger" key={blogger.id} onClick={()=>onBlogger(blogger.id)} aria-label={`查看${blogger.name}的观点`}><span className="overview-blogger-identity"><Avatar blogger={blogger}/><span><b>{blogger.name}</b><small>{total} 条观点 · {reviewed} 条复盘</small></span></span><span className="overview-blogger-rate"><b>{formatSuccessRate(success)}</b><small>{success.success} / {success.judged} 已判定</small></span><span className="overview-blogger-score">{average??'—'}</span></button>)}</div>:<div className="overview-empty compact"><strong>{query?'没有符合搜索的博主':'还没有博主档案'}</strong><p>添加博主，再持续跟踪他的判断表现。</p></div>}<div className="overview-performance-note"><Icon name="note"/><span>成功率仅计入已标记成功或失败的观点；评分单独统计，没有已判定样本时显示「—」。</span></div><button className="overview-panel-link" onClick={onManage}>管理全部博主 <Icon name="arrowRight"/></button></section>
        {overview.stats.scored>0&&<section className="overview-panel overview-trend"><header className="overview-panel-heading"><div><span className="overview-kicker">REVIEW TREND</span><h2>复盘评分轨迹</h2></div><span className="overview-panel-caption">近六周</span></header><Chart records={overview.records}/></section>}
      </div>
    </div>
  </div>;
}
