import { occurrences, tasksAround, thisWeek, occursOn } from './custom-events.js?v=202610242027';
import { TEMPLATES } from './templates.js?v=202610242027';
import { orderFor, isPastorOnly, recommendService, DEPTS, themeFor, worshipSlides, worshipFileName } from './worship.js?v=202610242027';
// 교회 사역앱 화면. 사용자 글은 textContent/value로만 넣는다(innerHTML 금지).
import { weekDays, dayItems, monthGrid, prepSpans, prepWeek, calendarCell, shortTask, weekShare, contiShare, parseRef, refRange, overlaps, scriptureSlides, scriptureFileName, passageLabel } from './home.js?v=202610242027';
import { deptsOf, toggleDept, sizeOf, sizeTips, formatCodeInput, validCode, nameKey, recentChurches, inviteText, mineList, isKakaoInApp, kakaoExternalUrl, isInAppBrowser, loginErrorText, chromeUrl, safariUrl } from './entry.js?v=202610242027';
import { openStore, newChurchCode } from './store.js?v=202610242027';
import { todayIso, nextSunday, addDays, parse, monthItems, qtIndex } from './calendar.js?v=202610242027';
import { EVENTS, RETREAT_FORMS, ABOUT } from './events.js?v=202610242027';
import { docs } from './docs.js?v=202610242027';
import { equipment, equipmentId, equipmentRows, productsFor, productLink, compareLink, buyNotice } from './equipment.js?v=202610242027';
import { label, parseCsv, mergeLibrary, filterSongs, parseBulk, nameFromFile, sheetId, sheetFirst, pickSheet, contiSlides, fitImage, browseSongs, sheetKeys, emptyHint, filterSpecials, defaultSeason, specialEmpty, cleanBy, seller } from './songbook.js?v=202610242027';
import { parseBackup, backupSundays, previousSundays } from './backup.js?v=202610242027';

const $ = id => document.getElementById(id);
const view = $('view'), nav = $('tabs'), msg = $('msg');
let store, unsubs = [];
let defaultSongs = [];


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
const watch = (path, cb, onErr) => {
  const u = store.watch(path, cb, e => { say('불러오지 못했어요. 인터넷 연결을 확인해 주세요.'); onErr?.(e); });
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
  // 구글로 로그인했으면 내 계정의 교회 목록에도 남긴다(다른 기기에서 바로 뜨게)
  const u = store.auth?.user();
  if (u) store.update('users/' + u.uid, { churches: { [c]: { name, at: todayIso() } }, last: c }).catch(() => {});
}
const myChurches = async () => { const u = store.auth?.user(); return u ? mineList((await readOnce('users/' + u.uid).catch(() => null))?.churches) : []; };
async function googleLogin() {
  try { await store.auth.signIn(); }
  catch (e) { if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') say(loginErrorText(e?.code)); return; }
  await afterLogin();
}
// 로그인 직후: 지금 들어가 있는 교회는 내 계정에 저장, 계정에 교회가 있으면 들어가고, 없으면 "어느 교회예요?"를 묻는다
async function afterLogin(startup = false) {
  const cur = localStorage.getItem('church:code');
  if (cur) { const d = await readOnce('churches/' + cur).catch(() => null); if (d) { remember(cur, d.name || '우리 교회'); say('이 교회를 내 구글 계정에 저장했어요'); if (startup) await enter(cur, d); return; } }
  const mine = await myChurches();
  if (mine.length === 1) await enter(mine[0].code); else showEntry(mine.length ? '' : '어느 교회에서 쓰시나요? 아래에서 교회를 골라 주세요.');
}
// 로그인 영역: 카톡 안 브라우저는 구글이 로그인을 막으므로 기본 브라우저로 열게 한다
function loginBox() {
  if (!store.auth) return null;
  const u = store.auth.user();
  if (u) return h('section', {class:'login-box'}, h('p', {class:'hint'}, (u.email || u.displayName || '구글 계정') + '로 로그인했어요'),
    h('button', {class:'text-button', onclick: async () => { await store.auth.signOut(); showEntry(); }}, '로그아웃'));
  if (isKakaoInApp(navigator.userAgent)) return h('section', {class:'login-box'},
    h('p', {}, '카톡 안에서는 구글 로그인이 안 돼요. 기본 브라우저로 열어 주세요.'),
    h('button', {class:'primary', onclick: () => { location.href = kakaoExternalUrl(location.href); }}, '기본 브라우저로 열기'));
  if (isInAppBrowser(navigator.userAgent)) { const ios = /iPhone|iPad/.test(navigator.userAgent); return h('section', {class:'login-box'},
    h('p', {}, '앱 안에서 연 화면에서는 구글이 로그인을 막아요. 아래 버튼으로 크롬이나 사파리에서 열어 주세요.'),
    h('button', {class:'primary', onclick: () => { location.href = chromeUrl(location.href, navigator.userAgent); }}, '크롬으로 열기'),
    ios && h('button', {class:'sub', onclick: () => { location.href = safariUrl(location.href); }}, '사파리로 열기'),
    h('button', {class:'text-button', onclick: () => copyText(location.href)}, '안 열리면: 주소 복사')); }
  return h('section', {class:'login-box'}, h('button', {class:'primary google-login', onclick: googleLogin}, 'Google로 로그인'),
    h('p', {class:'hint'}, '한 번 로그인하면 어느 기기에서든 우리 교회가 바로 떠요.'));
}
const INTRO_CARDS = [["사역자가 없어도, 교회가 놓치지 않게","절기·행사에서 거꾸로 계산해 언제부터 무엇을 준비할지 달력에 깔아 줘요."],["리더들이 함께 써요","초대 링크 하나로 같은 달력·콘티를 함께 보고 체크해요. 누가 했는지도 남아요."],["주일 준비를 한곳에서","찬양 콘티(곡 보관함·인쇄·예배 PPT), 말씀(주일설교 본문·큐티), 서류 양식, 장비 점검."],["이렇게 시작해요","① 초대 링크를 받았으면 누르기 ② 처음이면 새 교회 만들기 ③ 구글로 로그인하면 어느 기기서든 바로."]];
function showIntro() {
 if(document.getElementById('church-intro'))return;
 localStorage.setItem('church:introSeen','1');
 let index=0, startX=null; const box=h('dialog',{id:'church-intro',class:'intro-dialog','aria-label':'이 웹 소개'});
 const close=()=>box.close();
 function draw(){
  fill(box,h('article',{class:'intro-card','aria-live':'polite'},h('p',{class:'hint'},(index+1)+' / 4'),h('h2',{},INTRO_CARDS[index][0]),h('p',{},INTRO_CARDS[index][1])),
   h('div',{class:'row intro-dots','aria-label':'소개 카드 선택'},INTRO_CARDS.map((card,i)=>h('button',{type:'button','aria-label':(i+1)+'번째 소개','aria-pressed':String(index===i),onclick:()=>{index=i;draw();}},index===i?'●':'○'))),
   h('div',{class:'row'},h('button',{type:'button',disabled:index===0,onclick:()=>{index--;draw();}},'이전'),h('button',{type:'button',class:'primary',onclick:()=>{if(index===3)close();else{index++;draw();}}},index===3?'시작하기':'다음'),h('button',{type:'button',class:'text-button',onclick:close},'건너뛰기')));
 }
 box.addEventListener('touchstart',e=>{startX=e.changedTouches[0].clientX;},{passive:true});
 box.addEventListener('touchend',e=>{if(startX===null)return;const dx=e.changedTouches[0].clientX-startX;startX=null;if(Math.abs(dx)<50)return;index=Math.max(0,Math.min(3,index+(dx<0?1:-1)));draw();},{passive:true});
 box.addEventListener('close',()=>box.remove());
 document.body.append(box);draw();box.showModal();
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
  const recent=getRecent(), mineBox=h('section');
  myChurches().then(mine=>{ if(mine.length) fill(mineBox,h('h2',{},'내 교회'),mine.map(item=>h('div',{class:'recent-row'},h('button',{class:'recent-church',onclick:()=>join(item.code)},item.name)))); });
  // 로그인 영역이 없거나(체험 모드) 최근 교회가 없을 때 null·false가 글자로 찍히지 않게 걸러서 넣는다
  view.append(...[h('h1',{},'교회 사역앱'),h('p',{class:'hint'},'우리 교회의 사역을 함께 준비해요.'),loginBox(),mineBox,
    recent.length > 0 && h('section',{},h('h2',{},'최근 들어간 교회'),recent.map(item=>h('div',{class:'recent-row'},
      h('button',{class:'recent-church',onclick:()=>join(item.code)},item.name),
      h('button',{class:'text-button', 'aria-label':item.name+' 목록에서 빼기',onclick:()=>{localStorage.setItem('church:recent',JSON.stringify(getRecent().filter(x=>x.code!==item.code)));showEntry();}},'목록에서 빼기')))),
    h('section',{},h('h2',{},'초대 링크를 받았나요?'),h('p',{},'카톡으로 받은 링크를 누르면 바로 들어와요.')),
    h('form',{onsubmit:e=>{e.preventDefault();if(validCode(code.value))join(code.value);}},h('h2',{},'교회 코드로 들어가기'),code,err,submit),
    h('button',{class:'text-button entry-create',onclick:showCreate},'처음이에요 → 새 교회 만들기'),h('button',{type:'button',class:'text-button',onclick:showIntro},'이 웹 소개')].filter(Boolean));
  if(!localStorage.getItem('church:introSeen'))showIntro();
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
 reset(); let step=1; const s={depts:['청년부'],churchSize:'xs',deptSize:{'청년부':'b'},enabled:Object.fromEntries(EVENTS.map(e=>[e.id,e.on])),dates:{}};
 let role=localStorage.getItem('church:role')||''; const box=h('section',{class:'card'});view.append(box);
 function draw(){
 fill(box,h('p',{class:'hint'},step+'/4'),h('h2',{},['부서와 역할','절기·행사','여름수련회 날짜','리더 초대'][step-1]));
 if(step===1)box.append(h('h3',{},'부서 고르기'),deptPicker(s, v=>{s.depts=v;s.deptSize=sizeOf(s);draw();}),sizePickers(s,patch=>{Object.assign(s,patch);draw();}),h('label',{},h('span',{},'내 역할 이름'),h('input',{value:role,placeholder:'예: 찬양리더',maxLength:20,oninput:e=>role=e.target.value})));
 if(step===2)box.append(h('ul',{class:'toggles'},EVENTS.map(ev=>h('li',{},h('label',{},h('input',{type:'checkbox',checked:s.enabled[ev.id],onchange:e=>s.enabled[ev.id]=e.target.checked}),ev.name)))));
 if(step===3)box.append(h('label',{},h('span',{},'여름수련회 출발일'),h('input',{type:'date',value:s.dates.retreat||'',onchange:e=>s.dates.retreat=e.target.value})),h('button',{class:'sub',onclick:()=>{delete s.dates.retreat;step++;draw();}},'건너뛰기'));
 if(step===4)box.append(h('p',{},'교회 코드'),h('p',{class:'code big'},c),h('button',{class:'primary',onclick:()=>copyInvite(c)},'초대 링크 복사'),h('button',{class:'text-button',onclick:()=>copyText(c)},'코드만 복사'));
 box.append(h('div',{class:'row'},step>1&&h('button',{class:'sub',onclick:()=>{step--;draw();}},'이전'),h('button',{class:'primary',onclick:async()=>{localStorage.setItem('church:role',role.trim());try{await store.update(churchPath(),{settings:s});}catch{say('저장하지 못했어요. 인터넷 연결을 확인해 주세요.');return;}if(step===4)enter(c);else{step++;draw();}}},step===4?'시작하기':'다음')));
 }draw();
}
function deptPicker(settings, change) {
 return h('div',{class:'row'},['청년부','중고등부','아동부','유치부','장년부'].map(v=>h('button',{type:'button',class:'sub','aria-pressed':String(deptsOf(settings).includes(v)),onclick:()=>change(toggleDept(settings,v))},v)));
}
function sizePicker(title,value,options,change){return h('section',{},h('h3',{},title),h('div',{class:'row'},options.map(([id,t])=>h('button',{type:'button',class:'sub','aria-pressed':String(value===id),onclick:()=>change(id)},t))));}
function sizePickers(settings,change){
 return h('div',{},sizePicker('교회 규모 (장년 주일 출석 기준)',settings?.churchSize,[['xs','50명 미만'],['s','50~150명'],['m','150~500명'],['l','500명 이상']],churchSize=>change({churchSize})),
 Object.entries(sizeOf(settings)).map(([dept,size])=>sizePicker(dept+' 인원',size,[['a','10명 이하'],['b','10~30명'],['c','30~80명'],['d','80명 이상']],value=>change({deptSize:{...sizeOf(settings),[dept]:value}}))));
}
function sizeGuide(settings){return h('section',{class:'size-guide'},h('h3',{},'부서 규모별 수련회 팁'),sizeTips(settings).map(text=>h('p',{},text)));}

async function enter(c, data) {
  const d = data || await readOnce('churches/'+c).catch(()=>null);
  if(!d) {showEntry('이 코드의 교회를 찾지 못했어요. 코드를 다시 확인해 주세요.');return;}
  localStorage.setItem('church:code', c);remember(c,d.name||'우리 교회');
  // 주소에 교회 코드를 남겨 둔다: 이 주소를 즐겨찾기·홈 화면에 추가하면 어느 브라우저(카톡 안 브라우저 포함)에서도 바로 들어온다. 해시라 서버로는 안 간다.
  if(location.hash!=='#c='+c) history.replaceState(null,'',location.pathname+location.search+'#c='+c);
  nav.hidden = false;
  show('home');
}

// ---------- 탭 ----------
const MENUS = [['home','홈'],['schedule','절기·행사'],['conti','찬양 콘티'],['word','말씀'],['worship','예배'],['docs','자료실'],['equipment','장비'],['set','설정']];
const TABS = [['home','홈'],['schedule','절기·행사'],['conti','콘티'],['word','말씀'],['more','더보기']];
const side = h('aside', { id:'sidebar', hidden:true }); document.body.prepend(side);
const VIEWS = { worship:worshipView, home:homeView, schedule:scheduleView, conti:contiView, word:wordView, docs:docsView, equipment:equipmentView, set:setView, more:moreView };
const GUIDES = {home:'일·주·월·년 일정과 준비할 일을 확인해요',schedule:'절기와 행사에 맞춰 준비할 일을 보여 줘요',conti:'이번 주일 찬양을 순서대로 준비해요',word:'주일설교 본문을 찾고 매일 말씀을 묵상해요',docs:'우리 교회에 필요한 준비 양식을 내려받아요',equipment:'장비의 수량과 상태를 함께 확인해요',set:'우리 교회에 맞게 설정해요',more:'자료실과 장비, 설정을 열어요'};
const SCREEN_HELP = {"worship":["예배를 고르면 순서와 담당, 메모가 나와요","▲▼·빼기·순서 추가로 우리 교회 순서로 고쳐요(기본값으로 되돌릴 수 있어요)","순서지 인쇄와 예배 PPT 만들기로 마무리해요"],"home":["◀ ▶로 기간을 옮기고, 오른쪽 '월 보기'에서 일·주·월·년을 골라요","색 표시는 행사일, ○ 표시는 준비 시작일이에요. 준비 기간은 '준비할 행사' 목록에서 봐요","날짜를 누르면 그날 할 일, '+ 행사 추가'로 여름성경학교 같은 행사를 넣어요"],"schedule":["행사마다 준비 진행률이 보여요","펼치면 할 일 체크와 준비물 사기 링크가 있어요","날짜를 바꾸면 준비 일정도 같이 옮겨져요"],"conti":["곡 보관함에서 키·주제·분위기 줄을 눌러 고르면 바로 아래 곡이 펼쳐져요. +로 추가해요","▲▼로 순서를 바꾸고 메모를 달아요","카톡 보내기·A4/A3 인쇄·예배 PPT로 마무리해요"],"word":["주일설교: 본문(예: 막 4:1-9)을 검색하면 본문과 6단계 해설이 나와요","큐티: 매일 하나씩 순서대로 나와요","아래에 묵상을 적으면 리더들과 나눠져요"],"docs":["맨 위 '부서'를 눌러 우리 부서 자료를 골라요","서류 이름을 누르면 설명과 워드·한글 받기가 나와요","빈칸을 채워 바로 쓰면 돼요"],"equipment":["기본 장비 목록이 미리 있어요","수량과 상태를 바꾸면 바로 저장돼요","'점검 필요'·'고장'은 맨 위에 모여요"],"set":["교회 이름·규모·부서를 바꿔요","초대 링크를 복사해 리더들에게 보내요","구글로 로그인하면 다른 기기에서도 바로 들어와요"]};
function screenHeading(id, title) {
 const key='church:guide:'+id;
 const card=h('section',{class:'card usage-guide',id:'guide-'+id,hidden:localStorage.getItem(key)!=='open'},h('strong',{},'이 화면 사용법'),h('ol',{},SCREEN_HELP[id].map(line=>h('li',{},line))));
 const button=h('button',{type:'button',class:'sub guide-toggle','aria-label':title+' 이 화면 사용법','aria-controls':card.id,'aria-expanded':String(!card.hidden),onclick:()=>{card.hidden=!card.hidden;localStorage.setItem(key,card.hidden?'closed':'open');button.setAttribute('aria-expanded',String(!card.hidden));}},h('span',{class:'q-mark','aria-hidden':'true'},'?'),'이 화면 도움말');
 card.append(h('button',{type:'button',class:'sub',onclick:()=>{card.hidden=true;for(const k of Object.keys(SCREEN_HELP))localStorage.setItem('church:guide:'+k,'closed');button.setAttribute('aria-expanded','false');button.focus();}},'알겠어요'));
 return [h('div',{class:'row screen-heading'},h('h2',{},title),button),card];
}
// 접히는 카드: 머리줄(제목 · 한 줄 요약, 56px). 펼침 상태는 church:open:<id>에 기억한다
function foldCard(id, open = false, cls = '') {
 const saved = localStorage.getItem('church:open:' + id);
 return h('details', { class: 'card fold fold-' + id + ' ' + cls, open: saved ? saved === '1' : open, ontoggle: e => localStorage.setItem('church:open:' + id, e.target.open ? '1' : '0') });
}
function foldHead(title, note = '', tone = '') { return h('summary', {}, h('span', { class: 'fold-title' }, title), note && h('span', { class: 'fold-note ' + tone }, note)); }
function show(tab) {
 reset(); side.hidden=false; nav.hidden=false; view.dataset.screen=tab;
 for(const b of [...nav.children,...side.querySelectorAll('button')]) { b.removeAttribute('aria-current'); if(b.dataset.k===tab || (b.dataset.k==='more'&&['docs','equipment','set'].includes(tab))||(b.dataset.k==='word'&&tab==='worship'))b.setAttribute('aria-current','page'); }
 if(tab!=='home')view.append(...(SCREEN_HELP[tab]?screenHeading(tab,MENUS.find(m=>m[0]===tab)[1]):[h('h2',{},'더보기'),h('p',{class:'hint screen-guide'},GUIDES[tab])]));
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
// 할 일에 연결된 서류: 이름 + [서류 미리보기] [워드 받기]
function docActions(num) {
  const doc = num && docs.find(d => d.file.startsWith('docs/' + num + '_'));
  return doc ? h('div', { class: 'task-doc' }, h('span', { class: 'task-doc-name' }, doc.title), h('button', { type: 'button', class: 'sub small', onclick: () => showPreview(doc) }, '서류 미리보기'), h('a', { class: 'sub-link small', href: doc.file, download: true, 'aria-label': doc.title + ' 워드 받기' }, '워드 받기')) : null;
}
const taskList = (ts, done, compact = false) => h('ul', { class: 'tasks' }, ts.map(t => h('li', {class:t.due<todayIso()&&!done[t.key]?'task-overdue':''}, h('label', {},
  h('input', { type: 'checkbox', checked: !!done[t.key], k: 'c:' + t.key,
    onchange: e => toggleTask(t.key, e.target.checked) }),
  h('span', {}, t.due < todayIso() && !done[t.key] ? h('small', {class:'late'}, '기한 지남') : null, h('span', { class: 'text' }, t.text), done[t.key]?.by ? h('small', {}, done[t.key].by + ' · ' + md(done[t.key].at)) : null,
    h('small', {}, [`${md(t.due)} 기한`, t.due < todayIso() && !done[t.key] ? Math.round((parse(todayIso())-parse(t.due))/864e5)+'일 지남' : '', t.event, t.who].filter(Boolean).join(' · ')))),docActions(t.doc),compact?h('div',{class:'task-due-action'},h('button',{class:'sub task-due-button',onclick:()=>changeTaskDue(t)},'기한 바꾸기')):h('details',{},h('summary',{},'완료 처리 · 기한 변경'),h('button',{class:'sub',onclick:()=>toggleTask(t.key,!done[t.key])},done[t.key]?'완료 취소':'완료 처리'),h('label',{},h('span',{},'기한 변경'),h('input',{type:'date',value:t.due,'aria-label':t.text+' 기한 변경',onchange:e=>e.target.value&&save(churchPath(),{settings:{taskDue:{[t.key]:e.target.value}}})}))))));

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
  const withCover = h('input', { type: 'checkbox' });
  const ppt = h('button', { type: 'button', class:'primary', onclick: async () => {
    flush(); const songs = cur.map(s => ({ ...s })).filter(s => s.title.trim()), day = date.value, name = churchName; ppt.disabled = true;
    const size = data => new Promise(ok => { const im = new Image(); im.onload = () => ok({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 }); im.onerror = () => ok(null); im.src = data; });
    const got = await Promise.allSettled(songs.map(async s => { const id = pickSheet(s, sheets); if (!id) return null; const d = await readOnce(churchPath() + '/sheets/' + id); if (!String(d?.img).startsWith('data:image/')) return null; const wh = await size(d.img); return wh && [s.title + '|' + (s.key || ''), { data: d.img, ...wh }]; }));
    const images = Object.fromEntries(got.map(r => r.status === 'fulfilled' && r.value).filter(Boolean)), missing = songs.filter(s => !images[s.title + '|' + (s.key || '')]);
    try { await makePpt(name, day, songs, images, withCover.checked); say(missing.length ? '악보 없는 곡 ' + missing.length + '개: ' + missing.map(s => s.title).join(', ') + ' (설정 > 악보 사진 올리기)' : '악보 ' + songs.length + '곡을 넣었어요'); } catch { say('PPT 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'); } finally { ppt.disabled = !cur.some(s=>s.title.trim()); }
  } }, h('span', { class: 'desktop-copy' }, '예배'), 'PPT 만들기');
  const box = h('div'), list = h('datalist', { id: 'songbook' }), groups = h('div');
  let sheets={}; // 교회 문서의 sheets: {id: {title, key}}
  // 악보 보기: 원하는 키(필터의 키 → 곡의 키) 악보부터, 창 안에서 다른 키로 바꿀 수 있다
  const sheetFor=(title,key)=>{const all=Object.entries(sheets).filter(([,v])=>v?.title===title);return all.find(([,v])=>(v.key||'')===(key||''))||all[0];};
  const sheetButton=(title,key)=>{const hit=Object.entries(sheets).find(([,v])=>v?.title===title&&(v.key||'')===(key||''));return hit?h('button',{type:'button',class:'sub sheet-button','aria-label':title+' 악보 보기',onclick:()=>showSheet(title,hit[0],sheets,{isFav,toggleFav})},glyph('conti'),'악보'):null;};
  let onlySheets=null, churchSongs={}, favorites={}, onlyFav=false, sort='name';
  const isFav=x=>favorites[label(x)]===true;
  const toggleFav=x=>{const on=!isFav(x);favorites={...favorites,[label(x)]:on};save(churchPath(),{favorites:{[label(x)]:on}});say(on?label(x)+' 즐겨찾기에 넣었어요':label(x)+' 즐겨찾기에서 뺐어요');draw();drawBrowse();};
  const useSheets=()=>onlySheets===null?Object.keys(sheets).length>0:onlySheets;
  const filters={key:'',theme:'',mood:''}; let count=20;
  const options={key:['C','D','E','F','G','A','B','Ab','Bb','Eb','단조'],theme:['경배와 찬양','은혜와 사랑','회개와 고백','기도와 간구','축복과 교제','선교와 승리'],mood:['신나게','보통','잔잔하게']};
  const NAMES={key:'키',theme:'주제',mood:'분위기'};
  const wide=()=>!!globalThis.matchMedia?.('(min-width: 1024px)').matches;
  const chips=h('div',{class:'browse-chips'}), tags=h('div',{class:'browse-tags'}), countLine=h('div',{class:'browse-count'});
  const query=()=>({sheets,churchBook:churchSongs,favorites,onlySheets:useSheets(),onlyFav,...filters,q:search.value,sort});
  const nFilters=()=>['key','theme','mood'].filter(f=>filters[f]).length;
  const search=h('input',{type:'search',k:'song-search',placeholder:'🔍 곡명으로 찾기','aria-label':'곡명으로 찾기',oninput:()=>{count=20;drawBrowse();}});
  const resetAll=()=>{filters.key=filters.theme=filters.mood='';onlyFav=false;search.value='';count=20;drawBrowse();};
  const clear=action=>{if(action==='reset')return resetAll();if(action==='fav')onlyFav=false;else if(action==='sheets')onlySheets=false;else filters[action]='';count=20;drawBrowse();};
  // 키·주제·분위기는 [필터]를 누르면 아래에서 올라오는 판 하나에(컴퓨터는 오른쪽 위). 항목마다 하나만, 항목끼리는 AND
  const openFilters=()=>{
    const body=h('div',{class:'filter-body'}),go=h('button',{type:'button',class:'primary'});
    const paint=()=>{fill(body,Object.entries(options).map(([f,vals])=>h('section',{class:'filter-group'},h('h4',{},NAMES[f],f==='mood'&&h('small',{class:'meta'},' · AI 추정'),f==='theme'&&h('small',{class:'meta'},' · 시와 찬미 분류')),h('div',{class:'row'},vals.map(v=>h('button',{type:'button',class:'sub chip','aria-pressed':String(filters[f]===v),onclick:()=>{filters[f]=filters[f]===v?'':v;count=20;paint();drawBrowse();}},v))))));go.textContent='결과 '+browseSongs(Object.values(book),query()).songs.length+'곡 보기';};
    const dlg=bigDialog('필터','filter-dialog',body,h('div',{class:'filter-foot'},h('button',{type:'button',class:'sub',onclick:()=>{filters.key=filters.theme=filters.mood='';paint();drawBrowse();}},'초기화'),go));
    go.onclick=()=>dlg.close();paint();
  };
  const drawChips=()=>fill(chips,
    Object.keys(sheets).length>0&&h('button',{type:'button',class:'chip','aria-pressed':String(useSheets()),onclick:()=>{onlySheets=!useSheets();count=20;drawBrowse();}},'악보 있는 곡만'),
    h('button',{type:'button',class:'chip','aria-pressed':String(onlyFav),onclick:()=>{onlyFav=!onlyFav;count=20;drawBrowse();}},'즐겨찾기만'),
    h('button',{type:'button',class:'chip','aria-pressed':String(nFilters()>0),'aria-haspopup':'dialog',onclick:openFilters},'필터'+(nFilters()?' '+nFilters():'')));
  const drawBrowse=()=>{
    drawChips();
    fill(tags,nFilters()>0&&[...['key','theme','mood'].filter(f=>filters[f]).map(f=>h('button',{type:'button',class:'tag','aria-label':NAMES[f]+' '+filters[f]+' 조건 빼기',onclick:()=>{filters[f]='';drawBrowse();}},NAMES[f]+' '+filters[f]+' ×')),h('button',{type:'button',class:'text-button',onclick:()=>{filters.key=filters.theme=filters.mood='';drawBrowse();}},'조건 초기화')]);
    const {songs,reason}=browseSongs(Object.values(book),query());
    fill(countLine,h('span',{'aria-live':'polite'},'조건에 맞는 곡 '+songs.length+'곡 · '),h('select',{class:'sort-select',k:'song-sort','aria-label':'정렬',onchange:e=>{sort=e.target.value;drawBrowse();}},[['name','가나다순'],['rec','추천순']].map(([v,t])=>h('option',{value:v,selected:sort===v},t))));
    const q=search.value.trim(),typed=q&&!songs.some(x=>x.title===q)&&h('button',{type:'button',class:'sub add-title',onclick:()=>{setSongs([...cur,{title:q,key:'',memo:''}]);say(q+' 추가했어요');search.value='';drawBrowse();}},"+ '"+q+"' 곡으로 추가");
    const hint=!songs.length&&emptyHint({reason,onlyFav,onlySheets:useSheets(),...filters});
    const added=s=>cur.some(c=>c.title===s.title&&(c.key||'')===(s.key||''));
    // 곡 한 줄: 1줄 곡명(즐겨찾기면 작은 ★), 2줄 "악보 D·E · 시와찬미 47", 오른쪽 [악보 보기][+ 추가]
    const songRow=s=>{const keys=sheetKeys(s.title,sheets),hit=keys.length&&sheetFor(s.title,filters.key&&keys.includes(filters.key)?filters.key:s.key),link=!hit&&typeof s.sheet==='string'&&s.sheet.startsWith('https://')&&s.sheet;
      return h('li',{},h('div',{class:'song-info'},h('span',{class:'song-name'},isFav(s)&&h('span',{class:'fav-mark','aria-label':'즐겨찾기'},'★ '),s.title),h('small',{class:'meta'},[keys.length?'악보 '+keys.map(k=>k||'키 없음').join('·'):s.key&&s.key+'키',s.note].filter(Boolean).join(' · '))),
       hit?h('button',{type:'button',class:'sub sheet-button','aria-label':s.title+' 악보 보기',onclick:()=>showSheet(s.title,hit[0],sheets,{isFav,toggleFav})},'악보 보기'):link?h('a',{class:'sub-link',href:link,target:'_blank',rel:'noopener'},'악보 보기'):null,
       added(s)?h('button',{type:'button',class:'sub added',disabled:true},'✓ 추가됨'):h('button',{type:'button',class:'sub add-button','aria-label':s.title+' 이번 주 콘티에 추가',onclick:()=>{const at=cur.length;setSongs([...cur,{title:s.title,key:s.key,memo:''}]);drawBrowse();say('이번 주 콘티에 추가했어요');msg.append(h('button',{onclick:()=>{setSongs(cur.filter((_,j)=>j!==at));msg.textContent='';drawBrowse();}},'실행 취소'));}},'+ 추가'));};
    fill(groups,typed,songs.length?h('ul',{class:'browse'},songs.slice(0,count).map(songRow)):h('div',{class:'empty-state'},h('p',{},hint.text),h('button',{type:'button',class:'sub',onclick:()=>clear(hint.action)},hint.button)),songs.length>count&&h('button',{class:'sub more-songs',onclick:()=>{count+=20;drawBrowse();}},'더 보기 · 남은 '+(songs.length-count)+'곡'));
  };
  const browse=h('section',{class:'card song-browser'},search,chips,tags,countLine,groups);

  // ---------- 특송: 검색 → [형태▾][연령▾][절기▾][필터] → 곡 수 → 목록. 다가오는 절기는 기본으로 켠다 ----------
  let specials=null, churchSettings=null, autoSeason=null;
  const sp={form:'',age:'',season:'',theme:''}, spBox=h('div'), spNote=h('p',{class:'special-target'}), spChips=h('div',{class:'browse-chips'}), spCount=h('div',{class:'browse-count'});
  const spSearch=h('input',{type:'search',k:'special-search',placeholder:'🔍 곡명·부른 이로 찾기','aria-label':'특송 찾기',oninput:()=>drawSpecial()});
  const SP_OPTS={form:['개인 독창','소그룹 중창','단체 합창'],age:['어린이','청소년','청년','장년'],season:['대림·성탄','사순·고난','부활','성령강림','추수·맥추감사','송구영신']};
  const SP_NAMES={form:'형태',age:'연령',season:'절기',theme:'주제'};
  const josa=w=>{const c=w.charCodeAt(w.length-1)-0xAC00;return c>=0&&c<11172&&c%28?'이':'가';};
  const loadSpecials=()=>{if(specials)return;specials=[];fetch('./specials.json').then(r=>r.json()).then(list=>{specials=Array.isArray(list)?list.filter(x=>typeof x?.url==='string'&&x.url.startsWith('https://')):[];applySeason();drawSpecial();}).catch(()=>{fill(spBox,h('div',{class:'empty-state'},h('p',{},'특송 목록을 불러오지 못했어요'),h('button',{type:'button',class:'sub',onclick:()=>{specials=null;loadSpecials();}},'다시 시도')));});};
  // 오늘부터 8주 안에 특송 절기가 있으면 그 절기를 먼저(한 번만)
  const applySeason=()=>{if(autoSeason!==null||!specials?.length||!churchSettings)return;const d=defaultSeason(thisWeek(todayIso(),churchSettings,{}).upcoming);autoSeason=d||false;if(d&&localStorage.getItem('church:specialSeasonOff')!==d.season)sp.season=d.season;};
  const spAdded=x=>cur.some(c=>c.title===x.title&&c.memo==='특송');
  const openThemes=()=>{
    const themes=Object.entries((specials||[]).reduce((m,x)=>{for(const t of x.theme||[])m[t]=(m[t]||0)+1;return m;},{})).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0],'ko')).map(([t])=>t);
    const body=h('div',{class:'filter-body'}),go=h('button',{type:'button',class:'primary'});
    const paint=()=>{fill(body,h('section',{class:'filter-group'},h('h4',{},'주제'),h('div',{class:'row'},themes.map(t=>h('button',{type:'button',class:'sub chip','aria-pressed':String(sp.theme===t),onclick:()=>{sp.theme=sp.theme===t?'':t;paint();drawSpecial();}},t)))));go.textContent='결과 '+filterSpecials(specials||[],{...sp,q:spSearch.value}).length+'곡 보기';};
    const dlg=bigDialog('특송 필터','filter-dialog',body,h('div',{class:'filter-foot'},h('button',{type:'button',class:'sub',onclick:()=>{sp.theme='';paint();drawSpecial();}},'초기화'),go));go.onclick=()=>dlg.close();paint();
  };
  const drawSpecial=()=>{
    if(!specials)return;
    const t=date.value;fill(spNote,(+t.slice(5,7))+'월 '+(+t.slice(8,10))+'일('+'일월화수목금토'[new Date(t+'T00:00:00Z').getUTCDay()]+') 콘티에 추가돼요');
    fill(spChips,autoSeason&&sp.season===autoSeason.season&&h('button',{type:'button',class:'chip season-on','aria-label':autoSeason.event+josa(autoSeason.event)+' 다가와서 '+sp.season+' 절기 적용 중, 누르면 해제',onclick:()=>{localStorage.setItem('church:specialSeasonOff',sp.season);sp.season='';drawSpecial();}},sp.season+' 적용 중 ×'),Object.entries(SP_OPTS).filter(([f])=>!(f==='season'&&autoSeason&&sp.season===autoSeason.season)).map(([f,vals])=>h('select',{class:'chip chip-select'+(sp[f]?' on':''),k:'sp-'+f,'aria-label':SP_NAMES[f],onchange:e=>{sp[f]=e.target.value;drawSpecial();}},h('option',{value:''},SP_NAMES[f]+' 전체'),vals.map(v=>h('option',{value:v,selected:sp[f]===v},v)))),
      h('button',{type:'button',class:'chip','aria-pressed':String(!!sp.theme),'aria-haspopup':'dialog',onclick:openThemes},sp.theme?'주제: '+sp.theme+' ▾':'주제 ▾'));
    const list=filterSpecials(specials,{...sp,q:spSearch.value});
    fill(spCount,h('span',{'aria-live':'polite'},'조건에 맞는 특송 '+list.length+'곡'));
    const hint=!list.length&&specialEmpty({...sp,q:spSearch.value});
    const row=x=>h('li',{},h('div',{class:'song-info'},h('span',{class:'song-name'},x.title),h('small',{class:'meta'},[cleanBy(x.by),(x.form||[]).join('·'),(x.age||[]).join('·')].filter(Boolean).join(' · '))),
      h('div',{class:'buy'},h('a',{class:'sub-link','aria-label':x.title+' 악보 구매(새 창)',href:x.url,target:'_blank',rel:'noopener'},'악보 구매 ↗'),h('small',{class:'meta'},seller(x.url)+' · 유료')),
      spAdded(x)?h('button',{type:'button',class:'sub added',disabled:true},'✓ 추가됨'):h('button',{type:'button',class:'primary add-button','aria-label':x.title+' 특송 추가',onclick:()=>{const at=cur.length;setSongs([...cur,{title:x.title,key:'',memo:'특송'}]);drawSpecial();say('이번 주 콘티에 특송으로 넣었어요');msg.append(h('button',{onclick:()=>{setSongs(cur.filter((_,j)=>j!==at));msg.textContent='';drawSpecial();}},'실행 취소'));}},'+ 특송 추가'));
    fill(spBox,list.length?h('ul',{class:'browse special-list'},list.map(row)):h('div',{class:'empty-state'},h('p',{},hint.text),h('button',{type:'button',class:'sub',onclick:()=>{if(hint.action==='reset'){sp.form=sp.age=sp.season=sp.theme='';spSearch.value='';}else sp[hint.action]='';drawSpecial();}},hint.button)),
      h('p',{class:'meta special-source'},'외부 판매처로 이동합니다. 구매 전 편성·조성과 이용 조건을 확인하세요. 구매만으로 단체 복사·배포가 허용되는 것은 아니에요.'));
  };
  const specialSection=h('section',{class:'card special-browser'},h('h3',{class:'desktop-copy'},'특송 고르기'),spSearch,spChips,spCount,spNote,spBox);
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
  const editor=h('div',{class:'conti-editor'}), editorTitle=h('h3',{class:'conti-title'});
  let lastCount=0, stopLast=()=>{};
  // 보관함 탭에서만: 탭바 바로 위 '이번 주 콘티 n곡 · 확인하기 →'
  const weekBar=h('button',{type:'button',class:'week-bar',onclick:()=>{wrap.dataset.tab='week';for(const b of tabs.children)b.setAttribute('aria-pressed',String(b===tabs.children[0]));scrollTo(0,0);}}); // 지난주 콘티 곡 수(복사 버튼을 켤지)
  // 휴대폰: 지금 화면 위에 검색·보관함 시트를 연다(닫으면 보관함은 제자리로). 컴퓨터는 옆 보관함 검색칸으로
  const openPicker=()=>{if(wide()){search.focus();return;}const back=browse.parentNode,next=browse.nextSibling,dlg=bigDialog('곡 찾아 추가하기','picker-dialog',browse);dlg.addEventListener('close',()=>back.insertBefore(browse,next));search.focus();};
  const badge=h('span',{class:'tab-badge'});
  const draw = () => { weekBar.textContent='이번 주 콘티 '+cur.length+'곡 · 확인하기 →'; badge.textContent=cur.length?String(cur.length):''; badge.hidden=!cur.length; for(const el of exports.querySelectorAll('button, select'))el.disabled=!cur.some(s=>s.title.trim()); fill(box,!cur.length&&h('div',{class:'empty conti-empty'},h('button',{type:'button',class:'primary add-song',onclick:openPicker},'+ 곡 찾아 추가하기'),h('button',{type:'button',class:'sub',disabled:!lastCount,onclick:()=>loadLast()},'지난주 콘티 복사하기'),h('p',{class:'hint'},lastCount?'지난주 '+lastCount+'곡을 이번 주에 그대로 채워 넣어요. 지금은 비어 있어 덮어쓰는 곡이 없어요.':'지난주 콘티가 없어요')),cur.length>0&&h('div',{class:'song-columns','aria-hidden':'true'},['','곡명','키','메모','순서'].map(t=>h('span',{},t))), h('ol', { class: 'songs' }, cur.map((s, i) => h('li', {},
    h('span', { class: 'num' }, i + 1 + '.'), field(i, 'title', '곡명'), field(i, 'key', '키'), h('div',{class:'song-tools'},h('div',{class:'song-memo'},s.memo||memoOpen.has(i)?field(i,'memo','메모'):h('button',{class:'text-button',onclick:()=>{memoOpen.add(i);draw();}},'+ 메모')),
    h('span', { class: 'acts' }, sheetButton(s.title, s.key),

      h('button', { type: 'button', class: 'sub', 'aria-label': `${i + 1}번 곡 위로`, disabled: i === 0, onclick: () => swap(i, i - 1) }, '▲'),
      h('button', { type: 'button', class: 'sub', 'aria-label': `${i + 1}번 곡 아래로`, disabled: i === cur.length - 1, onclick: () => swap(i, i + 1) }, '▼'),
      h('button', { type: 'button', class: 'danger', onclick: () => {removed={song:{...cur[i]},index:i};setSongs(cur.filter((_,j)=>j!==i));} }, '삭제')))))),
  cur.length > 0 && h('button', { type: 'button', class: 'sub', onclick: () => setSongs([...cur, { title: '', key: '', memo: '' }]) }, '곡 추가'),removed&&h('button',{class:'sub',onclick:()=>{const songs=[...cur];songs.splice(removed.index,0,removed.song);removed=null;setSongs(songs);}},'삭제 되돌리기')); };
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
        h('ol', { class: 'history-songs' }, data.songs.map(s => h('li', {}, h('span', {}, label(s), s.memo ? ' · ' + s.memo : ''), sheetButton(s.title, s.key)))),
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
    const t = date.value; editorTitle.textContent = (+t.slice(5, 7)) + '월 ' + (+t.slice(8, 10)) + '일(' + '일월화수목금토'[new Date(t + 'T00:00:00Z').getUTCDay()] + ') 주일 찬양';
    stop = watch(path, d => { cur = d?.songs || []; draw(); drawPrint(); drawBrowse(); drawSpecial(); });
    drawSpecial();
    stopLast(); stopLast = watch(`${churchPath()}/conti/${addDays(date.value, -7)}`, d => { lastCount = (d?.songs || []).filter(s => s.title).length; if (!cur.length) draw(); });
  };
  const loadLast = async () => {
    const d = await readOnce(`${churchPath()}/conti/${addDays(date.value, -7)}`).catch(() => null);
    if (!d?.songs?.length) return say('지난 주 콘티가 없어요');
    if (cur.length && !confirm('지금 콘티를 지난 주 콘티로 바꿀까요?')) return;
    setSongs(d.songs.map(s => ({ title: s.title || '', key: s.key || '', memo: s.memo || '' })));
  };
  const exports = h('div',{class:'export-tools'},h('button',{class:'sub',onclick:()=>{flush();copyText(contiShare(churchName,date.value,cur));}},'카톡 보내기'), h('div', { class: 'row print-tools' }, h('label', {}, h('span', {}, '인쇄 용지'), paper), h('button', { type: 'button', class:'sub', onclick: print }, '인쇄'), ppt), h('label', { class: 'ppt-cover' }, withCover, h('span', {}, 'PPT에 표지·순서 장도 넣기')));
  // 휴대폰: [이번 주 콘티][곡 보관함][지난 콘티] 중 하나만 보인다(컴퓨터는 콘티와 보관함을 나란히)
  const tabs=h('div',{class:'segments conti-tabs',role:'group','aria-label':'콘티 화면 고르기'},[['week','이번 주 콘티'],['book','곡 보관함'],['special','특송'],['history','지난 콘티']].map(([id,t])=>h('button',{type:'button',class:'sub','aria-pressed':String(id==='week'),onclick:e=>{wrap.dataset.tab=id;if(id==='special')loadSpecials();for(const b of tabs.children)b.setAttribute('aria-pressed',String(b===e.currentTarget));if(id==='history'&&!history.open)history.open=true;scrollTo(0,0);}},t,id==='week'&&badge)));
  const wrap=h('div',{class:'conti','data-tab':'week'});
  view.append(h('h2', {}, '콘티'), (wrap.append(tabs, h('div', { class: 'row conti-date' }, h('label', {}, h('span', {}, '주일 찬양 날짜'), date)),
  h('p', { class: 'hint conti-hint' }, '곡명을 치면 교회 곡 목록에서 고를 수 있어요. 가사는 저작권이 있어 곡명만 적어요.'), h('div',{class:'conti-layout'},(editor.append(editorTitle,box,list,h('button',{class:'sub mobile-browse','aria-expanded':'false',onclick:e=>{const open=browse.classList.toggle('expanded');e.currentTarget.setAttribute('aria-expanded',String(open));}},'곡 목록에서 고르기')),editor),browse,exports,history,specialSection),weekBar), wrap), printBox);
  watch(churchPath(), d => {
    churchName = d?.name || '';
    // 할 일 체크 같은 다른 변경 때는 다시 그리지 않는다(펼쳐 둔 묶음이 닫히지 않게)
    const merged = mergeLibrary(defaultSongs, d?.songbook);
    const sh = d?.sheets || {}, fv = d?.favorites || {};
    if (JSON.stringify(merged) === JSON.stringify(book) && JSON.stringify(sh) === JSON.stringify(sheets) && JSON.stringify(fv) === JSON.stringify(favorites)) return;
    favorites = fv;
    churchSongs = d?.songbook || {};
    churchSettings = { ...d?.settings, customEvents: d?.customEvents }; applySeason(); drawSpecial();
    book = merged; sheets = sh; draw(); drawBrowse(); list.replaceChildren(...Object.keys(book).sort().map(v => h('option', { value: v, label: book[v].note ? `${v} · ${book[v].note}` : v }))); });
  drawBrowse(); open(); if (wide()) loadSpecials();
}

function qtView() {
  let path, stop = () => {}, archive = []; const passageBox=h('section',{class:'card'}); 
  const daily = h('section', { class: 'card', hidden: true });
  const drawDaily = () => {
    const item = archive[qtIndex(date.value, archive.length)]; daily.hidden = !item; if(item)scripture(passageBox,item.ref,false);
    fill(daily, item && [h('h3', {}, '오늘의 큐티'), h('h4', {}, item.ref + ' · ' + item.title),
      ...[['meaning', '1 이 말씀의 뜻'], ['context', '2 앞뒤 맥락'], ['people', '3 인물들의 입장과 생각'], ['why', '4 성경에 실린 이유'], ['theology', '5 신학적 의미와 본문의 역할'], ['apply', '6 오늘의 적용']].map(([key, title]) => h('div', {}, stepTitle(title), h('p', { class: 'qt-copy' }, item[key] || ''))), deepBox(item)]);
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

// 사진을 긴 변 1400px·JPEG 0.75로 줄인다. 저장 크기(글자 수)가 900KB를 넘으면 화질, 그다음 크기를 더 줄인다
async function shrinkImage(file) {
  const bmp = await createImageBitmap(file);
  let scale = Math.min(1, 1400 / Math.max(bmp.width, bmp.height)), q = 0.75;
  for (let i = 0; i < 8; i++) {
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    const url = c.toDataURL('image/jpeg', q);
    if (url.length <= 900 * 1024) return url;
    if (q > 0.55) q -= 0.1; else scale *= 0.85;
  }
  throw new Error('too big');
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
    if (await save(churchPath(), { songbook: { [sheetSong.value]: { ...song, sheet } } })) say('악보 링크를 저장했어요');
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
  // 곡 한꺼번에 넣기: 한 줄에 한 곡 '곡명 키' 또는 '곡명 (키)'
  const bulkInfo = h('p', { class: 'hint', 'aria-live': 'polite' });
  const bulk = h('textarea', { rows: 6, 'aria-label': '한꺼번에 넣을 곡', placeholder: '한 줄에 한 곡씩\n감사함으로 E\n하나님의 세계 (D)', oninput: () => { const add = Object.keys(parseBulk(bulk.value)); bulkInfo.textContent = add.length ? add.length + '곡이 들어가요: ' + add.slice(0, 3).join(', ') + (add.length > 3 ? ' 외' : '') : ''; bulkBtn.disabled = !add.length; } });
  const bulkBtn = h('button', { type: 'button', class: 'sub', disabled: true, onclick: async () => { const add = parseBulk(bulk.value), n = Object.keys(add).length; if (n && await save(churchPath(), { songbook: add })) { say('곡 ' + n + '개를 목록에 넣었어요'); bulk.value = ''; bulkInfo.textContent = ''; bulkBtn.disabled = true; } } }, '넣기');
  // 악보 사진 올리기: 사진 고르기 → 곡명·키(파일 이름에서 채움) → 긴 변 1400px·JPEG로 줄여 저장
  let photos = [], busyPhotos = false;
  const photoList = h('div', { class: 'photo-list' });
  const photoInput = h('input', { type: 'file', accept: 'image/*', multiple: true, 'aria-label': '악보 사진 고르기', onchange: () => { photos = [...photoInput.files].map(file => ({ file, ...nameFromFile(file.name) })); photoInput.value = ''; drawPhotos(); } });
  const drawPhotos = () => fill(photoList, photos.map((p, i) => h('div', { class: 'photo-row' }, h('small', { class: 'meta' }, (i + 1) + '. ' + p.file.name), h('input', { value: p.title, placeholder: '곡명', maxLength: 100, 'aria-label': (i + 1) + '번 사진 곡명', oninput: e => p.title = e.target.value }), h('input', { class: 'photo-key', value: p.key, placeholder: '키', maxLength: 10, 'aria-label': (i + 1) + '번 사진 키', oninput: e => p.key = e.target.value }))), photos.length > 0 && h('button', { type: 'button', class: 'sub', onclick: uploadPhotos }, '사진 ' + photos.length + '장 저장'));
  const uploadPhotos = async () => {
    if (busyPhotos) return;
    if (photos.some(p => !p.title.trim())) return say('곡명이 비어 있는 사진이 있어요');
    busyPhotos = true; let n = 0;
    for (const p of photos) {
      const t = p.title.trim(), k = p.key.trim();
      try {
        const img = await shrinkImage(p.file), id = await sheetId(t, k);
        if (!await save(churchPath() + '/sheets/' + id, { img })) break;
        if (!await save(churchPath(), { sheets: { [id]: { title: t, key: k } }, songbook: { [label({ title: t, key: k })]: { title: t, key: k } } })) break;
        n++;
      } catch { say(p.file.name + ' 사진을 줄이지 못했어요'); }
    }
    busyPhotos = false;
    if (n) { say('악보 ' + n + '장을 저장했어요'); photos = []; drawPhotos(); }
  };
  const copy = h('button', { type: 'button', class: 'sub', onclick: () => (navigator.clipboard?.writeText(code) || Promise.reject())
    .then(() => (copy.textContent = '복사했어요'), () => say('복사가 안 돼요. 코드를 길게 눌러 복사해 주세요.')) }, '코드만 복사');
  const fold=(id,title,note,...kids)=>{const d=foldCard(id);d.append(foldHead(title,note),...kids.filter(Boolean));return d;};
  view.append(h('div',{class:'settings-grid'},
 fold('set-church','교회 정보','',nameBox),fold('set-dept','부서·규모','',sizeBox),fold('set-invite','멤버 초대',code,h('h4',{},'교회 코드'),h('p',{class:'code'},code),h('button',{class:'primary',onclick:()=>copyInvite(code)},'초대 링크 복사'),copy),fold('set-account','내 기기·계정',localStorage.getItem('church:role')||'',loginBox(),h('label',{},h('span',{},'내 역할 이름 (이 기기에만 저장)'),h('input',{value:localStorage.getItem('church:role')||'',placeholder:'예: 찬양리더',maxLength:20,oninput:e=>localStorage.setItem('church:role',e.target.value.trim())})),h('button',{class:'danger',onclick:()=>{localStorage.removeItem('church:code');history.replaceState(null,'',location.pathname+location.search);showEntry();}},'다른 교회로 바꾸기')),
 fold('set-events','절기·행사 켜고 끄기','',evBox),
 fold('set-songs','곡 목록·자료 옮기기','',bookBox,
  h('section',{class:'song-tool'},h('h4',{},'곡 한꺼번에 넣기'),h('p',{class:'hint'},"한 줄에 한 곡씩 '곡명 키' 또는 '곡명 (키)'로 붙여 넣어요"),bulk,bulkInfo,bulkBtn),
  h('section',{class:'song-tool'},h('h4',{},'악보 사진 올리기'),h('p',{class:'hint'},"사진을 고르고 곡명과 키를 적어요. 파일 이름이 '곡명 (키).jpg'면 저절로 채워져요. 교회 안 공유도 악보 저작권 허락(CCLI 등)이 필요할 수 있어요."),h('label',{class:'photo-pick'},h('span',{},'사진 고르기'),photoInput),photoList),
  h('details',{class:'advanced'},h('summary',{},'고급 (CSV 파일 · 악보 링크)'),h('label',{},h('span',{},'CSV 파일로 곡 넣기'),csv),h('p',{class:'meta'},'제목, 키, 메모, 주제, 분위기, 악보 주소 순서'),sheetForm),
  transferCard())));
  watch(churchPath(), d => {
    for(const [id,note] of [['set-church',d?.name||''],['set-dept',deptsOf(d?.settings).join(' · ')]]){const n=view.querySelector('.fold-'+id+' summary');if(n)n.replaceWith(foldHead(id==='set-church'?'교회 정보':'부서·규모',note));}
    fill(sizeBox,h('h3',{},'부서 고르기'),deptPicker(d?.settings, depts=>save(churchPath(),{settings:{depts,deptSize:sizeOf({...d?.settings,depts})}})),sizePickers(d?.settings,settings=>save(churchPath(),{settings}))); 
    settingsBook = mergeLibrary(defaultSongs, d?.songbook);
    const titles = Object.keys(settingsBook).sort();
    fill(sheetSongs, titles.map(t => h('option', { value: t }))); 
    fill(bookBox, h('h3', {}, `곡 목록 ${titles.length}곡`), h('p', {class:'meta'}, `기본 ${defaultSongs.length}곡 + 우리 교회 ${Object.values(d?.songbook || {}).filter(Boolean).length}곡`), titles.length
      ? h('details', {}, h('summary', {}, '목록 보기'), h('ul', {}, titles.map(t => h('li', {}, t))))
      : h('p', { class: 'empty' }, '콘티에 곡을 적으면 저절로 쌓여요.'));
    const s = d?.settings || {}, occ = occurrences([y, y + 1], { dates: s.dates }), today = todayIso();
    fill(nameBox, h('label', {}, h('span', {}, '교회 이름'), h('input', { value: d?.name || '', maxLength: 40, k: 'name',
      oninput: e => { const v = e.target.value.trim(); if (v) later('name', () => save(churchPath(), { name: v })); } })));
    fill(evBox, h('ul', { class: 'toggles' }, EVENTS.map(ev => h('li', {}, h('label', {},
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


// 준비 시작 문구: 시작했으면 "준비 시작 10월 18일 · 준비 중", 아직이면 "3일 뒤 준비 시작"
const mdLong = d => (+d.slice(5, 7)) + '월 ' + (+d.slice(8, 10)) + '일';
const prepText = (start, today) => start > today ? Math.round((parse(start) - parse(today)) / 864e5) + '일 뒤 준비 시작' : '준비 시작 ' + mdLong(start) + ' · 준비 중';
function scheduleView() {
 const list=h('div',{class:'timeline'});let mode='future',data={};const dateOpen=new Set();
 // 앞으로(오늘부터 12개월) / 지난 일정(지난 12개월)
 const tabs=h('div',{class:'segments'},[['future','앞으로'],['past','지난 일정']].map(([id,t])=>h('button',{class:'sub','aria-pressed':String(id===mode),onclick:()=>{mode=id;for(const b of tabs.children)b.setAttribute('aria-pressed',String(b.textContent===t));draw();}},t)));
 const addBox=h('section',{class:'card',hidden:true});view.append(h('div',{class:'schedule-bar'},tabs,h('button',{class:'primary',onclick:()=>{addBox.hidden=false;addEventPanel(addBox,todayIso(),()=>{addBox.hidden=true;draw();});}},'+ 행사 추가')),addBox,list);
 fill(list,h('p',{class:'hint'},'일정을 불러오는 중이에요'));
 function draw(){
 const s={...data.settings,customEvents:data.customEvents},today=todayIso(),y=+today.slice(0,4),tasks=tasksAround(today,s),yearLater=addDays(today,365),yearAgo=addDays(today,-365);
 const all=mode==='future'?occurrences([y,y+1],s).filter(ev=>ev.date>=today&&ev.date<yearLater):occurrences([y-1,y],s).filter(ev=>ev.date<today&&ev.date>=yearAgo).reverse();
 // 한 줄: [달력 낱장 날짜] 이름·준비 시작·진행 막대·[준비 n개 중 m개 완료 ∨] | D-day. 가까운 30일만 진하게
 const row=ev=>{
  const mine=tasks.filter(t=>t.key.startsWith(ev.id+'_'+ev.date+'_')),n=mine.filter(t=>data.done?.[t.key]).length,days=Math.round((parse(ev.date)-parse(today))/864e5),d=parse(ev.date);
  const id=ev.id+ev.date,open=opened.has(id),start=mine.reduce((m,t)=>t.due<m?t.due:m,ev.date),tone=days<0?'past':days<=30?'near':'far';
  const toggle=()=>{open?opened.delete(id):opened.add(id);draw();};
  const hide=async()=>{if(ev.custom){if(!confirm('삭제하면 준비 체크 기록도 안 보여요'))return;await save(churchPath(),{customEvents:{[ev.id]:null}});}else{if(!confirm(ev.name+'을(를) 이번 일정에서 숨길까요? 설정의 \'절기·행사 켜고 끄기\'에서 다시 켤 수 있어요'))return;await save(churchPath(),{settings:{enabled:{[ev.id+'_'+ev.date.slice(0,4)]:false}}});}};
  return h('li',{class:'tl-item '+tone+(days===0?' dday0':''),style:'--ev:'+eventColor(ev.id)+';--ev-bg:'+eventTone(ev.id)[0]},
   h('div',{class:'tl-date','aria-hidden':'true'},h('span',{class:'tl-day'},String(d.getUTCDate())),h('span',{class:'tl-dow'},'일월화수목금토'[d.getUTCDay()])),
   h('div',{class:'tl-main'},
    h('div',{class:'tl-name-row'},h('strong',{class:'tl-name'},ev.name),ABOUT[ev.id]&&h('button',{type:'button',class:'text-button tl-about',onclick:()=>showAbout(ev)},'절기 설명 보기'),ev.custom&&h('small',{class:'meta'},'우리 교회 행사')),
    h('p',{class:'tl-sub'},days<0?(mine.length?'준비 '+n+'/'+mine.length+' 완료':'등록된 준비 항목이 없어요'):(mine.length?(start>today?'준비 시작까지 '+Math.round((parse(start)-parse(today))/864e5)+'일':'준비 중('+mdLong(start)+'부터)'):'등록된 준비 항목 없음')+' · ',h('span',{class:'nowrap'},'행사까지 '+dLabel(days))),
    mine.length>0&&h('progress',{max:mine.length,value:n,'aria-label':ev.name+' 준비 진행'})),
   h('span',{class:'dday tl-dday'},days<0?Math.abs(days)+'일 전':dLabel(days)),
   h('button',{type:'button',class:mine.length?'sub tl-toggle':'text-button tl-toggle quiet','aria-expanded':String(open),onclick:toggle},mine.length?'준비 '+mine.length+'개 중 '+n+'개 완료 · 남은 '+(mine.length-n):'날짜 바꾸기 · 숨기기'),
   open&&h('div',{class:'tl-detail'},mine.length?taskList(mine,data.done||{}):null,eventExtras(ev,data),
    h('div',{class:'tl-more'},h('button',{type:'button',class:'text-button','aria-expanded':String(dateOpen.has(id)),onclick:()=>{dateOpen.has(id)?dateOpen.delete(id):dateOpen.add(id);draw();}},'날짜 바꾸기'),h('button',{type:'button',class:'text-button',onclick:hide},ev.custom?'이 행사 삭제':'우리 부서에서 숨기기'),dateOpen.has(id)&&eventEditor(ev,data,()=>{dateOpen.delete(id);draw();},false,false))));
 };
 // 월별로 묶는다: "11월", 다른 해면 "2027년 1월"
 const group=evs=>{const months=[];for(const ev of evs){const k=ev.date.slice(0,7);(months.at(-1)?.[0]===k?months.at(-1)[1]:months[months.push([k,[]])-1][1]).push(ev);}return months.map(([k,list])=>h('section',{class:'tl-month'},h('h3',{},(k.slice(0,4)!==today.slice(0,4)?k.slice(0,4)+'년 ':'')+(+k.slice(5))+'월'),h('ul',{class:'tl-list'},list.map(row))));};
 // '앞으로'에서 3개월보다 먼 행사는 접은 묶음으로
 const cut=(()=>{const d=parse(today);d.setUTCMonth(d.getUTCMonth()+3);return d.toISOString().slice(0,10);})(),soon=mode==='future'?all.filter(ev=>ev.date<cut):all,later=mode==='future'?all.filter(ev=>ev.date>=cut):[];
 fill(list,all.length?[...group(soon),later.length>0&&h('details',{class:'tl-later',open:opened.has('later'),ontoggle:e=>e.target.open?opened.add('later'):opened.delete('later')},h('summary',{},'3개월 뒤 일정 '+later.length+'개'),group(later))]:h('div',{class:'empty-state'},h('p',{},mode==='future'?'앞으로 12개월 안에 등록된 행사가 없어요':'지난 12개월 동안의 행사가 없어요'),mode==='future'&&h('button',{type:'button',class:'sub',onclick:()=>{addBox.hidden=false;addEventPanel(addBox,todayIso(),()=>{addBox.hidden=true;draw();});}},'첫 행사 추가')));
 }
 watch(churchPath(),d=>{data=d||{};draw();},()=>fill(list,h('div',{class:'empty-state'},h('p',{},'불러오지 못했어요'),h('button',{type:'button',class:'sub',onclick:()=>show('schedule')},'다시 시도'))));
}
function moreView(){ view.append(h('div',{class:'more-list'},[['docs','자료실'],['equipment','장비'],['set','설정']].map(([id,t])=>h('button',{class:'sub',onclick:()=>show(id)},t)))); }
// 절기 줄을 펼쳤을 때 할 일 아래에 붙는 것: 준비물 사기, 수련회 팁·양식, 관련 서류
// 행사 이름의 낱말(두 글자 이상)이 서류 제목에 있으면 관련 서류. 여름수련회는 수련회 규모별 준비도
function relatedDocs(ev, list) {
  const words = ev.name.replace(/[()·,]/g, ' ').split(/\s+/).filter(w => w.length >= 2 && w !== '주일');
  return list.filter(doc => words.some(w => doc.title.includes(w)) || (ev.id === 'retreat' && /수련회 규모/.test(doc.title))).slice(0, 3);
}
function eventExtras(ev, d) {
  return [ev.buy?.length > 0 && h('section', {}, h('h4', {}, '준비물 사기'), h('ul', {}, ev.buy.map(item => h('li', {},
      h('a', { href: 'https://www.coupang.com/np/search?q=' + encodeURIComponent(item), target: '_blank', rel: 'noopener' }, item)))),
      h('p', { class: 'hint' }, '쿠팡 검색 결과로 열려요. 광고·제휴 링크가 아니에요.')),
    ev.id === 'retreat' && sizeGuide(d?.settings),
    ev.id === 'retreat' && retreatForms(d?.retreatForms || {}),
    (()=>{const rel=relatedDocs(ev,docs),list=rel.length?rel:docs.filter(doc=>doc.group==='행정·안내').slice(0,2);return h('div',{class:'event-docs'},h('h4',{},rel.length?'관련 서류':'기본 서류'),list.map(doc=>h('div',{class:'event-doc'},h('span',{class:'event-doc-title'},doc.title),h('button',{type:'button',class:'sub',onclick:()=>showPreview(doc)},'미리보기'),docLink(doc))));})()];
}
function icon(kind='sheet',letter='') {
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
 for(const [k,v] of Object.entries({viewBox:'0 0 24 24',width:24,height:24,fill:'none',stroke:'currentColor','stroke-width':1.5,'aria-hidden':'true'}))svg.setAttribute(k,v);
 const path=document.createElementNS(ns,'path');path.setAttribute('d','M5 2h10l4 4v16H5z M14 2v5h5');svg.append(path);
 if(letter){svg.setAttribute('class','file-icon '+kind);const text=document.createElementNS(ns,'text');text.setAttribute('x','12');text.setAttribute('y','17');text.setAttribute('text-anchor','middle');text.setAttribute('fill','white');text.setAttribute('stroke','none');text.setAttribute('font-size','12');text.textContent=letter;svg.append(text);}
 return svg;
}
const docLink=doc=>h('div',{class:'doc-download'},[['word','W','워드',doc.file],['hwp','한','한글',doc.file.replace(/\.docx$/,'.hwpx')]].map(([kind,letter,title,href])=>h('a',{href,download:true,'aria-label':doc.title+' '+title+' 내려받기'},icon(kind,letter),h('span',{},title+'로 받기'))));
// 자료실: 고른 부서의 서류 + 공통 서류(아래 따로 묶음). '전체'는 모두. 서류는 접힌 줄로 두고 누르면 설명과 받기 버튼.
const DOC_DEPTS = ['전체','유치부','아동부','중등부','고등부','청년부','교구','시니어','공통'];
function docsFor(list, dept) {
 if (dept === '전체') return { mine: list, common: [] };
 const mine = list.filter(d => d.depts?.includes(dept));
 return { mine, common: dept === '공통' ? [] : list.filter(d => d.depts?.includes('공통') && !mine.includes(d)) };
}
// 서류 종류 꼬리표: 안내문(가정에 보내는 글·포스터) · 활동지(퀴즈·활동) · 서식(계획서·보고서·표)
const docKind = title => /통신문|포스터|문구/.test(title) ? '안내문' : /퀴즈|활동$|활동과/.test(title) ? '활동지' : '서식';
// 설정의 첫 부서를 자료실 부서로(중고등부는 중등부, 목록에 없는 부서는 전체)
const docDept = settings => { const first = deptsOf(settings)[0]; const d = first === '중고등부' ? '중등부' : first; return DOC_DEPTS.includes(d) ? d : '전체'; };
// 서류 미리보기: 큰 창(휴대폰은 전체 화면)에 docs/NN_이름.html. 닫기·Esc·바깥 누르기로 닫힘
function bigDialog(title, cls, ...kids) {
 const box = h('dialog', { class: 'event-dialog big-dialog ' + cls, 'aria-label': title }, h('div', { class: 'event-dialog-heading' }, h('h2', {}, title), h('button', { type: 'button', onclick: () => box.close() }, '닫기')), ...kids);
 box.addEventListener('click', e => { if (e.target !== box) return; const r = box.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) box.close(); });
 box.addEventListener('close', () => box.remove());
 document.body.append(box); box.showModal(); return box;
}
const showPreview = doc => bigDialog(doc.title + ' 미리보기', 'preview-dialog', h('iframe', { src: doc.file.replace(/\.docx$/, '.html'), title: doc.title + ' 미리보기' }));
// 악보 보기: 누를 때 그 악보 문서 하나만 읽는다. 같은 제목에 키가 다른 악보가 있으면 창 안에서 키를 바꾼다
function showSheet(title, id, sheets, fav = null) {
 const keys = Object.entries(sheets).filter(([, v]) => v?.title === title);
 const img = h('img', { class: 'sheet-img', alt: title + ' 악보', hidden: true }), status = h('p', { class: 'hint' }), bar = h('div', { class: 'segments sheet-keys', role: 'group', 'aria-label': '키 바꾸기' }), star = h('div', { class: 'sheet-star' });
 const drawStar = sid => { const song = { title, key: sheets[sid]?.key || '' }, on = fav?.isFav(song); fill(star, fav && h('button', { type: 'button', class: 'sub fav-button', 'aria-pressed': String(!!on), onclick: () => { fav.toggleFav(song); drawStar(sid); } }, on ? '★ 즐겨찾기' : '☆ 즐겨찾기')); };
 const load = async sid => {
  fill(bar, keys.length > 1 && keys.map(([k, v]) => h('button', { type: 'button', class: 'sub', 'aria-pressed': String(k === sid), onclick: () => load(k) }, v.key || '키 없음')));
  bar.hidden = keys.length < 2; drawStar(sid); img.hidden = true; status.hidden = false; status.textContent = '악보를 불러오는 중이에요';
  try { const d = await readOnce(churchPath() + '/sheets/' + sid); if (!String(d?.img).startsWith('data:image/')) throw new Error('img'); img.src = d.img; img.hidden = false; status.hidden = true; }
  catch { status.textContent = '악보를 불러오지 못했어요'; }
 };
 bigDialog(title + ' 악보', 'sheet-dialog', h('div', { class: 'sheet-tools' }, bar, star), status, img); load(id);
}
function docsView() {
 let dept = null;
 const find = h('input', { type: 'search', class: 'doc-search', placeholder: '수련회, 회의록, 결과보고…', 'aria-label': '자료 찾기', oninput: () => draw() });
 const picker = h('details', { class: 'dept-picker' }), mineBox = h('section', { class: 'doc-list' }), commonBox = h('section', { class: 'doc-list' });
 const row = doc => h('details', { class: 'doc-row', ontoggle: e => { const d = e.currentTarget; if (d.open && !d.querySelector('iframe')) d.querySelector('.doc-frame')?.append(h('iframe', { src: doc.file.replace(/\.docx$/, '.html'), title: doc.title + ' 미리보기', loading: 'lazy' })); } }, h('summary', {}, h('span', { class: 'doc-kind' }, docKind(doc.title)), h('span', { class: 'doc-title' }, doc.title), h('small', { class: 'meta' }, doc.group)), h('div', { class: 'doc-frame' }), h('p', {}, doc.desc), h('button', { type: 'button', class: 'sub preview-button', onclick: () => showPreview(doc) }, '크게 보기'), docLink(doc));
 const draw = () => {
  const term = find.value.trim();
  picker.hidden = !!term;
  if (term) { const hits = docs.filter(d => (d.title + ' ' + (d.desc || '') + ' ' + (d.group || '')).includes(term)); fill(mineBox, h('h3', {}, '찾은 자료 ' + hits.length + '개'), hits.length ? hits.map(row) : h('p', { class: 'empty' }, '찾는 자료가 없어요. 다른 낱말로 찾아보세요.')); commonBox.hidden = true; return; }
  const { mine, common } = docsFor(docs, dept);
  fill(picker, h('summary', {}, '부서: ' + dept), h('div', { class: 'row', role: 'group', 'aria-label': '부서 고르기' }, DOC_DEPTS.map(d => h('button', { type: 'button', class: 'sub', 'aria-pressed': String(d === dept), onclick: () => { dept = d; picker.open = false; draw(); } }, d))));
  // 분류(행정·안내/교육·행사/수련회·MT/순례)별로 접어 묶는다. 자료가 적으면 처음부터 펼친다.
  const groups = [...new Set(['행정·안내', '교육·행사', '수련회·MT', '순례', ...mine.map(d => d.group)])].map(g => [g, mine.filter(d => d.group === g)]).filter(([, list]) => list.length);
  fill(mineBox, h('h3', {}, (dept === '전체' ? '모든 자료 ' : dept + ' 자료 ') + mine.length + '개'), mine.length ? groups.map(([g, list]) => h('details', { class: 'doc-group', open: mine.length <= 8 }, h('summary', {}, h('strong', { class: 'doc-group-title' }, g), h('small', { class: 'meta' }, list.length + '개')), list.map(row))) : h('p', { class: 'empty' }, '이 부서용 자료가 아직 없어요'));
  fill(commonBox, ...(common.length ? [h('h3', {}, '공통 자료 ' + common.length + '개'), ...common.map(row)] : []));
  commonBox.hidden = !common.length;
 };
 view.append(find, picker, mineBox, commonBox, pptTemplatesSection());
 watch(churchPath(), d => { if (dept !== null) return; dept = docDept(d?.settings); draw(); });
}
// 구매 도움: "구매하려고 해요"를 체크해야 링크가 눌린다(구매 의사가 있을 때만). 체크 전에는 흐린 버튼
function buyHelpBody(list, intent, setIntent) {
 return [h('label', { class: 'buy-intent' }, h('input', { type: 'checkbox', checked: intent, onchange: e => setIntent(e.target.checked) }), h('span', {}, '구매하려고 해요')),
  h('ul', { class: 'buy-list' }, list.map(p => h('li', {}, h('strong', { class: 'buy-name' }, p.name), p.why && h('p', { class: 'buy-why' }, p.why), h('small', { class: 'meta' }, (p.price || '가격 정보 없음') + ' · 조사 시점 가격'),
   h('div', { class: 'buy-links' }, intent ? [h('a', { class: 'sub-link', href: productLink(p), target: '_blank', rel: 'noopener sponsored', 'aria-label': p.name + ' 쿠팡에서 보기(새 창)' }, '쿠팡에서 보기 ↗'), h('a', { class: 'sub-link', href: compareLink(p.name), target: '_blank', rel: 'noopener', 'aria-label': p.name + ' 가격 비교(새 창)' }, '가격 비교 ↗')]
    : [h('button', { type: 'button', class: 'sub', disabled: true, title: '먼저 "구매하려고 해요"를 체크해 주세요' }, '쿠팡에서 보기 ↗'), h('button', { type: 'button', class: 'sub', disabled: true, title: '먼저 "구매하려고 해요"를 체크해 주세요' }, '가격 비교 ↗')])))),
  h('p', { class: 'meta buy-notice' }, buyNotice(list))];
}
function equipmentView() {
 const eqOpen=new Map(), buyOpen=new Map(), buyIntent=new Map(); let products=[], last;
 // 분류 아래 접힌 줄 "구매 도움 · 추천 n개 ∨"
 const buyHelp=c=>{const list=productsFor(c,products);if(!list.length)return null;const d=h('details',{class:'buy-help',open:!!buyOpen.get(c),ontoggle:e=>buyOpen.set(c,e.target.open)},h('summary',{},'구매 도움 · 추천 '+list.length+'개'));d.append(...buyHelpBody(list,!!buyIntent.get(c),on=>{buyIntent.set(c,on);render(last);}));return d;};
 const summary=h('p',{class:'equipment-summary'}),box=h('div',{class:'equipment-grid'});
 const cat=h('select',{'aria-label':'추가 장비 분류'},Object.keys(equipment).map(c=>h('option',{value:c},c)));
 const name=h('input',{required:true,maxLength:100,placeholder:'품목 이름','aria-label':'추가할 품목 이름'});
 const form=h('form',{class:'equipment-add',onsubmit:e=>{e.preventDefault();const n=name.value.trim();if(!n)return;save(churchPath(),{equipment:{[equipmentId(cat.value,n)]:{cat:cat.value,name:n,qty:1,state:'좋음',memo:''}}});name.value='';say(n+' 1개를 넣었어요');}},cat,name,h('button',{class:'sub'},'추가'));
 view.append(summary,box,h('h3',{class:'equipment-add-title'},'목록에 없는 품목 추가'),form);
 const render=d=>{
 const entries=equipmentRows(d?.equipment||{}),total=entries.reduce((n,[,v])=>n+Number(v.qty||0),0),needs=entries.filter(([,v])=>v.state==='점검 필요').length,broken=entries.filter(([,v])=>v.state==='고장').length;
 fill(summary,h('span',{},'전체 '+total+'개'),h('span',{class:needs?'late':''},'점검 필요 '+needs),h('span',{class:broken?'late':''},'고장 '+broken));
 fill(box,Object.keys(equipment).map(c=>{const mine=entries.filter(([,v])=>v.cat===c),owned=mine.filter(([,v])=>v.state!=='없음'),warn=mine.filter(([,v])=>v.state==='점검 필요'||v.state==='고장').length;return h('details',{class:'card equipment-category',open:eqOpen.has(c)?eqOpen.get(c):owned.length>0,ontoggle:e=>eqOpen.set(c,e.target.open)},h('summary',{},h('span',{class:'eq-name'},c),h('small',{class:warn?'late':'meta'},owned.length?owned.length+'종 보유'+(warn?' · 점검 '+warn:''):'없음')),h('table',{},h('thead',{},h('tr',{},['품목','수량'].map(t=>h('th',{},t)))),h('tbody',{},entries.filter(([,v])=>v.cat===c).map(([id,item])=>{
 const write=(key,value)=>save(churchPath(),{equipment:{[id]:{cat:item.cat,name:item.name,[key]:value}}});
 const qty=Number(item.qty)||0;
 // 수량을 바꾸면 상태도 맞춘다: 0개면 '없음', 처음 1개 이상이면 '좋음'
 const setQty=n=>{n=Math.max(0,Math.floor(n)||0);save(churchPath(),{equipment:{[id]:{cat:item.cat,name:item.name,qty:n,state:n===0?'없음':item.state==='없음'?'좋음':item.state}}});};
 return h('tr',{class:(item.state==='고장'?'broken equipment-warning':item.state==='점검 필요'?'equipment-warning':'')+(qty?' has-qty':'')},h('th',{scope:'row'},item.name),
  h('td',{class:'stepper'},h('button',{type:'button',class:'sub','aria-label':item.name+' 하나 빼기',disabled:qty<=0,onclick:()=>setQty(qty-1)},'−'),h('input',{type:'number',min:0,step:1,inputMode:'numeric',value:qty,k:'eq:'+id+'qty','aria-label':item.name+' 수량',oninput:e=>{if(e.target.value!==''&&e.target.validity.valid)setQty(Number(e.target.value));}}),h('button',{type:'button',class:'sub','aria-label':item.name+' 하나 더하기',onclick:()=>setQty(qty+1)},'+')),
  qty>0&&h('td',{class:'eq-state'},h('select',{k:'eq:'+id+'state','aria-label':item.name+' 상태',onchange:e=>write('state',e.target.value)},['좋음','점검 필요','고장'].map(v=>h('option',{value:v,selected:item.state===v},v)))),
  qty>0&&h('td',{class:'eq-memo'},h('input',{value:item.memo||'',maxLength:500,placeholder:'메모',k:'eq:'+id+'memo','aria-label':item.name+' 메모',oninput:e=>{const v=e.target.value;later('eq:'+id+'memo',()=>write('memo',v));}})));
 }))),buyHelp(c));}));
 };
 watch(churchPath(),d=>{last=d;render(d);});
 fetch('./equip-products.json').then(r=>r.json()).then(list=>{products=Array.isArray(list)?list:[];if(last!==undefined)render(last);}).catch(()=>{});
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
async function makeScripturePpt(slides, fileName, dark) {
  await loadPptTool();
  const deck = new window.PptxGenJS(); deck.layout = 'LAYOUT_WIDE'; deck.title = fileName.replace(/\.pptx$/, '');
  const bg = dark ? '1F2420' : 'FFFFFF', fg = dark ? 'FFFFFF' : '1D2421', sub = dark ? 'B8C2BD' : '5F6964', font = 'Malgun Gothic';
  for (const sl of slides) {
    const s = deck.addSlide(); s.background = { color: bg };
    if (sl.type === 'title') s.addText(sl.title, { x: 0.8, y: 2.4, w: 11.7, h: 2, fontFace: font, fontSize: 40, bold: true, color: fg, align: 'center', valign: 'middle' });
    else if (sl.type === 'verse') { s.addText(sl.text, { x: 0.8, y: 0.7, w: 11.7, h: 5.4, fontFace: font, fontSize: 34, color: fg, valign: 'middle', lineSpacingMultiple: 1.3 }); s.addText(sl.label, { x: 0.8, y: 6.5, w: 11.7, h: 0.5, fontFace: font, fontSize: 16, color: sub, align: 'right' }); }
    else s.addText(sl.text, { x: 0.8, y: 3, w: 11.7, h: 1.2, fontFace: font, fontSize: 20, color: sub, align: 'center', valign: 'middle' });
  }
  await deck.writeFile({ fileName });
}
// 콘티 PPT: 기본은 콘티 순서대로 악보 장만(악보 없는 곡은 제목 장). 표지·순서 장은 고를 때만
async function makePpt(name, date, songs, images = {}, withCover = false) {
  await loadPptTool();
  const deck = new window.PptxGenJS(); deck.layout = 'LAYOUT_WIDE'; deck.author = name; deck.subject = '주일 찬양'; deck.title = date + ' 콘티 악보';
  const font = 'Malgun Gothic';
  if (withCover) {
    const cover = deck.addSlide(); cover.background = { color: 'FFFFFF' };
    cover.addText('주일 예배', { x: 0.8, y: 2.2, w: 11.7, h: 1.3, fontFace: font, fontSize: 44, bold: true, color: '1D2421', align: 'center' });
    cover.addText([name, date].filter(Boolean).join(' · '), { x: 0.8, y: 3.6, w: 11.7, h: 0.8, fontFace: font, fontSize: 24, color: '5F6964', align: 'center' });
    const order = deck.addSlide(); order.background = { color: 'FFFFFF' };
    order.addText('예배 순서', { x: 0.8, y: 0.8, w: 11.7, h: 1, fontFace: font, fontSize: 36, bold: true, color: '1D2421' });
    order.addText('묵도 · 찬송 · 대표기도 · 성경봉독 · 설교\n찬양 · 봉헌 · 광고 · 축도', { x: 0.8, y: 2.3, w: 11.7, h: 3, fontFace: font, fontSize: 28, color: '1D2421' });
  }
  for (const sl of contiSlides(songs, images)) {
    const s = deck.addSlide(); s.background = { color: 'FFFFFF' };
    if (sl.type === 'sheet') { s.addImage({ data: sl.image.data, ...fitImage(sl.image.w, sl.image.h) }); s.addText(sl.label, { x: 7.3, y: 0.12, w: 5.8, h: 0.4, fontFace: font, fontSize: 12, color: '6B726D', align: 'right' }); }
    else s.addText(sl.label, { x: 0.8, y: 2.6, w: 11.7, h: 2, fontFace: font, fontSize: 44, bold: true, color: '1D2421', align: 'center', valign: 'middle' });
  }
  await deck.writeFile({ fileName: date + ' 콘티 악보.pptx' });
}


let homeMonth=todayIso().slice(0,7), selectedDay='',homeMode='month';
async function homeWord(box) {
 try {
  const [items,index]=await Promise.all([fetch('./qt-archive.json').then(r=>r.json()),fetch('./bible/index.json').then(r=>r.json())]);
  const item=items[qtIndex(todayIso(),items.length)],ref=item&&refRange(item.ref,index);
  if(!item||!ref)throw new Error('말씀 없음');
  const bible=await fetch('./bible/'+String(ref.book).padStart(2,'0')+'.json').then(r=>r.json());
  if(!box.isConnected)return;
  box.hidden=false;fill(box,foldHead('오늘의 말씀',item.ref),h('p',{class:'rail-verse'},bible[ref.chap-1]?.[(ref.v1||1)-1]||''),h('button',{class:'sub go',onclick:()=>{wordMode='qt';show('word');}},'말씀 읽기'));
 } catch {box.hidden=true;}
}

// 행사 색(자료 구분용 6색, 강조색 초록과 겹치지 않게). 흰 글자 대비 4.5:1 이상
const dLabel = days => days < 0 ? '지남' : days === 0 ? 'D-day' : days < 100 ? 'D-' + days : Math.round(days / 30.4) + '달 뒤';
const EVENT_TONES = { advent:['#EAE4EF','#5E486F'], christmas:['#F1E9D6','#6A5628'], epiphany:['#E1ECE9','#345F59'], lent:['#EBE2E7','#704B61'], palm:['#EEE2DE','#7A4A42'], easter:['#F1E4DC','#80533E'], pentecost:['#EFDFDB','#864B43'], summerThanks:['#E6EAD9','#53633E'], retreat:['#DFE9EC','#355F6B'], creation:['#E2EBE1','#41634A'], thanksgiving:['#F0E3D5','#80512F'], king:['#EFE0E6','#7A4560'], yearEnd:['#E2E5EE','#43506F'] };
const CUSTOM_TONES = [['#E3E6F0','#4A5378'],['#ECE2EC','#6B4A6B'],['#DFEAEA','#3B6264'],['#E6EAD9','#53633E'],['#F0E3D9','#7A4E3A'],['#EFE8D6','#665628']];
const eventTone = id => EVENT_TONES[id] || CUSTOM_TONES[([...id].reduce((n,c)=>n+c.charCodeAt(0),0))%6];
const eventColor = id => eventTone(id)[1];
async function moveEvent(ev,date,data){
 if(!date||date===ev.date)return;
 if(!ev.custom&&date.slice(0,4)!==ev.date.slice(0,4)){say('기본 절기는 같은 해 안에서 날짜를 골라 주세요');return;}
 const delta=Math.round((parse(date)-parse(ev.date))/864e5), taskDue={};
 ev.tasks.forEach((_,i)=>{const old=ev.id+'_'+ev.date+'_'+i;if(data.settings?.taskDue?.[old])taskDue[ev.id+'_'+date+'_'+i]=addDays(data.settings.taskDue[old],delta);});
 const patch=ev.custom?{customEvents:{[ev.id]:{date}},settings:{taskDue}}:{settings:{dates:{[ev.id]:date},taskDue}};
 if(await save(churchPath(),patch)){say(ev.name+'을 '+fmt(date)+'로 옮겼어요');msg.append(h('button',{onclick:async()=>{if(await save(churchPath(),ev.custom?{customEvents:{[ev.id]:{date:ev.date}}}:{settings:{dates:{[ev.id]:data.settings?.dates?.[ev.id]||null}}}))say('되돌렸어요');}},'되돌리기'));}
}
// "무슨 절기인가요?" 설명 창: 닫기·바깥 누르기·Esc로 닫힌다. 휴대폰에서는 아래에서 올라오는 시트(CSS)
function showAbout(ev){
 const box=h('dialog',{class:'event-dialog about-dialog','aria-labelledby':'about-title'},h('div',{class:'event-dialog-heading'},h('h2',{id:'about-title'},ev.name),h('button',{type:'button',onclick:()=>box.close()},'닫기')),h('p',{},ABOUT[ev.id]));
 box.addEventListener('click',e=>{if(e.target!==box)return;const r=box.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)box.close();});
 box.addEventListener('close',()=>box.remove());
 document.body.append(box);box.showModal();
}
const aboutButton=(ev,small=false)=>ABOUT[ev.id]?h('button',{type:'button',class:'about-button'+(small?' small':''),'aria-label':ev.name+' 무슨 절기인가요?',title:'무슨 절기인가요?',onclick:()=>showAbout(ev)},small?'':'무슨 절기인가요?'):null;
function eventEditor(ev,data,close=()=>{},title=true,off=true){
 const date=h('input',{type:'date',value:ev.date,min:ev.custom?'':ev.date.slice(0,4)+'-01-01',max:ev.custom?'':ev.date.slice(0,4)+'-12-31',required:true,'aria-label':'행사 날짜 바꾸기'});
 return h('section',{class:'event-editor'},title&&h('h3',{},ev.name),title&&aboutButton(ev),title&&ev.custom&&h('small',{class:'event-tag'},'우리 교회 행사'),h('form',{class:'date-form',onsubmit:async e=>{e.preventDefault();await moveEvent(ev,date.value,data);close();}},h('label',{},h('span',{},'날짜 바꾸기'),date),h('button',{class:'primary'},'저장')),off&&h('button',{class:'text-button',onclick:async()=>{if(ev.custom){if(!confirm('삭제하면 준비 체크 기록도 안 보여요'))return;if(await save(churchPath(),{customEvents:{[ev.id]:null}}))close();}else if(await save(churchPath(),{settings:{enabled:{[ev.id+'_'+ev.date.slice(0,4)]:false}}}))close();}},ev.custom?'삭제':'올해 끄기'));
}
function addEventPanel(host,initialDate,close){
 if(document.getElementById('add-event-dialog'))return;
 const opener=document.activeElement;
 const box=h('dialog',{id:'add-event-dialog',class:'event-dialog','aria-labelledby':'add-event-title'});
 const content=h('div'); let step=1;
 const dismiss=()=>box.close();
 let draft={name:'',date:initialDate||todayIso(),days:1,tpl:'',tasks:[]};
 box.append(h('div',{class:'event-dialog-heading'},h('h2',{id:'add-event-title'},'행사 추가'),h('button',{type:'button',onclick:dismiss},'닫기')),content);
 box.addEventListener('click',e=>{if(e.target===box){const r=box.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dismiss();}});
 box.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const nodes=[...box.querySelectorAll('button,input,select,textarea,a[href]')].filter(n=>!n.disabled&&!n.hidden);
  const first=nodes[0],last=nodes.at(-1);
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 });
 box.addEventListener('close',()=>{box.remove();close();if(opener?.isConnected)opener.focus();});
 function draw(){
 const field=(title,type,key,props={})=>h('label',{},h('span',{},title),h('input',{type,value:draft[key],required:true,...props,oninput:e=>draft[key]=type==='number'?Number(e.target.value):e.target.value}));
 fill(content,h('p',{class:'hint'},step===1?'1 / 2 · 행사 종류 고르기':'2 / 2 · 행사 내용 편집'));
 if(step===1)content.append(h('div',{class:'template-list'},[...TEMPLATES,{id:'',name:'직접 만들기',days:1,tasks:[]}].map(t=>h('button',{type:'button',onclick:()=>{if(draft.tpl!==t.id||!draft.name)draft={...draft,tpl:t.id,name:t.id?t.name:'',days:t.days,tasks:t.tasks.map(row=>[...row])};step=2;draw();content.querySelector('input')?.focus();}},h('strong',{},t.name),h('small',{},'준비 '+Math.max(0,...t.tasks.map(v=>v[0]))+'주 전부터')))));
 else content.append(h('form',{onsubmit:async e=>{e.preventDefault();if(!draft.name.trim())return;if(await save(churchPath(),{customEvents:{['c'+Date.now().toString(36)]:{...draft,name:draft.name.trim(),tasks:draft.tasks.filter(t=>t[1].trim())}}}))dismiss();}},field('이름','text','name',{maxLength:100}),field('날짜','date','date'),field('일수','number','days',{min:1,max:10,step:1}),h('h4',{},'준비 할 일'),draft.tasks.map((t,i)=>h('div',{class:'row task-edit'},h('input',{type:'number',value:t[0],'aria-label':'준비 주전',oninput:e=>t[0]=Number(e.target.value)}),h('input',{value:t[1],required:true,'aria-label':'할 일',oninput:e=>t[1]=e.target.value}),h('input',{value:t[2],'aria-label':'담당',oninput:e=>t[2]=e.target.value}),h('button',{type:'button',onclick:()=>{draft.tasks.splice(i,1);draw();}},'삭제'))),h('button',{type:'button',onclick:()=>{draft.tasks.push([1,'','']);draw();}},'+ 할 일'),h('div',{class:'row'},h('button',{class:'primary'},'추가'),h('button',{type:'button',onclick:()=>{step=1;draw();content.querySelector('button')?.focus();}},'이전'))));
 box.scrollTop=0;
 }document.body.append(box);draw();box.showModal();
}

function homeView(){

 const homeHeading=screenHeading('home','홈');
 const nextBox=h('section',{class:'home-next'}),summary=h('section',{class:'home-summary'}),cal=h('section',{class:'card calendar'}),detail=h('section',{class:'card day-detail'}),agenda=foldCard('agenda',false,'agenda'),right=h('div',{class:'home-right'});
 let data={},selectedEvent=null,editing=null,adding=false; const sundayBox=foldCard('sunday',false,'rail-card'),wordBox=foldCard('word',false,'rail-card'),nowCard=foldCard('now',true,'now-card'),tipsCard=foldCard('tips',false,'tips-card');wordBox.hidden=true;
 // 주인공 버튼: 휴대폰에서는 탭바 위에 떠 있고, 컴퓨터에서는 화면 오른쪽 위에 붙는다
 const fab=h('button',{class:'primary fab',onclick:()=>{adding=true;editing=null;addEventPanel(right,selectedDay,()=>{adding=false;draw();});}},'+ 행사 추가');
 view.append(summary,h('div',{class:'home-layout'},h('div',{class:'home-main'},nextBox,cal,detail),h('div',{class:'home-side'},agenda,right)),fab);
 // 첫 자료가 오기 전에는 빈 상자 대신 '불러오는 중'
 fill(cal,h('p',{class:'hint loading'},'일정을 불러오는 중이에요'));nextBox.hidden=detail.hidden=agenda.hidden=true;
 watch(churchPath()+'/conti/'+nextSunday(todayIso()),d=>{const songs=(d?.songs||[]).filter(s=>s.title);fill(sundayBox,foldHead('이번 주일 찬양',songs.length?songs.length+'곡':'아직 없음'),songs.length?h('ol',{class:'sunday-songs'},songs.map(s=>h('li',{},s.title))):h('p',{class:'hint'},'아직 콘티가 없어요'),h('button',{class:'sub go',onclick:()=>show('conti')},'콘티 열기'));});
 homeWord(wordBox);
 const today=todayIso(); selectedDay ||= today;
 const edit=e=>{editing=e;adding=false;draw();right.scrollIntoView({behavior:'smooth',block:'nearest'});};
 const prepOf=e=>addDays(e.date,-7*Math.max(0,...e.tasks.map(t=>t[0])));
 function draw(){
 cal.dataset.mode=homeMode;
 const s={...data.settings,customEvents:data.customEvents},done=data.done||{},[y,m]=homeMonth.split('-').map(Number),grid=monthGrid(y,m),ts=tasksAround(homeMonth+'-01',s),evs=occurrences([y-1,y,y+1],s),spans=prepSpans(y,m,s),w=thisWeek(today,s,done);
 const choose=p=>{selectedEvent=p;selectedDay=p.start;editing=evs.find(e=>e.id===p.eventId&&e.date===p.end);adding=false;draw();};
 const move=n=>{if(homeMode==='day'||homeMode==='week'){selectedDay=addDays(selectedDay,n*(homeMode==='week'?7:1));homeMonth=selectedDay.slice(0,7);}else{const d=parse(homeMonth+'-01');d.setUTCMonth(d.getUTCMonth()+n*(homeMode==='year'?12:1));homeMonth=d.toISOString().slice(0,7);selectedDay=homeMonth+'-01';}selectedEvent=null;draw();};
 const period=homeMode==='year'?y+'년':homeMode==='week'?md(weekDays(selectedDay)[0])+'~'+md(weekDays(selectedDay)[6]):homeMode==='day'?fmt(selectedDay):y+'년 '+m+'월';
 fill(summary,h('div',{class:'home-top'},h('p',{class:'meta home-dept'},deptsOf(data.settings).join(' · ')),homeHeading[0]),
  h('div',{class:'home-bar'},
   h('div',{class:'period-controls'},h('button',{class:'sub','aria-label':'이전 기간',onclick:()=>move(-1)},'◀'),h('strong',{class:'period-label'},homeMode==='month'?[h('span',{class:'period-year'},y+'년 '),m+'월']:period),h('button',{class:'sub','aria-label':'다음 기간',onclick:()=>move(1)},'▶')),
   h('button',{class:'sub today-button',onclick:()=>{homeMonth=today.slice(0,7);selectedDay=today;selectedEvent=null;draw();}},'오늘'),
   h('select',{class:'view-select','aria-label':'보기 바꾸기',onchange:e=>{homeMode=e.target.value;draw();}},[['day','일 보기'],['week','주 보기'],['month','월 보기'],['year','년 보기']].map(([id,t])=>h('option',{value:id,selected:homeMode===id},t)))),
  homeHeading[1]);
 fill(cal,
 h('div',{class:'weekdays'},...'일월화수목금토'.split('').map(d=>h('div',{class:'weekday'},d))),grid.map(week=>h('div',{class:'calendar-week'},h('div',{class:'month-grid'},week.map(day=>{
 const cell=calendarCell(day,ts,evs), active=evs.filter(e=>occursOn(e,day)), starts=spans.filter(p=>p.start===day), inPrep=spans.filter(p=>p.start<=day&&p.end>day).sort((a,b)=>a.start.localeCompare(b.start));
 const label=[fmt(day),...active.map(e=>e.name),...starts.map(p=>p.name+' 준비 시작')].join(' · ');
 return h('div',{style:(active[0]?'--ev:'+eventColor(active[0].id)+';':'')+(starts[0]?'--ps:'+eventColor(starts[0].eventId)+';':'')+(inPrep[0]?'--pp:'+eventColor(inPrep[0].eventId):''),...(inPrep[0]?.start===day&&{'data-prep':inPrep[0].name.replace(/주일$/,'')}),ondragover:e=>{if(matchMedia('(pointer:fine)').matches){e.preventDefault();e.currentTarget.classList.add('drop-target');}},ondragleave:e=>e.currentTarget.classList.remove('drop-target'),ondrop:e=>{e.preventDefault();e.currentTarget.classList.remove('drop-target');const ev=evs.find(v=>v.id+'_'+v.date===e.dataTransfer.getData('text/plain'));if(ev)moveEvent(ev,day,data);},class:'day'+(active.length?' has-event':'')+(inPrep.length?' in-prep'+(inPrep[0].start===day?' prep-s':'')+(addDays(day,1)===inPrep[0].end?' prep-e':''):'')+(starts.length?' prep-day':'')+(day===today?' today':'')+(day===selectedDay?' selected':'')+(!day.startsWith(homeMonth)?' outside':'')},h('button',{class:'day-number','aria-label':label,'aria-pressed':String(day===selectedDay),onclick:()=>{selectedDay=day;selectedEvent=null;draw();}},String(+day.slice(8))),cell.items.filter(item=>item.event).map(item=>h('button',{style:'background:'+eventColor(item.event.id)+';color:white',class:'calendar-item sub event-title',draggable:matchMedia('(pointer:fine)').matches,ondragstart:e=>e.dataTransfer.setData('text/plain',item.event.id+'_'+item.event.date),title:item.event.name,onclick:()=>{selectedDay=day;selectedEvent=null;editing=item.event;adding=false;draw();detail.scrollIntoView({behavior:'smooth',block:'nearest'});}},item.event.name)),cell.extra>0&&h('button',{class:'calendar-more sub',onclick:()=>{selectedDay=day;selectedEvent=null;draw();}},'외 '+cell.extra+'개'));
 })),h('div',{class:'week-preps'},prepWeek(week,spans,homeMonth).sort((a,b)=>a.start.localeCompare(b.start)||a.name.localeCompare(b.name)).map((p,i)=>h('button',{class:'prep-ribbon'+(selectedEvent?.eventId===p.eventId?' chosen':'')+(p.starts?' starts':'')+(p.ends?' ends':''),style:'--event-color:'+eventColor(p.eventId)+';--event-bg:'+eventTone(p.eventId)[0]+';grid-row:'+(i+1)+';grid-column:'+p.column+' / span '+p.width,'aria-label':p.name+' 준비 '+md(p.start)+'~'+md(p.end),title:p.name+' 준비 '+md(p.start)+'~'+md(p.end),onclick:()=>choose(p)},h('span',{},p.name.replace(/주일$/,'')+' 준비')))))),
 h('div',{class:'calendar-legend'},h('span',{},h('i',{class:'key-event'}),'행사일'),h('span',{},h('i',{class:'key-prep'}),'준비 시작'),h('span',{class:'key-bar-item'},h('i',{class:'key-bar'}),'준비 기간'),h('span',{},h('i',{class:'key-today'}),'오늘')));
 const dayData=dayItems(selectedDay,s,done);
 if(homeMode==='day')fill(cal,h('h3',{},fmt(selectedDay)),dayData.events.map(e=>h('button',{class:'event-tag',onclick:()=>edit(e)},e.name)),dayData.tasks.length?taskList(dayData.tasks,done):h('div',{},h('p',{},'이날은 준비할 일이 없어요'),dayData.next&&h('p',{class:'meta'},'다음 할 일 · '+fmt(dayData.next.due)+' '+dayData.next.text)),dayData.preps.map(e=>h('div',{class:'daily-prep',style:'--ev:'+eventColor(e.id)},h('h4',{},e.name+' · D-'+Math.round((parse(e.date)-parse(selectedDay))/864e5)),h('progress',{max:e.total||1,value:e.completed,'aria-label':e.name+' 준비 진행'}),h('small',{class:'meta'},e.completed+' / '+e.total+'개 완료'))));
 if(homeMode==='week')fill(cal,h('h3',{},'이번 주 일정'),h('div',{class:'week-view'},weekDays(selectedDay).map(day=>{const items=dayItems(day,s,done);return h('section',{class:'week-column'+(day===today?' today':'')},h('h4',{},fmt(day)),items.events.map(e=>h('button',{class:'event-tag',onclick:()=>edit(e)},e.name)),items.tasks.length?taskList(items.tasks.slice(0,3),done,true):h('p',{class:'meta'},'할 일 없음'),items.tasks.length>3&&h('button',{class:'sub',onclick:()=>{selectedDay=day;homeMonth=day.slice(0,7);homeMode='day';draw();}},'외 '+(items.tasks.length-3)+'개'));})));
 if(homeMode==='year')fill(cal,h('h3',{},y+'년 월별 일정'),h('div',{class:'year-months'},Array.from({length:12},(_,i)=>{const prefix=y+'-'+String(i+1).padStart(2,'0'),preps=prepSpans(y,i+1,s).filter(p=>p.start.startsWith(prefix));return h('section',{class:'year-month'},h('button',{class:'sub',onclick:()=>{homeMonth=prefix;selectedDay=prefix+'-01';homeMode='month';draw();}},i+1+'월'),h('div',{},evs.filter(e=>e.date<=prefix+'-31'&&addDays(e.date,(e.days||1)-1)>=prefix+'-01').map(e=>h('button',{class:'event-tag',onclick:()=>edit(e)},e.name)),preps.map(p=>h('small',{class:'meta'},p.name+' 준비 시작 · '+md(p.start)))));})));

 // 다음 행사: 이름·D-day를 가장 크게, 준비 진행과 [준비할 일 보기]
 const nx=occurrences([+today.slice(0,4),+today.slice(0,4)+1],s).find(e=>e.date>=today);
 if(!nx)fill(nextBox,h('p',{class:'next-label'},'다음 행사'),h('p',{class:'next-empty'},'등록된 행사가 없어요'),h('button',{type:'button',class:'sub',onclick:()=>fab.click()},'첫 행사 추가'));
 if(nx){const mine=tasksAround(today,s).filter(t=>t.key.startsWith(nx.id+'_'+nx.date+'_')),nd=mine.filter(t=>done[t.key]).length,days=Math.round((parse(nx.date)-parse(today))/864e5),start=prepOf(nx);
  nextBox.style.setProperty('--ev',eventColor(nx.id));
  fill(nextBox,h('p',{class:'next-label'},'다음 행사'),h('div',{class:'next-row'},h('strong',{class:'next-name'},nx.name),h('span',{class:'next-dday'},dLabel(days))),
   h('p',{class:'next-sub'},fmt(nx.date)+' · '+(mine.length?prepText(start,today)+' · '+nd+'/'+mine.length+' 완료':'등록된 준비 항목이 없어요')),
   mine.length>0&&h('progress',{max:mine.length,value:nd,'aria-label':nx.name+' 준비 진행'}),
   (()=>{const dt=tasksAround(today,s).find(t=>t.doc&&!done[t.key]&&t.due>=today&&t.due<=addDays(today,31)),doc=dt&&docs.find(d=>d.file.startsWith('docs/'+dt.doc+'_'));return doc&&h('p',{class:'next-doc'},h('span',{},'준비할 서류: '+doc.title+' · '+dt.event+' / '+mdLong(dt.due)+'까지'),h('button',{type:'button',class:'sub small',onclick:()=>showPreview(doc)},'미리보기'));})(),
   w.overdue.length>0&&h('button',{type:'button',class:'sub next-go next-late',onclick:()=>{const c=right.querySelector('.now-card');if(c){c.open=true;c.scrollIntoView({behavior:'smooth',block:'start'});}}},'기한 지난 준비 '+w.overdue.length+'건 보기'),
   mine.length>0&&h('button',{type:'button',class:'sub next-go',onclick:()=>{homeMode='month';choose({eventId:nx.id,name:nx.name,start,end:nx.date});detail.scrollIntoView({behavior:'smooth',block:'nearest'});}},'준비할 일 보기'));}
 nextBox.hidden=false;agenda.hidden=false;
 // 일정 목록: 이 달에 준비 기간이 걸친 행사(오늘 이후)마다 D-day·준비 기간·진행률
 const from=today>homeMonth+'-01'?today:homeMonth+'-01', tsFrom=tasksAround(from,s);
 let upcoming=evs.filter(e=>e.date>=from&&prepOf(e)<=homeMonth+'-31');
 if(!upcoming.length)upcoming=evs.filter(e=>e.date>=from).slice(0,1);
 fill(agenda,foldHead(m+'월에 준비할 행사',upcoming.length?upcoming[0].name+' '+dLabel(Math.round((parse(upcoming[0].date)-parse(today))/864e5))+(upcoming.length>1?' 외 '+(upcoming.length-1)+'개':''):'없음'),upcoming.length?h('ul',{class:'agenda-list'},upcoming.map(e=>{
  const mine=tsFrom.filter(t=>t.key.startsWith(e.id+'_'+e.date+'_')),n=mine.filter(t=>done[t.key]).length,start=prepOf(e),days=Math.round((parse(e.date)-parse(today))/864e5);
  const state=today<start?'시작까지 '+Math.round((parse(start)-parse(today))/864e5)+'일':'준비 중';
  return h('li',{},h('button',{class:'agenda-item',style:'--ev:'+eventColor(e.id),'aria-pressed':String(selectedEvent?.eventId===e.id&&selectedEvent?.end===e.date),onclick:()=>{choose({eventId:e.id,name:e.name,start,end:e.date});detail.scrollIntoView({behavior:'smooth',block:'nearest'});}},
   h('span',{class:'agenda-dot'}),h('span',{class:'agenda-name'},e.name),h('span',{class:'agenda-dday'},dLabel(days)),
   h('span',{class:'agenda-when'},fmt(e.date)+(e.days>1?' · '+e.days+'일간':'')),
   h('span',{class:'agenda-prep'},mine.length?'준비 '+md(start)+' ~ '+md(e.date)+' · '+state:'등록된 준비 항목이 없어요'),
   mine.length>0&&h('span',{class:'agenda-progress'},h('progress',{max:mine.length,value:n,'aria-label':e.name+' 준비 진행'}),h('span',{},n+'/'+mine.length+' 완료'))));
 })):h('p',{class:'hint'},'다가오는 행사가 없어요'));

 detail.hidden=homeMode!=='month'||(selectedDay===today&&!selectedEvent&&!dayData.tasks.length);
 const selected=selectedEvent?ts.filter(t=>t.eventDate===selectedEvent.end&&t.event===selectedEvent.name):ts.filter(t=>t.due===selectedDay);
 fill(detail,h('h3',{},selectedEvent?selectedEvent.name+' 준비할 일':fmt(selectedDay)+' 할 일'),dayData.preps.map(e=>h('p',{class:'meta selected-prep'},e.name+' 준비 중 · '+e.completed+'/'+e.total+'개 완료')),spans.filter(p=>p.start===selectedDay).map(p=>h('p',{class:'prep-start'},p.name.replace(/주일$/,'')+' 준비 시작')),selected.length?taskList(selected,done):h('p',{class:'hint'},'등록된 준비 항목이 없어요'),evs.filter(e=>occursOn(e,selectedDay)).map(e=>h('button',{class:'sub',onclick:()=>edit(e)},e.name+' 날짜 바꾸기')));
 if(adding)return;
 fill(nowCard,foldHead(w.overdue.length?'기한 지난 준비 '+w.overdue.length+'건':'이번 주 할 일',w.overdue.length?'':w.week.length?w.week.length+'개':'새 마감 없음'),w.overdue.length>0&&h('section',{class:'overdue'},h('ul',{class:'tasks overdue-actions'},w.overdue.map(t=>h('li',{},h('small',{class:'task-event'},t.event+' 준비'),h('strong',{},t.text),docActions(t.doc),h('small',{},'마감 '+md(t.due)+' · ',h('span',{class:'late-days'},Math.round((parse(today)-parse(t.due))/864e5)+'일 지남')),h('div',{class:'row'},h('button',{class:'primary done-button',onclick:()=>toggleTask(t.key,true)},'✓ 완료 처리'),h('button',{class:'text-button due-button',onclick:()=>changeTaskDue(t)},'기한 변경')))))),w.week.length?[h('h4',{},'이번 주 할 일 '+w.week.length+'개'),taskList(w.week,done)]:h('p',{class:'hint'},'이번 주 새 마감 없음'),h('button',{class:'text-button more-link go',onclick:()=>show('schedule')},'전체 준비 일정 보기'));
 const tips=sizeTips(data.settings);fill(tipsCard,foldHead('부서 규모별 수련회 팁',deptsOf(data.settings).join(' · ')),tips.map(t=>h('p',{},t)));tipsCard.hidden=!tips.length;
 fill(right,nowCard,sundayBox,wordBox,tipsCard);
 if(editing)fill(right,h('section',{class:'card editor-card'},eventEditor(editing,data,()=>{editing=null;draw();})));
 }watch(churchPath(),d=>{data=d||{};draw();},()=>fill(cal,h('div',{class:'empty-state'},h('p',{},'불러오지 못했어요'),h('button',{type:'button',class:'sub',onclick:()=>show('home')},'다시 시도'))));
}
const stepTitle=t=>h('h4',{class:'step-title'},h('span',{class:'step-number'},t.slice(0,1)),t.slice(2));
// 심화: 매튜 헨리 주석(1706, 저작권 만료)을 AI가 한국어로 풀어 쓴 글. tools/gen_deep.py가 만든다.
const deepBox=a=>a.deep&&h('details',{class:'qt-deep'},h('summary',{},'심화 · 매튜 헨리 주석'),h('p',{class:'qt-copy'},a.deep),h('p',{class:'bible-credit'},'매튜 헨리 성경 주석 요약판(1706, 저작권 만료)을 AI가 한국어로 풀어 썼어요'));
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
 if(commentary){const matches=archive.filter(a=>{const r=refRange(a.ref,index);return r&&overlaps(ref,r);});box.append(...(matches.length?matches.map(a=>h('section',{class:'card'},h('h3',{},a.ref+' · '+a.title),...STEPS.map(([k,t])=>h('div',{},stepTitle(t),h('p',{class:'qt-copy'},a[k]))),deepBox(a))):[h('p',{},'이 본문의 해설은 준비 중이에요')]));}
 }catch{if(box.request!==request)return;fill(box,h('p',{class:'err'},'본문을 불러오지 못했어요. 본문 범위와 인터넷 연결을 확인해 주세요.'));}
}
function wordView(){
 view.append(h('div',{class:'segments switcher'},[['sermon','주일설교'],['qt','큐티'],['worship','예배']].map(([id,t])=>h('button',{class:'sub','aria-pressed':String(wordMode===id),onclick:()=>{if(id==='worship')return show('worship');wordMode=id;show('word');}},t))));
 if(wordMode==='qt'){qtView();return;}
 const box=h('section',{class:'reading','aria-live':'polite'},h('p',{class:'hint'},'성경과 장·절을 고르면 말씀이 나와요')),input=h('input',{id:'scripture-input',required:true,'aria-label':'성경 본문'});
 // 성경 66권 ▾ · 장 ▾ · 시작 절 ▾ · 끝 절 ▾ — 고르면 바로 찾는다. 절 수는 그 권 파일에서
 const book=h('select',{'aria-label':'성경'}),chap=h('select',{'aria-label':'장',disabled:true}),v1=h('select',{'aria-label':'시작 절',disabled:true}),v2=h('select',{'aria-label':'끝 절',disabled:true});
 let index=[],loaded=null;
 const opts=(sel,n,unit)=>{sel.replaceChildren(...Array.from({length:n},(_,i)=>h('option',{value:i+1},(i+1)+unit)));sel.disabled=false;};
 const picked=()=>index.find(b=>String(b.n)===book.value);
 const go=()=>{const b=picked();if(!b)return;const text=b.name+' '+chap.value+':'+v1.value+(v2.value!==v1.value?'-'+v2.value:'');input.value=text;scripture(box,text);drawPpt();};
 const verses=async()=>{const b=picked();if(loaded?.n!==b.n)loaded={n:b.n,data:await fetch('./bible/'+String(b.n).padStart(2,'0')+'.json').then(r=>r.json())};const n=loaded.data[chap.value-1]?.length||1;opts(v1,n,'절');opts(v2,n,'절');v2.value=String(n);};
 book.onchange=async()=>{const b=picked();if(!b)return;opts(chap,b.chapters,'장');try{await verses();go();}catch{fill(box,h('p',{class:'err'},'본문을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));}};
 chap.onchange=async()=>{try{await verses();go();}catch{fill(box,h('p',{class:'err'},'본문을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));}};
 v1.onchange=()=>{if(+v2.value<+v1.value)v2.value=v1.value;go();};
 v2.onchange=()=>{if(+v2.value<+v1.value)v1.value=v2.value;go();};
 // 말씀 PPT: 지금 본문(직접 입력 포함)과 [구간 추가]로 모은 구간을 한 파일로
 const cache={},passages=[],pptBox=h('section',{class:'ppt-box',hidden:true});let dark=true;
 const passageOf=async text=>{const ref=refRange(text,index);if(!ref)return null;const b=index.find(x=>x.n===ref.book);cache[ref.book]??=await fetch('./bible/'+String(ref.book).padStart(2,'0')+'.json').then(r=>r.json());const bible=cache[ref.book],verses=[];for(let c=ref.chap;c<=ref.endChap;c++)for(let v=(c===ref.chap?ref.v1||1:1);v<=(c===ref.endChap?ref.v2||bible[c-1]?.length:bible[c-1]?.length);v++)if(bible[c-1]?.[v-1])verses.push({c,v,text:bible[c-1][v-1]});return verses.length?{name:b.name,abbr:b.abbr,chap:ref.chap,v1:ref.v1||1,endChap:ref.endChap,v2:ref.v2||bible[ref.endChap-1].length,verses}:null;};
 const drawPpt=()=>{pptBox.hidden=!input.value.trim()&&!passages.length;fill(pptBox,h('h3',{},'PPT로 내보내기'),
  passages.length>0&&h('div',{class:'browse-tags'},passages.map((x,i)=>h('button',{type:'button',class:'tag','aria-label':passageLabel(x)+' 빼기',onclick:()=>{passages.splice(i,1);drawPpt();}},passageLabel(x)+' ×'))),
  h('div',{class:'row'},h('button',{type:'button',class:'sub',onclick:async()=>{const x=await passageOf(input.value).catch(()=>null);if(!x)return say('본문을 먼저 골라 주세요');passages.push(x);say(passageLabel(x)+' 구간을 넣었어요');drawPpt();}},'+ 지금 본문을 구간에 추가'),
   h('div',{class:'segments ppt-theme',role:'group','aria-label':'바탕'},[[true,'어두운 바탕'],[false,'밝은 바탕']].map(([v,t])=>h('button',{type:'button',class:'sub','aria-pressed':String(dark===v),onclick:()=>{dark=v;drawPpt();}},t)))),
  h('button',{type:'button',class:'primary ppt-go',onclick:async e=>{const btn=e.currentTarget;let list=passages;if(!list.length){const x=await passageOf(input.value).catch(()=>null);if(!x)return say('본문을 먼저 골라 주세요');list=[x];}btn.disabled=true;try{await makeScripturePpt(scriptureSlides(list),scriptureFileName(list,nextSunday(todayIso())),dark);}catch{say('PPT 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.');}finally{btn.disabled=false;}}},'PPT로 내보내기'),
  h('p',{class:'hint'},(passages.length?passages.length+'개 구간':'지금 본문')+'을 16:9 슬라이드로 만들어요. 표지 · 절마다 한 장 · 출처 장'));};
 fetch('./bible/index.json').then(r=>r.json()).then(list=>{index=list;book.replaceChildren(h('option',{value:''},'성경 고르기'),...list.map(b=>h('option',{value:b.n},b.name)));}).catch(()=>{});
 view.append(h('div',{class:'bible-pick'},book,chap,v1,v2),
  h('details',{class:'direct-input'},h('summary',{},'직접 입력'),h('label',{htmlFor:'scripture-input'},h('span',{},'성경 본문')),h('form',{class:'scripture-search',onsubmit:e=>{e.preventDefault();scripture(box,input.value);drawPpt();}},input,h('button',{class:'sub'},'검색')),h('p',{class:'hint meta'},'예: 막 4:1–9 또는 마가복음 4장')),box,pptBox);
}

// ---------- 예배: 예배 고르기 → 순서 보기·고치기 → 순서지 인쇄 · 예배 PPT ----------
let worshipData = null;
const loadWorship = async () => (worshipData ??= await fetch('./worship.json').then(r => { if (!r.ok) throw new Error('worship'); return r.json(); }));
let bibleIndex = null; const bibleBooks = {};
// "막 4:1-9" → 말씀 PPT와 같은 구간 모양(없으면 null)
async function loadPassage(text) {
  bibleIndex ??= await fetch('./bible/index.json').then(r => r.json());
  const ref = refRange(String(text || '').trim(), bibleIndex); if (!ref) return null;
  const b = bibleIndex.find(x => x.n === ref.book);
  bibleBooks[ref.book] ??= await fetch('./bible/' + String(ref.book).padStart(2, '0') + '.json').then(r => r.json());
  const bible = bibleBooks[ref.book], verses = [];
  for (let c = ref.chap; c <= ref.endChap; c++) for (let v = (c === ref.chap ? ref.v1 || 1 : 1); v <= (c === ref.endChap ? ref.v2 || bible[c - 1]?.length : bible[c - 1]?.length); v++) if (bible[c - 1]?.[v - 1]) verses.push({ c, v, text: bible[c - 1][v - 1] });
  return verses.length ? { name: b.name, abbr: b.abbr, chap: ref.chap, v1: ref.v1 || 1, endChap: ref.endChap, v2: ref.v2 || bible[ref.endChap - 1].length, verses } : null;
}
// 콘티 곡마다 교회 악보 그림(같은 제목+키, 없으면 같은 제목) — 그 문서 하나씩 병렬로
async function loadSheetImages(songs, sheets) {
  const size = data => new Promise(ok => { const im = new Image(); im.onload = () => ok({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 }); im.onerror = () => ok(null); im.src = data; });
  const got = await Promise.allSettled(songs.map(async s => { const id = pickSheet(s, sheets); if (!id) return null; const d = await readOnce(churchPath() + '/sheets/' + id); if (!String(d?.img).startsWith('data:image/')) return null; const wh = await size(d.img); return wh && { ...s, image: { data: d.img, ...wh } }; }));
  return songs.map((s, i) => (got[i].status === 'fulfilled' && got[i].value) || s);
}
// 예배 PPT 그리기(16:9). 가사·성경은 단색 바탕, 악보 장은 흰 바탕에 그림만
async function makeWorshipPpt(slides, T, fileName) {
  await loadPptTool();
  const deck = new window.PptxGenJS(); deck.layout = 'LAYOUT_WIDE'; deck.title = fileName.replace(/\.pptx$/, '');
  const F = 'Malgun Gothic', W = 13.333, base = { fontFace: F, color: T.text };
  for (const sl of slides) {
    const s = deck.addSlide(); s.background = { color: sl.type === 'sheet' ? 'FFFFFF' : T.bg };
    const bar = () => s.addShape(deck.ShapeType.rect, { x: 0.8, y: 4.15, w: 1.2, h: 0.06, fill: { color: T.accent }, line: { color: T.accent } });
    if (sl.type === 'wait') { s.addText(sl.title, { ...base, x: 0.8, y: 2.2, w: W - 1.6, h: 1.4, fontSize: T.size.title + 4, bold: true, align: 'center' }); s.addText(sl.sub, { ...base, color: T.sub, x: 0.8, y: 3.7, w: W - 1.6, h: 0.8, fontSize: T.size.sub, align: 'center' }); if (sl.church) s.addText(sl.church, { ...base, color: T.accent, x: 0.8, y: 6.4, w: W - 1.6, h: 0.6, fontSize: T.size.sub - 2, align: 'center' }); }
    else if (sl.type === 'title') { s.addText(sl.cover || '', { ...base, color: T.accent, x: 0.8, y: 1.6, w: W - 1.6, h: 0.7, fontSize: T.size.sub }); s.addText(sl.title, { ...base, x: 0.8, y: 2.4, w: W - 1.6, h: 1.6, fontSize: T.size.title + 4, bold: true }); bar(); s.addText(sl.sub, { ...base, color: T.sub, x: 0.8, y: 4.5, w: W - 1.6, h: 0.8, fontSize: T.size.sub }); }
    else if (sl.type === 'section') { s.addText(sl.head || '', { ...base, color: T.sub, x: 0.8, y: 0.5, w: 8, h: 0.6, fontSize: T.size.sub - 2 }); s.addText(sl.title, { ...base, x: 0.8, y: 2.3, w: W - 1.6, h: 1.6, fontSize: T.size.title + 4, bold: true, align: 'center' }); if (sl.sub) s.addText(sl.sub, { ...base, color: T.accent, x: 0.8, y: 4, w: W - 1.6, h: 0.8, fontSize: T.size.sub + 4, align: 'center' }); if (sl.church) s.addText(sl.church, { ...base, color: T.sub, x: W - 6.8, y: 6.7, w: 6, h: 0.5, fontSize: T.size.sub - 6, align: 'right' }); }
    else if (sl.type === 'sheet') { s.addImage({ data: sl.image.data, ...fitImage(sl.image.w, sl.image.h) }); s.addText(sl.label, { fontFace: F, color: '6B726D', x: W - 6.1, y: 0.12, w: 5.8, h: 0.4, fontSize: 12, align: 'right' }); }
    else if (sl.type === 'song') { s.addText(sl.title, { ...base, x: 0.8, y: 2.6, w: W - 1.6, h: 1.6, fontSize: T.size.lyric, bold: true, align: 'center', valign: 'middle' }); if (sl.sub) s.addText(sl.sub, { ...base, color: T.sub, x: 0.8, y: 4.3, w: W - 1.6, h: 0.6, fontSize: T.size.sub, align: 'center' }); }
    else if (sl.type === 'bible' || sl.type === 'creed' || sl.type === 'notice') {
      const head = sl.type === 'notice' ? '광고' : sl.type === 'creed' ? sl.title : sl.head, size = sl.type === 'notice' ? T.size.notice : T.size.bible;
      s.addText(head, { ...base, color: T.accent, x: 0.8, y: 0.45, w: W - 1.6, h: 0.7, fontSize: T.size.sub, bold: true });
      s.addText(sl.lines.map(t => ({ text: t, options: { breakLine: true, bullet: sl.type === 'notice' ? { code: '25CF' } : false, paraSpaceAfter: 10 } })), { ...base, x: 0.8, y: 1.3, w: W - 1.6, h: 5.6, fontSize: size, valign: 'top', align: 'left', lineSpacingMultiple: 1.25 });
    }
    else if (sl.type === 'sermon') { s.addText('설교', { ...base, color: T.accent, x: 0.8, y: 1.7, w: W - 1.6, h: 0.6, fontSize: T.size.sub, align: 'center' }); s.addText(sl.title, { ...base, x: 0.8, y: 2.4, w: W - 1.6, h: 1.8, fontSize: T.size.title + 4, bold: true, align: 'center', valign: 'middle' }); if (sl.sub) s.addText(sl.sub, { ...base, color: T.sub, x: 0.8, y: 4.4, w: W - 1.6, h: 0.7, fontSize: T.size.sub, align: 'center' }); }
    else if (sl.type === 'after') { s.addText(sl.title, { ...base, x: 0.8, y: 2.4, w: W - 1.6, h: 1.2, fontSize: T.size.title, bold: true, align: 'center' }); s.addText(sl.sub, { ...base, color: T.sub, x: 0.8, y: 3.7, w: W - 1.6, h: 0.7, fontSize: T.size.sub, align: 'center' }); s.addText(sl.foot, { fontFace: F, color: T.sub, x: 0.8, y: 6.8, w: W - 1.6, h: 0.4, fontSize: 12, align: 'center' }); }
  }
  await deck.writeFile({ fileName });
}
// 교회 부서 → 예배 PPT 부서
const deptToPpt = d => ({ 유치부: 'preschool', 아동부: 'elementary', 중고등부: 'middle', 청년부: 'young', 장년부: 'adult' }[d] || 'adult');
// 예배 PPT 만들기 창: 부서·테마·순서·날짜·담당자·본문·설교·광고, 콘티 곡(악보 포함)은 저절로
function openWorshipPpt(serviceId, data) {
  const W = worshipData, settings = data.settings || {}, sundays = nextSunday(todayIso());
  let deptId = deptToPpt(deptsOf(settings)[0]), mode = themeFor(deptId).mode;
  const dept = h('select', { 'aria-label': '부서', onchange: () => { deptId = dept.value; mode = themeFor(deptId).mode; svc.value = DEPTS.find(d => d.id === deptId).service; paintTheme(); paintPeople(); } }, DEPTS.map(d => h('option', { value: d.id, selected: d.id === deptId }, d.name)));
  const svc = h('select', { 'aria-label': '예배 순서', onchange: () => paintPeople() }, W.services.map(s => h('option', { value: s.id, selected: s.id === serviceId }, s.name)));
  const themeBox = h('div', { class: 'segments' }), paintTheme = () => fill(themeBox, [['dark', '어두운 바탕'], ['light', '밝은 바탕']].map(([m, t]) => h('button', { type: 'button', class: 'sub', 'aria-pressed': String(mode === m), onclick: () => { mode = m; paintTheme(); } }, t)));
  const day = h('input', { type: 'date', value: sundays, 'aria-label': '예배 날짜' }), time = h('input', { type: 'time', value: '11:00', 'aria-label': '시작 시각' });
  const pastor = h('input', { type: 'checkbox' }), creeds = h('input', { type: 'checkbox', checked: true });
  const apostles = h('textarea', { rows: 4, value: settings.creeds?.apostles || '', placeholder: '교회가 쓰는 사도신경 문안(비우면 제목 장만)', 'aria-label': '사도신경 문안', oninput: () => later('creed-a', () => save(churchPath(), { settings: { creeds: { apostles: apostles.value } } })) });
  const lords = h('textarea', { rows: 4, value: settings.creeds?.lords || '', placeholder: '교회가 쓰는 주기도문 문안(비우면 제목 장만)', 'aria-label': '주기도문 문안', oninput: () => later('creed-l', () => save(churchPath(), { settings: { creeds: { lords: lords.value } } })) });
  const peopleBox = h('div', { class: 'people' }), people = {};
  const steps = () => orderFor(W.services.find(s => s.id === svc.value), data.worshipOrders);
  const paintPeople = () => fill(peopleBox, steps().map((st, i) => h('label', {}, h('span', {}, (i + 1) + '. ' + st.name), h('input', { value: people[svc.value + i] || '', placeholder: st.who || '담당', maxLength: 30, oninput: e => people[svc.value + i] = e.target.value }))));
  const passage = h('input', { placeholder: '예: 막 4:1-9', 'aria-label': '성경 본문' }), title = h('input', { placeholder: '설교 제목', 'aria-label': '설교 제목', maxLength: 80 }), preacher = h('input', { placeholder: '설교자', 'aria-label': '설교자', maxLength: 30 });
  const notices = h('textarea', { rows: 4, placeholder: '한 줄에 광고 하나씩', 'aria-label': '광고' });
  const contiInfo = h('p', { class: 'hint' }, '이번 주 콘티를 불러오는 중이에요'); let conti = [];
  readOnce(churchPath() + '/conti/' + sundays).then(d => { conti = (d?.songs || []).filter(s => s.title?.trim()); const n = conti.filter(s => pickSheet(s, data.sheets || {})).length; contiInfo.textContent = conti.length ? '이번 주 콘티 ' + conti.length + '곡(악보 ' + n + '곡)을 찬양 순서에 넣어요' : '이번 주 콘티가 없어요. 찬양은 순서 장만 들어가요'; }).catch(() => { contiInfo.textContent = '콘티를 불러오지 못했어요'; });
  const go = h('button', { type: 'button', class: 'primary', onclick: async () => {
    go.disabled = true;
    try {
      const sv = W.services.find(s => s.id === svc.value), st = steps(), ps = passage.value.trim() ? await loadPassage(passage.value) : null;
      if (passage.value.trim() && !ps) { say('본문을 찾지 못했어요. 예: 막 4:1-9'); return; }
      const songs = await loadSheetImages(conti, data.sheets || {}), T = themeFor(deptId, mode);
      const slides = worshipSlides({ service: sv, steps: st, dept: deptId, churchName: data.name || '', date: day.value, time: time.value, pastor: pastor.checked, songs, passages: ps ? [ps] : [], sermon: { title: title.value.trim(), preacher: preacher.value.trim(), text: ps ? passageLabel(ps) : '' }, notices: notices.value.split('\n'), people: st.map((_, i) => people[sv.id + i] || ''), creeds: creeds.checked, creedText: { apostles: apostles.value, lords: lords.value } });
      await makeWorshipPpt(slides, T, worshipFileName(day.value, T.dept.name, sv.name));
      say('예배 PPT ' + slides.length + '장을 만들었어요');
    } catch { say('PPT를 만들지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'); } finally { go.disabled = false; }
  } }, 'PPT 내보내기');
  const field = (t, el) => h('label', {}, h('span', {}, t), el);
  bigDialog('예배 PPT 만들기', 'worship-ppt-dialog', h('div', { class: 'wp-form' }, field('부서', dept), field('예배 순서', svc), h('div', { class: 'wp-theme' }, h('span', {}, '바탕'), themeBox), h('div', { class: 'wp-row' }, field('날짜', day), field('시작 시각', time)),
    field('성경 본문', passage), h('div', { class: 'wp-row' }, field('설교 제목', title), field('설교자', preacher)), field('광고', notices), contiInfo,
    h('details', {}, h('summary', {}, '순서 담당자 이름'), peopleBox),
    h('label', { class: 'buy-intent' }, pastor, h('span', {}, '목사님이 축도해요(끄면 주기도문으로 마쳐요)')),
    h('label', { class: 'buy-intent' }, creeds, h('span', {}, '사도신경·주기도문 장 넣기')),
    h('details', {}, h('summary', {}, '교회 번역 문안 붙여 넣기'), apostles, lords),
    go));
  paintTheme(); paintPeople();
}
function worshipView() {
  view.append(h('div', { class: 'segments switcher' }, [['sermon', '주일설교'], ['qt', '큐티'], ['worship', '예배']].map(([id, t]) => h('button', { class: 'sub', 'aria-pressed': String(id === 'worship'), onclick: () => { if (id === 'worship') return; wordMode = id; show('word'); } }, t))));
  const top = h('div', { class: 'worship-top' }), detail = h('section', { class: 'worship-detail' }), printBox = h('section', { class: 'print-conti' });
  view.append(top, detail, printBox);
  let data = {}, group = '', sel = '';
  fill(top, h('p', { class: 'hint loading' }, '예배 순서를 불러오는 중이에요'));
  const draw = () => {
    const W = worshipData; if (!W) return;
    const rec = recommendService(thisWeek(todayIso(), { ...data.settings, customEvents: data.customEvents }, {}).upcoming, W.services);
    sel ||= rec?.service.id || 'sunday-main'; group ||= W.services.find(s => s.id === sel)?.group || '정기';
    const groups = [...new Set(W.services.map(s => s.group))];
    fill(top, rec && h('p', { class: 'special-note' }, h('span', {}, rec.event.name + (/[가-힣]$/.test(rec.event.name) && (rec.event.name.charCodeAt(rec.event.name.length - 1) - 0xAC00) % 28 ? '이' : '가') + ' 다가와요'), h('button', { type: 'button', class: 'text-button', onclick: () => { sel = rec.service.id; group = rec.service.group; draw(); } }, rec.service.name + ' 순서 보기')),
      h('div', { class: 'browse-chips' }, groups.map(g => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(g === group), onclick: () => { group = g; draw(); } }, g))),
      h('ul', { class: 'worship-list' }, W.services.filter(s => s.group === group).map(s => h('li', {}, h('button', { type: 'button', class: 'worship-pick', 'aria-pressed': String(s.id === sel), onclick: () => { sel = s.id; draw(); } }, h('strong', {}, s.name), h('small', { class: 'meta' }, s.when))))));
    const sv = W.services.find(s => s.id === sel), saved = data.worshipOrders || {}, steps = orderFor(sv, saved), edited = Array.isArray(saved[sel]) && saved[sel].length > 0;
    const put = list => save(churchPath(), { worshipOrders: { [sel]: list } });
    const name = h('input', { placeholder: '순서 이름(예: 특송)', 'aria-label': '추가할 순서 이름', maxLength: 40 }), who = h('input', { placeholder: '담당(예: 다 함께)', 'aria-label': '추가할 순서 담당', maxLength: 30 });
    fill(detail, h('h3', { class: 'worship-title' }, sv.name), h('p', { class: 'meta' }, sv.when + (edited ? ' · 우리 교회가 고친 순서' : '')), h('p', { class: 'meta worship-source' }, '출처: ' + W.source),
      h('ol', { class: 'worship-steps' }, steps.map((st, i) => h('li', {}, h('span', { class: 'ws-num' }, String(i + 1)), h('div', { class: 'ws-main' }, h('strong', {}, st.name), h('span', { class: 'ws-who' }, st.who, isPastorOnly(st) && h('span', { class: 'ws-tag' }, '목사')), st.note && h('small', { class: 'meta' }, st.note)),
        h('span', { class: 'ws-acts' }, h('button', { type: 'button', class: 'sub', 'aria-label': st.name + ' 위로', disabled: i === 0, onclick: () => { const b = [...steps]; [b[i - 1], b[i]] = [b[i], b[i - 1]]; put(b); } }, '▲'), h('button', { type: 'button', class: 'sub', 'aria-label': st.name + ' 아래로', disabled: i === steps.length - 1, onclick: () => { const b = [...steps]; [b[i + 1], b[i]] = [b[i], b[i + 1]]; put(b); } }, '▼'), h('button', { type: 'button', class: 'danger', 'aria-label': st.name + ' 빼기', onclick: () => put(steps.filter((_, j) => j !== i)) }, '빼기'))))),
      h('form', { class: 'ws-add', onsubmit: e => { e.preventDefault(); if (!name.value.trim()) return; put([...steps, { name: name.value.trim(), who: who.value.trim(), note: '' }]); } }, name, who, h('button', { class: 'sub' }, '+ 순서 추가')),
      edited && h('button', { type: 'button', class: 'text-button', onclick: () => { if (confirm('기본 순서로 되돌릴까요? 고친 순서는 지워져요')) save(churchPath(), { worshipOrders: { [sel]: null } }); } }, '기본값으로'),
      h('details', { class: 'lay-rules' }, h('summary', {}, '평신도가 인도할 때 주의 ' + W.layRules.length + '가지'), h('ul', {}, W.layRules.map(r => h('li', {}, r)))),
      h('div', { class: 'worship-actions' }, h('button', { type: 'button', class: 'sub', onclick: () => { fill(printBox, h('h1', {}, sv.name), h('p', {}, [data.name, nextSunday(todayIso())].filter(Boolean).join(' · ')), h('table', {}, h('thead', {}, h('tr', {}, ['순서', '이름', '담당', '메모'].map(t => h('th', {}, t)))), h('tbody', {}, steps.map((st, i) => h('tr', {}, [i + 1, st.name, st.who, st.note].map(t => h('td', {}, String(t || '')))))))); $('pagesize')?.remove(); document.head.append(h('style', { id: 'pagesize' }, '@page { size: A4 portrait; margin: 15mm }')); window.print(); } }, '순서지 인쇄'),
        h('button', { type: 'button', class: 'primary', onclick: () => openWorshipPpt(sel, data) }, '예배 PPT 만들기')));
  };
  loadWorship().then(draw).catch(() => fill(top, h('div', { class: 'empty-state' }, h('p', {}, '예배 순서를 불러오지 못했어요'), h('button', { type: 'button', class: 'sub', onclick: () => show('worship') }, '다시 시도'))));
  watch(churchPath(), d => { data = d || {}; draw(); });
}
// 자료실: 부서별 빈 예배 PPT 양식(앱에서 빈 값으로 만들어 받기)
function pptTemplatesSection() {
  const box = h('section', { class: 'doc-list ppt-templates' }, h('h3', {}, '예배 PPT 양식 ' + DEPTS.length + '개'), h('p', { class: 'hint' }, '순서 장 → 내용 장 흐름의 빈 양식이에요. 받은 뒤 이름·곡·본문을 채워 쓰세요.'),
    h('ul', { class: 'buy-list' }, DEPTS.map(d => h('li', { class: 'ppt-template' }, h('strong', {}, d.name), h('small', { class: 'meta' }, (d.base === 'dark' ? '어두운 바탕' : '밝은 바탕') + (d.plus ? ' · 글자 크게' : '')), h('button', { type: 'button', class: 'sub', onclick: async e => { const b = e.currentTarget; b.disabled = true; try { const W = await loadWorship(), sv = W.services.find(s => s.id === d.service), T = themeFor(d.id); await makeWorshipPpt(worshipSlides({ service: sv, steps: orderFor(sv), dept: d.id, blank: true }), T, d.name + ' 예배 PPT 양식.pptx'); } catch { say('양식을 만들지 못했어요. 인터넷 연결을 확인해 주세요.'); } finally { b.disabled = false; } } }, '빈 양식 받기')))));
  return box;
}

// ---------- 시작 ----------
// 탭바 그림(선 아이콘). 글자는 그대로 두어 40~60대도 뜻을 바로 알게 한다
const GLYPHS = { home: 'M4 11 12 4l8 7v9h-5v-6H9v6H4z', schedule: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4', conti: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z', word: 'M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2zM12 6v14', more: 'M5 12h.01M12 12h.01M19 12h.01', worship: 'M12 3v18M7 8h10M5 21h14', docs: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z', equipment: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3M8 21h8', set: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4' };
function glyph(id) {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), path = document.createElementNS(ns, 'path');
  for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: 24, height: 24, fill: 'none', stroke: 'currentColor', 'stroke-width': id === 'more' ? 3 : 1.75, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
  path.setAttribute('d', GLYPHS[id]); svg.append(path); return svg;
}
nav.append(...TABS.map(([id, label]) => h('button', { type: 'button', k: id, onclick: () => show(id) }, glyph(id), h('span', {}, label))));
side.append(h('p',{id:'church-title'},'교회 사역앱'),...MENUS.map(([id,t])=>h('button',{k:id,onclick:()=>show(id)},glyph(id),h('span',{},t))));
defaultSongs = await fetch('./songs-default.json').then(r => { if (!r.ok) throw new Error('곡 목록'); return r.json(); }).catch(() => { say('기본 곡을 불러오지 못했어요. 새로고침해 주세요.'); return []; });
store = await openStore().catch(() => null);
if (!store) msg.textContent = '저장소에 연결하지 못했어요. 새로고침해 주세요.';
else {
  $('band').hidden = store.mode !== 'local'; $('band').textContent='체험 모드 · 이 기기에 저장';
  await store.auth?.ready; // 로그인 상태를 먼저 확인(구글 로그인한 기기면 내 교회로 바로)
  // 페이지 이동 방식으로 로그인하고 돌아온 경우
  let back = null; try { back = store.auth && await store.auth.redirectResult(); } catch (e) { say(loginErrorText(e?.code)); }
  if (back) await afterLogin(true);
  else if (location.hash.startsWith('#c=')) await openInvite();
  else if (localStorage.getItem('church:code')) await enter(localStorage.getItem('church:code'));
  else { const mine = await myChurches(); if (mine.length) await enter(mine[0].code); else showEntry(); }
}

async function openInvite() {
  const c=location.hash.slice(3);
  showEntry();
  if(!validCode(c)){showEntry('초대 링크가 잘못됐어요');return;}
  try {const d=await readOnce('churches/'+c);if(d)await enter(c,d);else showEntry('초대 링크가 잘못됐어요');}
  catch {showEntry('불러오지 못했어요. 인터넷 연결을 확인해 주세요.');}
}
addEventListener('hashchange',()=>{if(store && location.hash.startsWith('#c='))openInvite();});
