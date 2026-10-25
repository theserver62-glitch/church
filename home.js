import { addDays, parse } from './calendar.js?v=202610251020';
import { occurrences, tasksAround, occursOn } from './custom-events.js?v=202610251020';
export function monthGrid(year, month) {
 const first = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0,10);
 const start = addDays(first, -parse(first).getUTCDay());
 return Array.from({length:6},(_,w)=>Array.from({length:7},(_,d)=>addDays(start,w*7+d)));
}
export function prepSpans(year, month, settings = {}) {
 const grid=monthGrid(year,month), from=grid[0][0], to=grid[5][6];
 return occurrences([year-1,year,year+1],settings).filter(e=>e.tasks.length).map(e=>({eventId:e.id,name:e.name,start:addDays(e.date,-7*Math.max(...e.tasks.map(t=>t[0]))),end:e.date,...(e.dept&&{dept:e.dept})})).filter(e=>e.start<=to&&e.end>=from);
}
const md=s=>+s.slice(5,7)+'/'+ +s.slice(8,10);
const fmt=s=>md(s)+'('+'일월화수목금토'[parse(s).getUTCDay()]+')';
export function weekShare(name, mon, sun, tasks, done = {}) {
 return '['+name+'] 이번 주 할 일 ('+md(mon)+'~'+md(sun)+')\n'+tasks.map(t=>(done[t.key]?'☑':'☐')+' '+t.text+' — '+fmt(t.due)+'까지'+(t.who?' · '+t.who:'')).join('\n');
}
export function contiShare(name, day, songs) {
 return '['+name+'] '+fmt(day)+' 찬양\n'+songs.filter(s=>s.title).map((s,i)=>(i+1)+'. '+s.title+(s.key?' ('+s.key+')':'')).join('\n');
}
export function parseRef(text,index) {
 const m=text.trim().replace(/[–—]/g,'-').replace(/\s+/g,'').match(/^(.+?)(\d+)(?:장)?(?:(?::|절)(\d+)(?:-(\d+))?)?$/);
 if(!m)return null;
 const book=index.find(b=>b.name===m[1]||b.abbr===m[1]);
 const chap=+m[2], v1=m[3]?+m[3]:null,v2=m[4]?+m[4]:v1;
 if(!book||chap<1||chap>book.chapters||(v1!==null&&(v1<1||v2<v1)))return null;
 return {book:book.n,chap,v1,v2};
}
export function refRange(text,index) {
 const cross=text.trim().match(/^(.*?\d+:\d+)-(\d+):(\d+)$/);
 if(!cross){const r=parseRef(text,index);return r&&{...r,endChap:r.chap};}
 const r=parseRef(cross[1],index), endChap=+cross[2],v2=+cross[3];
 if(!r||endChap<r.chap||endChap>index.find(b=>b.n===r.book).chapters||v2<1)return null;
 return {...r,endChap,v2};
}
export function overlaps(a,b) {
 return a.book===b.book && a.chap*1000+(a.v1||1)<=b.endChap*1000+(b.v2||999) && b.chap*1000+(b.v1||1)<=a.endChap*1000+(a.v2||999);
}

// 한 주 안에서 준비 기간을 잘라 CSS 격자 열로 돌려준다.
export function prepWeek(week, spans, month) {
 return spans.filter(p=>p.start<=week[6]&&p.end>=week[0]).map(p=>{
 const start=week.findIndex(d=>d>=p.start), end=week.findLastIndex(d=>d<=p.end);
 return {...p,column:start+1,width:end-start+1,starts:week.includes(p.start),ends:week.includes(p.end),continues:p.end>week[6],monthContinues:p.end.slice(0,7)>month&&week.some(d=>d.startsWith(month)&&addDays(d,1).slice(0,7)!==month)};
 });
}
export function calendarCell(day,tasks,events,limit=2){
 const items=[...events.filter(e=>occursOn(e,day)).map(event=>({type:'event',event})),...tasks.filter(t=>t.due===day).map(task=>({type:'task',task}))];
 return {items:items.slice(0,limit),extra:Math.max(0,items.length-limit)};
}
export const shortTask = text => text.replace(/\s*[(（].*?[)）]/g,'').split(/[:：]/).pop().trim();

// 월요일 시작 한 주. UTC 계산으로 연도·윤년 경계를 보존한다.
export function weekDays(dateIso) {
 const monday=addDays(dateIso,-((parse(dateIso).getUTCDay()+6)%7));
 return Array.from({length:7},(_,i)=>addDays(monday,i));
}
export function dayItems(dateIso,settings={},done={}) {
 const tasks=tasksAround(dateIso,settings), year=+dateIso.slice(0,4);
 return {tasks:tasks.filter(t=>t.due===dateIso),events:occurrences([year-1,year],settings).filter(e=>occursOn(e,dateIso)),next:tasks.find(t=>t.due>dateIso&&!done[t.key])||null,
 preps:occurrences([year-1,year,year+1],settings).filter(e=>e.tasks.length&&e.date>=dateIso&&addDays(e.date,-7*Math.max(...e.tasks.map(t=>t[0])))<=dateIso).map(e=>{const mine=tasks.filter(t=>t.key.startsWith(e.id+'_'+e.date+'_'));return {...e,total:mine.length,completed:mine.filter(t=>done[t.key]).length};})};
}

// ---------- 말씀 PPT ----------
// 긴 절은 한 장에 max자 이하로, 비슷한 길이로 띄어쓰기에서 나눈다
export function splitVerse(text, max = 120) {
  const t = String(text).trim().replace(/\s+/g, ' ');
  if (t.length <= max) return [t];
  const n = Math.ceil(t.length / max), target = Math.ceil(t.length / n), out = [];
  let cur = '';
  for (const w of t.split(' ')) {
    const next = cur ? cur + ' ' + w : w;
    if (cur && (next.length > max || cur.length >= target) && out.length < n - 1) { out.push(cur); cur = w; } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}
// 구간 이름: "막 4:1-9", 장을 넘으면 "막 4:35-5:2"
export const passageLabel = p => p.abbr + ' ' + p.chap + ':' + p.v1 + (p.endChap !== p.chap ? '-' + p.endChap + ':' + p.v2 : p.v2 !== p.v1 ? '-' + p.v2 : '');
// passages: [{name, abbr, chap, v1, endChap, v2, verses: [{c, v, text}]}] → 표지 1장, 절마다(긴 절은 나눠) 한 장, 마지막 출처 장
export function scriptureSlides(passages, max = 120) {
  const slides = [{ type: 'title', title: passages.map(passageLabel).join(' / ') + ' · 개역한글' }];
  for (const p of passages) for (const v of p.verses) {
    const parts = splitVerse(v.text, max);
    parts.forEach((text, i) => slides.push({ type: 'verse', text, label: p.name + ' ' + v.c + ':' + v.v + (parts.length > 1 ? ' (' + (i + 1) + '/' + parts.length + ')' : '') }));
  }
  slides.push({ type: 'source', text: '개역한글(1961) · 저작권 보호기간 만료' });
  return slides;
}
// 파일 이름: "2026-10-25 막4_1-9.pptx"(구간이 더 있으면 " 외 n")
export const scriptureFileName = (passages, date) => date + ' ' + passageLabel(passages[0]).replace(' ', '').replace(':', '_') + (passages.length > 1 ? ' 외 ' + (passages.length - 1) : '') + '.pptx';

// ---------- 할 일 체크 ----------
// 완료(done)와 이번엔 건너뛰기(skipped)는 따로 저장한다. 되돌리기는 false
export const donePatch = (key, on, by, at) => ({ done: { [key]: on ? { by, at } : false } });
export const skipPatch = (key, on, by, at) => ({ skipped: { [key]: on ? { by, at } : false } });
// 목록에서 뺄 '챙긴 일': 완료 + 건너뜀
export const handled = (done = {}, skipped = {}) => ({ ...Object.fromEntries(Object.entries(done).filter(([, v]) => v)), ...Object.fromEntries(Object.entries(skipped).filter(([, v]) => v)) });

// 홈 '다음 행사'의 준비할 서류: 그 행사의 할 일 중 서류가 붙은 것, 안 끝난 것, 기한 빠른 것 하나(다른 절기 서류가 붙지 않게)
export const nextDocTask = (tasks, ev, done = {}) => tasks.filter(t => t.key.startsWith(ev.id + '_' + ev.date + '_') && t.doc && !done[t.key]).sort((a, b) => a.due.localeCompare(b.due))[0] || null;
