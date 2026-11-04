import {average,dateToday,isJudged,fmt,successRate} from './domain.js';
import {EMPTY_FILTERS,filterRecords,reviewRecords,sortRecords,summarize} from './workbench.js';

export function buildOverview(data,query='',today=dateToday()){
  // Overview has its own search scope; a hidden ledger filter must not narrow it.
  const records=filterRecords(data,query,EMPTY_FILTERS);
  const pending=reviewRecords(records,'pending');
  const key=query.trim().toLowerCase();
  const recordsByBlogger=new Map();
  for(const record of records){
    if(!recordsByBlogger.has(record.bloggerId))recordsByBlogger.set(record.bloggerId,[]);
    recordsByBlogger.get(record.bloggerId).push(record);
  }
  const bloggers=data.bloggers.map(blogger=>{
    const items=recordsByBlogger.get(blogger.id)||[];
    return {blogger,total:items.length,reviewed:items.filter(isJudged).length,average:average(items),success:successRate(items)};
  }).filter(item=>!key||item.total||item.blogger.name.toLowerCase().includes(key))
    .toSorted((a,b)=>b.success.judged-a.success.judged||b.reviewed-a.reviewed||b.total-a.total||a.blogger.name.localeCompare(b.blogger.name,'zh-CN'));
  return {records,stats:summarize(records),pending,bloggers,
    dueCount:pending.filter(record=>record.due&&record.due<=today).length,
    recent:sortRecords(records,{key:'date',direction:'desc'}).slice(0,4)};
}

export function reviewDeadline(record,today=dateToday()){
  if(!record.due)return {text:'未设回看日期',tone:'neutral'};
  // Date-only UTC arithmetic avoids browser timezone and daylight-saving offsets.
  const days=Math.round((Date.parse(`${today}T00:00:00Z`)-Date.parse(`${record.due}T00:00:00Z`))/86400000);
  if(days>0)return {text:`逾期 ${days} 天`,tone:'overdue'};
  if(days===0)return {text:'今天回看',tone:'today'};
  return {text:`回看 ${fmt(record.due)}`,tone:'upcoming'};
}
