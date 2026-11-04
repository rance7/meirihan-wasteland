import {describe,it,expect} from 'vitest';
import {demoState} from './domain.js';
import {buildOverview,reviewDeadline} from './overview.js';

describe('overview totals, actions and blogger performance',()=>{
  it('includes all stages, separates action queues and leaves original records unchanged',()=>{
    const data=demoState(),before=structuredClone(data),overview=buildOverview(data);
    expect(overview.stats).toEqual({total:12,pending:2,reviewed:10,scored:6,average:81});
    expect(overview.pending.map(record=>record.id)).toEqual(['r3','r12']);
    expect(overview.recent).toHaveLength(4);
    expect(overview.recent.map(record=>record.date)).toEqual(overview.recent.map(record=>record.date).toSorted().reverse());
    const blogger=overview.bloggers.find(item=>item.blogger.id==='b2');
    expect(blogger).toMatchObject({total:3,reviewed:3,success:{success:1,failure:2,judged:3,rate:33.3}});
    expect(data).toEqual(before);
  });
  it('counts deadlines only for records awaiting a result',()=>{
    const data=demoState();data.records.find(r=>r.id==='r3').due='2026-11-04';data.records.at(-1).due='';
    data.records.find(r=>r.id==='r8').due='2026-11-01';
    const overview=buildOverview(data,'','2026-11-04');
    expect(overview.dueCount).toBe(1);expect(overview.pending.map(r=>r.id)).toEqual(['r3','r12']);
  });
  it('applies one search scope to totals, tasks and performance and handles empty profiles',()=>{
    const data=demoState(),overview=buildOverview(data,'林间研究所');
    expect(overview.stats.total).toBe(3);
    expect(overview.pending).toEqual([]);
    expect(overview.bloggers.map(item=>item.blogger.id)).toEqual(['b1']);
    data.bloggers.push({id:'b5',name:'只建档的博主'});
    expect(buildOverview(data,'只建档').bloggers[0]).toMatchObject({total:0,reviewed:0,average:null,success:{rate:null}});
    expect(buildOverview(data,'没有匹配的内容').stats.total).toBe(0);
    expect(buildOverview({bloggers:[],records:[]}).bloggers).toEqual([]);
  });
  it('labels deadlines correctly across day, month and leap-year boundaries',()=>{
    expect(reviewDeadline({due:''},'2026-11-04')).toEqual({text:'未设回看日期',tone:'neutral'});
    expect(reviewDeadline({due:'2026-11-04'},'2026-11-04')).toEqual({text:'今天回看',tone:'today'});
    expect(reviewDeadline({due:'2026-11-02'},'2026-11-04')).toEqual({text:'逾期 2 天',tone:'overdue'});
    expect(reviewDeadline({due:'2026-11-05'},'2026-11-04')).toEqual({text:'回看 2026.11.05',tone:'upcoming'});
    expect(reviewDeadline({due:'2024-02-28'},'2024-03-01').text).toBe('逾期 2 天');
  });
});
