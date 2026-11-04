export const dateToday=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const dayOffset=n=>{const d=new Date(dateToday()+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
export const fmt=d=>d?d.replaceAll('-','.'):'未设置';
export const uid=()=>crypto.randomUUID();
export const score=r=>r.review?r.review.ratings.reduce((sum,n,i)=>sum+n*[8,5,4,3][i],0):null;
export const eligible=r=>Boolean(r.verified&&r.review&&r.status!=='draft');
export const average=records=>{const list=records.filter(eligible);return list.length?Math.round(list.reduce((s,r)=>s+score(r),0)/list.length):null;};
export const REVIEW_VERDICTS={success:'成功',failure:'失败'};
export function successRate(records){
  let success=0,failure=0,unjudged=0;
  for(const record of records){
    if(!eligible(record))continue;
    if(record.review.verdict==='success')success++;
    else if(record.review.verdict==='failure')failure++;
    else unjudged++;
  }
  const judged=success+failure;
  return {success,failure,unjudged,judged,rate:judged?Math.round(success/judged*1000)/10:null};
}
export const formatSuccessRate=result=>result.rate===null?'—':`${result.rate}%`;
export function safeURL(value){try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password;}catch{return false;}}
export function validDate(s){return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s;}
function demoState(){
  const bloggers=[
    {id:'b1',name:'林间研究所',platform:'虚构示例',tags:'宏观,市场节奏',bio:'关注市场环境与风险，习惯先写条件，再做判断。',color:'purple'},
    {id:'b2',name:'南风交易笔记',platform:'虚构示例',tags:'趋势,仓位管理',bio:'记录趋势跟踪和仓位变化，强调操作的一致性。',color:'blue'},
    {id:'b3',name:'慢慢看市场',platform:'虚构示例',tags:'行业观察,中期',bio:'从产业变化出发，持续跟踪观点的兑现过程。',color:'green'},
    {id:'b4',name:'山月复盘',platform:'虚构示例',tags:'短线,情绪观察',bio:'从成交量与市场情绪出发，寻找可验证的信号。',color:'orange'}
  ];
  const descriptions=[
    ['b1','等待缩量回踩，再观察承接','宽基指数','观望','观点','指数反弹后先不追高，若回踩前低不破，再考虑提高仓位。',-38,[4,4,5,4]],
    ['b2','趋势确认后分批建立观察仓','科技板块','看多','操作','收盘站上整理区间，先建立观察仓；跌回区间则撤销判断。',-32,[4,3,4,5]],
    ['b3','产业景气仍需订单验证','消费电子','观望','观点','需求改善还需要订单数据支持，先跟踪，不提前给出盈利拐点。',-26,[4,4,4,4]],
    ['b4','情绪回暖，留意高位分歧','短线情绪','看空','观点','连续加速后警惕分歧，若量能衰减则降低暴露。',-20,[3,3,4,3]],
    ['b1','反弹中的量能仍需持续观察','宽基指数','观望','观点','单日放量不足以确认反转，至少再观察三至五个交易日。',-14,[5,4,4,5]],
    ['b2','按原计划减半观察仓','科技板块','看空','操作','没有突破前高，先将观察仓减半；放量站稳后再重新评估。',-9,[4,4,5,4]],
    ['b3','等待需求数据，不提前交易','可选消费','观望','观点','当前只跟踪月度需求，数据未连续改善之前维持观察。',-6,[4,4,4,5]],
    ['b1','回踩之后，观察是否形成更高低点','宽基指数','看多','观点','若本周回踩守住上一低点，且再次放量突破前高，再确认趋势。',-3,null],
    ['b2','轻仓试探，跌破支撑退出','科技板块','看多','操作','只用观察仓试探，不在盘中追加；收盘跌破支撑则退出。',-2,null],
    ['b4','高位成交放大，先看分歧','短线情绪','观望','观点','高位放量后先观察次日承接，不把放量本身当作买入理由。',-1,null],
    ['b3','新一轮订单数据待跟踪','消费电子','看多','观点','若连续两期订单改善，再重新评估行业景气。',0,null],
    ['b4','截图中的观点有待核实','行业观察','观望','观点','尚未找到完整原文，需要核对发表日期及前置条件。',0,null]
  ];
  return {version:1,mode:'demo',bloggers,records:descriptions.map((x,i)=>({
    id:`r${i+1}`,bloggerId:x[0],title:x[1],target:x[2],direction:x[3],kind:x[4],quote:x[5],date:dayOffset(x[6]),due:dayOffset(x[6]+7),horizon:'一周',condition:'以原文前置条件成立为准，避免脱离上下文。',invalidation:'关键支撑失守或原有条件不成立时，重新评估。',source:'',status:i===11?'draft':'published',verified:i!==11,
    review:x[7]?{date:dayOffset(Math.min(x[6]+5,0)),ratings:x[7],verdict:['success','success','','failure','success','failure','success'][i],outcome:'演示复盘：记录当时条件与后续变化，检查判断是否按约定兑现。',lesson:'这是虚构的交互示例；评分用于展示功能，不代表任何真实博主表现。',entry:null,exit:null,benchmark:null}:null
  }))};
}
function validateState(data){
  const fail=msg=>{throw Error(msg);};
  if(!data||data.version!==1||!['demo','personal'].includes(data.mode)||!Array.isArray(data.bloggers)||!Array.isArray(data.records))fail('文件格式不符合美日韩废土 v1 备份');
  if(data.bloggers.length>2000||data.records.length>30000)fail('备份数据量过大');
  const text=(obj,key,max=10000,required=false)=>{const s=obj[key];if(typeof s!=='string'||s.length>max||(required&&!s.trim()))fail('字段不合法：'+key);return s;};
  const ids=new Set(),names=new Set();
  const bloggers=data.bloggers.map(b=>{if(!b||typeof b!=='object')fail('博主格式不合法');const n={id:text(b,'id',100,true),name:text(b,'name',60,true),platform:text(b,'platform',100),tags:text(b,'tags',180),bio:text(b,'bio',1000),color:text(b,'color',20)};if(ids.has(n.id)||names.has(n.name)||!['purple','blue','green','orange','pink'].includes(n.color))fail('博主 ID / 名称重复，或颜色不合法');ids.add(n.id);names.add(n.name);return n;});
  const recordIds=new Set();
  const records=data.records.map(r=>{if(!r||typeof r!=='object')fail('观点格式不合法');const n={};for(const [key,max,required]of [['id',100,true],['bloggerId',100,true],['title',180,true],['target',100,true],['direction',10,true],['kind',10,true],['quote',10000,true],['date',10,true],['due',10,false],['horizon',30,false],['condition',3000,false],['invalidation',3000,false],['source',2000,false],['status',20,true]])n[key]=text(r,key,max,required);
    if(recordIds.has(n.id)||!ids.has(n.bloggerId)||!['看多','看空','观望'].includes(n.direction)||!['观点','操作'].includes(n.kind)||!['draft','published'].includes(n.status)||typeof r.verified!=='boolean')fail('观点 ID、博主关联或分类不合法');recordIds.add(n.id);
    if(!validDate(n.date)||n.date>dateToday()||(n.due&&(!validDate(n.due)||n.due<n.date))||(n.source&&!safeURL(n.source)))fail('观点日期或来源链接不合法');n.verified=r.verified;n.review=null;
    if(r.review!==null){const v=r.review;if(!v||!r.verified||n.status==='draft'||!Array.isArray(v.ratings)||v.ratings.length!==4||v.ratings.some(x=>!Number.isInteger(x)||x<0||x>5))fail('复盘评分或核对状态不合法');const rev={date:text(v,'date',10,true),ratings:[...v.ratings],outcome:text(v,'outcome',10000,true),lesson:text(v,'lesson',5000)};if(!validDate(rev.date)||rev.date<n.date||rev.date>dateToday())fail('复盘日期不合法');if(v.verdict!==undefined&&!['','success','failure'].includes(v.verdict))fail('复盘判断结果不合法');if(v.verdict)rev.verdict=v.verdict;for(const key of ['entry','exit','benchmark']){if(v[key]!==null&&(typeof v[key]!=='number'||!Number.isFinite(v[key])))fail('价格或基准格式不合法');rev[key]=v[key];}if((rev.entry===null)!==(rev.exit===null)||(rev.entry!==null&&(rev.entry<=0||rev.exit<0))||(rev.benchmark!==null&&rev.benchmark < -100))fail('价格或基准数值不合法');n.review=rev;}return n;});
  return {version:1,mode:data.mode,bloggers,records};
}
export {demoState};
export function normalize(data){const value=validateState(data);value.revision=Number.isSafeInteger(data.revision)&&data.revision>=0?data.revision:0;for(const r of value.records)r.status=r.verified?'published':'draft';return value;}
export function matches(r,q,bloggers){const key=q.trim().toLowerCase();return !key||[r.title,r.target,r.quote,bloggers.find(b=>b.id===r.bloggerId)?.name].some(s=>s?.toLowerCase().includes(key));}
export function priceReturn(review){if(review?.entry==null||review.exit==null)return null;return (review.exit/review.entry-1)*100;}
export function download(data,name='美日韩废土-备份-'+dateToday()+'.json'){const blob=new Blob([JSON.stringify({...data,exportedAt:new Date().toISOString()},null,2)],{type:'application/json;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
