import {average,eligible,matches,score} from './domain.js';

export const EMPTY_FILTERS=Object.freeze({blogger:'',target:'',direction:'',status:'',kind:'',horizon:'',from:'',to:''});
export const STAGES={draft:'待核对',pending:'待复盘',reviewed:'已复盘'};

export function stage(record){
  return !record.verified||record.status==='draft'?'draft':record.review?'reviewed':'pending';
}

export function verificationRecords(records){return records.filter(r=>stage(r)==='draft');}

export function filterRecords(data,query='',filter=EMPTY_FILTERS){
  return data.records.filter(r=>matches(r,query,data.bloggers)
    &&(!filter.blogger||r.bloggerId===filter.blogger)
    &&(!filter.target||r.target===filter.target)
    &&(!filter.direction||r.direction===filter.direction)
    &&(!filter.kind||r.kind===filter.kind)
    &&(!filter.horizon||r.horizon===filter.horizon)
    &&(!filter.status||stage(r)===filter.status)
    &&(!filter.from||r.date>=filter.from)
    &&(!filter.to||r.date<=filter.to));
}

export function summarize(records){
  return {total:records.length,draft:records.filter(r=>stage(r)==='draft').length,
    pending:records.filter(r=>stage(r)==='pending').length,
    reviewed:records.filter(eligible).length,average:average(records)};
}

export function sortRecords(records,sort={key:'date',direction:'desc'},bloggers=[]){
  const names=new Map(bloggers.map(b=>[b.id,b.name]));
  const direction=sort.direction==='asc'?1:-1;
  return records.toSorted((a,b)=>{
    if(sort.key==='score'){
      const av=eligible(a)?score(a):null,bv=eligible(b)?score(b):null;
      // Unreviewed opinions have no score; they stay last in either order.
      if(av===null||bv===null)return av===bv?0:av===null?1:-1;
      return (av-bv)*direction;
    }
    if(sort.key==='due'||sort.key==='reviewDate'){
      const av=sort.key==='due'?a.due:a.review?.date,bv=sort.key==='due'?b.due:b.review?.date;
      if(!av||!bv)return !av===!bv?0:!av?1:-1;
      return av.localeCompare(bv)*direction;
    }
    const av=sort.key==='blogger'?names.get(a.bloggerId):a[sort.key];
    const bv=sort.key==='blogger'?names.get(b.bloggerId):b[sort.key];
    return String(av??'').localeCompare(String(bv??''),'zh-CN',{numeric:true})*direction;
  });
}

export function activeFilterCount(filter){return Object.values(filter).filter(Boolean).length;}

export function reviewRecords(records,tab){
  const desired=tab==='completed'?'reviewed':tab==='draft'?'draft':'pending';
  return records.filter(r=>stage(r)===desired).toSorted((a,b)=>tab==='completed'
    ?b.review.date.localeCompare(a.review.date):(a.due||'9999').localeCompare(b.due||'9999'));
}
