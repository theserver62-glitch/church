import { occurrences as baseOccurrences, addDays, parse } from './calendar.js?v=202610251020';
export function customOccurrences(customEvents = {}, years = []) {
 return Object.entries(customEvents || {}).filter(([,e])=>e && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && years.includes(+e.date.slice(0,4)) && !Number.isNaN(parse(e.date).getTime()) && parse(e.date).toISOString().slice(0,10)===e.date).map(([id,e])=>({id,name:e.name,date:e.date,tasks:(e.tasks||[]).map(t=>Array.isArray(t)?[...t]:[t.w,t.t,t.who||'',t.doc]),custom:true,dept:typeof e.dept==='string'&&e.dept.trim()?e.dept.trim():ALL,days:Math.min(10,Math.max(1,Math.trunc(Number(e.days)||1)))})).sort((a,b)=>a.date.localeCompare(b.date));
}
// 부서: 일정마다 dept(값이 없는 옛 일정·기본 절기는 '전체'). 내 부서(이 기기) + '전체'가 먼저, 다른 부서는 뒤(흐리게·접기)
export const ALL='전체';
export const deptOf=x=>x?.dept||ALL;
export const isMine=(x,mine=[])=>!mine.length||deptOf(x)===ALL||mine.includes(deptOf(x));
export const splitMine=(list,mine=[])=>({mine:list.filter(x=>isMine(x,mine)),others:list.filter(x=>!isMine(x,mine))});
export const byPriority=(list,mine=[])=>{const s=splitMine(list,mine);return [...s.mine,...s.others];};
// 기기에 고른 내 부서 중 지금 교회에 있는 것만. 부서가 하나뿐인 교회는 나눌 필요가 없어서 []
export const myDeptsIn=(stored,depts=[])=>depts.length>1&&Array.isArray(stored)?stored.filter(d=>depts.includes(d)):[];
export const occursOn=(e,day)=>e.date<=day && addDays(e.date,(e.days||1)-1)>=day;
export function occurrences(years,settings={}) { return [...baseOccurrences(years,settings),...customOccurrences(settings.customEvents,years)].filter(e=>settings.enabled?.[e.id+'_'+e.date.slice(0,4)] !== false).sort((a,b)=>a.date.localeCompare(b.date)); }
export function tasksAround(today, settings = {}) {
  const y = +today.slice(0, 4);
  return occurrences([y - 1, y, y + 1], settings).flatMap(ev => ev.tasks.map(([weeks, text, who, doc], i) => ({
    key: `${ev.id}_${ev.date}_${i}`, event: ev.name, eventDate: ev.date, dept: deptOf(ev), due: settings.taskDue?.[ev.id+'_'+ev.date+'_'+i] || addDays(ev.date, -7 * weeks), weeks, text, who: who || '', doc: doc || '',
  }))).sort((a, b) => a.due.localeCompare(b.due));
}

// 이번 주(월~주일)에 마감인 일, 지난 4주 안에 못 한 일, 앞으로 8주 안의 절기
export function thisWeek(today, settings = {}, done = {}) {
  const mon = addDays(today, -((parse(today).getUTCDay() + 6) % 7)), sun = addDays(mon, 6);
  const all = tasksAround(today, settings);
  return {
    mon, sun,
    week: all.filter(t => t.due >= today && t.due <= sun),
    overdue: all.filter(t => t.due < today && t.due >= addDays(mon, -28) && !done[t.key]),
    upcoming: occurrences([+today.slice(0, 4), +today.slice(0, 4) + 1], settings).filter(e => e.date >= today && e.date <= addDays(today, 56)),
  };
}

