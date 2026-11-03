import {describe,it,expect} from 'vitest';
import {groupByPublicationDate,monthDays,shiftMonth} from './calendar.js';

describe('publication calendar',()=>{
  it('lays out six complete Sunday-first weeks including adjacent months',()=>{
    const days=monthDays('2026-11');
    expect(days).toHaveLength(42);
    expect(days[0]).toEqual({key:'2026-11-01',day:1,inMonth:true});
    expect(days[29].key).toBe('2026-11-30');
    expect(days[30]).toEqual({key:'2026-12-01',day:1,inMonth:false});
    expect(days.at(-1).key).toBe('2026-12-12');
    expect(monthDays('2026-12')[0]).toEqual({key:'2026-11-29',day:29,inMonth:false});
  });
  it('handles leap years and year boundaries without timezone drift',()=>{
    expect(monthDays('2024-02').filter(d=>d.inMonth)).toHaveLength(29);
    expect(monthDays('2025-02').filter(d=>d.inMonth)).toHaveLength(28);
    expect(shiftMonth('2026-12',1)).toBe('2027-01');
    expect(shiftMonth('2026-01',-1)).toBe('2025-12');
    const days=monthDays('2026-03');
    expect(days.find(d=>d.key==='2026-03-08')?.day).toBe(8);
    expect(new Set(days.map(d=>d.key)).size).toBe(42);
  });
  it('groups only by publication date, preserving original records and all opinions on a day',()=>{
    const records=Array.from({length:5},(_,i)=>({id:String(i),date:i<3?'2026-11-02':'2026-11-03',due:'2026-11-04',review:{date:'2026-11-05'}}));
    const before=structuredClone(records),groups=groupByPublicationDate(records);
    expect(groups.get('2026-11-02').map(r=>r.id)).toEqual(['0','1','2']);
    expect(groups.get('2026-11-03')).toHaveLength(2);
    expect(groups.has('2026-11-04')).toBe(false);
    expect(groups.has('2026-11-05')).toBe(false);
    expect(groupByPublicationDate(records.slice(3)).size).toBe(1);
    expect(groupByPublicationDate([]).size).toBe(0);
    expect(records).toEqual(before);
  });
});
