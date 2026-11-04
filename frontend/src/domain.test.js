import {describe,it,expect} from 'vitest';
import {average,demoState,eligible,formatSuccessRate,matches,normalize,priceReturn,safeURL,score,successRate,validDate} from './domain.js';

describe('domain and legacy backup compatibility',()=>{
  it('round-trips a v1 backup without leaking unknown fields',()=>{const data=demoState();data.exportedAt='ignored';const value=normalize(JSON.parse(JSON.stringify(data)));expect(value.records).toHaveLength(12);expect(value.revision).toBe(0);expect(value.exportedAt).toBeUndefined()});
  it('uses fixed weights and excludes unverified samples',()=>{expect(score({review:{ratings:[5,4,3,2]}})).toBe(78);expect(average(demoState().records)).toBe(81);expect(eligible({verified:false,status:'draft',review:{ratings:[5,5,5,5]}})).toBe(false)});
  it('matches original quote, target, and blogger name',()=>{const d=demoState();expect(d.records.filter(r=>matches(r,'林间研究所',d.bloggers))).toHaveLength(3);expect(d.records.filter(r=>matches(r,'消费电子',d.bloggers)).length).toBeGreaterThan(0)});
  it.each(['javascript:alert(1)','file:///private','https://name:secret@example.com'])('rejects unsafe source %s',source=>{expect(safeURL(source)).toBe(false);const d=demoState();d.records[0].source=source;expect(()=>normalize(d)).toThrow()});
  it('rejects invalid dates, ratings and broken references',()=>{expect(validDate('2026-02-30')).toBe(false);for(const mutate of [s=>s.records[0].bloggerId='missing',s=>s.records[0].review.ratings[0]=6,s=>s.records[1].id=s.records[0].id]){const d=demoState();mutate(d);expect(()=>normalize(d)).toThrow()}});
  it('keeps price return separate from reviewer score',()=>{expect(priceReturn({entry:100,exit:110})).toBeCloseTo(10);expect(priceReturn({entry:null,exit:null})).toBeNull()});
  it('counts explicit verdicts rather than scores, prices or unfinished opinions',()=>{
    const record=(verdict,extra={})=>({verified:true,status:'published',review:{verdict,ratings:[0,0,0,0],entry:100,exit:90},...extra});
    const records=[record('success'),record('failure'),record(''),record(undefined),record('success',{verified:false}),record('success',{status:'draft'}),record('success',{review:null})];
    const before=structuredClone(records);
    expect(successRate(records)).toEqual({success:1,failure:1,unjudged:2,judged:2,rate:50});
    expect(formatSuccessRate(successRate([]))).toBe('—');
    expect(formatSuccessRate(successRate([record('failure')]))).toBe('0%');
    expect(successRate([record('success'),record('success'),record('failure')]).rate).toBe(66.7);
    expect(records).toEqual(before);
  });
  it('preserves verdicts through backup restore and leaves old reviews unjudged',()=>{
    const data=demoState(),restored=normalize(JSON.parse(JSON.stringify(data)));
    expect(successRate(restored.records)).toEqual({success:4,failure:2,unjudged:1,judged:6,rate:66.7});
    for(const record of data.records)if(record.review)delete record.review.verdict;
    expect(successRate(normalize(data).records)).toEqual({success:0,failure:0,unjudged:7,judged:0,rate:null});
    for(const invalid of ['partial',true,null,1]){const copy=demoState();copy.records[0].review.verdict=invalid;expect(()=>normalize(copy)).toThrow('复盘判断结果不合法');}
  });
  it('separates blogger samples and removes withdrawn reviews from success rate',()=>{
    const data=demoState();
    expect(successRate(data.records.filter(r=>r.bloggerId==='b1')).rate).toBe(100);
    expect(successRate(data.records.filter(r=>r.bloggerId==='b2')).rate).toBe(50);
    const reviewed=data.records.find(r=>r.bloggerId==='b1'&&r.review);reviewed.review=null;
    expect(successRate(data.records.filter(r=>r.bloggerId==='b1')).judged).toBe(1);
  });
});
