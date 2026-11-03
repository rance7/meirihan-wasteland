import {describe,it,expect} from 'vitest';
import {demoState} from './domain.js';
import {EMPTY_FILTERS,filterRecords,reviewRecords,sortRecords,stage,summarize} from './workbench.js';

describe('workbench filters and statistics',()=>{
  it('combines blogger, direction, stage and publication date without changing data',()=>{
    const data=demoState(),before=structuredClone(data),record=data.records.find(r=>r.id==='r8');
    const filtered=filterRecords(data,'宽基指数',{...EMPTY_FILTERS,blogger:'b1',direction:'看多',status:'pending',kind:'观点',horizon:'一周',from:record.date,to:record.date});
    expect(filtered.map(r=>r.id)).toEqual(['r8']);
    expect(data).toEqual(before);
  });
  it('filters exact targets and inclusive date boundaries',()=>{
    const data=demoState(),date=data.records[0].date;
    expect(filterRecords(data,'',{...EMPTY_FILTERS,from:date,to:date}).map(r=>r.id)).toEqual(['r1']);
    const result=filterRecords(data,'',{...EMPTY_FILTERS,target:'科技板块'});
    expect(result).toHaveLength(3);expect(result.every(r=>r.target==='科技板块')).toBe(true);
  });
  it('distinguishes pending verification from pending review and leaves absent scores empty',()=>{
    const data=demoState();
    expect(stage(data.records.at(-1))).toBe('draft');
    expect(summarize(data.records)).toEqual({total:12,draft:1,pending:4,reviewed:7,average:81});
    const unverified=data.records.filter(r=>!r.verified);
    expect(summarize(unverified)).toEqual({total:1,draft:1,pending:0,reviewed:0,average:null});
    expect(summarize([]).average).toBeNull();
  });
  it('keeps unreviewed records last in both score sort directions',()=>{
    const data=demoState(),before=structuredClone(data.records);
    for(const direction of ['asc','desc']){
      const sorted=sortRecords(data.records,{key:'score',direction},data.bloggers);
      expect(sorted.slice(0,7).every(r=>r.review)).toBe(true);
      expect(sorted.slice(7).every(r=>!r.review)).toBe(true);
    }
    expect(data.records).toEqual(before);
  });
  it('orders review queues by due date and puts missing dates last',()=>{
    const data=demoState();data.records.find(r=>r.id==='r8').due='';
    const items=reviewRecords(data.records,'pending');
    expect(items.at(-1).id).toBe('r8');
    expect(items.every(r=>r.verified&&!r.review)).toBe(true);
    expect(sortRecords(items,{key:'due',direction:'asc'}).at(-1).id).toBe('r8');
    const completed=sortRecords(reviewRecords(data.records,'completed'),{key:'reviewDate',direction:'desc'});
    expect(completed[0].review.date>=completed.at(-1).review.date).toBe(true);
  });
});
