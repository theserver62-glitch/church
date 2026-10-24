import { occurrences, tasksAround, thisWeek, occursOn } from './custom-events.js';
import { TEMPLATES } from './templates.js';
// 교회 사역앱 화면. 사용자 글은 textContent/value로만 넣는다(innerHTML 금지).
import { weekDays, dayItems, monthGrid, prepSpans, prepWeek, calendarCell, shortTask, weekShare, contiShare, parseRef, refRange, overlaps } from './home.js';
import { formatCodeInput, validCode, nameKey, recentChurches, inviteText } from './entry.js';
import { openStore, newChurchCode } from './store.js';
import { todayIso, nextSunday, addDays, parse, monthItems, qtIndex } from './calendar.js';
import { EVENTS, RETREAT_FORMS } from './events.js';
import { docs } from './docs.js';
import { equipment, equipmentId, equipmentRows } from './equipment.js';
import { label, parseCsv, groupSongs } from './songbook.js';
import { parseBackup, backupSundays, previousSundays } from './backup.js';

const $ = id => document.getElementById(id);
const view = $('view'), nav = $('tabs'), msg = $('msg');
let store, unsubs = [];

// 요소 만들기. 문자열 자식은 텍스트 노드가 된다.
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'k') el.dataset.k = v;
    else if (k === 'class') el.className = v;
    else if (k.includes('-') || k === 'list') el.setAttribute(k, v);
    else el[k] = v;
  }
  el.append(...kids.flat().filter(c => c != null && c !== false));
  return el;
}

// 실시간으로 다시 그릴 때 지금 입력 중인 칸(data-k)은 값·커서를 새 칸으로 옮기고, 그 값을 다시 저장 대기에 올린다.
function fill(box, ...kids) {
  const a = document.activeElement, k = box.contains(a) && a.dataset.k;
  const text = k && a.matches('input:not([type=checkbox]), textarea');
  const v = a?.value, s = a?.selectionStart, e = a?.selectionEnd;
  box.replaceChildren(...kids.flat().filter(Boolean));
  const n = k && box.querySelector(`[data-k="${CSS.escape(k)}"]`);
  if (!n) return;
  n.focus();
  if (text && n.value !== v) { n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); }
  if (text) try { n.setSelectionRange(s, e); } catch { /* date 칸은 커서가 없다 */ }
}

// 글자 칸은 입력이 멈추고 0.6초 뒤 저장(쓰기 횟수 아끼기). 화면을 옮길 때·페이지를 닫을 때는 바로 저장.
const pending = new Map();
const later = (key, fn) => {
  clearTimeout(pending.get(key)?.t);
  pending.set(key, { fn, t: setTimeout(() => { pending.delete(key); fn(); }, 600) });
};
const flush = () => { pending.forEach(p => { clearTimeout(p.t); p.fn(); }); pending.clear(); };
addEventListener('pagehide', flush);

const say = t => { msg.textContent = t; clearTimeout(say.t); say.t = setTimeout(() => (msg.textContent = ''), 4000); };
const save = (path, obj) => store.update(path, obj).then(() => true).catch(() => { say('저장하지 못했어요. 인터넷 연결을 확인해 주세요.'); return false; });
const watch = (path, cb) => {
  const u = store.watch(path, cb, () => say('불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
  unsubs.push(u);
  return u;
};
const readOnce = path => new Promise((ok, no) => {
  let stop;
  const finish = (done, value) => { done(value); queueMicrotask(() => stop?.()); };
  stop = store.watch(path, d => finish(ok, d), err => finish(no, err));
});
const churchPath = () => 'churches/' + localStorage.getItem('church:code');
const md = s => `${+s.slice(5, 7)}/${+s.slice(8, 10)}`;
const fmt = s => `${md(s)}(${'일월화수목금토'[parse(s).getUTCDay()]})`;

function reset() {
  flush();
  unsubs.forEach(u => u());
  unsubs = [];
  view.replaceChildren();
  msg.textContent = '';
}

// ---------- 입장 ----------
function getRecent() {
  try { return recentChurches(JSON.parse(localStorage.getItem('church:recent')), null); } catch { return []; }
}
function remember(c, name) {
  try { localStorage.setItem('church:recent', JSON.stringify(recentChurches(getRecent(), {code:c,name}))); } catch { /* 입장은 계속한다 */ }
}
function showEntry(message = '') {
  reset(); view.dataset.screen = 'entry';
  nav.hidden = true; side.hidden = true;
  const err = h('p', {id:'entry-error', class:'err', role:'alert'}, message);
  const submit = h('button', {class:'primary', disabled:true}, '들어가기');
  const code = h('input', {class:'entry-code', placeholder:'ABCDE-FGHJK', autocomplete:'off', autocapitalize:'characters', spellcheck:false,
    'aria-label':'교회 코드', 'aria-describedby':'entry-error', oninput:()=>{
      code.value = formatCodeInput(code.value); submit.disabled = !validCode(code.value); err.textContent=''; code.removeAttribute('aria-invalid');
    }});
  let busy = false;
  async function join(c) {
    if(busy) return; busy=true; submit.disabled=true;
    try { const d=await readOnce('churches/'+c);
      if(d) await enter(c,d); else {err.textContent='이 코드의 교회를 찾지 못했어요. 코드를 다시 확인해 주세요.';code.setAttribute('aria-invalid','true');}
    } catch {err.textContent='불러오지 못했어요. 인터넷 연결을 확인해 주세요.';}
    finally {busy=false;submit.disabled=!validCode(code.value);}
  }
  const recent=getRecent();
  view.append(h('h1',{},'교회 사역앱'),h('p',{class:'hint'},'우리 교회의 사역을 함께 준비해요.'),
    recent.length > 0 && h('section',{},h('h2',{},'최근 들어간 교회'),recent.map(item=>h('div',{class:'recent-row'},
      h('button',{class:'recent-church',onclick:()=>join(item.code)},item.name),
      h('button',{class:'text-button', 'aria-label':item.name+' 목록에서 빼기',onclick:()=>{localStorage.setItem('church:recent',JSON.stringify(getRecent().filter(x=>x.code!==item.code)));showEntry();}},'목록에서 빼기')))),
    h('section',{},h('h2',{},'초대 링크를 받았나요?'),h('p',{},'카톡으로 받은 링크를 누르면 바로 들어와요.')),
    h('form',{onsubmit:e=>{e.preventDefault();if(validCode(code.value))join(code.value);}},h('h2',{},'교회 코드로 들어가기'),code,err,submit),
    h('button',{class:'text-button entry-create',onclick:showCreate},'처음이에요 → 새 교회 만들기'));
}
function showCreate() {
  reset(); view.dataset.screen='entry'; nav.hidden=true;side.hidden=true;
  const name=h('input',{required:true,maxLength:60,placeholder:'예: 새빛교회 청년부'});
  const err=h('p',{class:'err',role:'alert'}), duplicate=h('div');
  const submit=h('button',{class:'primary'},'새 교회 만들기');
  let busy=false;
  async function create(force=false, expected='') {
    if(busy)return;
    const n=name.value.trim(), key=nameKey(n);
    if(!key){err.textContent='교회 이름을 1~60자로 입력해 주세요.';return;}
    busy=true; submit.disabled=true; duplicate.replaceChildren();err.textContent='';
    try {
      const exists=await readOnce('names/'+key).catch(()=>null);
      if(exists && !(force && expected===n)) {
        duplicate.append(h('p',{},'같은 이름의 교회가 이미 있어요. 리더에게 초대 링크를 받아 들어오세요.'),
          h('button',{type:'button',class:'text-button',onclick:()=>{if(confirm('같은 이름의 교회가 이미 있어요. 그래도 새 교회를 만들까요?'))create(true,n);}},'그래도 새로 만들기'),
          h('button',{type:'button',class:'text-button',onclick:()=>showEntry('카톡으로 받은 초대 링크를 누르면 바로 들어와요. 리더에게 초대 링크를 받아 주세요.')},'초대 링크로 들어가기 안내'));
        return;
      }
      const c=newChurchCode();
      await store.update('churches/'+c,{name:n,createdAt:new Date().toISOString()});
      if(!exists) {
        try { if(!await readOnce('names/'+key)) await store.update('names/'+key,{createdAt:todayIso()}); } catch { /* 이름 등록 실패와 무관하게 생성한 교회로 진행 */ }
      }
      localStorage.setItem('church:code',c);remember(c,n);showCreated(c);
    } catch {err.textContent='만들지 못했어요. 인터넷 연결을 확인해 주세요.';}
    finally {busy=false;submit.disabled=false;}
  }
  view.append(h('h1',{},'새 교회 만들기'),h('p',{},'이미 우리 교회를 만든 리더가 있다면, 새로 만들지 말고 초대 링크를 받아 주세요.'),
    h('form',{onsubmit:e=>{e.preventDefault();create();}},h('label',{},h('span',{},'교회 이름'),name),err,duplicate,submit),
    h('button',{class:'text-button',onclick:()=>showEntry()},'입장 화면으로'));
}
async function copyInvite(c) {
  try {const d=await readOnce('churches/'+c);if(d)await copyText(inviteText(d.name,c,location.href));}
  catch {say('초대 링크를 불러오지 못했어요. 다시 시도해 주세요.');}
}

function showCreated(c) {
 reset(); let step=1; const s={dept:'청년부',size:'s',enabled:Object.fromEntries(EVENTS.map(e=>[e.id,e.on])),dates:{}};
 let role=localStorage.getItem('church:role')||''; const box=h('section',{class:'card'});view.append(box);
 function draw(){
 fill(box,h('p',{class:'hint'},step+'/4'),h('h2',{},['부서와 역할','절기·행사','여름수련회 날짜','리더 초대'][step-1]));
 if(step===1)box.append(h('h3',{},'부서 고르기'),h('div',{class:'row'},['청년부','중고등부','아동부','유치부','장년부'].map(v=>h('button',{class:'sub','aria-pressed':String(s.dept===v),onclick:()=>{s.dept=v;draw();}},v))),sizePicker(s.size,v=>{s.size=v;draw();}),h('label',{},h('span',{},'내 역할 이름'),h('input',{value:role,placeholder:'예: 찬양리더',maxLength:20,oninput:e=>role=e.target.value})));
 if(step===2)box.append(h('ul',{class:'toggles'},EVENTS.map(ev=>h('li',{},h('label',{},h('input',{type:'checkbox',checked:s.enabled[ev.id],onchange:e=>s.enabled[ev.id]=e.target.checked}),ev.name)))));
 if(step===3)box.append(h('label',{},h('span',{},'여름수련회 출발일'),h('input',{type:'date',value:s.dates.retreat||'',onchange:e=>s.dates.retreat=e.target.value})),h('button',{class:'sub',onclick:()=>{delete s.dates.retreat;step++;draw();}},'건너뛰기'));
 if(step===4)box.append(h('p',{},'교회 코드'),h('p',{class:'code big'},c),h('button',{class:'primary',onclick:()=>copyInvite(c)},'초대 링크 복사'),h('button',{class:'text-button',onclick:()=>copyText(c)},'코드만 복사'));
 box.append(h('div',{class:'row'},step>1&&h('button',{class:'sub',onclick:()=>{step--;draw();}},'이전'),h('button',{class:'primary',onclick:async()=>{localStorage.setItem('church:role',role.trim());try{await store.update(churchPath(),{settings:s});}catch{say('저장하지 못했어요. 인터넷 연결을 확인해 주세요.');return;}if(step===4)enter(c);else{step++;draw();}}},step===4?'시작하기':'다음')));
 }draw();
}
function sizePicker(value,change){return h('section',{},h('h3',{},'우리 교회 규모'),h('div',{class:'row'},[['s','20명 이하'],['m','20~60명'],['l','60명 이상']].map(([id,t])=>h('button',{class:'sub','aria-pressed':String(value===id),onclick:()=>change(id)},t))));}

async function enter(c, data) {
  const d = data || await readOnce('churches/'+c).catch(()=>null);
  if(!d) {showEntry('이 코드의 교회를 찾지 못했어요. 코드를 다시 확인해 주세요.');return;}
  localStorage.setItem('church:code', c);remember(c,d.name||'우리 교회');
  if(location.hash.startsWith('#c=')) history.replaceState(null,'',location.pathname+location.search);
  nav.hidden = false;
  show('home');
}

// ---------- 탭 ----------
const MENUS = [['home','홈'],['schedule','절기·행사'],['conti','찬양 콘티'],['word','말씀'],['docs','자료실'],['equipment','장비'],['set','설정']];
const TABS = [['home','홈'],['schedule','절기·행사'],['conti','콘티'],['word','말씀'],['more','더보기']];
const side = h('aside', { id:'sidebar', hidden:true }); document.body.prepend(side);
const VIEWS = { home:homeView, schedule:scheduleView, conti:contiView, word:wordView, docs:docsView, equipment:equipmentView, set:setView, more:moreView };
const GUIDES = {home:'일·주·월·년 일정과 준비할 일을 확인해요',schedule:'절기와 행사에 맞춰 준비할 일을 보여 줘요',conti:'이번 주일 찬양을 순서대로 준비해요',word:'주일설교 본문을 찾고 매일 말씀을 묵상해요',docs:'우리 교회에 필요한 준비 양식을 내려받아요',equipment:'장비의 수량과 상태를 함께 확인해요',set:'우리 교회에 맞게 설정해요',more:'자료실과 장비, 설정을 열어요'};
function show(tab) {
 reset(); side.hidden=false; nav.hidden=false; view.dataset.screen=tab;
 for(const b of [...nav.children,...side.querySelectorAll('button')]) { b.removeAttribute('aria-current'); if(b.dataset.k===tab || (b.dataset.k==='more'&&['docs','equipment','set'].includes(tab)))b.setAttribute('aria-current','page'); }
 view.append(h('h2',{},MENUS.find(m=>m[0]===tab)?.[1]||'더보기'),h('p',{class:'hint screen-guide'},GUIDES[tab]));
 VIEWS[tab]();
 watch(churchPath(),d=>{ $('church-title').textContent=d?.name||'교회 사역앱'; });
 for(const title of [...view.querySelectorAll('h2')].slice(1)) title.remove();
 [...view.children].forEach((el,i)=>el.style.animationDelay=(i*40)+'ms');
 scrollTo(0,0);
}
function toggleTask(key, checked) {
 let role=localStorage.getItem('church:role')?.trim();
 if(checked&&!role){role=prompt('내 역할 이름(예: 찬양리더)')?.trim()||'리더';localStorage.setItem('church:role',role);}
 save(churchPath(),{done:{[key]:checked?{by:role,at:todayIso()}:false}});
}
async function copyText(text) {
 try {await navigator.clipboard.writeText(text);say('복사했어요. 카톡방에 붙여 넣으세요');}
 catch {const box=h('dialog',{},h('p',{},'아래 글을 복사해 주세요')); const area=h('textarea',{value:text,rows:10,'aria-label':'복사할 글'});box.append(area,h('button',{class:'sub',onclick:()=>box.remove()},'닫기'));document.body.append(box);box.showModal();area.focus();area.select();}
}
function changeTaskDue(t) {
 const date=h('input',{type:'date',value:t.due,'aria-label':t.text+' 기한 변경'});
 const box=h('dialog',{},h('h3',{},'기한 바꾸기'),h('p',{},t.text),date,h('div',{class:'row'},h('button',{class:'sub',onclick:()=>box.close()},'취소'),h('button',{onclick:()=>{if(!date.value)return;save(churchPath(),{settings:{taskDue:{[t.key]:date.value}}});box.close();}},'저장')));
 box.addEventListener('close',()=>box.remove());document.body.append(box);box.showModal();date.focus();
}
const taskList = (ts, done, compact = false) => h('ul', { class: 'tasks' }, ts.map(t => h('li', {class:t.due<todayIso()&&!done[t.key]?'task-overdue':''}, h('label', {},
  h('input', { type: 'checkbox', checked: !!done[t.key], k: 'c:' + t.key,
    onchange: e => toggleTask(t.key, e.target.checked) }),
  h('span', {}, t.due < todayIso() && !done[t.key] ? h('small', {class:'late'}, '기한 지남') : null, h('span', { class: 'text' }, t.text), done[t.key]?.by ? h('small', {}, done[t.key].by + ' · ' + md(done[t.key].at)) : null,
    h('small', {}, [`${md(t.due)} 기한`, t.due < todayIso() && !done[t.key] ? Math.round((parse(todayIso())-parse(t.due))/864e5)+'일 지남' : '', t.event, t.who].filter(Boolean).join(' · ')))),compact?h('div',{class:'task-due-action'},h('button',{class:'sub task-due-button',onclick:()=>changeTaskDue(t)},'기한 바꾸기')):h('details',{},h('summary',{},'완료 처리 · 기한 변경'),h('button',{class:'sub',onclick:()=>toggleTask(t.key,!done[t.key])},done[t.key]?'완료 취소':'완료 처리'),h('label',{},h('span',{},'기한 변경'),h('input',{type:'date',value:t.due,'aria-label':t.text+' 기한 변경',onchange:e=>e.target.value&&save(churchPath(),{settings:{taskDue:{[t.key]:e.target.value}}})}))))));

const opened = new Set();

const retreatForms = forms => h('div', {}, h('h4', {}, '수련회 양식'), RETREAT_FORMS.map(([name, cols, keep]) => keep
  ? h('label', {}, h('span', {}, name), h('textarea', { rows: 4, placeholder: cols, value: forms[name] || '', k: 'f:' + name,
    oninput: e => { const v = e.target.value; later('f:' + name, () => save(churchPath(), { retreatForms: { [name]: v } })); } }))
  : h('div', { class: 'note' }, h('strong', {}, name), h('p', {}, cols), h('p', {}, '명단은 개인정보라 앱에 적지 말고 교회가 따로 보관하세요'))));

const sheetLink = song => typeof song?.sheet === 'string' && song.sheet.startsWith('https://')
  ? h('a', { class: 'sheet-link', 'aria-label':song.title+' 악보 열기', title:'악보 열기', href: song.sheet, target: '_blank', rel: 'noopener' }, icon()) : null;

function contiView() {
  let path, cur = [], stop = () => {}, book = {}, churchName = '';
  const printBox = h('section', { class: 'print-conti' });
  const paper = h('select', { 'aria-label': '인쇄 용지' }, ['A4', 'A3'].map(v => h('option', { value: v }, v)));
  const drawPrint = () => fill(printBox, h('h1', {}, '주일 찬양 콘티 · ' + date.value.replace(/(\d{4})-(\d{2})-(\d{2})/, (_, y, m, d) => y + '년 ' + +m + '월 ' + +d + '일')),
    h('table', {}, h('thead', {}, h('tr', {}, ['순서', '곡명', '키', '메모'].map(t => h('th', {}, t)))), h('tbody', {}, cur.map((s, i) => h('tr', {}, [i + 1, s.title, s.key, s.memo].map(t => h('td', {}, t || '')))))));
  const print = () => { flush(); drawPrint(); printBox.dataset.paper = paper.value; $('pagesize')?.remove(); document.head.append(h('style', { id: 'pagesize' }, '@page { size: ' + paper.value + ' portrait; margin: 15mm }')); window.print(); };
  const ppt = h('button', { type: 'button', class:'primary', onclick: async () => {
    flush(); const songs = cur.map(s => ({ ...s })), day = date.value, name = churchName; ppt.disabled = true;
    try { await makePpt(name, day, songs); } catch { say('PPT 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'); } finally { ppt.disabled = !cur.some(s=>s.title.trim()); }
  } }, '예배 PPT 만들기');
  const box = h('div'), list = h('datalist', { id: 'songbook' }), groups = h('div');
  let browseBy='theme'; const limits=new Map();
  const by=h('div',{class:'segments','aria-label':'곡 보관함 분류'},[['theme','주제별'],['key','조표별'],['mood','분위기별']].map(([id,t])=>h('button',{class:'sub','aria-pressed':String(id===browseBy),onclick:()=>{browseBy=id;for(const b of by.children)b.setAttribute('aria-pressed',String(b.dataset.k===id));drawBrowse();},k:id},t)));
  const search=h('input',{type:'search',placeholder:'곡명 검색 (선택 사항)','aria-label':'곡명 검색',oninput:()=>{limits.clear();drawBrowse();}});
  const drawBrowse=()=>{const grouped=groupSongs(Object.fromEntries(Object.entries(book).filter(([,s])=>s.title.includes(search.value.trim()))),browseBy);fill(groups,grouped.length?grouped.map(([name,songs])=>{
    const key=browseBy+name, count=limits.get(key)||30;
    return h('section',{class:'song-group'},h('h4',{},name+' · '+songs.length+'곡'),h('ul',{class:'browse'},songs.slice(0,count).map(s=>h('li',{},h('span',{},h('span',{},s.title,' ',h('small',{class:'key-tag'},s.key||'미지정')),h('small',{class:'meta'},[s.note,s.mood,s.theme].filter(Boolean).join(' · '))),sheetLink(s),h('button',{class:'sub','aria-label':s.title+' 콘티에 추가',onclick:()=>{setSongs([...cur,{title:s.title,key:s.key,memo:''}]);say(s.title+' 추가했어요');}},'+')))),songs.length>count&&h('button',{class:'sub',onclick:()=>{limits.set(key,count+30);drawBrowse();}},Math.min(30,songs.length-count)+'곡 더 보기 · 남은 '+(songs.length-count)+'곡'));
  }):h('p',{class:'empty'},search.value?'검색 결과가 없어요':'아직 저장된 곡이 없어요. 설정에서 곡 목록 CSV를 넣어 주세요.'));};
  const browse=h('section',{class:'card song-browser'},h('h3',{},'곡 보관함'),by,search,groups,h('p',{class:'meta'},'주제는 시와 찬미 분류 · 분위기는 AI 추정'));
  // 곡 목록에 있는 "제목 (키)"를 고르면 제목과 키를 나눠 채우고, 목록에 없는 새 곡은 목록에 더한다.
  const pick = i => {
    const s = book[cur[i].title];
    if (s) { cur[i] = { ...cur[i], title: s.title, key: s.key }; setSongs(cur.map(x => ({ ...x }))); }
    else if (cur[i].title.trim()) addToBook(cur[i]);
  };
  const addToBook = s => { const t = { title: s.title.trim(), key: (s.key || '').trim() }; if (!book[label(t)]) save(churchPath(), { songbook: { [label(t)]: t } }); };
  const date = h('input', { type: 'date', value: nextSunday(todayIso()), onchange: () => date.value && open() });
  // 순서가 바뀌면 칸 번호도 바뀌므로, 입력 중이던 칸을 먼저 놓는다(값은 flush로 이미 저장).
  const setSongs = songs => { flush(); document.activeElement?.blur(); cur = songs; save(path, { songs }); };
  const swap = (i, j) => { const b = [...cur]; [b[i], b[j]] = [b[j], b[i]]; setSongs(b); };
  // shortcut: 칸 이름이 곡 순서 번호라, 남이 앞 곡을 지우는 순간 입력 중이던 글이 다음 곡 칸으로 옮겨질 수 있다. 자주 생기면 곡마다 id를 둔다.
  const field = (i, f, ph) => h('input', { class: f, placeholder: ph, value: cur[i][f] || '', k: f + i, maxLength: 100, 'aria-label': `${i + 1}번 곡 ${ph}`,
    ...(f === 'title' && { list: 'songbook', onchange: () => pick(i) }), ...(f === 'key' && { onchange: () => cur[i].title.trim() && addToBook(cur[i]) }),
    oninput: e => {
      if (!cur[i]) return;
      cur[i][f] = e.target.value;
      drawPrint();
      const songs = cur.map(s => ({ ...s })), p = path;
      later('songs', () => save(p, { songs }));
    } });
  let removed=null; const memoOpen=new Set();
  const draw = () => { for(const el of exports.querySelectorAll('button, select'))el.disabled=!cur.some(s=>s.title.trim()); fill(box,!cur.length&&h('p',{class:'empty conti-empty'},h('span',{class:'desktop-copy'},'오른쪽 보관함에서 곡을 추가하세요'),h('span',{class:'mobile-copy'},'아래 보관함에서 곡을 추가하세요')),cur.length>0&&h('div',{class:'song-columns','aria-hidden':'true'},['','곡명','키','메모','순서'].map(t=>h('span',{},t))), h('ol', { class: 'songs' }, cur.map((s, i) => h('li', {},
    h('span', { class: 'num' }, i + 1 + '.'), field(i, 'title', '곡명'), field(i, 'key', '키'), h('div',{class:'song-memo'},s.memo||memoOpen.has(i)?field(i,'memo','메모'):h('button',{class:'sub',onclick:()=>{memoOpen.add(i);draw();}},'메모 추가')),
    h('span', { class: 'acts' },

      h('button', { type: 'button', class: 'sub', 'aria-label': `${i + 1}번 곡 위로`, disabled: i === 0, onclick: () => swap(i, i - 1) }, '▲'),
      h('button', { type: 'button', class: 'sub', 'aria-label': `${i + 1}번 곡 아래로`, disabled: i === cur.length - 1, onclick: () => swap(i, i + 1) }, '▼'),
      h('button', { type: 'button', class: 'danger', onclick: () => {removed={song:{...cur[i]},index:i};setSongs(cur.filter((_,j)=>j!==i));} }, '삭제'))))),
  h('button', { type: 'button', class: 'sub', onclick: () => setSongs([...cur, { title: '', key: '', memo: '' }]) }, '곡 추가'),removed&&h('button',{class:'sub',onclick:()=>{const songs=[...cur];songs.splice(removed.index,0,removed.song);removed=null;setSongs(songs);}},'삭제 되돌리기')); };
  let historyRequest = 0;
  const historyList = h('div');
  const history = h('details', { class: 'conti-history', ontoggle: () => { if (history.open) loadHistory(); } }, h('summary', {}, '지난 콘티'), historyList);
  async function loadHistory() {
    const request = ++historyRequest, selected = date.value, base = churchPath();
    fill(historyList, h('p', { class: 'hint' }, '지난 콘티를 불러오는 중이에요'));
    try {
      const weeks = await Promise.all(previousSundays(selected).map(async day => ({ day, data: await readOnce(base + '/conti/' + day) })));
      if (request !== historyRequest || !history.isConnected || date.value !== selected) return;
      const rows = weeks.filter(w => w.data?.songs?.length);
      fill(historyList, rows.length ? rows.map(({ day, data }) => h('details', {},
        h('summary', {}, fmt(day) + ' · ' + (data.songs[0].title || '제목 없는 곡') + (data.songs.length > 1 ? ' 외 ' + (data.songs.length - 1) + '곡' : '')),
        h('ol', {}, data.songs.map(s => h('li', {}, label(s), s.memo ? ' · ' + s.memo : ''))),
        h('button', { class: 'sub', onclick: () => {
          if (date.value !== selected || churchPath() !== base) return;
          if (confirm(fmt(selected) + ' 콘티를 이 콘티로 덮어쓸까요?')) setSongs(data.songs.map(s => ({ title: s.title || '', key: s.key || '', memo: s.memo || '' })));
        } }, '이 콘티 그대로 가져오기'))) : h('p', { class: 'empty' }, '이전 12주에 저장된 콘티가 없어요'));
    } catch { if (request === historyRequest) fill(historyList, h('p', { class: 'err' }, '지난 콘티를 불러오지 못했어요'), h('button', { class: 'sub', onclick: loadHistory }, '다시 불러오기')); }
  }
  const open = () => {
    flush();
    historyRequest++;
    if (history.open) loadHistory();
    stop(); removed=null; memoOpen.clear();
    path = `${churchPath()}/conti/${date.value}`;
    stop = watch(path, d => { cur = d?.songs || []; draw(); drawPrint(); });
  };
  const loadLast = async () => {
    const d = await readOnce(`${churchPath()}/conti/${addDays(date.value, -7)}`).catch(() => null);
    if (!d?.songs?.length) return say('지난 주 콘티가 없어요');
    if (cur.length && !confirm('지금 콘티를 지난 주 콘티로 바꿀까요?')) return;
    setSongs(d.songs.map(s => ({ title: s.title || '', key: s.key || '', memo: s.memo || '' })));
  };
  const exports = h('div',{class:'export-tools'},h('button',{class:'sub',onclick:()=>{flush();copyText(contiShare(churchName,date.value,cur));}},'카톡으로 보내기'), h('div', { class: 'row print-tools' }, h('label', {}, h('span', {}, '인쇄 용지'), paper), h('button', { type: 'button', class:'sub', onclick: print }, '인쇄'), ppt));
  view.append(h('h2', {}, '콘티'), h('div', { class: 'row' }, h('label', {}, h('span', {}, '주일 날짜'), date),
    h('button', { type: 'button', class: 'sub', onclick: loadLast }, '지난 주 콘티 불러오기')),
  h('p', { class: 'hint' }, '곡명을 치면 교회 곡 목록에서 고를 수 있어요. 가사는 저작권이 있어 곡명만 적어요.'), h('div',{class:'conti-layout'},h('div',{class:'conti-editor'},h('h3',{},'선택한 곡'),box,list,h('button',{class:'sub mobile-browse','aria-expanded':'false',onclick:e=>{const open=browse.classList.toggle('expanded');e.currentTarget.setAttribute('aria-expanded',String(open));}},'곡 목록에서 고르기')),browse,exports,history), printBox);
  watch(churchPath(), d => {
    churchName = d?.name || '';
    // 할 일 체크 같은 다른 변경 때는 다시 그리지 않는다(펼쳐 둔 묶음이 닫히지 않게)
    if (JSON.stringify(d?.songbook || {}) === JSON.stringify(book)) return;
    book = d?.songbook || {}; draw(); drawBrowse(); list.replaceChildren(...Object.keys(book).sort().map(v => h('option', { value: v, label: book[v].note ? `${v} · ${book[v].note}` : v }))); });
  drawBrowse(); open();
}

function qtView() {
  let path, stop = () => {}, archive = []; const passageBox=h('section',{class:'card'}); 
  const daily = h('section', { class: 'card', hidden: true });
  const drawDaily = () => {
    const item = archive[qtIndex(date.value, archive.length)]; daily.hidden = !item; if(item)scripture(passageBox,item.ref,false);
    fill(daily, item && [h('h3', {}, '오늘의 큐티'), h('h4', {}, item.ref + ' · ' + item.title),
      ...[['meaning', '1 이 말씀의 뜻'], ['context', '2 앞뒤 맥락'], ['people', '3 인물들의 입장과 생각'], ['why', '4 성경에 실린 이유'], ['theology', '5 신학적 의미와 본문의 역할'], ['apply', '6 오늘의 적용']].map(([key, title]) => h('div', {}, stepTitle(title), h('p', { class: 'qt-copy' }, item[key] || '')))]);
    const passage = box.querySelector('[data-k=passage]'); if (passage) passage.placeholder = item?.ref || '예: 요 3:1-16';
  };
  const box = h('div');
  const date = h('input', { type: 'date', value: todayIso(), onchange: () => date.value && open() });
  const who = h('input', { value: localStorage.getItem('church:role') || '', placeholder: '예: 찬양리더', maxLength: 20 });
  const text = h('textarea', { rows: 4, maxLength: 500, placeholder: '짧은 묵상을 적어 주세요 (500자까지)' });
  const post = e => {
    e.preventDefault();
    const t = text.value.trim();
    if (!t) return text.focus();
    save(path, { notes: { [Date.now().toString(36) + Math.random().toString(36).slice(2, 8)]: { who: who.value.trim() || '리더', text: t, at: new Date().toISOString() } } });
    text.value = '';
  };
  const open = () => {
    flush();
    stop();
    path = `${churchPath()}/qt/${date.value}`;
    drawDaily();
    stop = watch(path, d => {
      const notes = Object.values(d?.notes || {}).sort((a, b) => (a.at || '').localeCompare(b.at || ''));
      fill(box, h('label', {}, h('span', {}, '본문 범위'), h('input', { value: d?.passage || '', placeholder: archive[qtIndex(date.value, archive.length)]?.ref || '예: 요 3:1-16', maxLength: 50, k: 'passage',
        oninput: e => { const v = e.target.value, p = path; later('passage', () => save(p, { passage: v })); } })),
      
      h('h3', {}, '묵상'),
      notes.length ? h('ul', { class: 'notes' }, notes.map(n => h('li', {}, h('strong', {}, n.who || ''), ' · ', n.text || '')))
        : h('p', { class: 'empty' }, '아직 묵상이 없어요'));
    });
  };
  view.append(h('div',{class:'row'},h('button',{class:'sub',onclick:()=>{date.value=addDays(date.value,-1);open();}},'이전'),h('label',{},h('span',{},'날짜'),date),h('button',{class:'sub',onclick:()=>{date.value=addDays(date.value,1);open();}},'다음')),passageBox,daily,box,
    h('form', { class: 'card', onsubmit: post }, h('h3', {}, '묵상 쓰기'),
      h('label', {}, h('span', {}, '역할'), who), h('label', {}, h('span', {}, '묵상'), text), h('button', {class:'primary'}, '올리기')));
  fetch('./qt-archive.json').then(r => { if (!r.ok) throw new Error('QT'); return r.json(); }).then(items => { archive = Array.isArray(items) ? items : []; drawDaily(); }).catch(() => {});
  open();
}

function transferCard() {
  let busy = false;
  const download = h('button', { class: 'sub', onclick: async () => {
    if (busy) return;
    flush(); const base = churchPath(), today = todayIso();
    busy = true; download.disabled = upload.disabled = true;
    try {
      const [church, weeks] = await Promise.all([readOnce(base), Promise.all(backupSundays(today).map(async day => [day, await readOnce(base + '/conti/' + day)]))]);
      if (!church) throw new Error('교회 정보를 찾지 못했어요');
      const conti = Object.fromEntries(weeks.filter(([, d]) => d && Array.isArray(d.songs)).map(([day, d]) => [day, { songs: d.songs }]));
      const url = URL.createObjectURL(new Blob([JSON.stringify({ version: 1, church, conti }, null, 2)], { type: 'application/json' }));
      const a = h('a', { href: url, download: '교회백업_' + today + '.json' });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { say('백업을 내려받지 못했어요. 인터넷 연결을 확인해 주세요.'); }
    finally { busy = false; download.disabled = upload.disabled = false; }
  } }, '백업 내려받기');
  const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, onchange: async () => {
    const selected = file.files[0]; file.value = '';
    if (!selected || busy) return;
    busy = true; download.disabled = upload.disabled = true;
    const base = churchPath();
    try {
      let obj;
      try { obj = JSON.parse(await selected.text()); } catch { throw new Error('JSON 파일을 읽지 못했어요. 올바른 백업 파일을 골라 주세요'); }
      const { church, conti } = parseBackup(obj);
      if (!confirm('콘티 ' + Object.keys(conti).length + '주, 곡 목록 ' + Object.keys(church.songbook || {}).length + '곡을 넣을까요? 같은 날짜 콘티는 덮어써요')) return;
      if (churchPath() !== base) throw new Error('교회가 바뀌었어요. 다시 가져와 주세요');
      flush();
      if (Object.keys(church).length && !await save(base, church)) throw new Error('교회 자료를 저장하지 못했어요. 다시 가져와 주세요');
      for (const [day, data] of Object.entries(conti)) {
        if (!await save(base + '/conti/' + day, data)) throw new Error('일부 콘티를 저장하지 못했어요. 다시 가져오면 이어서 덮어써요');
      }
      say('백업 자료를 가져왔어요');
    } catch (error) { say(error.message || '백업을 가져오지 못했어요'); }
    finally { busy = false; download.disabled = upload.disabled = false; }
  } });
  const upload = h('button', { class: 'sub', onclick: () => file.click() }, '백업 가져오기');
  return h('section', { class: 'card' }, h('h3', {}, '자료 옮기기'), h('p', { class: 'hint' }, '교회 자료와 오늘 앞뒤 52주의 주일 콘티를 백업해요. 체험 모드에서 내려받은 파일을 Firebase 연결 후 가져올 수 있어요.'), h('div', { class: 'row' }, download, upload), file);
}

function setView() {
  const code = localStorage.getItem('church:code'), y = +todayIso().slice(0, 4);
  const sizeBox = h('div');
  const nameBox = h('div'), evBox = h('div'), bookBox = h('div');
  let settingsBook = {};
  const sheetSongs = h('datalist', { id: 'sheet-songs' });
  const sheetSong = h('input', { list: 'sheet-songs', required: true, 'aria-label': '악보를 넣을 곡', placeholder: '제목 (키)' });
  const sheetUrl = h('input', { type: 'url', required: true, placeholder: 'https://', 'aria-label': '악보 주소' });
  const sheetForm = h('form', { onsubmit: async e => {
    e.preventDefault(); const song = settingsBook[sheetSong.value], sheet = sheetUrl.value.trim();
    if (!song) return say('곡 목록에서 곡을 골라 주세요');
    if (!sheet.startsWith('https://')) return say('악보 주소는 https://로 시작해야 해요');
    if (await save(churchPath(), { songbook: { [sheetSong.value]: { sheet } } })) say('악보 링크를 저장했어요');
  } }, h('h4', {}, '악보 링크 넣기'), h('label', {}, h('span', {}, '곡 고르기'), sheetSong), sheetSongs,
    h('label', {}, h('span', {}, '악보 주소'), sheetUrl), h('button', {class:'primary'}, '저장'),
    h('p', { class: 'hint' }, "구글 드라이브에서 악보를 '링크가 있는 찬양팀만 보기'로 공유한 주소를 넣으세요. 교회 안 공유도 악보 저작권 허락(CCLI 등)이 필요할 수 있어요."));
  const csv = h('input', { type: 'file', accept: '.csv,text/csv', onchange: async () => {
    const f = csv.files[0];
    if (!f) return;
    const add = parseCsv(await f.text()), n = Object.keys(add).length;
    csv.value = '';
    if (!n) return say('CSV에서 곡을 찾지 못했어요. 첫 칸 제목, 둘째 칸 키로 적어 주세요.');
    await save(churchPath(), { songbook: add });
    say(`곡 ${n}개를 목록에 넣었어요`);
  } });
  const copy = h('button', { type: 'button', class: 'sub', onclick: () => (navigator.clipboard?.writeText(code) || Promise.reject())
    .then(() => (copy.textContent = '복사했어요'), () => say('복사가 안 돼요. 코드를 길게 눌러 복사해 주세요.')) }, '코드만 복사');
  view.append(h('div',{class:'settings-grid'},
 h('section',{class:'card'},h('h3',{},'교회 정보'),nameBox,sizeBox),h('section',{class:'card'},h('h3',{},'멤버 초대'),h('h4',{},'교회 코드'),h('p',{class:'code'},code),h('button',{class:'primary',onclick:()=>copyInvite(code)},'초대 링크 복사'),copy),h('section',{class:'card'},h('h3',{},'내 기기 설정'),h('label',{},h('span',{},'내 역할 이름 (이 기기에만 저장)'),h('input',{value:localStorage.getItem('church:role')||'',placeholder:'예: 찬양리더',maxLength:20,oninput:e=>localStorage.setItem('church:role',e.target.value.trim())})),h('button',{class:'danger',onclick:()=>{localStorage.removeItem('church:code');showEntry();}},'다른 교회로 바꾸기')),
 h('section',{class:'card'},evBox),
 h('section',{class:'card'},h('h3',{},'곡 목록·자료 옮기기'),bookBox,h('label',{},h('span',{},'CSV 파일로 곡 넣기'),csv),h('p',{class:'meta'},'제목, 키, 메모, 주제, 분위기, 악보 주소 순서'),sheetForm,transferCard())));
  watch(churchPath(), d => {
    fill(sizeBox,sizePicker(d?.settings?.size||'s',size=>save(churchPath(),{settings:{size}})));
    settingsBook = d?.songbook || {};
    const titles = Object.keys(settingsBook).sort();
    fill(sheetSongs, titles.map(t => h('option', { value: t }))); 
    fill(bookBox, h('h3', {}, `곡 목록 ${titles.length}곡`), titles.length
      ? h('details', {}, h('summary', {}, '목록 보기'), h('ul', {}, titles.map(t => h('li', {}, t))))
      : h('p', { class: 'empty' }, '콘티에 곡을 적으면 저절로 쌓여요.'));
    const s = d?.settings || {}, occ = occurrences([y, y + 1], { dates: s.dates }), today = todayIso();
    fill(nameBox, h('label', {}, h('span', {}, '교회 이름'), h('input', { value: d?.name || '', maxLength: 40, k: 'name',
      oninput: e => { const v = e.target.value.trim(); if (v) later('name', () => save(churchPath(), { name: v })); } })));
    fill(evBox, h('h3', {}, '절기·행사 켜고 끄기'), h('ul', { class: 'toggles' }, EVENTS.map(ev => h('li', {}, h('label', {},
      h('input', { type: 'checkbox', checked: s.enabled?.[ev.id] ?? ev.on, k: 'e:' + ev.id,
        onchange: e => save(churchPath(), { settings: { enabled: { [ev.id]: e.target.checked } } }) }), ev.name)))),
    h('h3', {}, '다가오는 행사 날짜'),
    ['retreat', 'summerThanks', 'thanksgiving'].map(id => {
      // 올해 것이 지났으면 내년 날짜를 고친다
      const ev = occ.find(o => o.id === id && o.date >= today), ey = ev.date.slice(0, 4);
      return h('label', {}, h('span', {}, `${ev.name} (${ey}년)`), h('input', { type: 'date', value: ev.date, min: `${ey}-01-01`, max: `${ey}-12-31`, k: 'd:' + id,
        onchange: e => e.target.value && save(churchPath(), { settings: { dates: { [id]: e.target.value } } }) }));
    }),
    h('p', { class: 'hint' }, '적힌 해의 날짜만 바뀌어요. 다른 해는 기본 날짜로 계산돼요.'));
  });
}


function scheduleView() {
 const list=h('div',{class:'event-list'});let selectedYear=+todayIso().slice(0,4),data={};
 const tabs=h('div',{class:'segments'},[0,1].map(n=>h('button',{class:'sub','aria-pressed':String(n===0),onclick:()=>{selectedYear=+todayIso().slice(0,4)+n;for(const [i,b] of [...tabs.children].entries())b.setAttribute('aria-pressed',String(i===n));draw();}},n?'내년':'올해')));
 const addBox=h('section',{class:'card',hidden:true});view.append(tabs,h('button',{onclick:()=>{addBox.hidden=false;addEventPanel(addBox,todayIso(),()=>{addBox.hidden=true;draw();});}},'+ 행사 추가'),addBox,list);
 function draw(){const tasks=tasksAround(selectedYear+'-07-01',{...data.settings,customEvents:data.customEvents});fill(list,occurrences([selectedYear],{...data.settings,customEvents:data.customEvents}).map(ev=>{
 const mine=tasks.filter(t=>t.key.startsWith(ev.id+'_'+ev.date+'_')),n=mine.filter(t=>data.done?.[t.key]).length,days=Math.round((parse(ev.date)-parse(todayIso()))/864e5);
 return h('section',{class:'card'},h('h3',{},ev.name),ev.custom&&h('span',{class:'event-tag'},'우리 교회 행사'),eventEditor(ev,data),h('p',{class:'meta'},fmt(ev.date)+' · '+(days<0?'D+'+Math.abs(days):days===0?'D-day':'D-'+days)),h('progress',{max:mine.length||1,value:n,'aria-label':ev.name+' 준비 진행'}),h('p',{class:'meta'},n+' / '+mine.length+'개 완료'),eventDetails(ev,tasks,data));
 }));}watch(churchPath(),d=>{data=d||{};draw();});
}
function moreView(){ view.append(h('div',{class:'row'},[['docs','자료실'],['equipment','장비'],['set','설정']].map(([id,t])=>h('button',{class:'sub',onclick:()=>show(id)},t)))); }
function eventDetails(ev, tasks, d) {
  const id = ev.id + ev.date, mine = tasks.filter(t => t.key.startsWith(ev.id+'_'+ev.date+'_'));
  return h('details', { open: opened.has(id), ontoggle: e => e.target.open ? opened.add(id) : opened.delete(id) },
    h('summary', {}, ev.name + ' · ' + fmt(ev.date)), mine.length ? taskList(mine, d?.done || {}) : h('p', { class: 'empty' }, '정해진 준비 일정이 없어요'),
    ev.buy?.length > 0 && h('section', {}, h('h4', {}, '준비물 사기'), h('ul', {}, ev.buy.map(item => h('li', {},
      h('a', { href: 'https://www.coupang.com/np/search?q=' + encodeURIComponent(item), target: '_blank', rel: 'noopener' }, item)))),
      h('p', { class: 'hint' }, '쿠팡 검색 결과로 열려요. 광고·제휴 링크가 아니에요.')),
    ev.id === 'retreat' && retreatForms(d?.retreatForms || {}),
    h('div',{class:'event-docs'},docs.filter(doc=>ev.id==='retreat'?/docs\/(04|05|15)_/.test(doc.file):doc.group==='행정·안내').slice(0,3).map(doc=>h('div',{},h('p',{},doc.title),docLink(doc)))));
}
function icon(kind='sheet',letter='') {
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 for(const [k,v] of Object.entries({viewBox:'0 0 24 24',width:24,height:24,fill:'none',stroke:'currentColor','stroke-width':1.5,'aria-hidden':'true'}))svg.setAttribute(k,v);
 const path=document.createElementNS(ns,'path');path.setAttribute('d','M5 2h10l4 4v16H5z M14 2v5h5');svg.append(path);
 if(letter){svg.setAttribute('class','file-icon '+kind);const text=document.createElementNS(ns,'text');text.setAttribute('x','12');text.setAttribute('y','17');text.setAttribute('text-anchor','middle');text.setAttribute('fill','white');text.setAttribute('stroke','none');text.setAttribute('font-size','11');text.textContent=letter;svg.append(text);}
 return svg;
}
const docLink=doc=>h('div',{class:'doc-download'},[['word','W','워드',doc.file],['hwp','한','한글',doc.file.replace(/\.docx$/,'.hwpx')]].map(([kind,letter,title,href])=>h('a',{href,download:true,'aria-label':doc.title+' '+title+' 내려받기'},icon(kind,letter),h('span',{},title+'로 받기'))));
function docsView() {
 const recommended=h('div',{class:'docs-grid'}),all=h('div',{class:'docs-grid'});
 const card=doc=>h('article',{class:'card doc-card'},h('small',{class:'meta'},doc.group),h('h4',{},doc.title),h('p',{},doc.desc),docLink(doc));
 view.append(h('section',{class:'docs-recommendations'},h('h3',{},'우리 교회 규모에 맞는 자료'),h('p',{},'설정한 교회 규모에 맞춰 준비에 필요한 양식을 골랐어요.'),recommended),h('h3',{},'다른 자료'),all);
 watch(churchPath(),d=>{const ids=({s:['15','01','08'],m:['03','04','05'],l:['03','04','06']}[d?.settings?.size||'s']);const featured=doc=>ids.some(id=>doc.file.startsWith('docs/'+id+'_'));fill(recommended,docs.filter(featured).map(card));fill(all,docs.filter(doc=>!featured(doc)).map(card));});
}
function equipmentView() {
 const summary=h('p',{class:'equipment-summary'}),box=h('div',{class:'equipment-grid'});
 const cat=h('select',{'aria-label':'추가 장비 분류'},Object.keys(equipment).map(c=>h('option',{value:c},c)));
 const name=h('input',{required:true,maxLength:100,placeholder:'장비 이름','aria-label':'추가 장비 이름'}),qty=h('input',{type:'number',min:0,step:1,value:0,required:true,'aria-label':'추가 장비 수량'});
 const form=h('form',{class:'equipment-add row',hidden:true,onsubmit:e=>{e.preventDefault();const n=name.value.trim();if(!n)return;save(churchPath(),{equipment:{[equipmentId(cat.value,n)]:{cat:cat.value,name:n,qty:Number(qty.value),state:Number(qty.value)?'좋음':'없음',memo:''}}});name.value='';}},cat,name,qty,h('button',{class:'sub'},'추가'));
 view.append(summary,box,h('button',{class:'text-button',onclick:()=>{form.hidden=!form.hidden;if(!form.hidden)name.focus();}},'다른 장비 추가'),form);
 watch(churchPath(),d=>{
 const entries=equipmentRows(d?.equipment||{}),total=entries.reduce((n,[,v])=>n+Number(v.qty||0),0),needs=entries.filter(([,v])=>v.state==='점검 필요').length,broken=entries.filter(([,v])=>v.state==='고장').length;
 fill(summary,h('span',{},'전체 '+total+'개'),h('span',{},'점검 필요 '+needs),h('span',{class:broken?'late':''},'고장 '+broken));
 fill(box,Object.keys(equipment).map(c=>h('section',{class:'card equipment-category'},h('h3',{},c),h('table',{},h('thead',{},h('tr',{},['품목','수량','상태','메모'].map(t=>h('th',{},t)))),h('tbody',{},entries.filter(([,v])=>v.cat===c).map(([id,item])=>{
 const write=(key,value)=>save(churchPath(),{equipment:{[id]:{cat:item.cat,name:item.name,[key]:value}}});
 return h('tr',{class:item.state==='고장'?'broken equipment-warning':item.state==='점검 필요'?'equipment-warning':''},h('th',{scope:'row'},item.name),h('td',{},h('input',{type:'number',min:0,step:1,value:item.qty,k:'eq:'+id+'qty','aria-label':item.name+' 수량',oninput:e=>{if(e.target.value!==''&&e.target.validity.valid)write('qty',Number(e.target.value));}})),h('td',{},h('select',{k:'eq:'+id+'state','aria-label':item.name+' 상태',class:item.state==='없음'?'absent':'',onchange:e=>write('state',e.target.value)},['없음','좋음','점검 필요','고장'].map(v=>h('option',{value:v,selected:item.state===v},v)))),h('td',{},h('input',{value:item.memo||'',maxLength:500,k:'eq:'+id+'memo','aria-label':item.name+' 메모',oninput:e=>{const v=e.target.value;later('eq:'+id+'memo',()=>write('memo',v));}})));
 }))))));
 });
}


let pptTool;
function loadPptTool() {
  if (window.PptxGenJS) return Promise.resolve();
  if (!pptTool) pptTool = new Promise((resolve, reject) => {
    const script = h('script', { src: 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js', onload: () => { window.PptxGenJS ||= window.pptxgen; window.PptxGenJS ? resolve() : reject(new Error('PPT')); }, onerror: () => { script.remove(); reject(new Error('PPT')); } });
    document.head.append(script);
  }).catch(err => { pptTool = null; throw err; });
  return pptTool;
}
async function makePpt(name, date, songs) {
  await loadPptTool();
  const deck = new window.PptxGenJS(); deck.layout = 'LAYOUT_WIDE'; deck.author = name; deck.subject = '주일 예배'; deck.title = date + ' 주일 예배';
  deck.theme = { headFontFace: 'Malgun Gothic', bodyFontFace: 'Malgun Gothic', lang: 'ko-KR' };
  const slide = title => {
    const s = deck.addSlide(); s.background = { color: '1f2420' };
    s.addShape(deck.ShapeType.rect, { x: 0, y: 0, w: 13.334, h: 0.3, fill: { color: '2f5d50' }, line: { color: '2f5d50' } });
    s.addText(title, { x: 0.8, y: 0.8, w: 11.7, h: 1.3, color: 'FFFFFF', fontFace: 'Malgun Gothic', fontSize: 40, bold: true, breakLine: false }); return s;
  };
  const text = (s, content, y, size = 28) => s.addText(content, { x: 0.8, y, w: 11.7, h: 1.3, color: 'FFFFFF', fontFace: 'Malgun Gothic', fontSize: size });
  const cover = slide('주일 예배'); text(cover, name, 3); text(cover, date, 4.5);
  const order = slide('예배 순서'); order.addText('묵도 · 찬송 · 대표기도 · 성경봉독 · 설교\n찬양 · 봉헌 · 광고 · 축도', { x: 0.8, y: 2.5, w: 11.7, h: 3, fontFace: 'Malgun Gothic', color: 'FFFFFF', fontSize: 28 });
  for (const song of songs.filter(s => s.title.trim())) { const s = slide(song.title); text(s, '키: ' + (song.key || ''), 3); text(s, '가사는 교회가 저작권을 확인하고 넣어 주세요', 6, 16); }
  const word = slide('오늘의 말씀'); word.addShape(deck.ShapeType.rect, { x: 0.8, y: 2.5, w: 11.7, h: 3.6, line: { color: 'FFFFFF', width: 1 }, fill: { color: '1f2420', transparency: 100 } });
  slide('광고');
  await deck.writeFile({ fileName: '예배_' + date + '.pptx' });
}


let homeMonth=todayIso().slice(0,7), selectedDay='',homeMode=['day','week','month','year'].includes(localStorage.getItem('church:view'))?localStorage.getItem('church:view'):'month';
async function homeWord(box) {
 try {
  const [items,index]=await Promise.all([fetch('./qt-archive.json').then(r=>r.json()),fetch('./bible/index.json').then(r=>r.json())]);
  const item=items[qtIndex(todayIso(),items.length)],ref=item&&refRange(item.ref,index);
  if(!item||!ref)throw new Error('말씀 없음');
  const bible=await fetch('./bible/'+String(ref.book).padStart(2,'0')+'.json').then(r=>r.json());
  if(!box.isConnected)return;
  fill(box,h('h3',{},'오늘의 말씀'),h('p',{class:'meta'},item.ref),h('p',{class:'rail-verse'},bible[ref.chap-1]?.[(ref.v1||1)-1]||''),h('button',{class:'sub',onclick:()=>{wordMode='qt';show('word');}},'말씀 읽기'));
 } catch {if(box.isConnected)fill(box,h('h3',{},'오늘의 말씀'),h('p',{},'말씀을 불러오지 못했어요'),h('button',{class:'sub',onclick:()=>homeWord(box)},'다시 불러오기'));}
}

const eventColor = id => ['#2f5d50','#79523c','#525c86','#765078','#806321','#386874'][([...id].reduce((n,c)=>n+c.charCodeAt(0),0))%6];
async function moveEvent(ev,date,data){
 if(!date||date===ev.date)return;
 if(!ev.custom&&date.slice(0,4)!==ev.date.slice(0,4)){say('기본 절기는 같은 해 안에서 날짜를 골라 주세요');return;}
 const delta=Math.round((parse(date)-parse(ev.date))/864e5), taskDue={};
 ev.tasks.forEach((_,i)=>{const old=ev.id+'_'+ev.date+'_'+i;if(data.settings?.taskDue?.[old])taskDue[ev.id+'_'+date+'_'+i]=addDays(data.settings.taskDue[old],delta);});
 const patch=ev.custom?{customEvents:{[ev.id]:{date}},settings:{taskDue}}:{settings:{dates:{[ev.id]:date},taskDue}};
 if(await save(churchPath(),patch)){say(ev.name+'을 '+fmt(date)+'로 옮겼어요');msg.append(h('button',{onclick:async()=>{if(await save(churchPath(),ev.custom?{customEvents:{[ev.id]:{date:ev.date}}}:{settings:{dates:{[ev.id]:data.settings?.dates?.[ev.id]||null}}}))say('되돌렸어요');}},'되돌리기'));}
}
function eventEditor(ev,data,close=()=>{}){
 const date=h('input',{type:'date',value:ev.date,min:ev.custom?'':ev.date.slice(0,4)+'-01-01',max:ev.custom?'':ev.date.slice(0,4)+'-12-31',required:true,'aria-label':'행사 날짜 바꾸기'});
 return h('section',{class:'event-editor'},h('h3',{},ev.name),ev.custom&&h('small',{class:'event-tag'},'우리 교회 행사'),h('form',{onsubmit:async e=>{e.preventDefault();await moveEvent(ev,date.value,data);close();}},h('label',{},h('span',{},'날짜 바꾸기'),date),h('button',{class:'primary'},'저장')),h('button',{class:'text-button',onclick:async()=>{if(ev.custom){if(!confirm('삭제하면 준비 체크 기록도 안 보여요'))return;if(await save(churchPath(),{customEvents:{[ev.id]:null}}))close();}else if(await save(churchPath(),{settings:{enabled:{[ev.id+'_'+ev.date.slice(0,4)]:false}}}))close();}},ev.custom?'삭제':'올해 끄기'));
}
function addEventPanel(box,initialDate,close){
 let draft={name:'',date:initialDate||todayIso(),days:1,tpl:'',tasks:[]};
 function draw(){
 const field=(title,type,key,props={})=>h('label',{},h('span',{},title),h('input',{type,value:draft[key],required:true,...props,oninput:e=>draft[key]=type==='number'?Number(e.target.value):e.target.value}));
 fill(box,h('h3',{},'행사 추가'),h('h4',{},'종류'),h('div',{class:'template-list'},[{id:'',name:'직접 만들기',days:1,tasks:[]},...TEMPLATES].map(t=>h('button',{type:'button','aria-pressed':String(draft.tpl===t.id),onclick:()=>{draft={...draft,tpl:t.id,name:t.id?t.name:'',days:t.days,tasks:t.tasks.map(row=>[...row])};draw();}},h('strong',{},t.name),h('small',{},'준비 '+Math.max(0,...t.tasks.map(v=>v[0]))+'주 전부터')))),h('form',{onsubmit:async e=>{e.preventDefault();if(!draft.name.trim())return;if(await save(churchPath(),{customEvents:{['c'+Date.now().toString(36)]:{...draft,name:draft.name.trim(),tasks:draft.tasks.filter(t=>t[1].trim())}}}))close();}},field('이름','text','name',{maxLength:100}),field('날짜','date','date'),field('일수','number','days',{min:1,max:10,step:1}),h('h4',{},'준비 할 일'),draft.tasks.map((t,i)=>h('div',{class:'row task-edit'},h('input',{type:'number',value:t[0],'aria-label':'준비 주전',oninput:e=>t[0]=Number(e.target.value)}),h('input',{value:t[1],required:true,'aria-label':'할 일',oninput:e=>t[1]=e.target.value}),h('input',{value:t[2],'aria-label':'담당',oninput:e=>t[2]=e.target.value}),h('button',{type:'button',onclick:()=>{draft.tasks.splice(i,1);draw();}},'삭제'))),h('button',{type:'button',onclick:()=>{draft.tasks.push([1,'','']);draw();}},'+ 할 일'),h('div',{class:'row'},h('button',{class:'primary'},'추가'),h('button',{type:'button',onclick:close},'취소'))));
 }draw();
}

function homeView(){
 view.querySelector('h2')?.remove();
 const summary=h('section',{class:'home-summary'}),cal=h('section',{class:'card calendar'}),detail=h('section',{class:'card day-detail'}),right=h('section',{class:'card home-right'});
 view.append(summary,h('div',{class:'home-layout'},h('div',{},cal,detail),right));
 let data={},selectedEvent=null,editing=null,adding=false; const sundayBox=h('section',{class:'rail-section'}),wordBox=h('section',{class:'rail-section'},h('h3',{},'오늘의 말씀'));
 watch(churchPath()+'/conti/'+nextSunday(todayIso()),d=>fill(sundayBox,h('h3',{},'이번 주일 찬양'),d?.songs?.length?h('ol',{},d.songs.filter(s=>s.title).map(s=>h('li',{},s.title))):h('p',{class:'hint'},'아직 콘티가 없어요'),h('button',{class:'sub',onclick:()=>show('conti')},'콘티 열기')));
 homeWord(wordBox);
 const today=todayIso(); selectedDay ||= today;
 function draw(){
 cal.dataset.mode=homeMode;
 const s={...data.settings,customEvents:data.customEvents},done=data.done||{},[y,m]=homeMonth.split('-').map(Number),grid=monthGrid(y,m),ts=tasksAround(homeMonth+'-01',s),evs=occurrences([y-1,y,y+1],s),spans=prepSpans(y,m,s),w=thisWeek(today,s,done),next=w.upcoming[0];
 const choose=p=>{selectedEvent=p;selectedDay=p.start;editing=evs.find(e=>e.id===p.eventId&&e.date===p.end);adding=false;draw();};
 fill(summary,h('div',{class:'home-heading'},h('h2',{},'홈'),h('p',{},next?'다음 행사: '+next.name+' '+md(next.date)+' · '+Math.round((parse(next.date)-parse(today))/864e5)+'일 남음':'다가오는 행사가 없어요')));
 const move=n=>{if(homeMode==='day'||homeMode==='week'){selectedDay=addDays(selectedDay,n*(homeMode==='week'?7:1));homeMonth=selectedDay.slice(0,7);}else{const d=parse(homeMonth+'-01');d.setUTCMonth(d.getUTCMonth()+n*(homeMode==='year'?12:1));homeMonth=d.toISOString().slice(0,7);selectedDay=homeMonth+'-01';}selectedEvent=null;draw();};
 const controls=h('div',{class:'home-controls'},h('div',{class:'segments'},[['day','일'],['week','주'],['month','월'],['year','년']].map(([id,t])=>h('button',{class:'sub','aria-pressed':String(homeMode===id),onclick:()=>{homeMode=id;localStorage.setItem('church:view',id);draw();}},t))),h('div',{class:'period-controls'},h('button',{class:'sub','aria-label':'이전 기간',onclick:()=>move(-1)},'◀'),h('strong',{},homeMode==='year'?y+'년':homeMode==='week'?md(weekDays(selectedDay)[0])+'~'+md(weekDays(selectedDay)[6]):homeMode==='day'?fmt(selectedDay):y+'년 '+m+'월'),h('button',{class:'sub','aria-label':'다음 기간',onclick:()=>move(1)},'▶'),h('button',{class:'sub',onclick:()=>{homeMonth=today.slice(0,7);selectedDay=today;selectedEvent=null;draw();}},'오늘')));
 summary.append(controls,h('button',{onclick:()=>{adding=true;editing=null;addEventPanel(right,selectedDay,()=>{adding=false;draw();});}},'+ 행사 추가'));
 if(homeMode==='month')summary.append(h('div',{class:'calendar-legend'},evs.filter(e=>addDays(e.date,-7*Math.max(0,...e.tasks.map(t=>t[0])))<=homeMonth+'-31'&&addDays(e.date,(e.days||1)-1)>=homeMonth+'-01').map(e=>h('span',{},h('i',{style:'background:'+eventColor(e.id)}),e.name))));
 fill(cal,
 h('div',{class:'weekdays'},...'일월화수목금토'.split('').map(d=>h('div',{class:'weekday'},d))),grid.map(week=>h('div',{class:'calendar-week'},h('div',{class:'month-grid'},week.map(day=>{
 const cell=calendarCell(day,ts,evs), active=evs.filter(e=>occursOn(e,day));
 return h('div',{style:'',ondragover:e=>{if(matchMedia('(pointer:fine)').matches){e.preventDefault();e.currentTarget.classList.add('drop-target');}},ondragleave:e=>e.currentTarget.classList.remove('drop-target'),ondrop:e=>{e.preventDefault();e.currentTarget.classList.remove('drop-target');const ev=evs.find(v=>v.id+'_'+v.date===e.dataTransfer.getData('text/plain'));if(ev)moveEvent(ev,day,data);},class:'day'+(active.length?' has-event':'')+(day===today?' today':'')+(day===selectedDay?' selected':'')+(!day.startsWith(homeMonth)?' outside':'')},h('button',{class:'day-number','aria-label':fmt(day),'aria-pressed':String(day===selectedDay),onclick:()=>{selectedDay=day;selectedEvent=null;draw();}},String(+day.slice(8))),spans.filter(p=>p.start===day).map(p=>h('button',{class:'calendar-marker prep-start',onclick:()=>{selectedDay=day;selectedEvent=null;draw();}},p.name.replace(/주일$/,'')+' 준비 시작')),cell.items.filter(item=>item.event).map(item=>h('button',{style:'background:'+eventColor(item.event.id)+';color:white',class:'calendar-item sub'+(item.event?' event-title':' task-caption'),draggable:!!item.event&&matchMedia('(pointer:fine)').matches,ondragstart:e=>e.dataTransfer.setData('text/plain',item.event.id+'_'+item.event.date),title:item.task?.text||item.event.name,onclick:()=>{selectedDay=day;selectedEvent=null;editing=item.event||null;adding=false;draw();detail.scrollIntoView({behavior:'smooth',block:'nearest'});}},item.task?shortTask(item.task.text):item.event.name)),cell.extra>0&&h('button',{class:'calendar-more sub',onclick:()=>{selectedDay=day;selectedEvent=null;draw();}},'외 '+cell.extra+'개'));
 })),h('div',{class:'week-preps'},prepWeek(week,spans,homeMonth).map(p=>h('button',{class:'prep-ribbon prep-tone-'+(EVENTS.findIndex(e=>e.id===p.eventId)%6)+' '+(p.eventId==='advent'?'advent':'thanksgiving')+(selectedEvent?.eventId===p.eventId?' chosen':''),style:'--event-color:'+eventColor(p.eventId)+';grid-column:'+p.column+' / span '+p.width,'aria-label':p.name+' 준비 '+md(p.start)+'~'+md(p.end),onclick:()=>choose(p)},h('span',{class:'ribbon-full'},p.starts||week===grid[0]?p.name:''),h('span',{class:'ribbon-mobile'},p.starts||week===grid[0]?p.name:'')))))));
 const dayData=dayItems(selectedDay,s,done);
 if(homeMode==='day')fill(cal,h('h3',{},fmt(selectedDay)),dayData.events.map(e=>h('button',{class:'event-tag',onclick:()=>{editing=e;adding=false;draw();}},e.name)),dayData.tasks.length?taskList(dayData.tasks,done):h('div',{},h('p',{},'이날은 준비할 일이 없어요'),dayData.next&&h('p',{},'다음 할 일 · '+fmt(dayData.next.due)+' '+dayData.next.text)),dayData.preps.map(e=>h('div',{class:'daily-prep prep-tone-'+(EVENTS.findIndex(v=>v.id===e.id)%6)},h('h4',{},e.name+' · D-'+Math.round((parse(e.date)-parse(selectedDay))/864e5)),h('progress',{max:e.total||1,value:e.completed,'aria-label':e.name+' 준비 진행'}),h('small',{class:'meta'},e.completed+' / '+e.total+'개 완료'))));
 if(homeMode==='week')fill(cal,h('h3',{},'이번 주 일정'),h('div',{class:'week-view'},weekDays(selectedDay).map(day=>{const items=dayItems(day,s,done);return h('section',{class:'week-column'+(day===today?' today':'')},h('h4',{},fmt(day)),items.events.map(e=>h('button',{class:'event-tag',onclick:()=>{editing=e;adding=false;draw();}},e.name)),items.tasks.length?taskList(items.tasks.slice(0,3),done,true):h('p',{class:'meta'},'할 일 없음'),items.tasks.length>3&&h('button',{class:'sub',onclick:()=>{selectedDay=day;homeMonth=day.slice(0,7);homeMode='day';localStorage.setItem('church:view','day');draw();}},'외 '+(items.tasks.length-3)+'개'));})));
 if(homeMode==='year')fill(cal,h('h3',{},y+'년 월별 일정'),h('div',{class:'year-months'},Array.from({length:12},(_,i)=>{const prefix=y+'-'+String(i+1).padStart(2,'0'),preps=prepSpans(y,i+1,s).filter(p=>p.start.startsWith(prefix));return h('section',{class:'year-month'},h('button',{onclick:()=>{homeMonth=prefix;selectedDay=prefix+'-01';homeMode='month';localStorage.setItem('church:view','month');draw();}},i+1+'월'),h('div',{},evs.filter(e=>e.date<=prefix+'-31'&&addDays(e.date,(e.days||1)-1)>=prefix+'-01').map(e=>h('button',{class:'event-tag',onclick:()=>{editing=e;adding=false;draw();}},e.name)),preps.map(p=>h('small',{class:'meta'},p.name+' 준비 시작 · '+md(p.start)))));})));

 detail.hidden=homeMode!=='month';
 const selected=selectedEvent?ts.filter(t=>t.eventDate===selectedEvent.end&&t.event===selectedEvent.name):ts.filter(t=>t.due===selectedDay);
 fill(detail,h('button',{onclick:()=>{adding=true;editing=null;addEventPanel(right,selectedDay,()=>{adding=false;draw();});}},'이날 행사 추가'),h('h3',{},selectedEvent?selectedEvent.name+' 준비':'선택 날짜 · '+fmt(selectedDay)),dayData.preps.map(e=>h('p',{class:'selected-prep'},e.name+' 준비 중 · '+e.completed+'/'+e.total+'개 완료')),spans.filter(p=>p.start===selectedDay).map(p=>h('p',{class:'prep-start'},p.name.replace(/주일$/,'')+' 준비 시작')),selected.length?taskList(selected,done):h('p',{class:'hint'},'정해진 준비 일정이 없어요'),evs.filter(e=>occursOn(e,selectedDay)).map(e=>h('button',{onclick:()=>{editing=e;adding=false;draw();}},e.name)));
 if(adding)return;
 fill(right,h('h3',{},'지금 준비할 일'),h('section',{class:w.overdue.length?'overdue':''},h('h4',{},'기한 지난 준비 '+w.overdue.length+'건'),h('ul',{class:'tasks overdue-actions'},w.overdue.map(t=>h('li',{},h('strong',{},t.text),h('small',{},'마감 '+md(t.due)+' · '+Math.round((parse(today)-parse(t.due))/864e5)+'일 지남'),h('div',{class:'row'},h('button',{class:'sub',onclick:()=>toggleTask(t.key,true)},'완료 처리'),h('button',{class:'sub',onclick:()=>changeTaskDue(t)},'기한 변경')))))),h('h4',{},'이번 주 할 일 '+w.week.length+'개'),w.week.length?taskList(w.week,done):h('p',{class:'hint'},'이번 주 예정된 준비는 없어요'),h('button',{class:'sub',onclick:()=>show('schedule')},'전체 준비 일정 보기'));
 right.append(sundayBox,wordBox);if(editing)fill(right,eventEditor(editing,data,()=>{editing=null;draw();}));
 }watch(churchPath(),d=>{data=d||{};draw();});
}
const stepTitle=t=>h('h4',{class:'step-title'},h('span',{class:'step-number'},t.slice(0,1)),t.slice(2));
const STEPS=[['meaning','1 이 말씀의 뜻'],['context','2 앞뒤 맥락'],['people','3 인물들의 입장과 생각'],['why','4 성경에 실린 이유'],['theology','5 신학적 의미와 본문의 역할'],['apply','6 오늘의 적용']];
const BIBLE_CODES='gen exo lev num deu jos jdg rut 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job psa pro ecc sng isa jer lam ezk dan hos jol amo oba jnh mic nam hab zep hag zec mal mat mrk luk jhn act rom 1co 2co gal eph php col 1th 2th 1ti 2ti tit phm heb jas 1pe 2pe 1jn 2jn 3jn jud rev'.split(' ');
let wordMode='sermon';
async function scripture(box,text,commentary=true){
 const request=Symbol();box.request=request;
 fill(box,h('p',{},'본문을 불러오는 중이에요'));
 try{
 const [index,archive]=await Promise.all([fetch('./bible/index.json').then(r=>r.json()),fetch('./qt-archive.json').then(r=>r.json())]);const ref=refRange(text,index);
 if(!ref){fill(box,h('p',{class:'err'},'본문을 찾지 못했어요. 책 이름과 장·절을 확인해 주세요'));return;}
 if(box.request!==request)return;
 const bible=await fetch('./bible/'+String(ref.book).padStart(2,'0')+'.json').then(r=>r.json());
 if(box.request!==request)return;
 if(!bible[ref.chap-1]||!bible[ref.endChap-1]||ref.v1>bible[ref.chap-1].length||ref.v2>bible[ref.endChap-1].length){fill(box,h('p',{class:'err'},'본문을 찾지 못했어요. 책 이름과 장·절을 확인해 주세요'));return;}
 const verses=[];for(let c=ref.chap;c<=ref.endChap;c++)for(let v=(c===ref.chap?ref.v1||1:1);v<=(c===ref.endChap?ref.v2||bible[c-1].length:bible[c-1].length);v++)verses.push(h('p',{},h('sup',{},c+':'+v+' '),bible[c-1][v-1]));
 fill(box,h('h3',{},text),...verses,h('p',{class:'bible-credit'},'개역한글(1961) · 저작재산권 보호기간 만료(대한성서공회 안내)'),h('a',{href:'https://www.bskorea.or.kr/bible/korbibReadpage.php?version=GAE&book='+BIBLE_CODES[ref.book-1]+'&chap='+ref.chap,target:'_blank',rel:'noopener'},'개역개정으로 보기'));
 if(commentary){const matches=archive.filter(a=>{const r=refRange(a.ref,index);return r&&overlaps(ref,r);});box.append(...(matches.length?matches.map(a=>h('section',{class:'card'},h('h3',{},a.ref+' · '+a.title),...STEPS.map(([k,t])=>h('div',{},stepTitle(t),h('p',{class:'qt-copy'},a[k]))))):[h('p',{},'이 본문의 해설은 준비 중이에요')]));}
 }catch{if(box.request!==request)return;fill(box,h('p',{class:'err'},'본문을 불러오지 못했어요. 본문 범위와 인터넷 연결을 확인해 주세요.'));}
}
function wordView(){
 view.append(h('div',{class:'row switcher'},[['sermon','주일설교'],['qt','큐티']].map(([id,t])=>h('button',{class:'sub','aria-pressed':String(wordMode===id),onclick:()=>{wordMode=id;show('word');}},t))));
 if(wordMode==='qt'){qtView();return;}
 const box=h('section',{class:'reading','aria-live':'polite'},h('p',{class:'hint'},'본문을 입력하면 말씀을 볼 수 있어요')),input=h('input',{id:'scripture-input',required:true,'aria-label':'성경 본문'});
 view.append(h('label',{htmlFor:'scripture-input'},h('span',{},'성경 본문')),h('form',{class:'scripture-search',onsubmit:e=>{e.preventDefault();scripture(box,input.value);}},input,h('button',{class:'primary'},'검색')),h('p',{class:'hint meta'},'예: 막 4:1–9 또는 마가복음 4장'),box);
}

// ---------- 시작 ----------
side.append(h('p',{id:'church-title'},'교회 사역앱'),...MENUS.map(([id,t])=>h('button',{k:id,onclick:()=>show(id)},t)));
nav.append(...TABS.map(([id, label]) => h('button', { type: 'button', k: id, onclick: () => show(id) }, label)));
store = await openStore().catch(() => null);
if (!store) msg.textContent = '저장소에 연결하지 못했어요. 새로고침해 주세요.';
else {
  $('band').hidden = store.mode !== 'local'; $('band').textContent='체험 모드 · 이 기기에 저장';
  if (location.hash.startsWith('#c=')) await openInvite();
  else if (localStorage.getItem('church:code')) await enter(localStorage.getItem('church:code')); else showEntry();
}

async function openInvite() {
  const c=location.hash.slice(3);
  showEntry();
  if(!validCode(c)){showEntry('초대 링크가 잘못됐어요');return;}
  try {const d=await readOnce('churches/'+c);if(d)await enter(c,d);else showEntry('초대 링크가 잘못됐어요');}
  catch {showEntry('불러오지 못했어요. 인터넷 연결을 확인해 주세요.');}
}
addEventListener('hashchange',()=>{if(store && location.hash.startsWith('#c='))openInvite();});
