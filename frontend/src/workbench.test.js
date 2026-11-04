import {describe,it,expect} from 'vitest';
import {demoState,eligible} from './domain.js';
import {EMPTY_FILTERS,filterRecords,reviewRecords,sortRecords,stage,summarize} from './workbench.js';

describe('unified review queues and statistics',()=>{
  it('combines filters without changing stored data',()=>{
    const data=demoState(),before=structuredClone(data),record=data.records.find(r=>r.id==='r8');
    const filtered=filterRecords(data,'宽基指数',{...EMPTY_FILTERS,blogger:'b1',direction:'看多',status:'reviewed',kind:'观点',horizon:'一周',from:record.date,to:record.date});
    expect(filtered.map(r=>r.id)).toEqual(['r8']);expect(data).toEqual(before);
    expect(filterRecords(data,'',{...EMPTY_FILTERS,from:data.records[0].date,to:data.records[0].date}).map(r=>r.id)).toEqual(['r1']);
    expect(filterRecords(data,'',{...EMPTY_FILTERS,target:'科技板块'})).toHaveLength(3);
  });
  it('completes a review on a verdict and counts scores separately',()=>{
    const data=demoState();
    expect(summarize(data.records)).toEqual({total:12,pending:2,reviewed:10,scored:6,average:81});
    const unreviewed=data.records.at(-1);expect(stage(unreviewed)).toBe('pending');
    unreviewed.verified=true;unreviewed.status='published';
    unreviewed.review={date:unreviewed.date,verdict:'failure',ratings:[],outcome:'',lesson:'',entry:null,exit:null,benchmark:null};
    expect(stage(unreviewed)).toBe('reviewed');
    expect(reviewRecords([unreviewed],'pending')).toEqual([]);
    expect(reviewRecords([unreviewed],'completed')).toEqual([unreviewed]);
    expect(summarize([unreviewed])).toEqual({total:1,pending:0,reviewed:1,scored:0,average:null});
    unreviewed.review.verdict='';expect(stage(unreviewed)).toBe('pending');
  });
  it('sorts scored samples while leaving unscored completed reviews empty',()=>{
    const data=demoState(),before=structuredClone(data.records);
    for(const direction of ['asc','desc']){
      const sorted=sortRecords(data.records,{key:'score',direction},data.bloggers);
      expect(sorted.slice(0,6).every(eligible)).toBe(true);
      expect(sorted.slice(6).every(r=>!eligible(r))).toBe(true);
    }
    expect(data.records).toEqual(before);
  });
  it('orders two queues and preserves existing reviews',()=>{
    const data=demoState(),before=structuredClone(data);
    data.records.find(r=>r.id==='r3').due='';
    expect(reviewRecords(data.records,'pending').map(r=>r.id)).toEqual(['r12','r3']);
    const completed=reviewRecords(data.records,'completed');expect(completed).toHaveLength(10);
    expect(completed[0].review.date>=completed.at(-1).review.date).toBe(true);
    expect(completed.find(r=>r.id==='r8').review).toEqual(before.records.find(r=>r.id==='r8').review);
    expect(summarize([])).toEqual({total:0,pending:0,reviewed:0,scored:0,average:null});
  });
});
