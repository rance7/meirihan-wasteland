import {describe,it,expect} from 'vitest';
import {average,demoState,eligible,matches,normalize,priceReturn,safeURL,score,validDate} from './domain.js';

describe('domain and legacy backup compatibility',()=>{
  it('round-trips a v1 backup without leaking unknown fields',()=>{const data=demoState();data.exportedAt='ignored';const value=normalize(JSON.parse(JSON.stringify(data)));expect(value.records).toHaveLength(12);expect(value.revision).toBe(0);expect(value.exportedAt).toBeUndefined()});
  it('uses fixed weights and excludes unverified samples',()=>{expect(score({review:{ratings:[5,4,3,2]}})).toBe(78);expect(average(demoState().records)).toBe(81);expect(eligible({verified:false,status:'draft',review:{ratings:[5,5,5,5]}})).toBe(false)});
  it('matches original quote, target, and blogger name',()=>{const d=demoState();expect(d.records.filter(r=>matches(r,'林间研究所',d.bloggers))).toHaveLength(3);expect(d.records.filter(r=>matches(r,'消费电子',d.bloggers)).length).toBeGreaterThan(0)});
  it.each(['javascript:alert(1)','file:///private','https://name:secret@example.com'])('rejects unsafe source %s',source=>{expect(safeURL(source)).toBe(false);const d=demoState();d.records[0].source=source;expect(()=>normalize(d)).toThrow()});
  it('rejects invalid dates, ratings and broken references',()=>{expect(validDate('2026-02-30')).toBe(false);for(const mutate of [s=>s.records[0].bloggerId='missing',s=>s.records[0].review.ratings[0]=6,s=>s.records[1].id=s.records[0].id]){const d=demoState();mutate(d);expect(()=>normalize(d)).toThrow()}});
  it('keeps price return separate from reviewer score',()=>{expect(priceReturn({entry:100,exit:110})).toBeCloseTo(10);expect(priceReturn({entry:null,exit:null})).toBeNull()});
});
