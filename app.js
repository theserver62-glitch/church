import { occurrences, tasksAround, thisWeek, occursOn } from './custom-events.js?v=202610250312';
import { TEMPLATES } from './templates.js?v=202610250312';
import { isAdmin, hasAdmins, canEditSettings, adminList, requestList, requestPatch, cancelRequestPatch, claimFirstPatch, approvePatch, rejectPatch, removeAdminPatch, isPermissionError } from './admins.js?v=202610250312';
import { elementsFor, sundayName, callRec, nameDates, orderFor, isPastorOnly, recommendService, DEPTS, themeFor, worshipSlides, worshipFileName } from './worship.js?v=202610250312';
// 교회 사역앱 화면. 사용자 글은 textContent/value로만 넣는다(innerHTML 금지).
import { weekDays, dayItems, monthGrid, prepSpans, prepWeek, calendarCell, shortTask, weekShare, contiShare, parseRef, refRange, overlaps, donePatch, skipPatch, handled, nextDocTask, scriptureSlides, scriptureFileName, passageLabel } from './home.js?v=202610250312';
import { deptsOf, toggleDept, sizeOf, sizeTips, formatCodeInput, validCode, nameKey, recentChurches, inviteText, mineList, isKakaoInApp, kakaoExternalUrl, isInAppBrowser, loginErrorText, chromeUrl, safariUrl } from './entry.js?v=202610250312';
import { openStore, newChurchCode, NOW } from './store.js?v=202610250312';
import { PHASES, phaseEnds, currentPhase, evKey, seasonTasks, nowTasks, projectState, guideMap, guideFor, reportLocked } from './season.js?v=202610250312';
import { todayIso, nextSunday, addDays, parse, monthItems, qtIndex } from './calendar.js?v=202610250312';
import { EVENTS, RETREAT_FORMS, ABOUT } from './events.js?v=202610250312';
import { docs } from './docs.js?v=202610250312';
import { onboardSteps, onbGet, onbSet } from './onboard.js?v=202610250312';
import { tourScreen, tourAgain, resetTours } from './tour.js?v=202610250312';
import { introSections, sourceDomains, deepParts } from './bookintro.js?v=202610250312';
import { linksFor, byKind, resourcesFor } from './links.js?v=202610250312';
import { equipment, equipmentId, equipmentRows, productsFor, productLink, compareLink, buyNotice } from './equipment.js?v=202610250312';
import { label, parseCsv, mergeLibrary, filterSongs, parseBulk, nameFromFile, sheetId, sheetFirst, pickSheet, contiSlides, fitImage, groupFor, fromKakao, splitLinks, viewerLink, parseViewer, contiTabs, svcShort, bundleShare, viewerPages, hymnLinks, filterHymns, contiSongsOf, contiPatchOf, contiServices, newContiSongs, browseSongs, sheetKeys, emptyHint, filterSpecials, defaultSeason, specialEmpty, cleanBy, seller, youtubeLink, parseKakaoConti } from './songbook.js?v=202610250312';
import { parseBackup, backupSundays, previousSundays, snapshotOf, snapWeeks, replacePatch, churchPart, contiPart, snapSummary, changeLabel, KEY_LABEL } from './backup.js?v=202610250312';

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
// 고치기는 로그인한 사람만(firestore.rules). 로그인 안 했으면 조용히 버리지 않고 로그인 안내, 저장되면 변경 기록 한 줄.
// 로그인 전에는 서버에 보내지도 않는다 — 보내면 거부된 뒤 화면이 되돌아가며 입력 칸이 다시 저장을 거는 반복이 생긴다.
// 안내는 한 박자 늦게 띄워서, 부른 쪽이 바로 띄우는 '넣었어요' 같은 문구를 덮어쓴다
const save = (path, obj, log = true) => store.auth && !store.auth.user() ? Promise.resolve().then(() => (needLogin(), false))
  : store.update(path, obj).then(() => { if (log) logChange(path, obj); return true; }).catch(e => { if (isPermissionError(e) && store.auth && !store.auth.user()) needLogin(); else say(isPermissionError(e) ? '이 설정은 관리자만 바꿀 수 있어요' : '저장하지 못했어요. 인터넷 연결을 확인해 주세요.'); return false; });
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
// 로그인 버튼 하나: 카톡·앱 안 브라우저는 구글이 로그인을 막으므로 바깥 브라우저로 열게 한다(loginBox와 같은 판단)
function loginAction() {
  const ua = navigator.userAgent;
  if (isKakaoInApp(ua)) return h('button', {type:'button', class:'sub', onclick: () => { location.href = kakaoExternalUrl(location.href); }}, '기본 브라우저로 열기');
  if (isInAppBrowser(ua)) return h('button', {type:'button', class:'sub', onclick: () => { location.href = chromeUrl(location.href, ua); }}, '크롬으로 열기');
  return h('button', {type:'button', class:'sub', onclick: googleLogin}, '로그인');
}
const needLogin = () => { say('고치려면 구글 로그인이 필요해요'); msg.append(loginAction()); };
// 맨 위 얇은 띠: 체험 모드면 그 안내(부팅 때 한 번), 교회 화면인데 로그인 안 했으면 "고치려면 로그인"
function paintBand() {
  const b = $('band');
  if (store?.mode !== 'shared') return;
  b.hidden = !!store.auth.user() || nav.hidden;
  if (!b.hidden) fill(b, h('span', {}, '고치려면 구글 로그인이 필요해요'), loginAction());
}
const userName = u => (u.displayName || '이름 없음').slice(0, 40);
const utcToday = () => new Date().toISOString().slice(0, 10);
// 변경 기록: 교회 문서·콘티를 바꾸면 "무엇을" 한 줄 남긴다. 같은 사람이 같은 항목을 1분 안에 이어 고치면 첫 줄 하나로 친다(기록은 고칠 수 없어서 합치지 않고 건너뜀)
let lastLog = { key: '', t: 0 };
function logChange(path, patch, what = changeLabel(path, patch)) {
  const u = store.auth?.user();
  if (store.mode !== 'shared' || !u || !what) return;
  const key = u.uid + '|' + what, now = Date.now(), same = lastLog.key === key && now - lastLog.t < 60000;
  lastLog = { key, t: now };
  if (!same) store.update(path.split('/').slice(0, 2).join('/') + '/log/' + now.toString(36) + Math.random().toString(36).slice(2, 8), { what, who: userName(u), uid: u.uid, at: NOW }).catch(() => {});
}
// 매일 자동 스냅샷: 그날(UTC) 처음 들어온 로그인 사용자가 snap/{날짜}를 만든다. 한 번 만들면 누구도 고치거나 지울 수 없다(firestore.rules).
// 관리자가 아니어도 "없는 날짜인지"는 읽힌다 — 이미 있으면 읽기가 막혀(권한 오류) 있다고 본다. 'made' | 'exists' | 'skip' | 'fail'
let snapTried = '';
async function dailySnapshot(force = false) {
  const u = store.auth?.user(), code = localStorage.getItem('church:code'), day = utcToday();
  if (store.mode !== 'shared' || !u || !code) return 'skip';
  const base = 'churches/' + code;
  if (!force && snapTried === base + day) return 'skip';
  snapTried = base + day;
  try { if (await readOnce(base + '/snap/' + day)) return 'exists'; } catch (e) { return isPermissionError(e) ? 'exists' : 'fail'; }
  try {
    const today = todayIso();
    const [church, weeks] = await Promise.all([readOnce(base), Promise.all(backupSundays(today).map(async d => [d, await readOnce(base + '/conti/' + d)]))]);
    const snap = snapshotOf(church, weeks, today);
    if (!snap) return 'fail';
    await store.update(base + '/snap/' + day, { ...snap, by: u.uid, who: userName(u), at: NOW });
    return 'made';
  } catch { return 'fail'; }
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
  nav.hidden = true; side.hidden = true; paintBand();
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
      let u=store.auth?.user?.();
      if(store.mode==='shared'&&store.auth&&!u){try{await store.auth.signIn();u=store.auth.user();}catch(e){err.textContent=loginErrorText(e?.code);return;}if(!u){err.textContent='교회를 만들려면 구글 로그인이 필요해요(만든 사람이 설정을 바꾸는 관리자가 돼요).';return;}}
      const c=newChurchCode();
      await store.update('churches/'+c,{name:n,createdAt:new Date().toISOString(),...(u&&claimFirstPatch(u,todayIso()))});
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
  try {const d=await readOnce('churches/'+c);if(d){await copyText(inviteText(d.name,c,location.href));onbSet('invite');}}
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
  dailySnapshot();
}

// ---------- 탭 ----------
const MENUS = [['home','홈'],['events','교회 일정'],['schedule','절기·행사'],['seasons','절기'],['ourEvents','행사'],['conti','찬양 콘티'],['ccm','CCM'],['special','특송'],['hymn','찬송가'],['word','말씀'],['sermon','주일설교'],['qt','큐티'],['worship','예배'],['worshipOrder','순서'],['worshipGuide','안내'],['docs','자료실'],['equipment','장비'],['set','설정']];
// 하위 메뉴 → 부모. 부모 메뉴를 누르면 첫 하위 화면으로 간다(한 메뉴 = 한 화면)
const PARENT = {events:'home',seasons:'schedule',ourEvents:'schedule',ccm:'conti',special:'conti',hymn:'conti',sermon:'word',qt:'word',worshipOrder:'worship',worshipGuide:'worship'};
const FIRST = {schedule:()=>'seasons',conti:()=>'ccm',word:()=>wordMode==='qt'?'qt':'sermon',worship:()=>'worshipOrder'};
const TABS = [['home','홈'],['schedule','절기·행사'],['conti','콘티'],['more','더보기']];
const TOOLS = new Set(['word','sermon','qt','worship','worshipOrder','worshipGuide','docs','equipment','set']); // 사이드바 '도구' 묶음 · 폰은 더보기 안
const side = h('aside', { id:'sidebar', hidden:true }); document.body.prepend(side);
const VIEWS = { worshipOrder:()=>{view.append(worshipSeg('worshipOrder'));worshipView();}, worshipGuide:()=>{view.append(worshipSeg('worshipGuide'));worshipGuideView();}, seasons:()=>scheduleView('season'), ourEvents:()=>scheduleView('custom'), ccm:()=>contiView('book'), special:()=>contiView('special'), hymn:()=>contiView('hymn'), sermon:()=>{wordMode='sermon';wordView();}, qt:()=>{wordMode='qt';wordView();}, events:homeView, project:projectView, worship:worshipView, home:nowView, schedule:scheduleView, conti:contiView, word:wordView, docs:docsView, equipment:equipmentView, set:setView, more:moreView };
const GUIDES = {home:'밀린 일과 앞으로 2주 안에 할 일을 보여 줘요',schedule:'절기와 행사에 맞춰 준비할 일을 보여 줘요',conti:'이번 주일 찬양을 순서대로 준비해요',word:'주일설교 본문을 찾고 매일 말씀을 묵상해요',docs:'우리 교회에 필요한 준비 양식을 내려받아요',equipment:'장비의 수량과 상태를 함께 확인해요',set:'우리 교회에 맞게 설정해요',more:'자료실과 장비, 설정을 열어요'};
const SCREEN_HELP = {"events":["◀ ▶로 기간을 옮기고, '월 보기'에서 일·주·월·년을 골라요","색 칸은 행사일, ○는 준비 시작일이에요","+ 행사 추가로 수련회·바자회·성경학교를 넣어요"],"worship":["[순서]: 예배를 고르면 순서·담당·메모가 나오고, 이름 옆 ⓘ로 그 순서 안내를 봐요","[순서 고치기]로 우리 교회 순서로 바꾸고, 순서지 인쇄·예배 PPT로 마무리해요","[안내]: 예배의 흐름, 예배로 부름 본문(이번 주 추천), 순서 사전, 평신도 인도 주의를 봐요"],"home":["할 일을 누르면 준비하는 방법이 옆(폰은 아래)에 나와요","끝냈으면 [다 했어요]나 왼쪽 네모를 눌러요","달력은 '달력으로 보기'나 [교회 일정]에서, 이번 주일 찬양·오늘의 말씀은 오른쪽 아래 한 줄에서 열어요"],"schedule":["절기마다 준비 구간 6칸과 진행률이 보여요","누르면 구간별 할 일과 준비 방법이 나와요","끝난 절기는 기록(3줄 정리·한 일·서류)으로 남아요"],"conti":["CCM 탭에서 키·주제·분위기로 곡을 찾아 [+ 담기]를 눌러요. 특송·찬송가 탭도 같아요","[순서 편집]으로 순서를 바꾸고, [⋯]에서 메모를 달아요","[공유·출력]에서 카톡·인쇄·PPT로 마무리해요"],"word":["주일설교: 본문(예: 막 4:1-9)을 검색하면 본문과 6단계 해설이 나와요","큐티: 매일 하나씩 순서대로 나와요","폰에서는 아래 [더보기] › 말씀에서 열어요"],"docs":["맨 위 '부서'를 눌러 우리 부서 자료를 골라요","서류 이름을 누르면 설명과 워드·한글 받기가 나와요","[커리큘럼·교재]·[나들이·수련회]·[링크] 탭에서 비교표와 추천 사이트를 봐요"],"equipment":["기본 장비 목록이 미리 있어요. 묶음 제목을 눌러 펼쳐요","−/+로 수량을 바꾸고, 문제가 있으면 [점검 필요]·[고장]을 눌러 메모해요","고장·점검이 있으면 맨 위 [확인하기]로 모아 봐요"],"set":["교회 이름·규모·부서를 바꿔요","초대 링크를 복사해 리더들에게 보내요","구글로 로그인하면 다른 기기에서도 바로 들어와요"],"seasons":["절기마다 준비 구간 6칸과 진행률이 보여요","누르면 구간별 할 일과 준비 방법이 나와요","끝난 절기는 기록(3줄 정리·한 일·서류)으로 남아요"],"ourEvents":["수련회·바자회처럼 우리 교회가 추가한 행사만 모여요","+ 행사 추가로 새 행사와 준비할 일을 넣어요","행사를 누르면 할 일·날짜 바꾸기·삭제가 있어요"],"sermon":["본문(예: 막 4:1-9)을 고르거나 검색하면 본문과 6단계 해설이 나와요","PPT로 내보내기에서 본문을 예배 화면용 PPT로 받아요","아래에 묵상을 적으면 리더들과 나눠져요"],"qt":["매일 하나씩 순서대로 큐티 본문과 해설이 나와요","날짜를 바꾸면 그날 큐티를 볼 수 있어요","아래에 묵상을 적으면 리더들과 나눠져요"]};
// 화면 도움말: 제목 바로 옆 작은 원형 ? 버튼. 누르면 그 아래 말풍선(폰은 아래에서 올라오는 작은 시트). 본문을 밀지 않고, 바깥·Esc로 닫힘
function screenHeading(id, title) {
 const key='church:guide:'+id;
 const card=h('section',{class:'usage-guide guide-pop',id:'guide-'+id,role:'dialog','aria-label':title+' 도움말',hidden:true},h('strong',{},'이 화면 사용법'),h('ol',{},SCREEN_HELP[id].map(line=>h('li',{},line))));
 const doc=globalThis.document;
 const outside=e=>{if(!card.contains(e.target)&&e.target!==button&&!button.contains?.(e.target))close();};
 const esc=e=>{if(e.key==='Escape')close();};
 const close=()=>{card.hidden=true;localStorage.setItem(key,'closed');button.setAttribute('aria-expanded','false');doc?.removeEventListener('pointerdown',outside,true);doc?.removeEventListener('keydown',esc);};
 const open=()=>{card.hidden=false;localStorage.setItem(key,'open');button.setAttribute('aria-expanded','true');
  const r=button.getBoundingClientRect?.(),wide=globalThis.matchMedia?.('(min-width: 640px)').matches;
  card.classList?.toggle('as-sheet',!wide);
  if(r&&wide){const left=Math.max(8,Math.min(r.left+r.width/2-28,innerWidth-368));card.style.left=left+'px';card.style.top=(r.bottom+10)+'px';card.style.setProperty('--arrow-x',(r.left+r.width/2-left)+'px');}
  doc?.addEventListener('pointerdown',outside,true);doc?.addEventListener('keydown',esc);};
 const button=h('button',{type:'button',class:'guide-toggle','aria-label':'이 화면 도움말','aria-controls':card.id,'aria-expanded':'false',onclick:()=>card.hidden?open():close()},'?');
 card.append(h('button',{type:'button',class:'sub',onclick:()=>{close();for(const k of Object.keys(SCREEN_HELP))localStorage.setItem('church:guide:'+k,'closed');button.focus?.();}},'알겠어요'));
 card.append(h('button',{type:'button',class:'text-button tour-again',onclick:()=>{close();if(!tourAgain())say('이 화면은 따로 안내할 게 없어요');}},'사용법 다시 보기'));
 return [h('div',{class:'row screen-heading'},h('h2',{},title),button),card];
}
// 접히는 카드: 머리줄(제목 · 한 줄 요약, 56px). 펼침 상태는 church:open:<id>에 기억한다
function foldCard(id, open = false, cls = '') {
 const saved = localStorage.getItem('church:open:' + id);
 return h('details', { class: 'card fold fold-' + id + ' ' + cls, open: saved ? saved === '1' : open, ontoggle: e => localStorage.setItem('church:open:' + id, e.target.open ? '1' : '0') });
}
function foldHead(title, note = '', tone = '') { return h('summary', {}, h('span', { class: 'fold-title' }, title), note && h('span', { class: 'fold-note ' + tone }, note)); }
// 지금 위치: 사이드바는 그 메뉴 하나만 aria-current(하위 화면이면 부모는 옅은 표시), 폰 아래 탭은 부모
function markNav(tab) {
 const par=PARENT[tab],navKey=TOOLS.has(tab)?'more':par||tab;
 for(const b of side.querySelectorAll('button')){b.removeAttribute('aria-current');b.classList.toggle('parent-current',b.dataset.k===par);if(b.dataset.k===tab)b.setAttribute('aria-current','page');}
 for(const b of nav.children){b.removeAttribute('aria-current');if(b.dataset.k===navKey)b.setAttribute('aria-current','page');}
}
function show(tab) {
 if(FIRST[tab])tab=FIRST[tab]();
 reset(); side.hidden=false; nav.hidden=false; view.dataset.screen=PARENT[tab]&&PARENT[tab]!=='home'?PARENT[tab]:tab;
 markNav(tab);
 const helpId=SCREEN_HELP[tab]?tab:PARENT[tab]||tab;
 if(tab!=='home'&&tab!=='project')view.append(...(SCREEN_HELP[helpId]?screenHeading(helpId,MENUS.find(m=>m[0]===helpId)[1]):[h('h2',{},'더보기'),h('p',{class:'hint screen-guide'},GUIDES[tab])]));
 VIEWS[tab]();
 watch(churchPath(),d=>{ $('church-title').textContent=d?.name||'교회 사역앱'; });
 for(const title of [...view.querySelectorAll('h2')].slice(1)) title.remove();
 [...view.children].forEach((el,i)=>el.style.animationDelay=(i*40)+'ms');
 scrollTo(0,0); paintBand(); tourScreen(tab);
}
function toggleTask(key, checked) {
 let role=localStorage.getItem('church:role')?.trim();
 if(checked&&!role){role=prompt('내 역할 이름(예: 찬양리더)')?.trim()||'리더';localStorage.setItem('church:role',role);}
 save(churchPath(),donePatch(key,checked,role,todayIso())).then(ok=>{if(ok&&checked){say('완료했어요');msg.append(h('button',{onclick:()=>{msg.textContent='';save(churchPath(),donePatch(key,false));}},'되돌리기'));}});
}
// 이번엔 건너뛰기: 그 행사에서 이 할 일을 안 해도 될 때. 완료와 따로(skipped) 저장
function skipTask(key, on) {
 const role=localStorage.getItem('church:role')?.trim()||'리더';
 save(churchPath(),skipPatch(key,on,role,todayIso())).then(ok=>{if(ok&&on){say('이번엔 건너뛰었어요');msg.append(h('button',{onclick:()=>{msg.textContent='';save(churchPath(),skipPatch(key,false));}},'되돌리기'));}});
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
// 할 일 줄: 왼쪽 체크 동그라미(누르면 ✓·흐려짐·되돌리기 알림), 오른쪽 작은 [기한 바꾸기][이번엔 건너뛰기]. 지난 것은 줄 안에서만 "10/18까지였어요"
const taskList = (ts, done, compact = false, skipped = {}) => h('ul', { class: 'tasks' }, ts.map(t => {
  const isDone = !!done[t.key], isSkip = !isDone && !!skipped[t.key], late = t.due < todayIso() && !isDone && !isSkip;
  return h('li', { class: (isDone ? 'is-done' : '') + (isSkip ? ' is-skipped' : '') },
    h('label', { class: 'task-check' }, h('input', { type: 'checkbox', class: 'check-circle', checked: isDone, k: 'c:' + t.key, 'aria-label': t.text + ' 완료', onchange: e => toggleTask(t.key, e.target.checked) }),
      h('span', {}, h('span', { class: 'text' }, t.text), h('small', { class: late ? 'late-soft' : '' }, [late ? md(t.due) + '까지였어요' : md(t.due) + ' 기한', t.event, t.who].filter(Boolean).join(' · ')), isDone && done[t.key]?.by ? h('small', {}, done[t.key].by + ' · ' + md(done[t.key].at) + ' 완료') : null, isSkip ? h('small', { class: 'skip-tag' }, '이번엔 건너뜀') : null)),
    docActions(t.doc),
    !compact && h('div', { class: 'task-more' }, isSkip ? h('button', { type: 'button', class: 'text-button', onclick: () => skipTask(t.key, false) }, '건너뛰기 되돌리기') : !isDone && [h('button', { type: 'button', class: 'text-button', onclick: () => changeTaskDue(t) }, '기한 바꾸기'), h('button', { type: 'button', class: 'text-button', onclick: () => skipTask(t.key, true) }, '이번엔 건너뛰기')]));
}));

const retreatForms = forms => h('div', {}, h('h4', {}, '수련회 양식'), RETREAT_FORMS.map(([name, cols, keep]) => keep
  ? h('label', {}, h('span', {}, name), h('textarea', { rows: 4, placeholder: cols, value: forms[name] || '', k: 'f:' + name,
    oninput: e => { const v = e.target.value; later('f:' + name, () => save(churchPath(), { retreatForms: { [name]: v } })); } }))
  : h('div', { class: 'note' }, h('strong', {}, name), h('p', {}, cols), h('p', {}, '명단은 개인정보라 앱에 적지 말고 교회가 따로 보관하세요'))));

const sheetLink = song => typeof song?.sheet === 'string' && song.sheet.startsWith('https://')
  ? h('a', { class: 'sheet-link', 'aria-label':song.title+' 악보 열기', title:'악보 열기', href: song.sheet, target: '_blank', rel: 'noopener' }, icon()) : null;

function contiView(startPick = 'book') {
  let path, cur = [], stop = () => {}, book = {}, churchName = '';
  const printBox = h('section', { class: 'print-conti' });
  const paper = h('select', { 'aria-label': '인쇄 용지' }, ['A4', 'A3'].map(v => h('option', { value: v }, v)));
  const drawPrint = () => fill(printBox, h('h1', {}, '주일 찬양 콘티 · ' + date.value.replace(/(\d{4})-(\d{2})-(\d{2})/, (_, y, m, d) => y + '년 ' + +m + '월 ' + +d + '일')),
    h('table', {}, h('thead', {}, h('tr', {}, ['순서', '곡명', '키', '메모'].map(t => h('th', {}, t)))), h('tbody', {}, cur.map((s, i) => h('tr', {}, [i + 1, s.title, s.key, s.memo].map(t => h('td', {}, t || '')))))));
  const print = () => { flush(); drawPrint(); printBox.dataset.paper = paper.value; $('pagesize')?.remove(); document.head.append(h('style', { id: 'pagesize' }, '@page { size: ' + paper.value + ' portrait; margin: 15mm }')); window.print(); };
  const withCover = h('input', { type: 'checkbox' });
  const ppt = h('button', { type: 'button', class:'menu-item', onclick: async () => {
    closeMenus(); flush(); const songs = cur.map(s => ({ ...s })).filter(s => s.title.trim()), day = date.value, name = churchName; ppt.disabled = true;
    const size = data => new Promise(ok => { const im = new Image(); im.onload = () => ok({ w: im.naturalWidth || 1, h: im.naturalHeight || 1 }); im.onerror = () => ok(null); im.src = data; });
    const got = await Promise.allSettled(songs.map(async s => { const id = pickSheet(s, sheets); if (!id) return null; const d = await readOnce(churchPath() + '/sheets/' + id); if (!String(d?.img).startsWith('data:image/')) return null; const wh = await size(d.img); return wh && [s.title + '|' + (s.key || ''), { data: d.img, ...wh }]; }));
    const images = Object.fromEntries(got.map(r => r.status === 'fulfilled' && r.value).filter(Boolean)), missing = songs.filter(s => !images[s.title + '|' + (s.key || '')]);
    try { await makePpt(name, day, songs, images, withCover.checked); say(missing.length ? '악보 없는 곡 ' + missing.length + '개: ' + missing.map(s => s.title).join(', ') + ' (설정 > 악보 사진 올리기)' : '악보 ' + songs.length + '곡을 넣었어요'); } catch { say('PPT 도구를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.'); } finally { ppt.disabled = !cur.some(s=>s.title.trim()); }
  } }, '악보 PPT');
  const box = h('div'), list = h('datalist', { id: 'songbook' }), groups = h('div');
  let sheets={}; // 교회 문서의 sheets: {id: {title, key}}
  // 악보 보기: 원하는 키(필터의 키 → 곡의 키) 악보부터, 창 안에서 다른 키로 바꿀 수 있다
  const sheetFor=(title,key)=>{const all=Object.entries(sheets).filter(([,v])=>v?.title===title);return all.find(([,v])=>(v.key||'')===(key||''))||all[0];};
  const sheetButton=(title,key)=>{const hit=Object.entries(sheets).find(([,v])=>v?.title===title&&(v.key||'')===(key||''));return hit?h('button',{type:'button',class:'sub sheet-button','aria-label':title+' 악보 보기',onclick:()=>showSheet(title,hit[0],sheets,{isFav,toggleFav})},glyph('conti'),'악보'):null;};
  let onlySheets=null, churchSongs={}, favorites={}, onlyFav=false, sort='name';
  const isFav=x=>favorites[label(x)]===true;
  const toggleFav=x=>{const on=!isFav(x);favorites={...favorites,[label(x)]:on};save(churchPath(),{favorites:{[label(x)]:on}});say(on?label(x)+' 즐겨찾기에 넣었어요':label(x)+' 즐겨찾기에서 뺐어요');draw();drawBrowse();};
  const useSheets=()=>onlySheets===null?Object.keys(sheets).length>0:onlySheets;
  const filters={key:'',theme:'',mood:''}; let count=20, groupBy='', openGroups=new Set(); // 묶어 보기(악보 있는 곡만일 때)
  const options={key:['C','D','E','F','G','A','B','Ab','Bb','Eb','단조'],theme:['경배와 찬양','은혜와 사랑','회개와 고백','기도와 간구','축복과 교제','선교와 승리'],mood:['신나게','보통','잔잔하게']};
  const NAMES={key:'키',theme:'주제',mood:'빠르기'};
  const wide=()=>!!globalThis.matchMedia?.('(min-width: 1024px)').matches;
  const chips=h('div',{class:'browse-chips'}), tags=h('div',{class:'browse-tags'}), countLine=h('div',{class:'browse-count'});
  const query=()=>({sheets,churchBook:churchSongs,favorites,onlySheets:useSheets(),onlyFav,...filters,q:search.value,sort});
  const nFilters=()=>['key','theme'].filter(f=>filters[f]).length; // 빠르기(mood)는 칩으로 따로
  const search=h('input',{type:'search',k:'song-search',placeholder:'🔍 곡명으로 찾기','aria-label':'곡명으로 찾기',oninput:()=>{count=20;drawBrowse();}});
  const resetAll=()=>{filters.key=filters.theme=filters.mood='';onlyFav=false;search.value='';count=20;drawBrowse();};
  const clear=action=>{if(action==='reset')return resetAll();if(action==='fav')onlyFav=false;else if(action==='sheets')onlySheets=false;else filters[action]='';count=20;drawBrowse();};
  // 키·주제·분위기는 [필터]를 누르면 아래에서 올라오는 판 하나에(컴퓨터는 오른쪽 위). 항목마다 하나만, 항목끼리는 AND
  const openFilters=()=>{
    const body=h('div',{class:'filter-body'}),go=h('button',{type:'button',class:'primary'});
    const paint=()=>{fill(body,Object.entries(options).filter(([f])=>f!=='mood').map(([f,vals])=>h('section',{class:'filter-group'},h('h4',{},NAMES[f],f==='mood'&&h('small',{class:'meta'},' · AI 추정'),f==='theme'&&h('small',{class:'meta'},' · 시와 찬미 분류')),h('div',{class:'row'},vals.map(v=>h('button',{type:'button',class:'sub chip','aria-pressed':String(filters[f]===v),onclick:()=>{filters[f]=filters[f]===v?'':v;count=20;paint();drawBrowse();}},v))))));go.textContent='결과 '+browseSongs(Object.values(book),query()).songs.length+'곡 보기';};
    const dlg=bigDialog('필터','filter-dialog',body,h('div',{class:'filter-foot'},h('button',{type:'button',class:'sub',onclick:()=>{filters.key=filters.theme=filters.mood='';paint();drawBrowse();}},'초기화'),go));
    go.onclick=()=>dlg.close();paint();
  };
  const drawChips=()=>fill(chips,
    // 빠르기: 곡 데이터의 분위기(신나게/잔잔하게, AI 추정)를 빠른/느린 찬양으로 바로 거른다
    [['신나게','빠른 찬양'],['잔잔하게','느린 찬양']].map(([v,t])=>h('button',{type:'button',class:'chip','aria-pressed':String(filters.mood===v),onclick:()=>{filters.mood=filters.mood===v?'':v;count=20;drawBrowse();}},t)),
    Object.keys(sheets).length>0&&h('button',{type:'button',class:'chip','aria-pressed':String(useSheets()),onclick:()=>{onlySheets=!useSheets();count=20;drawBrowse();}},'악보 있는 곡'),
    h('button',{type:'button',class:'chip','aria-pressed':String(onlyFav),onclick:()=>{onlyFav=!onlyFav;count=20;drawBrowse();}},'즐겨찾기'),
    h('button',{type:'button',class:'chip','aria-pressed':String(nFilters()>0),'aria-haspopup':'dialog',onclick:openFilters},'필터'+(nFilters()?' '+nFilters():'')));
  const drawBrowse=()=>{
    drawChips();
    fill(tags,nFilters()>0&&[...['key','theme'].filter(f=>filters[f]).map(f=>h('button',{type:'button',class:'tag','aria-label':NAMES[f]+' '+filters[f]+' 조건 빼기',onclick:()=>{filters[f]='';drawBrowse();}},NAMES[f]+' '+filters[f]+' ×')),h('button',{type:'button',class:'text-button',onclick:()=>{filters.key=filters.theme=filters.mood='';drawBrowse();}},'조건 초기화')]);
    const {songs,reason}=browseSongs(Object.values(book),query());
    fill(countLine,h('span',{'aria-live':'polite'},songs.length+'곡'));
    const q=search.value.trim(),typed=q&&!songs.some(x=>x.title===q)&&h('button',{type:'button',class:'sub add-title',onclick:()=>{setSongs([...cur,{title:q,key:'',memo:''}]);say(q+' 추가했어요');search.value='';drawBrowse();}},"+ '"+q+"' 곡으로 추가");
    const hint=!songs.length&&emptyHint({reason,onlyFav,onlySheets:useSheets(),...filters});
    const added=s=>cur.some(c=>c.title===s.title&&(c.key||'')===(s.key||''));
    // 곡 한 줄: 1줄 곡명(즐겨찾기면 작은 ★), 2줄 "악보 D·E · 시와찬미 47", 오른쪽 [악보 보기][+ 추가]
    const songRow=(s,gk)=>{const keys=sheetKeys(s.title,sheets),want=gk||filters.key,hit=keys.length&&sheetFor(s.title,want&&keys.includes(want)?want:s.key),link=!hit&&typeof s.sheet==='string'&&s.sheet.startsWith('https://')&&s.sheet;
      return h('li',{},h('div',{class:'song-info'},h('span',{class:'song-name'},isFav(s)&&h('span',{class:'fav-mark','aria-label':'즐겨찾기'},'★ '),s.title),h('small',{class:'meta'},[keys.length?'악보 '+keys.map(k=>k||'키 없음').join('·'):s.key&&s.key+'키',s.note].filter(Boolean).join(' · '))),
       hit?h('button',{type:'button',class:'sub sheet-button','aria-label':s.title+' 악보 보기',onclick:()=>showSheet(s.title,hit[0],sheets,{isFav,toggleFav})},'악보 보기'):link?h('a',{class:'sub-link',href:link,target:'_blank',rel:'noopener'},'악보 보기'):null,
       added(s)?h('button',{type:'button',class:'sub added',disabled:true},'담았음 ✓'):h('button',{type:'button',class:'sub add-button','aria-label':s.title+' 콘티에 담기',onclick:()=>{const at=cur.length;flashAt=at;setTimeout(()=>{flashAt=-1;},1600);setSongs([...cur,{title:s.title,key:s.key,memo:''}]);draw();drawBrowse();say(whichLabel()+'에 담았어요');msg.append(h('button',{onclick:()=>{setSongs(cur.filter((_,j)=>j!==at));msg.textContent='';drawBrowse();}},'실행 취소'));}},'+ 담기'));};
    // 묶어 보기(키별·주제별·분위기별): 묶음 머리줄로 접고 펼침(처음엔 첫 묶음만). 가나다는 묶지 않은 목록
    const grouped=groupBy&&songs.length?groupFor(songs,groupBy,sheets).filter(([k])=>groupBy!=='key'||!filters.key||k===filters.key):null;
    if(grouped&&!openGroups.size)openGroups.add(grouped[0][0]);
    const groupList=grouped&&h('div',{class:'song-groups'},grouped.map(([k,list])=>{const on=openGroups.has(k);return h('section',{class:'song-group'},h('button',{type:'button',class:'group-head','aria-expanded':String(on),onclick:()=>{on?openGroups.delete(k):openGroups.add(k);drawBrowse();}},h('span',{},k),h('small',{class:'meta'},' ('+list.length+'곡)'),h('span',{class:'chev','aria-hidden':'true'})),on&&h('ul',{class:'browse'},list.map(x=>songRow(x,groupBy==='key'?k:''))));}));
    fill(groups,typed,grouped?groupList:songs.length?h('ul',{class:'browse'},songs.slice(0,count).map(x=>songRow(x))):h('div',{class:'empty-state'},h('p',{},hint.text),h('button',{type:'button',class:'sub',onclick:()=>clear(hint.action)},hint.button)),!grouped&&songs.length>count&&h('button',{class:'sub more-songs',onclick:()=>{count+=20;drawBrowse();}},'더 보기 · 남은 '+(songs.length-count)+'곡'));
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
    const row=x=>h('li',{},h('div',{class:'song-info'},h('span',{class:'song-name'},x.title,h('a',{class:'yt-link',href:youtubeLink(x),target:'_blank',rel:'noopener','aria-label':x.title+' 유튜브에서 찾기(새 창)'},'▶ 유튜브')),h('small',{class:'meta'},[cleanBy(x.by),(x.form||[]).join('·'),(x.age||[]).join('·')].filter(Boolean).join(' · '))),
      h('div',{class:'buy'},h('a',{class:'sub-link','aria-label':x.title+' 악보 구매(새 창)',href:x.url,target:'_blank',rel:'noopener'},'악보 구매 ↗'),h('small',{class:'meta'},seller(x.url)+' · 유료')),
      spAdded(x)?h('button',{type:'button',class:'sub added',disabled:true},'담았음 ✓'):h('button',{type:'button',class:'sub add-button','aria-label':x.title+' 특송으로 담기',onclick:()=>{const at=cur.length;flashAt=at;setTimeout(()=>{flashAt=-1;},1600);setSongs([...cur,{title:x.title,key:'',memo:'특송'}]);draw();drawSpecial();say(whichLabel()+'에 특송으로 담았어요');msg.append(h('button',{onclick:()=>{setSongs(cur.filter((_,j)=>j!==at));msg.textContent='';drawSpecial();}},'실행 취소'));}},'+ 담기'));
    fill(spBox,list.length?h('ul',{class:'browse special-list'},list.map(row)):h('div',{class:'empty-state'},h('p',{},hint.text),h('button',{type:'button',class:'sub',onclick:()=>{if(hint.action==='reset'){sp.form=sp.age=sp.season=sp.theme='';spSearch.value='';}else sp[hint.action]='';drawSpecial();}},hint.button)),
      h('p',{class:'meta special-source'},'외부 판매처로 이동합니다. 구매 전 편성·조성과 이용 조건을 확인하세요. 구매만으로 단체 복사·배포가 허용되는 것은 아니에요.'));
  };
  // ---------- 찬송가: 장 번호·제목 찾기 + 주제별 접기. 줄 = "123장 제목 [악보↗][PPT↗][+ 담기]" ----------
  let hymns=null; const hymnOpen=new Set(), hyBox=h('div');
  const hySearch=h('input',{type:'search',k:'hymn-search',placeholder:'🔍 장 번호나 제목으로 찾기','aria-label':'찬송가 찾기',oninput:()=>drawHymns()});
  const loadHymns=()=>{if(hymns)return;hymns=[];fetch('./hymn-src/hymns.json').then(r=>r.ok?r.json():[]).then(l=>{hymns=Array.isArray(l)?l.filter(x=>Number.isInteger(x?.no)&&typeof x.title==='string'):[];drawHymns();}).catch(()=>drawHymns());};
  const drawHymns=()=>{
    if(!hymns)return;
    if(!hymns.length)return fill(hyBox,h('div',{class:'empty-state'},h('p',{},'찬송가 목록을 준비하고 있어요')));
    const q=hySearch.value.trim(),list=filterHymns(hymns,q);
    const row=x=>{const l=hymnLinks(x),title=x.no+'장 '+x.title;return h('li',{},h('div',{class:'song-info'},h('span',{class:'song-name'},title)),
      h('a',{class:'sub-link',href:l.sheet,target:'_blank',rel:'noopener','aria-label':title+' 악보 찾기(새 창)'},'악보 ↗'),h('a',{class:'sub-link',href:l.ppt,target:'_blank',rel:'noopener','aria-label':title+' PPT 찾기(새 창)'},'PPT ↗'),
      cur.some(c=>c.title===title)?h('button',{type:'button',class:'sub added',disabled:true},'담았음 ✓'):h('button',{type:'button',class:'sub add-button','aria-label':title+' 콘티에 담기',onclick:()=>{flashAt=cur.length;setTimeout(()=>{flashAt=-1;},1600);setSongs([...cur,{title,key:'',memo:''}]);draw();drawHymns();say(whichLabel()+'에 담았어요');}},'+ 담기'));};
    if(q)return fill(hyBox,h('p',{class:'browse-count'},'찾은 찬송가 '+list.length+'장'),list.length?h('ul',{class:'browse hymn-list'},list.map(row)):h('p',{class:'hint'},'맞는 찬송가가 없어요'));
    const groups=[];for(const x of list){const k=x.theme||'기타';(groups.find(g=>g[0]===k)||groups[groups.push([k,[]])-1])[1].push(x);}
    fill(hyBox,groups.map(([k,l])=>{const on=hymnOpen.has(k);return h('section',{class:'song-group'},h('button',{type:'button',class:'group-head','aria-expanded':String(on),onclick:()=>{on?hymnOpen.delete(k):hymnOpen.add(k);drawHymns();}},h('span',{},k),h('small',{class:'meta'},' ('+l.length+'장)'),h('span',{class:'chev','aria-hidden':'true'})),on&&h('ul',{class:'browse hymn-list'},l.map(row)));}));
  };
  const hymnSection=h('section',{class:'card hymn-browser'},h('p',{class:'meta hymn-note'},'PPT는 한국찬송가공회 공식 자료실로, 악보는 검색으로 연결돼요'),hySearch,hyBox);
  const specialSection=h('section',{class:'card special-browser'},spSearch,spChips,spCount,spNote,spBox);
  // 곡 목록에 있는 "제목 (키)"를 고르면 제목과 키를 나눠 채우고, 목록에 없는 새 곡은 목록에 더한다.
  const pick = i => {
    const s = book[cur[i].title];
    if (s) { cur[i] = { ...cur[i], title: s.title, key: s.key }; setSongs(cur.map(x => ({ ...x }))); }
    else if (cur[i].title.trim()) addToBook(cur[i]);
  };
  const addToBook = s => { const t = { title: s.title.trim(), key: (s.key || '').trim() }; if (!book[label(t)]) save(churchPath(), { songbook: { [label(t)]: t } }); };
  const date = h('input', { type: 'date', value: nextSunday(todayIso()), onchange: () => date.value && open() });
  // 순서가 바뀌면 칸 번호도 바뀌므로, 입력 중이던 칸을 먼저 놓는다(값은 flush로 이미 저장).
  let svc = 'sunday-main', defSvc = 'sunday-main', curDoc = null; // 지금 연 콘티의 예배와 교회 기본 예배
  let inflight = 0, saveErr = false; const statusEl = h('p', { class: 'conti-status', 'aria-live': 'polite' });
  const paintStatus = () => { const busy = inflight > 0 || pending.has('songs'), n = cur.filter(x => x.title.trim()).length; fill(statusEl, whichLabel() + ' · ' + n + '곡 · ', h('span', { class: busy ? 'saving' : saveErr ? 'err' : 'saved' }, busy ? '저장 중…' : saveErr ? '저장 못 했어요' : '저장됨 ✓')); };
  const saveConti = (p, patch) => { inflight++; paintStatus(); return save(p, patch).then(ok => { inflight--; saveErr = !ok; paintStatus(); }); };
  const setSongs = songs => { flush(); document.activeElement?.blur(); cur = songs; saveConti(path, contiPatchOf(svc, defSvc, songs)); if (svc !== defSvc && songs.some(x => x.title?.trim()) && remembered()[svc] !== true) rememberSvc(svc, true); };
  const swap = (i, j) => { const b = [...cur]; [b[i], b[j]] = [b[j], b[i]]; setSongs(b); };
  // shortcut: 칸 이름이 곡 순서 번호라, 남이 앞 곡을 지우는 순간 입력 중이던 글이 다음 곡 칸으로 옮겨질 수 있다. 자주 생기면 곡마다 id를 둔다.
  const field = (i, f, ph) => h('input', { class: f, placeholder: ph, value: cur[i][f] || '', k: f + i, maxLength: 100, 'aria-label': `${i + 1}번 곡 ${ph}`,
    ...(f === 'title' && { list: 'songbook', onchange: () => pick(i) }), ...(f === 'key' && { onchange: () => cur[i].title.trim() && addToBook(cur[i]) }),
    oninput: e => {
      if (!cur[i]) return;
      cur[i][f] = e.target.value;
      drawPrint();
      const songs = cur.map(s => ({ ...s })), p = path;
      const sv = svc; later('songs', () => saveConti(p, contiPatchOf(sv, defSvc, songs))); paintStatus();
    } });
  let removed=null; const memoOpen=new Set();
  const editor=h('div',{class:'conti-editor'}), editorTitle=h('h3',{class:'conti-title'});
  let lastCount=0, stopLast=()=>{};
  // 보관함 탭에서만: 탭바 바로 위 '이번 주 콘티 n곡 · 확인하기 →'
  const weekBar=h('button',{type:'button',class:'week-bar',onclick:()=>{wrap.dataset.tab='week';for(const b of tabs.children)b.setAttribute('aria-pressed',String(b===tabs.children[0]));scrollTo(0,0);}}); // 지난주 콘티 곡 수(복사 버튼을 켤지)
  // 휴대폰: 지금 화면 위에 검색·보관함 시트를 연다(닫으면 보관함은 제자리로). 컴퓨터는 옆 보관함 검색칸으로
  const openPicker=()=>{if(wide()){setPick('book');search.focus();return;}const back=browse.parentNode,next=browse.nextSibling,dlg=bigDialog('곡 찾아 추가하기','picker-dialog',browse);dlg.addEventListener('close',()=>back.insertBefore(browse,next));search.focus();};
  const badge=h('span',{class:'tab-badge'});
  let ordering = false, flashAt = -1, dragFrom = -1;
  const closeMenus = () => { for (const d of view.querySelectorAll?.('details.menu[open]') || []) d.open = false; };
  const menu = (cls, label, aria, ...items) => h('details', { class: 'menu ' + cls }, h('summary', { 'aria-label': aria }, label), h('div', { class: 'menu-pop' }, ...items));
  const move = (from, to) => { if (from === to || from < 0) return; const b = [...cur], [m] = b.splice(from, 1); b.splice(to, 0, m); setSongs(b); };
  const draw = () => { drawSvc(); weekBar.textContent='이번 주 콘티 '+cur.length+'곡 · 확인하기 →'; badge.textContent=cur.length?String(cur.length):''; badge.hidden=!cur.length; paintTop();
    if (cur.length < 2) ordering = false;
    const songLi = (s, i) => h('li', { class: 'conti-song' + (i === flashAt ? ' flash' : '') + (ordering ? ' ordering' : ''), draggable: ordering ? 'true' : null,
        ...(ordering && { ondragstart: () => { dragFrom = i; }, ondragover: e => e.preventDefault(), ondrop: e => { e.preventDefault(); move(dragFrom, i); dragFrom = -1; } }) },
      h('span', { class: 'num' }, i + 1 + '.'), field(i, 'title', '곡명'),
      h('label', { class: 'key-field' }, h('span', {}, '키'), field(i, 'key', '키')),
      ordering ? h('span', { class: 'order-acts' },
        h('button', { type: 'button', class: 'sub', 'aria-label': `${i + 1}번 곡 위로`, disabled: i === 0, onclick: () => swap(i, i - 1) }, '▲'),
        h('button', { type: 'button', class: 'sub', 'aria-label': `${i + 1}번 곡 아래로`, disabled: i === cur.length - 1, onclick: () => swap(i, i + 1) }, '▼'))
      : h('span', { class: 'acts' }, sheetButton(s.title, s.key),
        menu('song-more', '⋯', `${i + 1}번 곡 더보기`,
          h('button', { type: 'button', class: 'menu-item', onclick: () => { closeMenus(); memoOpen.add(i); draw(); box.querySelector?.('[data-k=memo' + i + ']')?.focus(); } }, s.memo ? '메모 고치기' : '메모 쓰기'),
          s.title.trim() && h('button', { type: 'button', class: 'menu-item', onclick: () => { closeMenus(); toggleFav(s); } }, isFav(s) ? '★ 즐겨찾기 빼기' : '☆ 즐겨찾기 넣기'),
          h('button', { type: 'button', class: 'menu-item danger', onclick: () => { closeMenus(); removed = { song: { ...cur[i] }, index: i }; setSongs(cur.filter((_, j) => j !== i)); } }, '삭제'))),
      memoOpen.has(i) ? h('div', { class: 'memo-line' }, field(i, 'memo', '메모')) : s.memo && h('small', { class: 'memo-line meta' }, splitLinks(s.memo).map((t, k) => k % 2 ? h('a', { href: t, target: '_blank', rel: 'noopener', class: 'memo-link' }, t) : t)));
    fill(box,
      cur.length > 1 && h('div', { class: 'order-bar' }, h('button', { type: 'button', class: 'text-button', 'aria-pressed': String(ordering), onclick: () => { ordering = !ordering; draw(); } }, ordering ? '순서 편집 끝' : '순서 편집'), ordering && h('small', { class: 'meta' }, '▲▼를 누르거나 줄을 끌어 옮겨요')),
      !cur.length && h('div', { class: 'empty conti-empty' }, h('p', { class: 'hint only-wide' }, '왼쪽에서 곡을 찾아 [+ 담기]를 누르면 여기에 쌓여요'), h('button', { type: 'button', class: 'primary add-song only-narrow', onclick: openPicker }, '+ 곡 찾아 추가하기')),
      h('ol', { class: 'songs conti-songs' }, cur.map(songLi)),
      h('div', { class: 'row conti-more' }, !cur.length && lastCount > 0 && h('button', { type: 'button', class: 'text-button', onclick: () => loadLast() }, '지난주 콘티 그대로 가져오기'), h('button', { type: 'button', class: 'text-button', onclick: () => { memoOpen.clear(); setSongs([...cur, { title: '', key: '', memo: '' }]); box.querySelector?.('[data-k=title' + (cur.length - 1) + ']')?.focus(); } }, '+ 곡 직접 입력'),
        h('button', { type: 'button', class: 'text-button', onclick: () => openKakao() }, '카톡 글 붙여 넣기'),
        removed && h('button', { type: 'button', class: 'text-button', onclick: () => { const songs = [...cur]; songs.splice(removed.index, 0, removed.song); removed = null; setSongs(songs); } }, '삭제 되돌리기'))); };
  // 카톡 글 붙여 넣기: 글에서 곡(번호·곡명·키·메모)과 날짜를 뽑아 미리 보여 주고, 그 날짜(없으면 지금 연 날짜) 콘티에 넣는다. 이미 있는 곡(제목+키)은 다시 넣지 않는다
  const openKakao = () => {
    let got = { date: '', songs: [] };
    const prev = h('div', { class: 'kakao-preview', 'aria-live': 'polite' }), go = h('button', { type: 'button', class: 'primary', disabled: true }, '이번 콘티에 넣기');
    const ta = h('textarea', { rows: 6, 'aria-label': '카톡 콘티 글', placeholder: '카톡에서 콘티 글을 길게 눌러 복사한 뒤 여기에 붙여 넣어요\n예) 10/25 콘티 1. 손 잡고 함께 가세(E) 2. 부르신 곳에서(E)', oninput: () => paint() });
    const paint = () => {
      got = parseKakaoConti(ta.value, { today: todayIso(), list: Object.values(book) });
      const day = got.date || date.value, n = got.songs.length;
      go.disabled = !n; go.textContent = n ? dayLabel(day) + ' 콘티에 ' + n + '곡 넣기' : '이번 콘티에 넣기';
      fill(prev, ta.value.trim() && (n ? [h('p', { class: 'kakao-target' }, dayLabel(day) + ' 콘티에 들어가요' + (got.date ? '' : ' (글에 날짜가 없어서 지금 연 날짜로)')),
        h('ol', { class: 'kakao-songs' }, got.songs.map(s => h('li', {}, h('span', { class: 'song-name' }, s.title), h('small', { class: 'meta' }, [s.key ? s.key + '키' : '키 없음', s.memo, !s.known && '새 곡'].filter(Boolean).join(' · ')))))]
        : h('p', { class: 'hint' }, '곡을 찾지 못했어요. 한 줄에 한 곡씩 \'곡명 (키)\'로 적혀 있으면 가장 잘 읽어요.')));
    };
    go.onclick = async () => {
      const day = got.date || date.value, songs = got.songs.map(({ title, key, memo }) => ({ title, key, memo }));
      dlg.close(); flush();
      let base = cur;
      // 다른 날짜면 그 날짜 콘티를 먼저 읽는다. 못 읽으면 덮어쓰지 않게 멈춘다
      if (day !== date.value) { try { base = contiSongsOf(await readOnce(`${churchPath()}/conti/${day}`), svc, defSvc); } catch { return say(dayLabel(day) + ' 콘티를 불러오지 못했어요. 다시 해 주세요.'); } pickConti(day, svc); }
      const add = songs.filter(s => !base.some(c => c.title === s.title && (c.key || '') === (s.key || '')));
      if (add.length) setSongs([...base.map(x => ({ ...x })), ...add]);
      say(!add.length ? '모두 이미 ' + dayLabel(day) + ' 콘티에 있어요' : dayLabel(day) + ' 콘티에 ' + add.length + '곡을 넣었어요' + (songs.length > add.length ? ' (이미 있던 ' + (songs.length - add.length) + '곡은 그대로)' : ''));
    };
    const dlg = bigDialog('카톡 글 붙여 넣기', 'kakao-dialog', ta, prev, h('div', { class: 'filter-foot' }, go));
    ta.focus();
  };
  let historyRequest = 0;
  const historyList = h('div');
  const history = h('section', { class: 'conti-history' }, h('h3', {}, '지난 콘티'), historyList);
  async function loadHistory() {
    const request = ++historyRequest, selected = date.value, base = churchPath();
    fill(historyList, h('p', { class: 'hint' }, '지난 콘티를 불러오는 중이에요'));
    try {
      const weeks = await Promise.all(previousSundays(selected).map(async day => ({ day, data: await readOnce(base + '/conti/' + day) })));
      if (request !== historyRequest || !history.isConnected || date.value !== selected) return;
      const rows = weeks.map(w => ({ ...w, data: { ...w.data, songs: contiSongsOf(w.data, svc, defSvc) } })).filter(w => w.data.songs.length);
      fill(historyList, rows.length ? rows.map(({ day, data }) => h('details', {},
        h('summary', {}, fmt(day) + ' · ' + (data.songs[0].title || '제목 없는 곡') + (data.songs.length > 1 ? ' 외 ' + (data.songs.length - 1) + '곡' : ''), fromKakao(data, day, localStorage.getItem('church:code')) && h('small', { class: 'from-kakao' }, '카톡에서 가져옴')),
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
    if (!panel.hidden || wrap.dataset?.tab === 'history') loadHistory();
    stop(); removed=null; memoOpen.clear();
    path = `${churchPath()}/conti/${date.value}`;
    editorTitle.textContent = whichLabel();
    stop = watch(path, d => { curDoc = d; cur = contiSongsOf(d, svc, defSvc); draw(); drawPrint(); drawBrowse(); drawSpecial(); drawHymns(); drawList(); });
    drawSpecial();
    stopLast(); stopLast = watch(`${churchPath()}/conti/${addDays(date.value, -7)}`, d => { lastCount = contiSongsOf(d, svc, defSvc).filter(s => s.title).length; if (!cur.length) draw(); });
  };
  const loadLast = async () => {
    const d = await readOnce(`${churchPath()}/conti/${addDays(date.value, -7)}`).catch(() => null);
    const last = newContiSongs('copy', d, svc, defSvc);
    if (!last.length) return say('지난 주 콘티가 없어요');
    if (cur.length && !confirm('지금 콘티를 지난 주 콘티로 바꿀까요?')) return;
    setSongs(last);
  };
  const openPrint = () => { closeMenus(); const dlg = bigDialog('인쇄', 'print-dialog', h('div', { class: 'wp-form' }, h('label', {}, h('span', {}, '용지'), paper), h('button', { type: 'button', class: 'primary', onclick: () => { dlg.close(); print(); } }, '인쇄하기'))); };
  const openWorship = async () => { closeMenus(); flush(); try { await loadWorship(); openWorshipPpt(svc, churchDoc); } catch { say('예배 순서를 불러오지 못했어요. 다시 눌러 주세요.'); } };
  // 보기 링크: 받은 사람이 로그인 없이 태블릿에서 악보로 본다
  const viewUrl = (id = svc) => viewerLink(location.origin + location.pathname, localStorage.getItem('church:code') || '', date.value, id !== defSvc ? id : '');
  const shareAll = () => { closeMenus(); flush(); copyText(bundleShare('[' + churchName + '] ' + fmt(date.value) + ' 찬양', contiTabs(curDoc, defSvc, remembered()).map(id => ({ name: svcName(id), songs: id === svc ? cur : contiSongsOf(curDoc, id, defSvc), link: viewUrl(id) })))); };
  const shareItems = [h('button', { type: 'button', class: 'menu-item', onclick: () => { closeMenus(); flush(); copyText(contiShare(churchName, date.value, cur) + '\n\n악보로 보기: ' + viewUrl()); } }, '카톡 보내기'), h('button', { type: 'button', class: 'menu-item', onclick: () => { closeMenus(); flush(); copyText(viewUrl()); } }, '보기 링크 복사'), h('button', { type: 'button', class: 'menu-item', onclick: openPrint }, '인쇄'), ppt, h('label', { class: 'ppt-cover' }, withCover, h('span', {}, 'PPT에 표지·순서 장도 넣기')), h('button', { type: 'button', class: 'menu-item', onclick: openWorship }, '예배 PPT')];
  shareItems.splice(1, 0, h('button', { type: 'button', class: 'menu-item', onclick: shareAll }, '이번 주 콘티 모두 보내기'));
  const exports = menu('share-menu', '찬양팀에 보내기', '찬양팀에 보내기 메뉴(카톡·보기 링크·인쇄·PPT)', ...shareItems);
  // 휴대폰: [이번 주 콘티][곡 보관함][지난 콘티] 중 하나만 보인다(컴퓨터는 콘티와 보관함을 나란히)
  const tabs=h('div',{class:'segments conti-tabs',role:'group','aria-label':'콘티 화면 고르기'},[['week','콘티'],['book','CCM'],['special','특송'],['hymn','찬송가'],['history','지난 콘티']].map(([id,t])=>h('button',{type:'button',class:'sub','aria-pressed':String(id==='week'),onclick:e=>{wrap.dataset.tab=id;if(id==='special')loadSpecials();if(id==='hymn')loadHymns();for(const b of tabs.children)b.setAttribute('aria-pressed',String(b===e.currentTarget));if(id==='history')loadHistory();scrollTo(0,0);}},t,id==='week'&&badge)));
  const wrap=h('div',{class:'conti','data-tab':'week','data-pick':'book'});
  const pickTabs=h('div',{class:'segments pick-tabs',role:'group','aria-label':'곡 고르는 곳'},[['book','CCM'],['special','특송'],['hymn','찬송가']].map(([id,t])=>h('button',{type:'button',class:'sub','aria-pressed':String(id==='book'),onclick:e=>{setPick(id,e.currentTarget);markNav({book:'ccm',special:'special',hymn:'hymn'}[id]);}},t)));
  const setPick=(id,btn=pickTabs.children[['book','special','hymn'].indexOf(id)])=>{wrap.dataset.pick=id;if(id==='special')loadSpecials();if(id==='hymn')loadHymns();for(const b of pickTabs.children)b.setAttribute('aria-pressed',String(b===btn));};
  if(startPick!=='book')setPick(startPick);
  const pickCol=h('section',{class:'pick-col'},h('h3',{class:'browse-title'},'곡 찾아 담기'),pickTabs,browse,specialSection,hymnSection);
  // ---------- 콘티 목록·새 콘티 ----------
  const listBar=h('div',{class:'conti-list',role:'group','aria-label':'콘티 목록'}), weekDocs={};
  const svcName=id=>(worshipData?.services||[]).find(x=>x.id===id)?.name||({'sunday-main':'주일 대예배','young-adult':'청년부 예배','youth':'중고등부 예배'}[id]||id);
  const dayLabel=t=>(+t.slice(5,7))+'월 '+(+t.slice(8,10))+'일('+'일월화수목금토'[new Date(t+'T00:00:00Z').getUTCDay()]+')';
  const thisSun=nextSunday(todayIso()), nextSun=addDays(thisSun,7);
  const pickConti=(t,id)=>{panel.hidden=true;pickBtn.setAttribute('aria-expanded','false');if(date.value===t&&svc===id)return;date.value=t;svc=id;open();drawList();};
  const whichLabel=()=>{const t=date.value,base=svc!==defSvc?dayLabel(t)+' '+svcName(svc):t===thisSun?'이번 주':t===nextSun?'다음 주':dayLabel(t);return base+' 콘티';};
  const panel=h('section',{class:'conti-panel',id:'conti-panel',hidden:true},listBar,h('label',{class:'conti-date'},h('span',{},'다른 날짜 열기'),date),history);
  const pickBtn=h('button',{type:'button',class:'conti-pick','aria-expanded':'false','aria-controls':'conti-panel',onclick:()=>{panel.hidden=!panel.hidden;pickBtn.setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)loadHistory();}});
  const topBar=h('div',{class:'conti-top'});
  // 추천 하나: 곡이 없으면 곡 검색창(컴퓨터는 처음 한 번 포커스), 곡이 있으면 [공유·출력]이 주 버튼
  let recFocused=false;
  const paintTop=()=>{const t=date.value,has=cur.some(x=>x.title.trim());
   exports.className='menu share-menu'+(has?' rec':'');search.className=cur.length?'':'rec';if(!cur.length&&!recFocused&&wide()&&search.isConnected){recFocused=true;search.focus({preventScroll:true});}
   fill(pickBtn,h('strong',{},(+t.slice(5,7))+'/'+(+t.slice(8,10))+'('+'일월화수목금토'[new Date(t+'T00:00:00Z').getUTCDay()]+')'),' 콘티',h('span',{class:'chev','aria-hidden':'true'}));
   for(const el of shareItems)el.disabled=!has; withCover.disabled=!has;
   if(cur.length){paintStatus();fill(topBar,pickBtn,statusEl,exports);}
   else fill(topBar,pickBtn,h('p',{class:'conti-status'},whichLabel()+' · 아직 곡이 없어요'));};
  const drawList=()=>{
   const chip=(t,id,lead)=>{const doc=t===date.value?curDoc:weekDocs[t],n=contiSongsOf(doc,id,defSvc).filter(x=>x.title).length;return h('button',{type:'button',class:'chip conti-chip','aria-pressed':String(date.value===t&&svc===id),onclick:()=>pickConti(t,id)},lead+dayLabel(t)+(id!==defSvc?' · '+svcName(id):''),h('small',{},n?' '+n+'곡':' (곡 없음)'));};
   const others=t=>contiServices(t===date.value?curDoc:weekDocs[t],defSvc).filter(id=>id!==defSvc).map(id=>chip(t,id,''));
   fill(listBar,chip(thisSun,defSvc,'이번 주 '),...others(thisSun),chip(nextSun,defSvc,'다음 주 '),...others(nextSun),
    ![thisSun,nextSun].includes(date.value)&&chip(date.value,svc,''),
    h('button',{type:'button',class:'chip new-conti',onclick:()=>newConti()},'+ 새 콘티'));
  };
  for(const t of [thisSun,nextSun])watch(`${churchPath()}/conti/${t}`,d=>{weekDocs[t]=d;drawList();});
  // [+ 새 콘티]: 날짜(기본 다가오는 주일) · 예배(정기·교회학교) · 시작 방법 3가지
  const newConti=async(start=thisSun,startSvc=defSvc)=>{
   const W=await loadWorship().catch(()=>null),services=(W?.services||[]).filter(x=>['정기','교회학교'].includes(x.group));
   const day=h('input',{type:'date',value:start,'aria-label':'콘티 날짜'}),sel=h('select',{'aria-label':'예배'},(services.length?services:[{id:defSvc,name:svcName(defSvc)}]).map(x=>h('option',{value:x.id,selected:x.id===startSvc},x.name)));
   const go=async method=>{dlg.close();if(!day.value)return;const before=svc;date.value=day.value;svc=sel.value;open();drawList();
    if(method==='copy'){const last=newContiSongs('copy',await readOnce(`${churchPath()}/conti/${addDays(day.value,-7)}`).catch(()=>null),svc,defSvc);if(!last.length){say('지난주 같은 예배 콘티가 없어서 빈 콘티로 열었어요');return;}if(cur.length&&!confirm('이 날짜 콘티에 곡이 있어요. 지난주 콘티로 바꿀까요?'))return;setSongs(last);say('지난주 콘티 '+last.length+'곡을 복사했어요');}
    else if(method==='book'){if(wide()){setPick('book');search.focus();}else{wrap.dataset.tab='book';for(const b of tabs.children)b.setAttribute('aria-pressed',String(b===tabs.children[1]));scrollTo(0,0);}}
    else say(dayLabel(day.value)+' '+svcName(svc)+' 콘티를 열었어요');void before;};
   const dlg=bigDialog('새 콘티','new-conti-dialog',h('div',{class:'wp-form'},h('label',{},h('span',{},'날짜'),day),h('label',{},h('span',{},'예배'),sel),h('p',{class:'hint'},'어떻게 시작할까요?'),
    h('div',{class:'start-ways'},h('button',{type:'button',class:'sub',onclick:()=>go('empty')},'빈 콘티로'),h('button',{type:'button',class:'sub',onclick:()=>go('copy')},'지난주 콘티 복사'),h('button',{type:'button',class:'primary',onclick:()=>go('book')},'곡 보관함에서 고르기'))));
  };
  const onDoc=e=>{if(!wrap.isConnected)return document.removeEventListener('pointerdown',onDoc,true);for(const d of view.querySelectorAll('details.menu[open]'))if(!d.contains(e.target))d.open=false;};
  document.addEventListener?.('pointerdown',onDoc,true);
  var svcBar = h('div', { class: 'svc-tabs', role: 'group', 'aria-label': '이 날짜의 예배' });
  const remembered = () => churchDoc?.settings?.contiServices || {};
  const rememberSvc = (id, on) => { save(churchPath(), { settings: { contiServices: { [id]: on } } }); churchDoc = { ...churchDoc, settings: { ...churchDoc.settings, contiServices: { ...remembered(), [id]: on } } }; };
  function drawSvc() { if (!svcBar) return; // var: 위에서 먼저 불려도 아직 없으면 그냥 넘어간다
  fill(svcBar, contiTabs(curDoc, defSvc, remembered()).flatMap(id => { const n = contiSongsOf(curDoc, id, defSvc).filter(x => x.title).length; return [h('button', { type: 'button', class: 'chip svc-tab', 'aria-pressed': String(id === svc), onclick: () => { if (id !== svc) { svc = id; open(); } } }, svcName(id), h('small', {}, ' · ' + n + '곡')), id === svc && id !== defSvc && menu('svc-more', '⋯', svcName(id) + ' 탭 더보기', h('button', { type: 'button', class: 'menu-item', onclick: () => { closeMenus(); rememberSvc(id, false); svc = defSvc; open(); say(svcName(id) + ' 탭을 숨겼어요(곡은 그대로 있어요)'); } }, '이 예배 탭 숨기기'))].filter(Boolean); }), h('button', { type: 'button', class: 'chip svc-add', onclick: () => addSvc() }, '+ 예배 추가')); }
  // [+ 예배 추가]: 예배 이름에서 고르면 바로 빈 콘티 탭이 생기고 그 탭으로. 고른 조합은 교회 설정에 기억(다음 주에도 같은 탭)
  const addSvc = async () => { const W = await loadWorship().catch(() => null), have = new Set(contiTabs(curDoc, defSvc, remembered())), list = (W?.services || []).filter(x => ['정기', '교회학교'].includes(x.group) && !have.has(x.id));
    if (!list.length) return say('더 추가할 예배가 없어요');
    const dlg = bigDialog('예배 추가', 'filter-dialog svc-dialog', h('p', { class: 'hint' }, '고른 예배는 다음 주에도 탭으로 나와요(곡은 비어 있어요).'), h('div', { class: 'svc-list' }, list.map(x => h('button', { type: 'button', class: 'sub', onclick: () => { dlg.close(); rememberSvc(x.id, true); svc = x.id; open(); say(svcName(x.id) + ' 콘티 탭을 만들었어요'); } }, x.name)))); };
  view.append(h('h2', {}, '콘티'), (wrap.append(topBar, svcBar, panel, tabs,
  h('div',{class:'conti-layout'},(editor.append(editorTitle,box,list,h('p', { class: 'hint conti-hint' }, '곡명을 치면 교회 곡 목록에서 고를 수 있어요. 가사는 저작권이 있어 곡명만 적어요.'),h('button',{class:'sub mobile-browse','aria-expanded':'false',onclick:e=>{const open=browse.classList.toggle('expanded');e.currentTarget.setAttribute('aria-expanded',String(open));}},'곡 목록에서 고르기')),editor),pickCol),weekBar), wrap), printBox);
  let churchDoc = {};
  watch(churchPath(), d => {
    churchName = d?.name || ''; churchDoc = d || {}; drawSvc();
    // 할 일 체크 같은 다른 변경 때는 다시 그리지 않는다(펼쳐 둔 묶음이 닫히지 않게)
    const merged = mergeLibrary(defaultSongs, d?.songbook);
    const sh = d?.sheets || {}, fv = d?.favorites || {};
    if (JSON.stringify(merged) === JSON.stringify(book) && JSON.stringify(sh) === JSON.stringify(sheets) && JSON.stringify(fv) === JSON.stringify(favorites)) return;
    favorites = fv;
    const def = (DEPTS.find(x => x.id === deptToPpt(deptsOf(d?.settings)[0])) || {}).service || 'sunday-main';
    if (def !== defSvc) { const wasDef = svc === defSvc; defSvc = def; if (wasDef) svc = def; open(); }
    churchSongs = d?.songbook || {};
    churchSettings = { ...d?.settings, customEvents: d?.customEvents }; applySeason(); drawSpecial();
    book = merged; sheets = sh; draw(); drawBrowse(); list.replaceChildren(...Object.keys(book).sort().map(v => h('option', { value: v, label: book[v].note ? `${v} · ${book[v].note}` : v }))); });
  drawBrowse(); open(); if (globalThis.matchMedia?.('(min-width: 960px)').matches) { loadSpecials(); loadHymns(); } // 컴퓨터 배치(960px~)는 탭 없이 다 보여서
}

function qtView() {
  let path, stop = () => {}, archive = []; const passageBox=h('section',{class:'card'}); 
  const daily = h('section', { class: 'card', hidden: true });
  const drawDaily = () => {
    const item = archive[qtIndex(date.value, archive.length)]; daily.hidden = !item; if(item)scripture(passageBox,item.ref,false);
    const introSlot = h('div', { class: 'intro-slot' }); if (item) introForRef(item.ref).then(f => { if (f && introSlot.isConnected) introSlot.replaceChildren(f); });
    fill(daily, item && [h('h3', { class: 'qt-head' }, '오늘의 큐티'), h('h4', {}, item.ref + ' · ' + item.title), introSlot,
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
        if (!await save(base + '/conti/' + day, data, false)) throw new Error('일부 콘티를 저장하지 못했어요. 다시 가져오면 이어서 덮어써요');
      }
      logChange(base, null, '백업 가져오기 (콘티 ' + Object.keys(conti).length + '주)'); // 콘티는 주마다 남기지 않고 한 줄로
      say('백업 자료를 가져왔어요');
    } catch (error) { say(error.message || '백업을 가져오지 못했어요'); }
    finally { busy = false; download.disabled = upload.disabled = false; }
  } });
  const upload = h('button', { class: 'sub', onclick: () => file.click() }, '백업 가져오기');
  return h('section', { class: 'card' }, h('h3', {}, '자료 옮기기'), h('p', { class: 'hint' }, '교회 자료와 오늘 앞뒤 52주의 주일 콘티를 백업해요. 체험 모드에서 내려받은 파일을 Firebase 연결 후 가져올 수 있어요.'), h('div', { class: 'row' }, download, upload), file);
}

// 관리자 전용 접기(스냅샷·변경 기록): 펼칠 때마다 최근 n개를 읽어 그린다. 관리자가 아니면 접기 자체를 숨긴다(규칙도 관리자만 읽게 막는다)
function recordsFold(id, title, path, n, draw) {
  const box = h('div'), d = foldCard(id);
  let busy = false;
  const load = async () => {
    if (!d.open || d.hidden || busy) return;
    busy = true; fill(box, h('p', { class: 'hint' }, '불러오는 중…'));
    try { draw(box, await store.list(churchPath() + path, n)); }
    catch { fill(box, h('p', { class: 'err' }, '불러오지 못했어요. 접었다가 다시 펼쳐 주세요.')); }
    finally { busy = false; }
  };
  d.hidden = true; d.append(foldHead(title), box); d.addEventListener('toggle', load);
  return { el: d, show: on => { const was = !d.hidden; d.hidden = !on; if (on && !was) load(); } };
}
const when = t => { const d = t?.toDate?.(); return d ? (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : ''; };
// 변경 기록: 무엇 · 언제 · 누가
const drawLog = (box, list) => fill(box, list.length ? h('ul', { class: 'records' }, list.map(l => h('li', {}, h('span', {}, l.what || ''), h('small', {}, [when(l.at), l.who || '이름 없음'].filter(Boolean).join(' · ')))))
  : h('p', { class: 'empty' }, '아직 기록이 없어요'));
const changedLabels = patch => [...new Set(Object.keys(patch).map(k => KEY_LABEL[k] || k))];
// 스냅샷 목록(날짜 · 만든 사람) → 고르면 요약과 '이 날로 되돌리기'
// shortcut: 목록을 읽을 때 스냅샷 내용까지 30개를 다 받는다(웹 SDK는 칸만 골라 읽기가 없음). 교회 자료가 커져 느려지면 날짜·이름만 담은 목록 문서를 따로 둔다.
function drawSnaps(box, list, cur) {
  const preview = h('div', { class: 'snap-preview', 'aria-live': 'polite' });
  const pick = (s, btn) => {
    for (const b of box.querySelectorAll('.records button')) b.setAttribute('aria-pressed', String(b === btn));
    const changed = changedLabels(replacePatch(churchPart(cur()), churchPart(s.church)));
    const go = h('button', { type: 'button', class: 'primary', onclick: () => restoreSnap(s, go) }, '이 날로 되돌리기');
    fill(preview, h('h4', {}, fmt(s.id) + ' 상태'), h('p', {}, snapSummary(s)),
      h('p', { class: 'hint' }, (changed.length ? '바뀌는 것: ' + changed.join(', ') : '교회 정보는 지금과 같아요') + ' · 콘티 ' + snapWeeks(s).length + '주는 이날 것으로 덮어써요'), go);
  };
  fill(box, h('p', { class: 'hint' }, '매일 그날 처음 들어온 사람이 교회 상태를 저장해요. 저장된 날은 아무도 고치거나 지울 수 없어요.'),
    list.length ? h('ul', { class: 'records' }, list.map(s => { const b = h('button', { type: 'button', class: 'text-button', 'aria-pressed': 'false', onclick: () => pick(s, b) }, fmt(s.id), h('small', {}, s.who || '이름 없음')); return h('li', {}, b); }))
      : h('p', { class: 'empty' }, '아직 저장된 날이 없어요. 하루에 하나씩 쌓여요.'), preview);
}
// 되돌리기: 오늘 스냅샷이 없으면 지금 상태를 먼저 남기고, 교회 문서와 스냅샷에 있는 주의 콘티를 그날과 똑같이 만든다(관리자 표는 그대로)
async function restoreSnap(s, button) {
  const base = churchPath(), label = md(s.id);
  button.disabled = true;
  try {
    flush();
    const todaySaved = !!await readOnce(base + '/snap/' + utcToday());
    const weeks = snapWeeks(s), changed = changedLabels(replacePatch(churchPart(await readOnce(base)), churchPart(s.church)));
    if (!confirm(label + ' 상태로 되돌릴까요?\n바뀌는 것: ' + [...changed, '콘티 ' + weeks.length + '주'].join(', ') + '\n' + (todaySaved ? '오늘 저장된 상태 뒤에 바꾼 것은 사라져요.' : '지금 상태는 오늘 날짜로 먼저 저장해 둬요.'))) return;
    if (!todaySaved && await dailySnapshot(true) !== 'made') return say('지금 상태를 먼저 저장하지 못해서 되돌리지 않았어요. 다시 해 주세요.');
    const patch = replacePatch(churchPart(await readOnce(base)), churchPart(s.church));
    if (Object.keys(patch).length) await store.update(base, patch);
    for (const [day, w] of weeks) {
      const p = replacePatch(contiPart(await readOnce(base + '/conti/' + day)), contiPart(w));
      if (Object.keys(p).length) await store.update(base + '/conti/' + day, p);
    }
    logChange(base, null, '이전 상태로 되돌리기 (' + label + ')');
    say(label + ' 상태로 되돌렸어요');
  } catch { say('되돌리지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요.'); }
  finally { button.disabled = false; }
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
  const permBox=h('div',{class:'perm-box'}), adminBox=h('div'), skipBox=h('div',{class:'skip-box'});
  let latest = null;
  const snapF = store.mode === 'shared' && recordsFold('set-snap', '이전 상태로 되돌리기', '/snap', 30, (box, list) => drawSnaps(box, list, () => latest));
  const logF = store.mode === 'shared' && recordsFold('set-log', '변경 기록', '/log', 50, drawLog);
  // 설정 묶음: 사람 / 우리 교회 / 데이터 / 내 기기(맨 아래)
  const inviteBtn=h('button',{class:'sub',onclick:()=>copyInvite(code)},'초대 링크 복사'), inviteF=fold('set-invite','멤버 초대',code,h('h4',{},'교회 코드'),h('p',{class:'code'},code),inviteBtn,copy);
  view.append(permBox,h('div',{class:'settings-grid'},
 h('h3',{class:'set-group'},'사람'),inviteF,store.mode==='shared'&&fold('set-admin','관리자','',adminBox),
 h('h3',{class:'set-group'},'우리 교회'),fold('set-church','교회 정보','',nameBox),fold('set-dept','부서·규모','',sizeBox),fold('set-events','절기·행사 켜고 끄기','',evBox),fold('set-skip','계획서·보고 생략할 절기','',skipBox),
 h('h3',{class:'set-group'},'데이터'),fold('set-songs','곡 목록·자료 옮기기','',bookBox,
  h('section',{class:'song-tool'},h('h4',{},'곡 한꺼번에 넣기'),h('p',{class:'hint'},"한 줄에 한 곡씩 '곡명 키' 또는 '곡명 (키)'로 붙여 넣어요"),bulk,bulkInfo,bulkBtn),
  h('section',{class:'song-tool'},h('h4',{},'악보 사진 올리기'),h('p',{class:'hint'},"사진을 고르고 곡명과 키를 적어요. 파일 이름이 '곡명 (키).jpg'면 저절로 채워져요. 교회 안 공유도 악보 저작권 허락(CCLI 등)이 필요할 수 있어요."),h('label',{class:'photo-pick'},h('span',{},'사진 고르기'),photoInput),photoList),
  h('details',{class:'advanced'},h('summary',{},'고급 (CSV 파일 · 악보 링크)'),h('label',{},h('span',{},'CSV 파일로 곡 넣기'),csv),h('p',{class:'meta'},'제목, 키, 메모, 주제, 분위기, 악보 주소 순서'),sheetForm),
  transferCard()), snapF&&snapF.el, logF&&logF.el,
 h('h3',{class:'set-group'},'내 기기'),fold('set-account','내 기기·계정',localStorage.getItem('church:role')||'',loginBox(),h('label',{},h('span',{},'내 역할 이름 (이 기기에만 저장)'),h('input',{value:localStorage.getItem('church:role')||'',placeholder:'예: 찬양리더',maxLength:20,oninput:e=>localStorage.setItem('church:role',e.target.value.trim())})),h('button',{type:'button',class:'sub',onclick:()=>{resetTours();show('home');}},'튜토리얼 다시 하기'),h('button',{class:'danger',onclick:()=>{localStorage.removeItem('church:code');history.replaceState(null,'',location.pathname+location.search);showEntry();}},'다른 교회로 바꾸기'))));
  // 앱 정보(설정 맨 아래): 만든 사람·이메일(주열 님 요청 표시)·앱 버전(index.html의 ?v=)
  view.append(h('section', { class: 'app-info' }, h('h3', { class: 'set-group' }, '앱 정보'), h('p', {}, '만든 사람 권주열 · ', h('a', { href: 'mailto:theserver62@gmail.com' }, 'theserver62@gmail.com')), h('p', {}, '앱 버전 ' + (new URL(import.meta.url).searchParams.get('v') || '개발판')), h('p', {}, '문의·제안은 이메일로 보내 주세요')));
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
    // 권한: 관리자가 아니면 교회 정보·부서·규모·절기 켜고 끄기는 읽기 전용(날짜는 누구나)
    const u = store.auth?.user?.(), uid = u?.uid || '', editable = canEditSettings(d, uid, store.mode), today2 = todayIso();
    for (const el of [...nameBox.querySelectorAll('input'), ...sizeBox.querySelectorAll('button'), ...evBox.querySelectorAll('input[type=checkbox]')]) el.disabled = !editable;
    const doIt = async (patch, done) => { if (await save(churchPath(), patch) && done) say(done); };
    { // 계획서·보고 생략: 프로젝트(할 일 있는 절기·행사)마다 체크. 잠긴 것은 회색 '꼭 필요해요'
      const ss = { ...d?.settings, customEvents: d?.customEvents }, yy = +todayIso().slice(0, 4), seen = new Set();
      const evs = occurrences([yy, yy + 1], ss).filter(e => e.tasks.length && !seen.has(e.id) && seen.add(e.id)), skip = d?.settings?.skipReport || {};
      const row = (id, name, locked) => h('label', { class: 'skip-row' + (locked ? ' locked' : '') }, h('input', { type: 'checkbox', checked: !locked && !!skip[id], disabled: locked || !editable, 'aria-label': name + ' 계획서·보고 생략', onchange: e => save(churchPath(), { settings: { skipReport: { [id]: e.target.checked } } }) }), h('span', {}, name), locked && h('small', { class: 'meta' }, id === 'annual' ? '항상 해요 · 한 해 일정·예산의 기준이에요' : '항상 해요 · 숙박·안전·예산이 커서 보고가 꼭 필요해요'));
      fill(skipBox, h('p', { class: 'hint' }, '체크한 절기는 계획서 작성·보고와 결과 보고 할 일만 빠지고, 준비 할 일은 그대로 남아요.'), row('annual', '연간 사역계획서', true), evs.map(e => row(e.id, e.name, reportLocked(e, ss))));
    }
    const requested = !!d?.adminRequests?.[uid];
    fill(permBox, !editable && h('div', { class: 'special-note perm-note' }, h('span', {}, '설정은 리더가 승인한 사람만 바꿀 수 있어요'),
      !u ? h('button', { type: 'button', class: hasAdmins(d) ? 'sub' : 'primary', onclick: async () => { try { await store.auth.signIn(); } catch (e) { say(loginErrorText(e?.code)); return; } const me = store.auth.user(); if (me) doIt(hasAdmins(d) ? requestPatch(me, today2) : claimFirstPatch(me, today2), hasAdmins(d) ? '요청했어요 · 리더 승인을 기다려요' : '이 교회의 첫 관리자가 됐어요'); } }, hasAdmins(d) ? '구글로 로그인하고 권한 요청' : '구글로 로그인하고 첫 관리자 되기')
      : !hasAdmins(d) ? h('button', { type: 'button', class: 'primary', onclick: () => doIt(claimFirstPatch(u, today2), '이 교회의 첫 관리자가 됐어요') }, '이 교회의 첫 관리자가 되기')
      : requested ? [h('span', { class: 'meta' }, '요청했어요 · 리더 승인을 기다려요'), h('button', { type: 'button', class: 'text-button', onclick: () => doIt(cancelRequestPatch(uid), '요청을 취소했어요') }, '요청 취소')]
      : h('button', { type: 'button', class: 'sub', onclick: () => doIt(requestPatch(u, today2), '요청했어요 · 리더 승인을 기다려요') }, '권한 요청')));
    if (store.mode === 'shared') {
      const admins = adminList(d), reqs = requestList(d), me = isAdmin(d, uid);
      latest = d; snapF.show(me); logF.show(me);
      const alone = admins.length === 1 && !reqs.length; inviteBtn.className = alone ? 'primary' : 'sub'; if (alone && localStorage.getItem('church:open:set-invite') === null) inviteF.open = true;
      const n = view.querySelector('.fold-set-admin summary'); if (n) n.replaceWith(foldHead('관리자', admins.length + '명' + (me && reqs.length ? ' · 요청 ' + reqs.length + '건' : ''), me && reqs.length ? 'late' : ''));
      fill(adminBox, h('p', { class: 'hint' }, '관리자는 교회 정보·부서·규모·절기 켜고 끄기를 바꾸고, 다른 사람을 관리자로 승인할 수 있어요.'),
        h('h4', {}, '관리자 ' + admins.length + '명'), admins.length ? h('ul', { class: 'buy-list' }, admins.map(a => h('li', { class: 'admin-row' }, h('strong', {}, a.name || '이름 없음', a.uid === uid && ' (나)'), me && a.email && h('small', { class: 'meta' }, a.email),
          me && h('button', { type: 'button', class: 'text-button', disabled: admins.length <= 1, title: admins.length <= 1 ? '마지막 관리자는 뺄 수 없어요' : '', onclick: () => { const patch = removeAdminPatch(d, a.uid); if (!patch) return say('마지막 관리자는 뺄 수 없어요'); if (confirm((a.uid === uid ? '내 ' : a.name + '님의 ') + '관리자 권한을 뺄까요?')) doIt(patch, '권한을 뺐어요'); } }, '권한 빼기')))) : h('p', { class: 'empty' }, '아직 관리자가 없어요'),
        me && h('h4', {}, '권한 요청 ' + reqs.length + '건'), me && (reqs.length ? h('ul', { class: 'buy-list' }, reqs.map(r => h('li', { class: 'admin-row' }, h('strong', {}, r.name || '이름 없음'), h('small', { class: 'meta' }, [r.email, r.at].filter(Boolean).join(' · ')),
          h('div', { class: 'row' }, h('button', { type: 'button', class: 'primary', onclick: () => doIt(approvePatch(r, today2), r.name + '님을 관리자로 승인했어요') }, '승인'), h('button', { type: 'button', class: 'text-button', onclick: () => doIt(rejectPatch(r.uid), '요청을 거절했어요') }, '거절'))))) : h('p', { class: 'empty' }, '새 요청이 없어요')));
    }
  });
}


// 준비 시작 문구: 시작했으면 "준비 시작 10월 18일 · 준비 중", 아직이면 "3일 뒤 준비 시작"
const mdLong = d => (+d.slice(5, 7)) + '월 ' + (+d.slice(8, 10)) + '일';
const prepText = (start, today) => start > today ? Math.round((parse(start) - parse(today)) / 864e5) + '일 뒤 준비 시작' : '준비 시작 ' + mdLong(start) + ' · 준비 중';
// ---------- 절기 = 프로젝트: 홈 '지금 할 일' · 절기 목록 · 절기 상세 · 끝난 절기 기록 ----------
// 앱은 묻지 않고 알려 준다: 교회의 결정을 입력받지 않고(기록용 3줄 메모만), 화면마다 채운 버튼은 1개
let G = new Map(), guidesLoad = null;
const loadGuides = () => (guidesLoad ??= fetch('./task-guides.json').then(r => r.ok ? r.json() : []).then(guideMap).catch(() => new Map())).then(m => (G = m));
const tTitle = t => guideFor(G, t)?.title || t.text;
const daysTo = (d, today) => Math.round((parse(d) - parse(today)) / 864e5);
const fmtLong = d => mdLong(d) + '(' + '일월화수목금토'[parse(d).getUTCDay()] + ')';
const pjChevron = (down = false) => { const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), p = document.createElementNS(ns, 'path'); for (const [k, v] of Object.entries({ viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, class: 'pj-go', 'aria-hidden': 'true' })) svg.setAttribute(k, v); p.setAttribute('d', down ? 'm5 8 5 5 5-5' : 'm8 5 5 5-5 5'); svg.append(p); return svg; };
// 카톡으로 보내기: 휴대폰은 공유 창(카톡 고르기), 안 되면 복사
const shareText = text => navigator.share ? navigator.share({ text }).catch(e => { if (e?.name !== 'AbortError') copyText(text); }) : copyText(text);
const tasksShare = (title, ts) => '[' + title + ']\n' + ts.map(t => '☐ ' + tTitle(t) + ' — ' + fmt(t.due) + '까지' + (t.who ? ' · ' + t.who : '')).join('\n');
const pjDoc = num => num && docs.find(d => d.file.startsWith('docs/' + num + '_'));
let projectKey = '', pickHome = '', pickProject = '';
const openProject = ev => { projectKey = evKey(ev); pickProject = ''; show('project'); };
const projectList = ev => show(ev.custom ? 'ourEvents' : 'seasons');

// 할 일 한 줄: [체크] 제목(밀린 날 표시)·절기·담당·기한 [›]. 줄을 누르면 오른쪽(폰은 아래) 준비 안내
function pjRow(t, c) {
  const isDone = !!c.done[t.key], late = !isDone && t.due < c.today, sel = c.sel === t.key, by = c.data.done?.[t.key];
  return h('div', { class: 'pj-row' + (sel ? ' is-sel' : '') + (isDone ? ' is-done' : '') },
    h('label', { class: 'pj-chk' }, h('input', { type: 'checkbox', checked: isDone, k: 'c:' + t.key, 'aria-label': tTitle(t) + ' 다 했어요', onchange: e => toggleTask(t.key, e.target.checked) })),
    h('button', { type: 'button', class: 'pj-pick', 'aria-pressed': String(sel), onclick: () => c.pick(t) },
      h('span', { class: 'pj-t' }, late && h('span', { class: 'pj-badge' }, daysTo(c.today, t.due) + '일 지남'), tTitle(t)),
      h('span', { class: 'pj-m' }, c.showEvent && h('span', {}, t.event), t.who && h('span', {}, t.who),
        h('span', { class: 'num' + (late ? ' late' : '') }, isDone ? (by?.at ? md(by.at) + ' 완료' : c.data.skipped?.[t.key] ? '건너뜀' : '완료') : fmt(t.due) + (late ? '' : ' · ' + dLabel(daysTo(t.due, c.today))))),
      pjChevron()));
}
// 기록용 3줄 정리(결정 입력이 아니라 기록). records.{절기 key}.{good|bad|next}
const MEMO = [['good', '잘된 점'], ['bad', '아쉬운 점'], ['next', '내년엔']];
const memoFields = (key, data) => h('div', { class: 'pj-facts' }, MEMO.map(([f, label]) => h('label', { class: 'pj-fact' }, h('span', { class: 'pj-label' }, label),
  h('textarea', { rows: 2, maxLength: 300, value: data.records?.[key]?.[f] || '', k: 'r:' + key + f, 'aria-label': label, oninput: e => { const v = e.target.value; later('r:' + key + f, () => save(churchPath(), { records: { [key]: { [f]: v } } })); } }))));
// 준비 안내 카드(베테랑의 방법). 안내가 없으면 원문 할 일 + 담당 + 관련 서류만
function focusCard(t, c) {
  if (!t) return null;
  const g = guideFor(G, t), isDone = !!c.data.done?.[t.key], skip = !isDone && !!c.data.skipped?.[t.key], late = !isDone && !skip && t.due < c.today, doc = pjDoc(t.doc);
  const row = (dt, dd) => dd && [h('dt', {}, dt), h('dd', {}, dd)];
  const list = (tag, xs) => xs?.length ? h(tag, {}, xs.map(x => h('li', {}, x))) : null;
  return h('article', { class: 'pj-focus', id: 'pj-focus' },
    h('div', { class: 'pj-focus-head' },
      h('div', {}, h('p', { class: 'pj-label' }, [c.first && !isDone && !skip && '가장 먼저', c.showEvent && t.event, PHASES[t.phase] + ' 구간'].filter(Boolean).join(' · ')),
        h('h3', { class: 'pj-focus-title' }, tTitle(t)),
        h('p', { class: 'meta' }, t.who, t.who && ' · ', late ? h('span', { class: 'late' }, fmt(t.due) + ' 마감, ' + daysTo(c.today, t.due) + '일 지남') : fmt(t.due) + '까지' + (isDone || skip ? '' : ' · ' + dLabel(daysTo(t.due, c.today))))),
      isDone ? h('button', { type: 'button', onclick: () => toggleTask(t.key, false) }, '완료 되돌리기') : skip ? h('button', { type: 'button', onclick: () => skipTask(t.key, false) }, '건너뛰기 되돌리기') : h('div', { class: 'pj-focus-acts' }, doc && h('a', { class: 'primary pj-start', href: doc.file, download: true, 'aria-label': doc.title + ' 받아서 시작하기' }, '양식 받아 시작하기'), h('button', { type: 'button', class: doc ? 'sub' : 'primary', onclick: () => toggleTask(t.key, true) }, '다 했어요'))),
    late && !isDone && !skip && h('p', { class: 'pj-late-note' }, '기한이 지났어요. 다 못 했어도 괜찮아요 — 지금까지 정한 것과 아직 정할 것을 오늘 한 장으로 정리해 공유하세요.'),
    h('dl', {}, [
      g ? [row('목표', g.goal && h('span', { class: 'pj-goal' }, g.goal)), row('시작 전에', list('ul', g.before)), row('이렇게 해요', list('ol', g.steps)), row('모임에서 정할 것', list('ul', g.points)), row('끝나면 남는 것', g.output),
        row('안내문 예시', g.notice && [h('div', { class: 'pj-notice' }, g.notice), h('div', { class: 'pj-notice-actions' }, h('button', { type: 'button', onclick: () => shareText(g.notice) }, '카톡으로 보내기'), h('button', { type: 'button', class: 'text-button', onclick: () => copyText(g.notice) }, '복사'))])]
        : row('할 일', t.text),
      row('관련 서류', doc && h('div', { class: 'pj-doc' }, h('span', {}, doc.title, h('span', { class: 'meta' }, ' · 워드')), h('span', {}, h('button', { type: 'button', class: 'text-button', onclick: () => showPreview(doc) }, '미리보기'), h('a', { class: 'pj-btn', href: doc.file, download: true, 'aria-label': doc.title + ' 워드 받기' }, '받기')))),
      g && row('자주 놓치는 것', g.tip),
      t.phase === 5 && row('3줄 정리', [memoFields(t.key.slice(0, t.key.lastIndexOf('_')), c.data), h('p', { class: 'meta' }, '적어 두면 끝난 절기 기록과 내년 이맘때 상세 화면에 보여요')])].flat(3)),
    !isDone && !skip && h('div', { class: 'pj-focus-foot' }, [h('button', { type: 'button', class: 'text-button', onclick: () => changeTaskDue(t) }, '기한 바꾸기'), h('button', { type: 'button', class: 'text-button', onclick: () => skipTask(t.key, true) }, '이번엔 건너뛰기')]),
    // 계획서 할 일 카드 맨 아래: 보고가 필요 없는 절기는 설정에서 끈다
    t.guide === 'PLAN' && h('p', { class: 'pj-skip-note' }, '보고가 필요 없는 절기는 ', h('button', { type: 'button', class: 'text-button', onclick: () => { try { localStorage.setItem('church:open:set-skip', '1'); } catch { /* 그냥 연다 */ } show('set'); } }, '설정 > 계획서·보고 생략'), '에서 끌 수 있어요'));
}
// 절기 한 줄: 이름 · D-day · 6칸 막대 · 지금 구간(밀린 일) · n/m 완료
function pjProj(ev, st, today) {
  return h('button', { type: 'button', class: 'pj-proj', onclick: () => openProject(ev) },
    h('span', { class: 'pj-proj-top' }, h('span', { class: 'pj-proj-name' }, ev.name), h('span', { class: 'pj-dday' }, dLabel(daysTo(ev.date, today)))),
    h('span', { class: 'pj-phasebar', 'aria-label': st.started ? '6구간 중 ' + (st.phase + 1) + '번째(' + PHASES[st.phase] + ')' : '아직 시작 전' }, PHASES.map((_, i) => h('i', { class: st.started ? (i < st.phase ? 'past' : i === st.phase ? 'on' : '') : '' }))),
    h('span', { class: 'pj-proj-now' }, h('span', {}, !st.mine.length ? '준비할 일 없음' : st.started ? ['지금 ', h('b', {}, PHASES[st.phase]), ' · ', st.overdue.length ? h('span', { class: 'late' }, '밀린 일 ' + st.overdue.length) : fmt(ev.date)] : '첫 할 일 ' + fmt(st.first)), h('span', { class: 'num' }, st.doneCount + '/' + st.mine.length + ' 완료')));
}
const pjRec = (ev, st, data) => h('button', { type: 'button', class: 'pj-rec', onclick: () => openProject(ev) }, h('span', {}, ev.name + ' ', h('span', { class: 'meta num' }, (ev.date.slice(0, 4) !== todayIso().slice(0, 4) ? ev.date.slice(2, 4) + '년 ' : '') + md(ev.date))), h('span', { class: 'meta' }, data.records?.[evKey(ev)] ? '3줄 정리 있음' : '할 일 ' + st.doneCount + '/' + st.mine.length));
// 절기·행사 목록 자료: 진행 중·다가오는(1년 안) / 끝난(1년 안, 최근 먼저). 할 일 0개 절기는 달력에만(교회가 넣은 행사는 관리하려고 남김)
function projects(data, kind = 'all') {
  const s = { ...data.settings, customEvents: data.customEvents }, today = todayIso(), y = +today.slice(0, 4), tasks = seasonTasks(today, s), done = handled(data.done, data.skipped);
  const evs = occurrences([y - 1, y, y + 1], s).filter(ev => (kind === 'all' || !!ev.custom === (kind === 'custom')) && (ev.custom || ev.tasks.length)).map(ev => [ev, projectState(ev, tasks, today, done)]);
  return { today, tasks, done, s, active: evs.filter(([ev, st]) => !st.ended && ev.date < addDays(today, 365)), past: evs.filter(([ev, st]) => st.ended && ev.date >= addDays(today, -365)).reverse() };
}
const secHead = (title, link) => h('div', { class: 'pj-sec-head' }, h('h3', {}, title), link);
const pjLink = (text, onclick) => h('button', { type: 'button', class: 'text-button pj-link', onclick }, text);

// 홈: 지금 할 일(밀린 일 + 앞으로 14일)
function nowView() {
  const box = h('div', { class: 'pj' }); view.append(box);
  let data = {}, ready = false, contiN = 0, contiDoc = null, qtRef = '';
  // 처음 3단계 안내의 각 단계로 가기: ① 오른쪽 할 일 카드의 [다 했어요] ② 콘티 ③ 설정의 멤버 초대
  const goStep = id => { if (id === 'conti') return show('ccm'); if (id === 'invite') { try { localStorage.setItem('church:open:set-invite', '1'); } catch { /* 그냥 연다 */ } return show('set'); } const b = box.querySelector('.pj-focus-area button.primary') || box.querySelector('.pj-chk input'); b?.scrollIntoView({ behavior: 'smooth', block: 'center' }); b?.focus({ preventScroll: true }); };
  fill(box, h('p', { class: 'hint loading' }, '할 일을 불러오는 중이에요'));
  const draw = () => {
    const p = projects(data), { today, tasks, done } = p, r = nowTasks(tasks, today, done), all = [...r.now, ...r.later];
    const sel = all.find(t => t.key === pickHome) || all[0], c = { data, done, today, sel: sel?.key, showEvent: true, pick: t => { pickHome = t.key; draw(); if (!matchMedia('(min-width:960px)').matches) $('pj-focus')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
    const next = all.find(t => t.due >= today), reqN = store.mode === 'shared' && isAdmin(data, store.auth?.user?.()?.uid) ? requestList(data).length : 0;
    { const def = (DEPTS.find(x => x.id === deptToPpt(deptsOf(data.settings)[0])) || {}).service || 'sunday-main', ids = contiTabs(contiDoc, def).filter(id => contiSongsOf(contiDoc, id, def).some(s => s?.title));
      contiN = ids.length > 1 ? ids.map(id => svcShort((worshipData?.services || []).find(x => x.id === id)?.name || id) + ' ' + contiSongsOf(contiDoc, id, def).filter(s => s?.title).length).join(' · ') : contiSongsOf(contiDoc, def, def).filter(s => s?.title).length; }
    const ob = onboardSteps({ anyDone: Object.values(data.done || {}).some(Boolean), contiSongs: typeof contiN === 'string' ? 1 : contiN, invited: onbGet('invite'), closed: onbGet('off') });
    fill(box,
      ob.show && h('div', { class: 'onb', role: 'region', 'aria-label': '처음 쓰는 분 안내' }, h('span', { class: 'onb-title' }, '처음이라면'), h('ol', { class: 'onb-steps' }, ob.steps.map(([id, t, ok], i) => h('li', { class: ok ? 'done' : '' }, h('button', { type: 'button', class: 'onb-step', 'aria-label': (i + 1) + '단계 ' + t + (ok ? ' (했어요)' : ''), onclick: () => goStep(id) }, h('span', { class: 'onb-mark', 'aria-hidden': 'true' }, ok ? '✓' : String(i + 1)), h('span', {}, t))))), h('button', { type: 'button', class: 'text-button onb-close', onclick: () => { onbSet('off'); draw(); } }, '닫기')),
      h('div', { class: 'pj-head' }, h('div', {}, h('p', { class: 'pj-eyebrow num' }, mdLong(today) + ' ' + '일월화수목금토'[parse(today).getUTCDay()] + '요일 · ' + deptsOf(data.settings).join(' · ')), h('h1', {}, '지금 할 일'),
        h('p', { class: 'pj-sub' }, all.length ? [all.length + '개', r.overdue > 0 && ' · ', r.overdue > 0 && h('span', { class: 'late' }, r.overdue + '개는 기한이 지났어요'), next && ' · 다음 기한 ' + fmt(next.due)] : '앞으로 2주 안에 할 일이 없어요')),
        all.length > 0 && h('button', { type: 'button', onclick: () => shareText(tasksShare((data.name || '우리 교회') + ' 지금 할 일', all)) }, '할 일 ' + all.length + '개 카톡으로 보내기')),
      reqN > 0 && h('p', { class: 'perm-alert' }, h('span', {}, '권한 요청 ' + reqN + '건'), h('button', { type: 'button', class: 'text-button go', onclick: () => { localStorage.setItem('church:open:set-admin', '1'); show('set'); } }, '보기')),
      h('div', { class: 'pj-split' },
        h('div', { class: 'pj-list' }, all.length ? h('div', { class: 'pj-box' }, r.now.map(t => pjRow(t, c)),
          r.later.length > 0 && h('details', { class: 'pj-more', open: r.later.some(t => t.key === sel?.key) || !r.now.length }, h('summary', {}, h('span', {}, '그다음 주(' + md(addDays(today, 8)) + '~' + md(addDays(today, 14)) + ') ' + r.later.length + '개'), pjChevron(true)), r.later.map(t => pjRow(t, c))))
          : h('div', { class: 'pj-box pj-empty' }, h('p', {}, '지금 챙길 일이 없어요.'), (() => { const n = tasks.find(t => t.due > today && !done[t.key]); return n && h('p', { class: 'meta' }, '다음 할 일 · ' + fmt(n.due) + ' ' + tTitle(n) + ' (' + n.event + ')'); })())),
        h('div', { class: 'pj-focus-area' }, focusCard(sel, { ...c, first: sel === all[0] })),
        h('div', { class: 'pj-rest' },
          h('section', {}, secHead('준비 중인 절기·행사', pjLink('달력으로 보기', () => show('events'))), p.active.length ? h('div', { class: 'pj-box' }, p.active.slice(0, 4).map(([ev, st]) => pjProj(ev, st, today))) : h('p', { class: 'hint' }, '다가오는 절기가 없어요')),
          p.past.length > 0 && h('section', {}, secHead('지난 절기 기록', pjLink('모두 보기', () => show('seasons'))), h('div', { class: 'pj-box' }, p.past.slice(0, 3).map(([ev, st]) => pjRec(ev, st, data)))),
          // 예전 홈 카드는 작은 한 줄씩(지금 할 일보다 눈에 띄지 않게)
          h('section', { class: 'home-mini' }, h('p', {}, h('span', {}, '이번 주일 찬양 ' + (typeof contiN === 'string' ? contiN : contiN ? contiN + '곡' : '아직 없음')), h('button', { type: 'button', class: 'text-button', onclick: () => show('ccm') }, '콘티 열기')), qtRef && h('p', {}, h('span', {}, '오늘의 말씀 ' + qtRef), h('button', { type: 'button', class: 'text-button', onclick: () => show('qt') }, '열기'))))));
  };
  const redraw = () => ready && box.isConnected && draw();
  loadGuides().then(redraw);
  watch(churchPath() + '/conti/' + nextSunday(todayIso()), d => { contiDoc = d; redraw(); });
  loadWorship().then(redraw).catch(() => {});
  fetch('./qt-refs.json').then(r => r.json()).then(refs => { qtRef = refs[qtIndex(todayIso(), refs.length)] || ''; redraw(); }).catch(() => {});
  watch(churchPath(), d => { data = d || {}; ready = true; draw(); }, () => fill(box, h('div', { class: 'empty-state' }, h('p', {}, '불러오지 못했어요'), h('button', { type: 'button', class: 'sub', onclick: () => show('home') }, '다시 시도'))));
}

// 절기·행사 > 절기 / 행사: 진행 중·다가오는 목록(→ 상세) + 끝난 기록(→ 기록)
function scheduleView(kind = 'season') {
  const mine = kind === 'custom', box = h('div', { class: 'pj pj-lists' }), addBox = h('section', { class: 'card', hidden: true });
  const add = () => { addBox.hidden = false; addEventPanel(addBox, todayIso(), () => { addBox.hidden = true; draw(); }); };
  // 폰은 화면 위 [절기|행사], 컴퓨터는 사이드바 하위 메뉴
  view.append(h('div', { class: 'segments only-narrow' }, [['season', 'seasons', '절기'], ['custom', 'ourEvents', '행사']].map(([k, id, t]) => h('button', { type: 'button', class: 'sub', 'aria-pressed': String(k === kind), onclick: () => k !== kind && show(id) }, t))),
    ...(mine ? [h('div', { class: 'schedule-bar' }, h('button', { class: 'primary', onclick: add }, '+ 행사 추가'))] : []), addBox, box);
  let data = {};
  fill(box, h('p', { class: 'hint' }, '일정을 불러오는 중이에요'));
  const draw = () => {
    const p = projects(data, mine ? 'custom' : 'season'), word = mine ? '행사' : '절기';
    fill(box,
      h('section', {}, secHead('진행 중·다가오는 ' + word, pjLink('달력으로 보기', () => show('events'))), p.active.length ? h('div', { class: 'pj-box' }, p.active.map(([ev, st]) => pjProj(ev, st, p.today)))
        : h('div', { class: 'empty-state' }, h('p', {}, mine ? '아직 추가한 행사가 없어요. 수련회·바자회·성경학교를 넣어 보세요' : '앞으로 12개월 안에 절기가 없어요'), mine && h('button', { type: 'button', class: 'sub', onclick: add }, '첫 행사 추가'))),
      h('section', {}, secHead('지난 기록'), p.past.length ? h('div', { class: 'pj-box' }, p.past.map(([ev, st]) => pjRec(ev, st, data))) : h('p', { class: 'hint' }, '최근 1년 동안 끝난 ' + word + '이 없어요')));
  };
  watch(churchPath(), d => { data = d || {}; draw(); }, () => fill(box, h('div', { class: 'empty-state' }, h('p', {}, '불러오지 못했어요'), h('button', { type: 'button', class: 'sub', onclick: () => show(mine ? 'ourEvents' : 'seasons') }, '다시 시도'))));
}

// 절기 상세(진행 중·다가오는) / 끝난 절기 기록. projectKey = '대림절 id_날짜'
function projectView() {
  const box = h('div', { class: 'pj' }); view.append(box);
  let data = {};
  fill(box, h('p', { class: 'hint loading' }, '불러오는 중이에요'));
  const draw = () => {
    const s = { ...data.settings, customEvents: data.customEvents }, today = todayIso(), y = +today.slice(0, 4), tasks = seasonTasks(today, s), done = handled(data.done, data.skipped);
    const evs = occurrences([y - 1, y, y + 1], s), ev = evs.find(e => evKey(e) === projectKey);
    if (!ev) { fill(box, h('div', { class: 'empty-state' }, h('p', {}, '이 절기·행사를 찾지 못했어요(숨겼거나 삭제했을 수 있어요)'), h('button', { type: 'button', class: 'sub', onclick: () => show('seasons') }, '절기 목록으로'))); return; }
    markNav(ev.custom ? 'ourEvents' : 'seasons');
    const st = projectState(ev, tasks, today, done), crumb = h('button', { type: 'button', class: 'text-button pj-link', onclick: () => projectList(ev) }, '절기·행사');
    const others = evs.filter(e => e.id === ev.id && e.date !== ev.date && currentPhase(e.date, today) === 6);
    if (st.ended) return fill(box, recordBody(ev, st, data, done, crumb, others));
    const c = { data, done, today, showEvent: false, pick: t => { pickProject = t.key; draw(); if (!matchMedia('(min-width:960px)').matches) $('pj-focus')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); } };
    const cur = Math.min(st.phase, 5), rows = [...st.overdue, ...st.byPhase[cur]], undone = rows.find(t => !done[t.key]) || st.mine.find(t => !done[t.key]);
    const sel = st.mine.find(t => t.key === pickProject) || undone || rows[0] || st.mine[0];
    c.sel = sel?.key;
    const ends = phaseEnds(ev.date), last = others.at(-1), lastMemo = last && data.records?.[evKey(last)];
    fill(box,
      h('div', { class: 'pj-head' }, h('div', {}, h('p', { class: 'pj-eyebrow' }, crumb, ' › ' + ev.date.slice(0, 4)), h('h1', {}, ev.name),
        h('p', { class: 'pj-sub num' }, fmtLong(ev.date) + ' · ' + dLabel(daysTo(ev.date, today)), ABOUT[ev.id] && [' · ', h('button', { type: 'button', class: 'text-button pj-link', onclick: () => showAbout(ev) }, '무슨 절기인가요?')])),
        st.mine.length > 0 && h('button', { type: 'button', onclick: () => shareText(tasksShare((data.name ? data.name + ' ' : '') + ev.name + ' 준비', st.mine.filter(t => !done[t.key]))) }, '이 ' + (ev.custom ? '행사' : '절기') + ' 할 일 카톡으로 보내기')),
      h('ol', { class: 'pj-stepper', 'aria-label': '준비 구간 6개' }, PHASES.map((name, i) => { const ts = st.byPhase[i], now = st.started && i === cur, past = i < cur; return h('li', { class: 'pj-step' + (now ? ' now' : past ? ' past' : ''), ...(now && { 'aria-current': 'step' }) },
        h('b', {}, name, h('em', {}, past ? '지남' : now ? '진행 중' : '시작 전')), h('span', { class: 'num' }, (i === 4 ? fmt(ends[4]) : md(ends[i]) + '까지') + (ts.length ? ' · ' + (past || now ? ts.filter(t => done[t.key]).length + '/' + ts.length : ts.length + '개') : ''))); })),
      h('div', { class: 'pj-split' },
        h('div', { class: 'pj-list' }, secHead((st.started ? '지금: ' : '곧 시작: ') + PHASES[cur] + ' 구간', h('span', { class: 'meta num' }, (cur === 4 ? fmt(ends[4]) : fmt(ends[cur]) + '까지') + ' · ' + st.byPhase[cur].length + '개 중 ' + st.byPhase[cur].filter(t => done[t.key]).length + '개')),
          rows.length ? h('div', { class: 'pj-box' }, rows.map(t => pjRow(t, c))) : h('div', { class: 'pj-box pj-empty' }, h('p', { class: 'meta' }, '이 구간에는 할 일이 없어요. 아래 다음 구간을 보세요'))),
        h('div', { class: 'pj-focus-area' }, focusCard(sel, { ...c, first: sel === undone && rows.includes(sel) })),
        h('div', { class: 'pj-rest' },
          PHASES.some((_, i) => i > cur && st.byPhase[i].length) && h('section', {}, secHead('다음 구간', h('span', { class: 'meta' }, '눌러서 미리 보기')), h('div', { class: 'pj-box' }, PHASES.map((name, i) => i > cur && st.byPhase[i].length > 0 && h('details', { class: 'pj-more', open: st.byPhase[i].some(t => t.key === sel?.key) }, h('summary', {}, h('span', {}, h('b', {}, name), h('span', { class: 'meta num' }, ' · ' + md(ends[i]) + '까지 · ' + st.byPhase[i].length + '개')), pjChevron(true)), st.byPhase[i].map(t => pjRow(t, c)))))),
          PHASES.some((_, i) => i < cur && st.byPhase[i].length) && h('details', { class: 'pj-more pj-box' }, h('summary', {}, h('span', {}, '지난 구간 할 일 ' + st.byPhase.slice(0, cur).flat().length + '개'), pjChevron(true)), st.byPhase.slice(0, cur).flat().map(t => pjRow(t, c))),
          h('section', { class: 'pj-side' }, h('h3', {}, '지난해 ' + ev.name + ' 기록'), lastMemo ? [h('div', { class: 'pj-facts read' }, MEMO.map(([f, label]) => lastMemo[f] && h('p', { class: 'pj-fact' }, h('span', { class: 'pj-label' }, label), lastMemo[f]))), pjLink('지난 기록 열기', () => openProject(last))]
            : h('p', { class: 'meta' }, "아직 없어요. 올해 '정리·기록' 구간에서 3줄을 남기면, 내년 이맘때 여기에 떠요.")),
          (ev.buy?.length > 0 || ev.id === 'retreat') && h('section', { class: 'pj-side pj-extras' }, h('h3', {}, '준비물'), eventExtras(ev, data).slice(0, 3)), // 서류는 할 일 안내 카드에
          h('details', { class: 'pj-side pj-edit' }, h('summary', {}, '날짜 바꾸기 · ' + (ev.custom ? '삭제' : '올해 끄기')), eventEditor(ev, data, () => {}, false, true)))));
  };
  loadGuides().then(() => box.isConnected && draw());
  watch(churchPath(), d => { data = d || {}; draw(); }, () => fill(box, h('div', { class: 'empty-state' }, h('p', {}, '불러오지 못했어요'), h('button', { type: 'button', class: 'sub', onclick: () => show('project') }, '다시 시도'))));
}
// 끝난 절기 기록: 3줄 정리 · 무엇을 언제 했나 · 남은 서류 · 다른 해. [한 장으로 저장] = 인쇄(PDF)
function recordBody(ev, st, data, done, crumb, others) {
  const n = st.doneCount, total = st.mine.length, files = [...new Set(st.mine.map(t => t.doc).filter(Boolean))].map(pjDoc).filter(Boolean);
  const when = t => { const d = data.done?.[t.key]; if (d?.at) { const late = daysTo(d.at, t.due); return md(d.at) + (late > 0 ? ' (' + late + '일 늦음)' : ''); } return data.skipped?.[t.key] ? '건너뜀' : '안 함'; };
  return [h('div', { class: 'pj-head' }, h('div', {}, h('p', { class: 'pj-eyebrow' }, crumb, ' › 지난 기록'), h('h1', {}, ev.date.slice(0, 4) + ' ' + ev.name),
      h('p', { class: 'pj-sub num' }, fmtLong(ev.date) + ' · 끝남 · ' + (total && n === total ? '할 일 ' + total + '개 모두 완료' : '할 일 ' + total + '개 중 ' + n + '개 완료') + (files.length ? ' · 서류 ' + files.length : ''))),
      h('button', { type: 'button', class: 'primary', onclick: () => window.print() }, '한 장으로 저장(인쇄·PDF)')),
    h('div', { class: 'pj-grid pj-record' },
      h('div', { class: 'pj-main' },
        h('section', { class: 'pj-side pj-summary' }, h('h3', {}, '한눈에 보기'), memoFields(evKey(ev), data), h('p', { class: 'meta' }, '정리·기록 구간에 리더 모임이 남기는 3줄이에요. 내년 이맘때 이 ' + (ev.custom ? '행사' : '절기') + ' 상세 화면에 다시 보여요.')),
        h('section', { class: 'pj-log-block' }, secHead('무엇을 언제 했나', h('span', { class: 'meta' }, '구간별 · 체크한 날')), h('ol', { class: 'pj-side pj-log' }, st.mine.map(t => h('li', {}, h('span', { class: 'pj-label' }, PHASES[t.phase]), h('span', {}, tTitle(t), h('span', { class: 'meta num' }, ' · ' + [t.who, when(t), t.doc && '서류 1'].filter(Boolean).join(' · ')))))))),
      h('div', { class: 'pj-aside' },
        h('section', { class: 'pj-side pj-files' }, h('h3', {}, '남은 자료 ', h('span', { class: 'meta' }, files.length + '개')), files.length ? h('ul', {}, files.map(doc => h('li', {}, h('span', {}, doc.title, h('span', { class: 'meta' }, ' · 워드')), h('a', { class: 'pj-btn text', href: doc.file, download: true, 'aria-label': doc.title + ' 워드 받기' }, '받기')))) : h('p', { class: 'meta' }, '이 ' + (ev.custom ? '행사' : '절기') + ' 할 일에 붙은 서류가 없어요')),
        h('section', { class: 'pj-side pj-years' }, h('h3', {}, '다른 해 ' + ev.name), others.length ? others.map(o => pjLink(o.date.slice(0, 4) + '년 ' + ev.name + ' 기록', () => openProject(o))) : h('p', { class: 'meta' }, ev.date.slice(0, 4) + '년이 첫 기록이에요. 해마다 여기에 쌓여요.'))))];
}
// 홈 하위 탭 [홈 | 교회 일정]
const homeTabs = cur => h('div', { class: 'segments home-tabs', role: 'group', 'aria-label': '홈 화면 고르기' }, [['home', '홈'], ['events', '교회 일정']].map(([id, t]) => h('button', { type: 'button', class: 'sub', 'aria-pressed': String(id === cur), onclick: () => id !== cur && show(id) }, t)));
function moreView(){ view.append(h('div',{class:'more-list'},[['word','말씀'],['worship','예배'],['docs','자료실'],['equipment','장비'],['set','설정']].map(([id,t])=>h('button',{class:'sub',onclick:()=>show(id)},t)))); }
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
 const box = bigDialog(title + ' 악보', 'sheet-dialog', status, img); box.querySelector('.event-dialog-heading')?.append(h('div', { class: 'sheet-tools' }, bar, star)); load(id);
}
function docsView() {
 let dept = null;
 const find = h('input', { type: 'search', class: 'doc-search', placeholder: '수련회, 회의록, 결과보고…', 'aria-label': '자료 찾기', oninput: () => draw() });
 const picker = h('details', { class: 'dept-picker' }), mineBox = h('section', { class: 'doc-list' }), commonBox = h('section', { class: 'doc-list' });
 const row = (doc, inGroup) => h('details', { class: 'doc-row', ontoggle: e => { const d = e.currentTarget; if (d.open && !d.querySelector('iframe')) d.querySelector('.doc-frame')?.append(h('iframe', { src: doc.file.replace(/\.docx$/, '.html'), title: doc.title + ' 미리보기', loading: 'lazy' })); } }, h('summary', {}, h('span', { class: 'doc-kind' }, docKind(doc.title)), h('span', { class: 'doc-title' }, doc.title), !inGroup && h('small', { class: 'meta' }, doc.group)), h('div', { class: 'doc-frame' }), h('p', {}, doc.desc), h('button', { type: 'button', class: 'sub preview-button', onclick: () => showPreview(doc) }, '크게 보기'), docLink(doc));
 const draw = () => {
  const term = find.value.trim();
  picker.hidden = !!term;
  if (term) { const hits = docs.filter(d => (d.title + ' ' + (d.desc || '') + ' ' + (d.group || '')).includes(term)); fill(mineBox, h('h3', {}, '찾은 자료 ' + hits.length + '개'), hits.length ? hits.map(row) : h('p', { class: 'empty' }, '찾는 자료가 없어요. 다른 낱말로 찾아보세요.')); commonBox.hidden = true; return; }
  const { mine, common } = docsFor(docs, dept);
  fill(picker, h('summary', {}, '부서: ' + dept), h('div', { class: 'row', role: 'group', 'aria-label': '부서 고르기' }, DOC_DEPTS.map(d => h('button', { type: 'button', class: 'sub', 'aria-pressed': String(d === dept), onclick: () => { dept = d; picker.open = false; draw(); } }, d))));
  // 분류(행정·안내/교육·행사/수련회·MT/순례)별로 접어 묶는다. 자료가 적으면 처음부터 펼친다.
  const groups = [...new Set(['행정·안내', '교육·행사', '수련회·MT', '순례', ...mine.map(d => d.group)])].map(g => [g, mine.filter(d => d.group === g)]).filter(([, list]) => list.length);
  fill(mineBox, h('h3', {}, (dept === '전체' ? '모든 자료 ' : dept + ' 자료 ') + mine.length + '개'), mine.length ? groups.map(([g, list]) => h('details', { class: 'doc-group' }, h('summary', {}, h('strong', { class: 'doc-group-title' }, g), h('small', { class: 'meta' }, list.length + '개')), list.map(d => row(d, true)))) : h('p', { class: 'empty' }, '이 부서용 자료가 아직 없어요'));
  fill(commonBox, common.length ? h('details', { class: 'doc-group' }, h('summary', {}, h('strong', { class: 'doc-group-title' }, '공통 자료'), h('small', { class: 'meta' }, common.length + '개')), common.map(d => row(d, true))) : null);
  commonBox.hidden = !common.length;
 };
 // [서류 | 링크] 탭. 링크는 부서 고르기(서류와 같은 부서) → 종류별 접기 → 이름(새 창 ↗) + 설명 한 줄
 let tab = 'docs', links = null, res = null; const rec = h('div', { class: 'doc-rec' }), linkBox = h('section', { class: 'doc-list link-list' }), resBox = h('section', { class: 'res-box' }), resMore = new Set();
 const tabs = h('div', { class: 'segments doc-tabs', role: 'group', 'aria-label': '자료 종류' }, [['docs', '서류'], ['cur', '커리큘럼·교재'], ['trip', '나들이·수련회'], ['links', '링크']].map(([id, t]) => h('button', { type: 'button', class: 'sub', 'aria-pressed': String(id === tab), onclick: () => { tab = id; for (const b of tabs.children) b.setAttribute('aria-pressed', String(b.textContent === t)); paintTab(); } }, t)));
 const linkRow = x => h('li', {}, h('a', { href: x.url, target: '_blank', rel: 'noopener', class: 'link-name' }, x.name + ' ↗'), x.desc && h('small', { class: 'meta' }, x.desc));
 const linkGroups = (list, open) => byKind(list).map(([k, l]) => h('details', { class: 'doc-group', open }, h('summary', {}, h('strong', { class: 'doc-group-title' }, k), h('small', { class: 'meta' }, l.length + '개')), h('ul', { class: 'link-rows' }, l.map(linkRow))));
 const drawLinks = () => { if (!links) { links = []; fetch('./links.json').then(r => r.json()).then(l => { links = l; drawLinks(); }).catch(() => fill(linkBox, h('p', { class: 'err' }, '링크 목록을 불러오지 못했어요'))); return; }
  const { mine, common } = linksFor(links, dept);
  deptPick(drawLinks);
  fill(linkBox, h('h3', {}, (dept === '전체' ? '모든 링크 ' : dept + ' 링크 ') + mine.length + '개'), mine.length ? linkGroups(mine, mine.length <= 6) : h('p', { class: 'empty' }, '이 부서용 링크는 아직 없어요. 아래 공통 링크를 보세요'),
   common.length > 0 && h('h3', {}, '공통 링크 ' + common.length + '개'), linkGroups(common, false)); };
 const deptPick = redraw => fill(picker, h('summary', {}, '부서: ' + dept), h('div', { class: 'row', role: 'group', 'aria-label': '부서 고르기' }, DOC_DEPTS.map(d => h('button', { type: 'button', class: 'sub', 'aria-pressed': String(d === dept), onclick: () => { dept = d; picker.open = false; redraw(); } }, d))));
 // 알려 주기만 하는 비교 표(컴퓨터는 표, 폰은 항목마다 촘촘한 줄). 표가 길면 처음 8줄 + [더 보기]
 const COLS = { cur: [['size', '대상'], ['price', '가격'], ['pros', '장점'], ['cons', '단점'], ['fit', '이런 곳에 맞아요']], trip: [['region', '지역'], ['size', '알맞은 인원'], ['price', '가격·예약'], ['pros', '좋은 점'], ['cons', '주의할 점']] };
 const resTable = (title, cat, kind) => {
  const all = resourcesFor(res, cat, dept, kind === 'trip'), cols = cat === '수련회 장소' ? [...COLS.trip.slice(0, 3), ['has', '시설'], ...COLS.trip.slice(3)] : COLS[kind], more = resMore.has(cat), list = more ? all : all.slice(0, 8);
  const name = x => h('a', { href: x.url, target: '_blank', rel: 'noopener', class: 'link-name' }, x.name + ' ↗');
  return h('section', { class: 'res-section' }, h('h3', {}, title + ' ' + all.length + '개'),
   !all.length ? h('p', { class: 'empty' }, '이 부서에 맞는 자료가 아직 없어요. 위에서 부서를 바꿔 보세요') : [
    h('table', { class: 'res-table' }, h('thead', {}, h('tr', {}, h('th', { scope: 'col' }, kind === 'cur' ? '이름 · 발행처' : '이름'), cols.map(([, t]) => h('th', { scope: 'col' }, t)))),
     h('tbody', {}, list.map(x => h('tr', {}, h('th', { scope: 'row' }, name(x), kind === 'cur' && x.region && h('small', { class: 'meta' }, x.region)), cols.map(([k]) => h('td', {}, x[k] || '')))))),
    h('ul', { class: 'res-cards' }, list.map(x => h('li', {}, name(x), h('p', { class: 'meta' }, [x.region, x.size, x.price].filter(Boolean).join(' · ')), x.pros && h('p', {}, h('b', {}, kind === 'cur' ? '장점 ' : '좋은 점 '), x.pros), x.cons && h('p', {}, h('b', {}, kind === 'cur' ? '단점 ' : '주의할 점 '), x.cons), (x.fit || x.has) && h('p', { class: 'meta' }, x.fit || '시설: ' + x.has)))),
    all.length > 8 && h('button', { type: 'button', class: 'text-button res-more', onclick: () => { more ? resMore.delete(cat) : resMore.add(cat); drawRes(); } }, more ? '접기' : '더 보기 · ' + (all.length - 8) + '개 더')]);
 };
 const drawRes = () => { if (!res) { res = []; fetch('./resources.json').then(r => r.json()).then(l => { res = Array.isArray(l) ? l : []; drawRes(); }).catch(() => fill(resBox, h('p', { class: 'err' }, '자료를 불러오지 못했어요'))); return; }
  deptPick(drawRes);
  fill(resBox, h('p', { class: 'meta res-note' }, '가격·조건은 조사 시점(2026-10) 기준이에요. 신청 전 공식 사이트에서 확인하세요.'),
   tab === 'cur' ? [resTable('교회학교 커리큘럼', '커리큘럼', 'cur'), resTable('큐티책 비교', '큐티책', 'cur')] : [resTable('나들이', '나들이', 'trip'), resTable('성지순례', '성지순례', 'trip'), resTable('수련회 장소', '수련회 장소', 'trip')]); };
 const paintTab = () => { const on = tab === 'docs'; find.hidden = mineBox.hidden = pptBox.hidden = !on; linkBox.hidden = tab !== 'links'; resBox.hidden = tab !== 'cur' && tab !== 'trip'; if (on) return draw(); commonBox.hidden = true; picker.hidden = false; tab === 'links' ? drawLinks() : drawRes(); };
 const pptBox = pptTemplatesSection(); linkBox.hidden = resBox.hidden = true;
 view.append(rec, tabs, find, picker, mineBox, commonBox, linkBox, resBox, pptBox);
 // 추천 한 줄: 8주 안 행사(절기·교회 행사)에 관련 서류가 있으면 "수련회까지 3주: [계획서 받기]"
 const paintRec = d => { const today = todayIso(), y = +today.slice(0, 4), s = { ...d?.settings, customEvents: d?.customEvents };
  const ev = occurrences([y, y + 1], s).filter(e => e.date >= today && e.date <= addDays(today, 56)).find(e => relatedDocs(e, docs).length), doc = ev && relatedDocs(ev, docs)[0];
  if (!doc) return fill(rec);
  const days = Math.round((parse(ev.date) - parse(today)) / 864e5);
  fill(rec, h('span', {}, ev.name + '까지 ' + (days < 7 ? days + '일' : Math.round(days / 7) + '주') + ': '), h('a', { class: 'primary', href: doc.file, download: true, 'aria-label': doc.title + ' 워드 파일 받기' }, doc.title + ' 받기'), h('button', { type: 'button', class: 'text-button', onclick: () => showPreview(doc) }, '미리보기')); };
 watch(churchPath(), d => { paintRec(d); if (dept !== null) return; dept = docDept(d?.settings); draw(); });
}
// 구매 도움: "구매하려고 해요"를 체크해야 링크가 눌린다(구매 의사가 있을 때만). 체크 전에는 흐린 버튼
// 작은 확인 시트: [이동하기]를 눌러야 실행
function confirmSheet(title, text, okLabel, onOk) {
 const box = h('dialog', { class: 'event-dialog confirm-sheet', 'aria-label': title }, h('h2', {}, title), h('p', {}, text),
  h('div', { class: 'row dlg-actions' }, h('button', { type: 'button', class: 'primary', onclick: () => { box.close(); onOk(); } }, okLabel), h('button', { type: 'button', class: 'text-button', onclick: () => box.close() }, '취소')));
 box.addEventListener('click', e => { if (e.target !== box) return; const r = box.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) box.close(); });
 box.addEventListener('close', () => box.remove());
 document.body.append(box); box.showModal();
}
// 구매 도움 목록: 링크는 늘 진하게 눌린다. 아직 확인 전이면 기본 이동을 막고 ask(주소, 상품)로 확인을 받는다
function buyHelpBody(list, confirmed, ask) {
 const link = (p, href, label, aria) => h('a', { class: 'sub-link', href, target: '_blank', rel: 'noopener sponsored', 'aria-label': p.name + ' ' + aria + '(새 창)', onclick: e => { if (!confirmed()) { e.preventDefault(); ask(href, p); } } }, label);
 // 상품 줄은 낮게 한 줄: 상품명 · 가격 · [쿠팡 ↗][가격 비교 ↗](글자형). 추천 이유는 이름에 올리면 보인다
 return [h('ul', { class: 'buy-list' }, list.map(p => h('li', {}, h('span', { class: 'buy-name', title: p.why || null }, p.name), h('small', { class: 'meta buy-price' }, p.price || '가격 정보 없음'),
   h('span', { class: 'buy-links' }, link(p, productLink(p), '쿠팡 ↗', '쿠팡에서 보기'), link(p, compareLink(p.name), '가격 비교 ↗', '가격 비교'))))),
  h('p', { class: 'meta buy-notice' }, '가격은 조사 시점 기준이에요. ' + buyNotice(list))];
}
// 장비 한 줄: [품목명(좋음+메모면 옆에 작은 회색 메모)] [점검 필요][고장] 칩 · 켜진 칩이면 메모 칸 · [− n +]
// 칩을 다시 누르면 꺼짐 = 좋음(메모는 지우지 않는다). 칩은 수량 1개 이상일 때만
function eqRow(id, item, act) {
 const qty = Number(item.qty) || 0, bad = item.state === '점검 필요' || item.state === '고장';
 const chip = (v, cls) => h('button', { type: 'button', class: 'eq-chip ' + cls, 'aria-pressed': String(item.state === v), 'aria-label': item.name + ' ' + v + (item.state === v ? ' 끄기' : ''), onclick: () => act.setState(item.state === v ? '좋음' : v) }, h('span', {}, v));
 return h('tr', { class: qty ? 'has-qty' : '' }, h('th', { scope: 'row' }, item.name, !bad && item.memo && h('small', { class: 'eq-note' }, item.memo)),
  qty > 0 && h('td', { class: 'eq-chips' }, chip('점검 필요', 'check'), chip('고장', 'broken')),
  bad && h('td', { class: 'eq-memo' }, h('input', { value: item.memo || '', maxLength: 500, placeholder: '무엇이 문제인지 메모', k: 'eq:' + id + 'memo', 'aria-label': item.name + ' 메모', oninput: e => act.setMemo(e.target.value) })),
  h('td', { class: 'stepper' }, h('button', { type: 'button', class: 'sub', 'aria-label': item.name + ' 하나 빼기', disabled: qty <= 0, onclick: () => act.setQty(qty - 1) }, '−'), h('input', { type: 'number', min: 0, step: 1, inputMode: 'numeric', value: qty, k: 'eq:' + id + 'qty', 'aria-label': item.name + ' 수량', oninput: e => { if (e.target.value !== '' && e.target.validity.valid) act.setQty(Number(e.target.value)); } }), h('button', { type: 'button', class: 'sub', 'aria-label': item.name + ' 하나 더하기', onclick: () => act.setQty(qty + 1) }, '+')));
}
function equipmentView() {
 let focusMemo='', only=''; const qtyOpen=new Map(), buyOpen=new Map(), buyOk=new Set(); let products=[], last;
 // 구매 상자: 연한 바탕, 한 줄 상품 줄, 쿠팡 파트너스 고지·구매 의사 확인
 const buyBox=(c,list)=>h('div',{class:'buy-help',id:'buy-'+equipmentId(c,'')},h('p',{class:'buy-title'},'살 때 참고'+(list.some(p=>productLink(p)!==p.url)?'(쿠팡 파트너스)':'')),...buyHelpBody(list,()=>buyOk.has(c),(href,p)=>confirmSheet('구매하려고 하시나요?',(href.includes('coupang')?'쿠팡':'가격 비교 페이지')+'으로 이동해요 · '+(href.includes('coupang')&&p.partner?'쿠팡 파트너스 수수료를 받을 수 있어요':'가격은 바뀔 수 있어요'),'이동하기',()=>{buyOk.add(c);window.open(href,'_blank','noopener');})));
 const summary=h('p',{class:'equipment-summary'}),box=h('div',{class:'equipment-grid'});
 const cat=h('select',{'aria-label':'추가 장비 분류'},Object.keys(equipment).map(c=>h('option',{value:c},c)));
 const name=h('input',{required:true,maxLength:100,placeholder:'품목 이름','aria-label':'추가할 품목 이름'});
 const form=h('form',{class:'equipment-add',onsubmit:e=>{e.preventDefault();const n=name.value.trim();if(!n)return;save(churchPath(),{equipment:{[equipmentId(cat.value,n)]:{cat:cat.value,name:n,qty:1,state:'좋음',memo:''}}});name.value='';say(n+' 1개를 넣었어요');}},cat,name,h('button',{class:'sub'},'추가'));
 view.append(summary,box,h('h3',{class:'equipment-add-title'},'목록에 없는 품목 추가'),form);
 const render=d=>{
 const entries=equipmentRows(d?.equipment||{}),total=entries.reduce((n,[,v])=>n+Number(v.qty||0),0),needs=entries.filter(([,v])=>v.state==='점검 필요').length,broken=entries.filter(([,v])=>v.state==='고장').length;
 // 점검 필요·고장 거르기: 켜면 그 상태 품목만, 그 묶음은 [수량]이 열린다
 const filt=(v,n)=>h('button',{type:'button',class:'chip eq-filter','aria-pressed':String(only===v),disabled:!n&&only!==v,onclick:()=>{only=only===v?'':v;render(last);}},v+' '+n);
 // 추천: 고장·점검이 있으면 맨 위 [고장 n · 점검 n 확인하기](둘 다 거름), 없으면 추천 없음
 fill(summary,(needs||broken)>0&&only!=='문제'&&h('button',{type:'button',class:'primary eq-rec',onclick:()=>{only='문제';render(last);}},[broken&&'고장 '+broken,needs&&'점검 '+needs].filter(Boolean).join(' · ')+' 확인하기'),h('span',{},'전체 '+total+'개'),filt('점검 필요',needs),filt('고장',broken),only==='문제'&&h('button',{type:'button',class:'chip eq-filter','aria-pressed':'true',onclick:()=>{only='';render(last);}},'문제 있는 품목만 ×'));
 fill(box,Object.keys(equipment).map(c=>{const mine=entries.filter(([,v])=>v.cat===c),owned=mine.filter(([,v])=>v.state!=='없음'),warn=mine.filter(([,v])=>v.state==='점검 필요'||v.state==='고장').length,rows=only==='문제'?mine.filter(([,v])=>v.state==='점검 필요'||v.state==='고장'):only?mine.filter(([,v])=>v.state===only):mine,list=productsFor(c,products);
  if(only&&!rows.length)return null;
  const qOn=only?true:qtyOpen.has(c)?qtyOpen.get(c):owned.length>0,bOn=!!buyOpen.get(c)&&list.length>0,tid='eq-'+equipmentId(c,'');
  // 묶음 제목 줄 전체가 품목 목록 접기(주 내용), 오른쪽 '살 곳 보기'는 따로 여는 보조 동작
  return h('section',{class:'equipment-category'},h('div',{class:'eq-head'},h('button',{type:'button',class:'eq-fold','aria-expanded':String(qOn),'aria-controls':tid,onclick:()=>{qtyOpen.set(c,!qOn);render(last);}},h('span',{class:'chev','aria-hidden':'true'}),h('span',{class:'eq-name'},c),h('small',{class:warn?'late':'meta'},owned.length?owned.length+'종 보유'+(warn?' · 점검 '+warn:''):'없음')),
    list.length>0&&h('button',{type:'button',class:'eq-buy','aria-expanded':String(bOn),'aria-controls':'buy-'+equipmentId(c,''),onclick:()=>{buyOpen.set(c,!bOn);render(last);}},bOn?'살 곳 닫기':'살 곳 보기')),
   bOn&&buyBox(c,list),
   qOn&&h('table',{id:tid},h('thead',{},h('tr',{},['품목','수량'].map(t=>h('th',{},t)))),h('tbody',{},rows.map(([id,item])=>{
 const write=(key,value)=>save(churchPath(),{equipment:{[id]:{cat:item.cat,name:item.name,[key]:value}}});
 const qty=Number(item.qty)||0;
 // 수량을 바꾸면 상태도 맞춘다: 0개면 '없음', 처음 1개 이상이면 '좋음'
 const setQty=n=>{n=Math.max(0,Math.floor(n)||0);save(churchPath(),{equipment:{[id]:{cat:item.cat,name:item.name,qty:n,state:n===0?'없음':item.state==='없음'?'좋음':item.state}}});};
 return eqRow(id,item,{setQty,setState:v=>{if(v!=='좋음')focusMemo=id;write('state',v);},setMemo:v=>later('eq:'+id+'memo',()=>write('memo',v))});
 }))));}));
 if(focusMemo){box.querySelector('[data-k="eq:'+focusMemo+'memo"]')?.focus();focusMemo='';}
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
 const content=h('div'); let step=1, tasksOpen=false;
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
 // 2단계: 이름·날짜만 먼저(일수는 작은 칸, 기본 1). 할 일은 "준비할 일 n개 · 고치기 ∨"로 접고, 한 줄에 [− 8 +] 할 일 · 담당 ×. [추가]는 창 아래에 붙어 있다
 else { const weeks=w=>w>0?'D-'+w+'주':w===0?'당일':'행사 후 '+(-w)+'주';
  content.append(h('form',{class:'event-form',onsubmit:async e=>{e.preventDefault();if(!draft.name.trim())return;if(await save(churchPath(),{customEvents:{['c'+Date.now().toString(36)]:{...draft,name:draft.name.trim(),tasks:draft.tasks.filter(t=>t[1].trim()).map(([w,t,who,doc])=>({w:Number(w)||0,t,who:who||'',...(doc?{doc}:{})}))}}}))dismiss();}},
   field('이름','text','name',{maxLength:100}),h('div',{class:'event-when'},field('날짜','date','date'),field('일수','number','days',{min:1,max:10,step:1,class:'days-input'})),
   h('details',{class:'task-fold',open:tasksOpen,ontoggle:e=>tasksOpen=e.target.open},h('summary',{},'준비할 일 '+draft.tasks.length+'개 · 고치기'),
    draft.tasks.map((t,i)=>h('div',{class:'task-line'},h('span',{class:'task-weeks'},h('button',{type:'button',class:'sub','aria-label':'주 수 줄이기',onclick:()=>{t[0]=Math.max(-4,(Number(t[0])||0)-1);draw();}},'−'),h('span',{class:'weeks-label'},weeks(Number(t[0])||0)),h('button',{type:'button',class:'sub','aria-label':'주 수 늘리기',onclick:()=>{t[0]=Math.min(52,(Number(t[0])||0)+1);draw();}},'+')),h('input',{value:t[1],required:true,'aria-label':'할 일',placeholder:'할 일',oninput:e=>t[1]=e.target.value}),h('input',{class:'who-input',value:t[2],'aria-label':'담당',placeholder:'담당',oninput:e=>t[2]=e.target.value}),h('button',{type:'button',class:'text-button','aria-label':(t[1]||'할 일')+' 지우기',onclick:()=>{draft.tasks.splice(i,1);draw();}},'×'))),
    h('button',{type:'button',class:'sub',onclick:()=>{draft.tasks.push([1,'','']);tasksOpen=true;draw();}},'+ 할 일')),
   h('div',{class:'row dlg-foot'},h('button',{class:'primary'},'추가'),h('button',{type:'button',onclick:()=>{step=1;draw();content.querySelector('button')?.focus();}},'이전')))); }
 box.scrollTop=0;
 }document.body.append(box);draw();box.showModal();
}

function homeView(){

 const nextBox=h('section',{class:'home-next'}),summary=h('section',{class:'home-summary'}),cal=h('section',{class:'card calendar'}),detail=h('section',{class:'card day-detail'}),agenda=foldCard('agenda',false,'agenda'),right=h('div',{class:'home-right'});
 let data={},selectedEvent=null,editing=null,adding=false; const sundayBox=foldCard('sunday',false,'rail-card'),wordBox=foldCard('word',false,'rail-card'),nowCard=foldCard('now',true,'now-card'),tipsCard=foldCard('tips',false,'tips-card');wordBox.hidden=true;
 // 주인공 버튼: 휴대폰에서는 탭바 위에 떠 있고, 컴퓨터에서는 화면 오른쪽 위에 붙는다
 const fab=h('button',{class:'primary fab',onclick:()=>{adding=true;editing=null;addEventPanel(right,selectedDay,()=>{adding=false;draw();});}},'+ 행사 추가');
 view.prepend(homeTabs('events'));view.append(summary,h('div',{class:'home-layout'},h('div',{class:'home-main'},nextBox,cal,detail),h('div',{class:'home-side'},agenda,right)),fab);
 // 첫 자료가 오기 전에는 빈 상자 대신 '불러오는 중'
 fill(cal,h('p',{class:'hint loading'},'일정을 불러오는 중이에요'));nextBox.hidden=detail.hidden=agenda.hidden=true;
 watch(churchPath()+'/conti/'+nextSunday(todayIso()),d=>{const songs=(d?.songs||[]).filter(s=>s.title);fill(sundayBox,foldHead('이번 주일 찬양',songs.length?songs.length+'곡':'아직 없음'),songs.length?h('ol',{class:'sunday-songs'},songs.map(s=>h('li',{},s.title))):h('p',{class:'hint'},'아직 콘티가 없어요'),h('button',{class:'sub go',onclick:()=>show('conti')},'콘티 열기'));});
 homeWord(wordBox);
 const today=todayIso(); selectedDay ||= today;
 const edit=e=>{editing=e;adding=false;draw();right.scrollIntoView({behavior:'smooth',block:'nearest'});};
 const prepOf=e=>addDays(e.date,-7*Math.max(0,...e.tasks.map(t=>t[0])));
 function draw(){
 cal.dataset.mode=homeMode;
 const s={...data.settings,customEvents:data.customEvents},done=handled(data.done,data.skipped),[y,m]=homeMonth.split('-').map(Number),grid=monthGrid(y,m),ts=tasksAround(homeMonth+'-01',s),evs=occurrences([y-1,y,y+1],s),spans=prepSpans(y,m,s),w=thisWeek(today,s,done);
 const choose=p=>{selectedEvent=p;selectedDay=p.start;editing=evs.find(e=>e.id===p.eventId&&e.date===p.end);adding=false;draw();};
 const move=n=>{if(homeMode==='day'||homeMode==='week'){selectedDay=addDays(selectedDay,n*(homeMode==='week'?7:1));homeMonth=selectedDay.slice(0,7);}else{const d=parse(homeMonth+'-01');d.setUTCMonth(d.getUTCMonth()+n*(homeMode==='year'?12:1));homeMonth=d.toISOString().slice(0,7);selectedDay=homeMonth+'-01';}selectedEvent=null;draw();};
 const period=homeMode==='year'?y+'년':homeMode==='week'?md(weekDays(selectedDay)[0])+'~'+md(weekDays(selectedDay)[6]):homeMode==='day'?fmt(selectedDay):y+'년 '+m+'월';
 const reqN=store.mode==='shared'&&isAdmin(data,store.auth?.user?.()?.uid)?requestList(data).length:0;
 fill(summary,h('div',{class:'home-top'},h('p',{class:'meta home-dept'},deptsOf(data.settings).join(' · '))),reqN>0&&h('p',{class:'perm-alert'},h('span',{},'권한 요청 '+reqN+'건'),h('button',{type:'button',class:'text-button go',onclick:()=>{localStorage.setItem('church:open:set-admin','1');show('set');}},'보기')),
  h('div',{class:'home-bar'},
   h('div',{class:'period-controls'},h('button',{class:'sub','aria-label':'이전 기간',onclick:()=>move(-1)},'◀'),h('strong',{class:'period-label'},homeMode==='month'?[h('span',{class:'period-year'},y+'년 '),m+'월']:period),h('button',{class:'sub','aria-label':'다음 기간',onclick:()=>move(1)},'▶')),
   h('button',{class:'sub today-button',onclick:()=>{homeMonth=today.slice(0,7);selectedDay=today;selectedEvent=null;draw();}},'오늘'),
   h('select',{class:'view-select','aria-label':'보기 바꾸기',onchange:e=>{homeMode=e.target.value;draw();}},[['day','일 보기'],['week','주 보기'],['month','월 보기'],['year','년 보기']].map(([id,t])=>h('option',{value:id,selected:homeMode===id},t)))));
 fill(cal,
 h('div',{class:'weekdays'},...'일월화수목금토'.split('').map(d=>h('div',{class:'weekday'},d))),grid.map(week=>h('div',{class:'calendar-week'},h('div',{class:'month-grid'},week.map(day=>{
 const cell=calendarCell(day,ts,evs), active=evs.filter(e=>occursOn(e,day)), starts=spans.filter(p=>p.start===day), inPrep=spans.filter(p=>p.start<=day&&p.end>day).sort((a,b)=>a.start.localeCompare(b.start));
 const label=[fmt(day),...active.map(e=>e.name),...starts.map(p=>p.name+' 준비 시작')].join(' · ');
 return h('div',{style:(active[0]?'--ev:'+eventColor(active[0].id)+';':'')+(starts[0]?'--ps:'+eventColor(starts[0].eventId)+';':'')+(inPrep[0]?'--pp:'+eventColor(inPrep[0].eventId):''),...(inPrep[0]?.start===day&&{'data-prep':inPrep[0].name.replace(/주일$/,'')}),ondragover:e=>{if(matchMedia('(pointer:fine)').matches){e.preventDefault();e.currentTarget.classList.add('drop-target');}},ondragleave:e=>e.currentTarget.classList.remove('drop-target'),ondrop:e=>{e.preventDefault();e.currentTarget.classList.remove('drop-target');const ev=evs.find(v=>v.id+'_'+v.date===e.dataTransfer.getData('text/plain'));if(ev)moveEvent(ev,day,data);},class:'day'+(active.length?' has-event':'')+(inPrep.length?' in-prep'+(inPrep[0].start===day?' prep-s':'')+(addDays(day,1)===inPrep[0].end?' prep-e':''):'')+(starts.length?' prep-day':'')+(day===today?' today':'')+(day===selectedDay?' selected':'')+(!day.startsWith(homeMonth)?' outside':'')},h('button',{class:'day-number','aria-label':label,'aria-pressed':String(day===selectedDay),onclick:()=>{selectedDay=day;selectedEvent=null;draw();}},day.endsWith('-01')?md(day):String(+day.slice(8))),cell.items.filter(item=>item.event).map(item=>h('button',{style:'background:'+eventColor(item.event.id)+';color:white',class:'calendar-item sub event-title',draggable:matchMedia('(pointer:fine)').matches,ondragstart:e=>e.dataTransfer.setData('text/plain',item.event.id+'_'+item.event.date),title:item.event.name,onclick:()=>{selectedDay=day;selectedEvent=null;editing=item.event;adding=false;draw();detail.scrollIntoView({behavior:'smooth',block:'nearest'});}},item.event.name)),cell.extra>0&&h('button',{class:'calendar-more sub',onclick:()=>{selectedDay=day;selectedEvent=null;draw();}},'외 '+cell.extra+'개'));
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
   (()=>{const dt=nextDocTask(mine,nx,done),doc=dt&&docs.find(d=>d.file.startsWith('docs/'+dt.doc+'_'));return doc&&h('p',{class:'next-doc'},h('span',{},'준비할 서류: '+doc.title+' · '+dt.event+' / '+mdLong(dt.due)+'까지'),h('button',{type:'button',class:'sub small',onclick:()=>showPreview(doc)},'미리보기'));})(),
   (w.overdue.length+w.week.filter(t=>!done[t.key]).length)>0&&h('button',{type:'button',class:'sub go todo-link',onclick:()=>show('home')},'챙길 일 '+(w.overdue.length+w.week.filter(t=>!done[t.key]).length)+'개 · 보기'),
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
 fill(right,sundayBox,wordBox,tipsCard);
 if(editing)fill(right,h('section',{class:'card editor-card'},eventEditor(editing,data,()=>{editing=null;draw();})));
 }watch(churchPath(),d=>{data=d||{};draw();},()=>fill(cal,h('div',{class:'empty-state'},h('p',{},'불러오지 못했어요'),h('button',{type:'button',class:'sub',onclick:()=>show('home')},'다시 시도'))));
}
const stepTitle=t=>h('h4',{class:'step-title'},h('span',{class:'step-number'},t.slice(0,1)),t.slice(2));
// 심화: 매튜 헨리 주석(1706, 저작권 만료)을 AI가 한국어로 풀어 쓴 글. tools/gen_deep.py가 만든다.
const deepBox=a=>{if(!a.deep)return null;const p=deepParts(a.deep);return h('details',{class:'qt-deep'},h('summary',{},p.label),h('p',{class:'qt-copy'},p.body),p.source&&h('p',{class:'bible-credit'},'출처: '+p.source),p.kind==='mh'&&h('p',{class:'bible-credit'},'매튜 헨리 성경 주석 요약판(1706, 저작권 만료)을 AI가 한국어로 풀어 썼어요'));};
// 책 개관(book-intro.json): 접힌 보조. 개관이 없는 책이면 null(접기 숨김)
let bookIntroLoad=null;
const loadIntro=()=>(bookIntroLoad??=fetch('./book-intro.json').then(r=>r.ok?r.json():{}).catch(()=>({})));
const introFold=(name,data)=>{const e=data?.[name],secs=introSections(e);if(!secs.length)return null;const doms=sourceDomains(e.sources);
 return h('details',{class:'book-intro'},h('summary',{},'이 책 개관('+name+')'),h('p',{class:'meta intro-note'},'AI가 여러 자료를 요약한 참고용이에요. 연대·인명은 원자료로 확인하세요.'),
  secs.map(([label,v])=>h('section',{},h('h4',{},label),Array.isArray(v)?v.map(d=>h('div',{class:'intro-debate'},h('h5',{},d.topic),h('ul',{},(d.views||[]).map(x=>h('li',{},x))))):h('p',{},v))),
  doms.length>0&&h('p',{class:'meta intro-src'},'참고 출처: '+doms.join(' · ')));};
// 큐티처럼 장절 글만 있을 때: 책 이름을 찾아 개관 접기
const introForRef=async ref=>{try{const [index,data]=await Promise.all([fetch('./bible/index.json').then(r=>r.json()),loadIntro()]);const r=refRange(ref,index),b=r&&index.find(x=>x.n===r.book);return b?introFold(b.name,data):null;}catch{return null;}};
const STEPS=[['meaning','1 이 말씀의 뜻'],['context','2 앞뒤 맥락'],['people','3 인물들의 입장과 생각'],['why','4 성경에 실린 이유'],['theology','5 신학적 의미와 본문의 역할'],['apply','6 오늘의 적용']];
const BIBLE_CODES='gen exo lev num deu jos jdg rut 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job psa pro ecc sng isa jer lam ezk dan hos jol amo oba jnh mic nam hab zep hag zec mal mat mrk luk jhn act rom 1co 2co gal eph php col 1th 2th 1ti 2ti tit phm heb jas 1pe 2pe 1jn 2jn 3jn jud rev'.split(' ');
let wordMode='sermon';
async function scripture(box,text,commentary=true){
 const request=Symbol();box.request=request;
 fill(box,h('p',{},'본문을 불러오는 중이에요'));
 try{
 const [index,archive,introData]=await Promise.all([fetch('./bible/index.json').then(r=>r.json()),fetch('./qt-archive.json').then(r=>r.json()),commentary?loadIntro():null]);const ref=refRange(text,index);
 if(!ref){fill(box,h('p',{class:'err'},'본문을 찾지 못했어요. 책 이름과 장·절을 확인해 주세요'));return;}
 if(box.request!==request)return;
 const bible=await fetch('./bible/'+String(ref.book).padStart(2,'0')+'.json').then(r=>r.json());
 if(box.request!==request)return;
 if(!bible[ref.chap-1]||!bible[ref.endChap-1]||ref.v1>bible[ref.chap-1].length||ref.v2>bible[ref.endChap-1].length){fill(box,h('p',{class:'err'},'본문을 찾지 못했어요. 책 이름과 장·절을 확인해 주세요'));return;}
 const verses=[];for(let c=ref.chap;c<=ref.endChap;c++)for(let v=(c===ref.chap?ref.v1||1:1);v<=(c===ref.endChap?ref.v2||bible[c-1].length:bible[c-1].length);v++)verses.push(h('p',{},h('sup',{},c+':'+v+' '),bible[c-1][v-1]));
 fill(box,commentary&&introFold(index.find(b=>b.n===ref.book)?.name,introData),h('h3',{class:'scripture-head'},h('small',{},'성경 본문'),text),h('div',{class:'scripture'},...verses),h('p',{class:'bible-credit'},'개역한글(1961) · 저작재산권 보호기간 만료(대한성서공회 안내)'),h('a',{href:'https://www.bskorea.or.kr/bible/korbibReadpage.php?version=GAE&book='+BIBLE_CODES[ref.book-1]+'&chap='+ref.chap,target:'_blank',rel:'noopener'},'개역개정으로 보기'));
 if(commentary){const matches=archive.filter(a=>{const r=refRange(a.ref,index);return r&&overlaps(ref,r);});box.append(...(matches.length?matches.map(a=>h('section',{class:'card'},h('h3',{},a.ref+' · '+a.title),...STEPS.map(([k,t])=>h('div',{},stepTitle(t),h('p',{class:'qt-copy'},a[k]))),deepBox(a))):[h('p',{},'이 본문의 해설은 준비 중이에요')]));}
 }catch{if(box.request!==request)return;fill(box,h('p',{class:'err'},'본문을 불러오지 못했어요. 본문 범위와 인터넷 연결을 확인해 주세요.'));}
}
function wordView(){
 view.append(h('div',{class:'segments switcher only-narrow'},[['sermon','주일설교'],['qt','큐티']].map(([id,t])=>h('button',{class:'sub','aria-pressed':String(wordMode===id),onclick:()=>show(id)},t))));
 if(wordMode==='qt'){qtView();return;}
 const box=h('section',{class:'reading','aria-live':'polite'},h('p',{class:'hint'},'성경과 장·절을 고르면 말씀이 나와요')),input=h('input',{id:'scripture-input',required:true,'aria-label':'성경 본문'});
 // 성경 66권 ▾ · 장 ▾ · 시작 절 ▾ · 끝 절 ▾ — 고르면 바로 찾는다. 절 수는 그 권 파일에서
 const testa=h('select',{'aria-label':'구약 신약'},h('option',{value:''},'구약·신약'),h('option',{value:'old'},'구약'),h('option',{value:'new'},'신약')),book=h('select',{'aria-label':'성경',disabled:true}),chap=h('select',{'aria-label':'장',disabled:true}),v1=h('select',{'aria-label':'시작 절',disabled:true}),v2=h('select',{'aria-label':'끝 절',disabled:true});
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
 // 구약(1~39권)·신약(40~66권)을 먼저 고르면 그 안의 성경만 보여 준다
 const fillBooks=()=>{const list=index.filter(b=>testa.value==='old'?b.n<=39:testa.value==='new'?b.n>=40:false);book.replaceChildren(h('option',{value:''},testa.value?'성경 고르기':'구약·신약 먼저'),...list.map(b=>h('option',{value:b.n},b.name)));book.disabled=!list.length;for(const x of [chap,v1,v2]){x.replaceChildren();x.disabled=true;}};
 testa.onchange=fillBooks;
 fetch('./bible/index.json').then(r=>r.json()).then(list=>{index=list;fillBooks();}).catch(()=>{});
 view.append(h('div',{class:'bible-pick'},testa,book,chap,v1,v2),
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
// 예배 순서 안내 창(폰은 아래 시트, 컴퓨터는 가운데 창). 알려 주기만
function showElements(els, title) {
  const isRef = s => /^\d?\s?[가-힣]+\s?\d+:\d+(-\d+)?$/.test(String(s || '').trim());
  const textBox = el => { const vers = Object.keys(el.text || {}); if (!vers.length) return null; let cur = vers[0]; const body = h('p', { class: 'el-text' }), tabs = h('div', { class: 'segments', role: 'group', 'aria-label': '번역' });
    const paint = () => { fill(tabs, vers.map(v => h('button', { type: 'button', class: 'sub', 'aria-pressed': String(v === cur), onclick: () => { cur = v; paint(); } }, v))); body.textContent = el.text[cur]; };
    paint(); return h('section', { class: 'el-full' }, h('h4', {}, '전문'), tabs, body, h('button', { type: 'button', class: 'sub', onclick: () => copyText(el.text[cur]) }, '복사')); };
  const part = el => h('section', { class: 'el-part' }, els.length > 1 && h('h3', {}, el.key),
    h('h4', {}, '뜻'), h('p', {}, el.meaning || ''),
    el.who && [h('h4', {}, '누가'), h('p', {}, /목사만|반드시 목사|개인 권위로/.test(el.who) ? h('b', {}, el.who) : el.who)],
    el.prepare?.length > 0 && [h('h4', {}, '미리 준비할 것'), h('ul', {}, el.prepare.map(x => h('li', {}, x)))],
    el.how?.length > 0 && [h('h4', {}, '진행 순서'), h('ol', {}, el.how.map(x => h('li', {}, x)))],
    el.example && [h('h4', {}, isRef(el.example) ? '성경 장절' : '예시 멘트'), h('p', { class: 'el-example' }, el.example, isRef(el.example) && h('button', { type: 'button', class: 'text-button', onclick: () => { box.close(); show('sermon'); const i = $('scripture-input'); if (i) { i.value = el.example; i.closest('form')?.requestSubmit?.(); } } }, '말씀 보기'))],
    textBox(el),
    el.tip && [h('h4', {}, '자주 하는 실수'), h('p', { class: 'el-tip' }, el.tip)],
    el.key === '예배로 부름' && h('p', {}, h('button', { type: 'button', class: 'sub', onclick: () => { box.close(); callOpen = true; show('worshipGuide'); } }, '본문 고르기')));
  const box = h('dialog', { class: 'event-dialog about-dialog element-dialog', 'aria-labelledby': 'el-title' }, h('div', { class: 'event-dialog-heading' }, h('h2', { id: 'el-title' }, title + ' 안내'), h('button', { type: 'button', onclick: () => box.close() }, '닫기')), els.map(part));
  box.addEventListener('click', e => { if (e.target !== box) return; const r = box.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) box.close(); });
  box.addEventListener('close', () => box.remove());
  document.body.append(box); box.showModal();
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
  const lastMode = id => { const m = localStorage.getItem('church:pptMode:' + id); return m === 'dark' || m === 'light' ? m : themeFor(id).mode; };
  let deptId = deptToPpt(deptsOf(settings)[0]), mode = lastMode(deptId);
  const dept = h('select', { 'aria-label': '부서', onchange: () => { deptId = dept.value; mode = lastMode(deptId); svc.value = DEPTS.find(d => d.id === deptId).service; paintTheme(); paintPeople(); } }, DEPTS.map(d => h('option', { value: d.id, selected: d.id === deptId }, d.name)));
  const svc = h('select', { 'aria-label': '예배 순서', onchange: () => paintPeople() }, W.services.map(s => h('option', { value: s.id, selected: s.id === serviceId }, s.name)));
  const themeBox = h('div', { class: 'segments' }), paintTheme = () => fill(themeBox, [['dark', '어두운 바탕'], ['light', '밝은 바탕']].map(([m, t]) => h('button', { type: 'button', class: 'sub', 'aria-pressed': String(mode === m), onclick: () => { mode = m; localStorage.setItem('church:pptMode:' + deptId, m); paintTheme(); } }, t)));
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
// 예배 › 순서 · 안내(폰은 화면 위 세그먼트, 컴퓨터는 사이드바 하위 메뉴)
let worshipSel = '', callOpen = false;
const worshipSeg = cur => h('div', { class: 'segments only-narrow' }, [['worshipOrder', '순서'], ['worshipGuide', '안내']].map(([id, t]) => h('button', { type: 'button', class: 'sub', 'aria-pressed': String(id === cur), onclick: () => id !== cur && show(id) }, t)));
// 예배 › 안내(배우는 곳): ① 예배의 흐름 4단계 ② 형식별 차이 ③ 예배로 부름 본문 모음 ④ 순서 사전 ⑤ 평신도 인도 주의
function worshipGuideView() {
  const box = h('div', { class: 'wg' }); view.append(box);
  fill(box, h('p', { class: 'hint loading' }, '안내를 불러오는 중이에요'));
  loadWorship().then(W => {
    const S = W.structure || {}, list = W.callToWorship || [], today = todayIso(), sun = nextSunday(today), y = +today.slice(0, 4);
    const rec = callRec(list, sun, occurrences([y - 1, y, y + 1], {}));
    const stepBtn = name => { const els = elementsFor(name, W.elements); return els.length ? h('button', { type: 'button', class: 'text-button wg-step', onclick: () => showElements(els, name) }, name) : h('span', { class: 'wg-step plain' }, name); };
    const callRow = x => h('li', {}, h('button', { type: 'button', class: 'call-row', onclick: () => openCall(x) }, h('span', { class: 'call-ref' }, x.ref), h('span', { class: 'call-mode' + (x.mode === '교독' ? ' antiphon' : '') }, x.mode === '교독' ? '낭독 · 교독 가능' : '낭독'), h('span', { class: 'call-why' }, x.why)));
    let grp = '절기'; const callBox = h('div');
    const when = nameDates(sun, occurrences([y, y + 1], {})), wd = d => d ? md(d) + '(' + '일월화수목금토'[new Date(d + 'T00:00:00Z').getUTCDay()] + ')' : '';
    const drawCalls = () => { let names = [...new Set(list.filter(x => x.group === grp).map(x => x.name))]; if (grp === '절기') names = names.sort((a, b) => (when[a] || '9') < (when[b] || '9') ? -1 : 1); // 다가오는 순서
      fill(callBox, h('div', { class: 'browse-chips', role: 'group', 'aria-label': '본문 분류' }, ['절기', '평상시'].map(g => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(g === grp), onclick: () => { grp = g; drawCalls(); } }, g))),
        names.map(n => { const xs = list.filter(x => x.group === grp && x.name === n); return h('details', { class: 'doc-group' }, h('summary', {}, h('strong', { class: 'doc-group-title' }, n), grp === '절기' && when[n] && h('span', { class: 'call-when' }, wd(when[n])), h('small', { class: 'meta' }, xs.length + '개')), h('ul', { class: 'call-list' }, xs.map(callRow))); })); };
    drawCalls();
    const callSec = h('section', { class: 'wg-sec', id: 'wg-call' }, h('h3', {}, '예배로 부름 본문 모음 ' + list.length + '개'),
      rec.items.length > 0 && h('div', { class: 'call-rec' }, h('p', { class: 'call-rec-title' }, '이번 주(' + md(sun) + ') 추천 · ' + rec.name + (rec.plain ? ' (평상시 주제)' : '')), h('ul', { class: 'call-list' }, rec.items.map(callRow))),
      callBox);
    fill(box,
      h('section', { class: 'wg-sec' }, h('h3', {}, S.title || '예배의 흐름'), S.intro && h('p', { class: 'wg-intro' }, S.intro),
        h('ol', { class: 'wg-flow' }, (S.parts || []).map(p => h('li', {}, h('h4', {}, p.name), h('p', {}, p.what), h('div', { class: 'wg-steps' }, (p.steps || []).map(stepBtn))))),
        S.source && h('p', { class: 'meta wg-source' }, '출처: ' + S.source)),
      (S.formats || []).length > 0 && h('section', { class: 'wg-sec' }, h('h3', {}, '형식별 차이'), h('dl', { class: 'wg-formats' }, S.formats.flatMap(f => [h('dt', {}, f.name), h('dd', {}, f.note)]))),
      callSec,
      (W.elements || []).length > 0 && h('section', { class: 'wg-sec' }, h('details', { class: 'el-guides' }, h('summary', {}, '순서 사전 ' + W.elements.length + '개'), h('ul', {}, W.elements.map(el => h('li', {}, h('button', { type: 'button', class: 'text-button', onclick: () => showElements([el], el.key) }, el.key)))))),
      h('details', { class: 'lay-rules' }, h('summary', {}, '평신도가 인도할 때 주의 ' + W.layRules.length + '가지'), h('ul', {}, W.layRules.map(r => h('li', {}, r)))));
    if (callOpen) { callOpen = false; callSec.scrollIntoView({ block: 'start' }); }
  }).catch(() => fill(box, h('div', { class: 'empty-state' }, h('p', {}, '안내를 불러오지 못했어요'), h('button', { type: 'button', class: 'sub', onclick: () => show('worshipGuide') }, '다시 시도'))));
}
// 예배로 부름 본문 보기: 개역한글 본문(교독이면 절마다 사회자·회중 번갈아) · [복사] · [이번 주 순서지에 넣기]
function openCall(x) {
  const body = h('div', { class: 'call-text' }, h('p', { class: 'hint' }, '본문을 불러오는 중이에요')), copyBtn = h('button', { type: 'button', class: 'sub', disabled: true }, '복사');
  const put = async () => { try { await loadWorship(); const d = await readOnce(churchPath()), id = worshipSel || 'sunday-main', sv = worshipData.services.find(s => s.id === id), steps = orderFor(sv, d?.worshipOrders || {}).map(s => ({ ...s }));
      const i = steps.findIndex(s => elementsFor(s.name, worshipData.elements).some(e => e.key === '예배로 부름')); if (i < 0) return say(sv.name + ' 순서에 예배로 부름이 없어요');
      steps[i].note = x.ref; if (await save(churchPath(), { worshipOrders: { [id]: steps } })) say(sv.name + ' 순서지의 예배로 부름에 ' + x.ref + '을(를) 넣었어요'); } catch { say('넣지 못했어요. 다시 해 주세요.'); } };
  const box = h('dialog', { class: 'event-dialog about-dialog element-dialog call-dialog', 'aria-labelledby': 'call-title' }, h('div', { class: 'event-dialog-heading' }, h('h2', { id: 'call-title' }, x.ref + ' · ' + x.mode), h('button', { type: 'button', onclick: () => box.close() }, '닫기')),
    h('p', { class: 'meta' }, x.name + ' · ' + x.why), body, h('div', { class: 'row' }, copyBtn, h('button', { type: 'button', class: 'sub', onclick: () => { box.close(); put(); } }, '이번 주 순서지에 넣기')), h('p', { class: 'meta' }, '개역한글'));
  box.addEventListener('click', e => { if (e.target !== box) return; const r = box.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) box.close(); });
  box.addEventListener('close', () => box.remove()); document.body.append(box); box.showModal();
  (async () => { const index = await fetch('./bible/index.json').then(r => r.json()), r = refRange(x.ref, index); if (!r) throw new Error('ref');
    const bible = await fetch('./bible/' + String(r.book).padStart(2, '0') + '.json').then(q => q.json()), lines = [];
    for (let c = r.chap; c <= r.endChap; c++) { const vs = bible[c - 1] || [], from = c === r.chap ? (r.v1 || 1) : 1, to = c === r.endChap ? (r.v2 || vs.length) : vs.length; for (let v = from; v <= to; v++) if (vs[v - 1]) lines.push([c, v, vs[v - 1]]); }
    if (!lines.length) throw new Error('empty');
    // 기본은 사회자 낭독(채플처럼). 교독에 알맞은 시편이면 '교독으로 보기'로 바꿔 볼 수 있다
    let anti = false;
    const paint = () => {
      fill(body, x.mode === '교독' && h('button', { type: 'button', class: 'text-button call-toggle', onclick: () => { anti = !anti; paint(); } }, anti ? '낭독으로 보기' : '교독으로 보기(사회자·회중)'), lines.map(([c, v, t], k) => h('p', { class: 'call-line' + (anti ? (k % 2 ? ' people' : ' leader') : '') }, anti && h('b', {}, k % 2 ? '회중 ' : '사회자 '), h('sup', {}, (r.endChap > r.chap ? c + ':' : '') + v), ' ' + t)));
      copyBtn.onclick = () => copyText(x.ref + '\n' + lines.map(([, v, t], k) => (anti ? (k % 2 ? '(회중) ' : '(사회자) ') : v + ' ') + t).join('\n'));
    };
    paint(); copyBtn.disabled = false;
  })().catch(() => fill(body, h('p', { class: 'err' }, '본문을 불러오지 못했어요')));
}
function worshipView() {
  const top = h('div', { class: 'worship-top' }), detail = h('section', { class: 'worship-detail' }), printBox = h('section', { class: 'print-conti' });
  view.append(top, detail, printBox);
  let data = {}, group = '', sel = '', editing = false;
  fill(top, h('p', { class: 'hint loading' }, '예배 순서를 불러오는 중이에요'));
  const draw = () => {
    const W = worshipData; if (!W) return;
    const rec = recommendService(thisWeek(todayIso(), { ...data.settings, customEvents: data.customEvents }, {}).upcoming, W.services);
    sel ||= rec?.service.id || 'sunday-main'; group ||= W.services.find(s => s.id === sel)?.group || '정기'; worshipSel = sel;
    const groups = [...new Set(W.services.map(s => s.group))];
    fill(top, rec && h('p', { class: 'special-note' }, h('span', {}, rec.event.name + (/[가-힣]$/.test(rec.event.name) && (rec.event.name.charCodeAt(rec.event.name.length - 1) - 0xAC00) % 28 ? '이' : '가') + ' 다가와요'), h('button', { type: 'button', class: 'text-button', onclick: () => { sel = rec.service.id; group = rec.service.group; draw(); } }, rec.service.name + ' 순서 보기')),
      h('div', { class: 'browse-chips' }, groups.map(g => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(g === group), onclick: () => { group = g; if (W.services.find(s => s.id === sel)?.group !== g) { sel = W.services.find(s => s.group === g)?.id || sel; editing = false; } draw(); } }, g))),
      h('ul', { class: 'worship-list' }, W.services.filter(s => s.group === group).map(s => h('li', {}, h('button', { type: 'button', class: 'worship-pick', 'aria-pressed': String(s.id === sel), onclick: () => { sel = s.id; editing = false; draw(); } }, h('strong', {}, s.name), h('small', { class: 'meta' }, s.when))))));
    const sv = W.services.find(s => s.id === sel), saved = data.worshipOrders || {}, steps = orderFor(sv, saved), edited = Array.isArray(saved[sel]) && saved[sel].length > 0;
    const put = list => save(churchPath(), { worshipOrders: { [sel]: list } });
    const name = h('input', { placeholder: '순서 이름(예: 특송)', 'aria-label': '추가할 순서 이름', maxLength: 40 }), who = h('input', { placeholder: '담당(예: 다 함께)', 'aria-label': '추가할 순서 담당', maxLength: 30 });
    fill(detail, h('h3', { class: 'worship-title' }, sv.name), h('p', { class: 'meta' }, sv.when + (edited ? ' · 우리 교회가 고친 순서' : '')), h('p', { class: 'meta worship-source' }, '출처: ' + W.source),
      // 순서 표: 번호 | 순서 | 담당 | 메모. 고치기(▲▼·빼기·추가)는 [순서 고치기]를 눌렀을 때만
      h('div', { class: 'ws-bar' }, h('button', { type: 'button', class: editing ? 'primary' : 'sub', 'aria-pressed': String(editing), onclick: () => { editing = !editing; draw(); } }, editing ? '완료' : '순서 고치기'), edited && h('button', { type: 'button', class: 'text-button', onclick: () => { if (confirm('기본 순서로 되돌릴까요? 고친 순서는 지워져요')) save(churchPath(), { worshipOrders: { [sel]: null } }); } }, '기본값으로')),
      h('table', { class: 'ws-table' + (editing ? ' editing' : '') }, h('thead', {}, h('tr', {}, ['', '순서', '담당', '메모', editing ? '고치기' : ''].filter((t, k) => k < 4 || editing).map(t => h('th', { scope: 'col' }, t)))),
        h('tbody', {}, steps.map((st, i) => h('tr', {}, h('td', { class: 'ws-num' }, String(i + 1)), h('th', { scope: 'row', class: 'ws-name' }, st.name, (els => els.length > 0 && h('button', { type: 'button', class: 'text-button ws-guide', 'aria-label': st.name + ' 안내 보기', onclick: () => showElements(els, st.name) }, 'ⓘ 안내'))(elementsFor(st.name, W.elements))), h('td', { class: 'ws-who' }, st.who, isPastorOnly(st) && h('span', { class: 'ws-tag' }, '목사')), h('td', { class: 'ws-note' }, st.note || ''),
          editing && h('td', { class: 'ws-acts' }, h('button', { type: 'button', class: 'sub', 'aria-label': st.name + ' 위로', disabled: i === 0, onclick: () => { const b = [...steps]; [b[i - 1], b[i]] = [b[i], b[i - 1]]; put(b); } }, '▲'), h('button', { type: 'button', class: 'sub', 'aria-label': st.name + ' 아래로', disabled: i === steps.length - 1, onclick: () => { const b = [...steps]; [b[i + 1], b[i]] = [b[i], b[i + 1]]; put(b); } }, '▼'), h('button', { type: 'button', class: 'danger', 'aria-label': st.name + ' 빼기', onclick: () => put(steps.filter((_, j) => j !== i)) }, '빼기')))))),
      editing && h('form', { class: 'ws-add', onsubmit: e => { e.preventDefault(); if (!name.value.trim()) return; put([...steps, { name: name.value.trim(), who: who.value.trim(), note: '' }]); } }, name, who, h('button', { class: 'sub' }, '+ 순서 추가')),
      h('p', { class: 'meta ws-more' }, '순서 하나하나의 뜻·예배로 부름 본문·평신도 인도 주의는 ', h('button', { type: 'button', class: 'text-button', onclick: () => show('worshipGuide') }, '예배 › 안내'), '에서 봐요'),
      h('div', { class: 'worship-actions' }, h('button', { type: 'button', class: 'sub', onclick: () => { fill(printBox, h('h1', {}, sv.name), h('p', {}, [data.name, nextSunday(todayIso())].filter(Boolean).join(' · ')), h('table', { class: 'ws-print' }, h('thead', {}, h('tr', {}, ['', '순서', '담당', '메모'].map(t => h('th', {}, t)))), h('tbody', {}, steps.map((st, i) => h('tr', {}, [i + 1, st.name, st.who, st.note].map(t => h('td', {}, String(t || '')))))))); $('pagesize')?.remove(); document.head.append(h('style', { id: 'pagesize' }, '@page { size: A4 portrait; margin: 15mm }')); window.print(); } }, '순서지 인쇄'),
        h('button', { type: 'button', class: 'primary', onclick: () => openWorshipPpt(sel, data) }, '예배 PPT 만들기')));
  };
  loadWorship().then(draw).catch(() => fill(top, h('div', { class: 'empty-state' }, h('p', {}, '예배 순서를 불러오지 못했어요'), h('button', { type: 'button', class: 'sub', onclick: () => show('worship') }, '다시 시도'))));
  watch(churchPath(), d => { data = d || {}; draw(); });
}
// 자료실: 부서별 빈 예배 PPT 양식(앱에서 빈 값으로 만들어 받기)
function pptTemplatesSection() {
  const box = h('details', { class: 'doc-list doc-group ppt-templates' }, h('summary', {}, h('strong', { class: 'doc-group-title' }, '예배 PPT 양식'), h('small', { class: 'meta' }, DEPTS.length + '개')), h('p', { class: 'hint' }, '빈 양식이에요. 받아서 이름·곡·본문을 채워 쓰세요.'),
    h('ul', { class: 'buy-list' }, DEPTS.map(d => h('li', { class: 'ppt-template' }, h('strong', {}, d.name), d.plus ? h('small', { class: 'meta' }, '글자 크게') : null, h('div', { class: 'row tpl-btns' }, ['light', 'dark'].map(m => h('button', { type: 'button', class: 'text-button' + (m === (d.base || 'light') ? ' tpl-default' : ''), 'aria-label': d.name + ' ' + (m === 'dark' ? '어두운' : '밝은') + ' 양식 받기', onclick: async e => { const b = e.currentTarget; b.disabled = true; try { const W = await loadWorship(), sv = W.services.find(s => s.id === d.service), T = themeFor(d.id, m); await makeWorshipPpt(worshipSlides({ service: sv, steps: orderFor(sv), dept: d.id, blank: true }), T, d.name + ' 예배 PPT 양식(' + (m === 'dark' ? '어두운' : '밝은') + ').pptx'); } catch { say('양식을 만들지 못했어요. 인터넷 연결을 확인해 주세요.'); } finally { b.disabled = false; } } }, (m === 'dark' ? '어둡게' : '밝게') + ' ↓', m === (d.base || 'light') && h('small', {}, ' 기본'))))))));
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
side.append(h('p',{id:'church-title'},'교회 사역앱'),...MENUS.flatMap(([id,t])=>[id==='word'&&h('p',{class:'side-group'},'도구'),h('button',{k:id,class:[PARENT[id]&&'sub-menu',TOOLS.has(id)&&'tool'].filter(Boolean).join(' '),onclick:()=>show(id)},PARENT[id]?null:glyph(id),h('span',{},t))].filter(Boolean)));
defaultSongs = await fetch('./songs-default.json').then(r => { if (!r.ok) throw new Error('곡 목록'); return r.json(); }).catch(() => { say('기본 곡을 불러오지 못했어요. 새로고침해 주세요.'); return []; });
store = await openStore().catch(() => null);
if (!store) msg.textContent = '저장소에 연결하지 못했어요. 새로고침해 주세요.';
else {
  $('band').hidden = store.mode !== 'local'; $('band').textContent='체험 모드 · 이 기기에 저장';
  await store.auth?.ready; // 로그인 상태를 먼저 확인(구글 로그인한 기기면 내 교회로 바로)
  store.auth?.onChange(u => { paintBand(); if (u && !nav.hidden) dailySnapshot(); }); // 로그인·로그아웃하면 위 띠를 바꾸고, 로그인했으면 오늘 스냅샷
  // 페이지 이동 방식으로 로그인하고 돌아온 경우
  let back = null; try { back = store.auth && await store.auth.redirectResult(); } catch (e) { say(loginErrorText(e?.code)); }
  const viewing = !back && parseViewer(location.search);
  if (viewing) await openViewer(viewing);
  else if (back) await afterLogin(true);
  else if (location.hash.startsWith('#c=')) await openInvite();
  else if (localStorage.getItem('church:code')) await enter(localStorage.getItem('church:code'));
  else { const mine = await myChurches(); if (mine.length) await enter(mine[0].code); else showEntry(); }
}

// ---------- 콘티 보기(태블릿 악보 보기) ----------
// 목록: 얇은 줄 "10/25(일) 이번 주 콘티 · 4곡" + 곡 목록 + [악보로 보기]. 악보 모드: 한 화면 한 장, 좌우 넘기기·탭·←→, 위 바 "2/4 곡명 · E"
async function openViewer({ code, date, svc }) {
  reset(); nav.hidden = true; side.hidden = true; $('band').hidden = true; view.dataset.screen = 'viewer';
  fill(view, h('p', { class: 'hint loading' }, '콘티를 불러오는 중이에요'));
  const base = 'churches/' + code;
  let church, doc;
  try { [church, doc] = await Promise.all([readOnce(base), readOnce(base + '/conti/' + date)]); }
  catch { return fill(view, h('div', { class: 'empty-state' }, h('p', {}, '불러오지 못했어요. 인터넷 연결을 확인해 주세요.'), h('button', { type: 'button', class: 'sub', onclick: () => openViewer({ code, date, svc }) }, '다시 시도'))); }
  const def = (DEPTS.find(x => x.id === deptToPpt(deptsOf(church?.settings)[0])) || {}).service || 'sunday-main';
  const W = await loadWorship().catch(() => null), nameOf = id => svcShort((W?.services || []).find(x => x.id === id)?.name || id);
  const svcs = contiTabs(doc, def).filter(id => contiSongsOf(doc, id, def).some(s => s?.title));
  const sv = svc || def, pages = viewerPages(contiSongsOf(doc, sv, def), church?.sheets || {});
  const label = fmt(date) + ' ' + (date === nextSunday(todayIso()) ? '이번 주 콘티' : '콘티') + (svcs.length > 1 ? ' · ' + nameOf(sv) : '');
  if (!church || !pages.length) return fill(view, h('div', { class: 'viewer-head' }, h('p', { class: 'viewer-title' }, label)), h('div', { class: 'empty-state' }, h('p', {}, church ? '이 날짜 콘티에 곡이 아직 없어요' : '이 콘티를 찾을 수 없어요. 링크를 다시 받아 주세요.')));
  document.title = label + ' · ' + (church.name || '교회 사역앱');
  // 악보 그림은 장마다 한 번만 받아 둔다(다음 장 미리 받기)
  const cache = new Map(), img = id => { if (!cache.has(id)) cache.set(id, readOnce(base + '/sheets/' + id).then(d => String(d?.img || '').startsWith('data:image/') ? d.img : null).catch(() => null)); return cache.get(id); };
  const open = i => showSheets(pages, i, img, label);
  fill(view, h('div', { class: 'viewer-head' }, h('p', { class: 'viewer-title' }, label + ' · ' + pages.length + '곡'), h('p', { class: 'meta' }, church.name || '')),
    svcs.length > 1 && h('div', { class: 'viewer-svcs', role: 'group', 'aria-label': '예배 고르기' }, svcs.map(id => h('button', { type: 'button', class: 'chip', 'aria-pressed': String(id === sv), onclick: () => id !== sv && openViewer({ code, date, svc: id }) }, nameOf(id), h('small', {}, ' · ' + contiSongsOf(doc, id, def).filter(s => s?.title).length + '곡')))),
    h('button', { type: 'button', class: 'primary viewer-go', onclick: () => open(0) }, '악보로 보기'),
    h('ol', { class: 'viewer-list' }, pages.map((p, i) => h('li', {}, h('button', { type: 'button', class: 'viewer-song', onclick: () => open(i) }, h('span', { class: 'num' }, i + 1 + '.'), h('span', { class: 'viewer-song-name' }, p.title), p.key && h('span', { class: 'meta' }, ' · ' + p.key), h('span', { class: 'meta viewer-has' }, p.sheet ? '악보' : '악보 없음'))))),
    h('a', { class: 'text-button viewer-app', href: location.pathname }, '교회 사역앱 열기'));
}
function showSheets(pages, start, img, label) {
  let i = start, wake = null, barHidden = false, dark = localStorage.getItem('church:viewerDark') === '1', x0 = null;
  const pic = h('div', { class: 'viewer-page' }), bar = h('div', { class: 'viewer-bar' }), stage = h('div', { class: 'viewer-stage' + (dark ? ' dark' : ''), role: 'dialog', 'aria-label': label + ' 악보 보기', tabindex: '-1' }, bar, pic);
  const lock = async () => { try { wake = await navigator.wakeLock?.request('screen'); } catch { wake = null; } };
  const onVis = () => { if (document.visibilityState === 'visible' && stage.isConnected) lock(); };
  const close = () => { wake?.release?.().catch(() => {}); document.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); stage.remove(); };
  const go = n => { const j = Math.max(0, Math.min(pages.length - 1, n)); if (j !== i) { i = j; paint(); } };
  const onKey = e => { if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(i + 1); } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(i - 1); } else if (e.key === 'Escape') close(); };
  const paint = () => {
    const p = pages[i];
    stage.classList.toggle('bar-hidden', barHidden);
    fill(bar, h('button', { type: 'button', class: 'viewer-close', onclick: close }, '목록'), h('span', { class: 'viewer-where' }, (i + 1) + '/' + pages.length + ' ' + p.title + (p.key ? ' · ' + p.key : '')),
      h('button', { type: 'button', class: 'viewer-dark', 'aria-pressed': String(dark), onclick: e => { e.stopPropagation(); dark = !dark; localStorage.setItem('church:viewerDark', dark ? '1' : '0'); stage.classList.toggle('dark', dark); paint(); } }, dark ? '밝게' : '어둡게'));
    if (!p.sheet) { fill(pic, h('div', { class: 'viewer-nosheet' }, h('p', { class: 'viewer-nosheet-title' }, p.title), p.key && h('p', { class: 'viewer-nosheet-key' }, p.key + ' 키'), h('p', { class: 'meta' }, '악보 없음 — 곡명·키만'))); }
    else { fill(pic, h('p', { class: 'viewer-loading' }, '악보 불러오는 중…')); const want = i; img(p.sheet).then(src => { if (want !== i || !stage.isConnected) return; fill(pic, src ? h('img', { src, alt: p.title + (p.key ? ' ' + p.key : '') + ' 악보', draggable: 'false' }) : h('div', { class: 'viewer-nosheet' }, h('p', { class: 'viewer-nosheet-title' }, p.title), h('p', { class: 'meta' }, '악보를 불러오지 못했어요'))); }); }
    const next = pages[i + 1]; if (next?.sheet) img(next.sheet); // 다음 장 미리 받기
  };
  // 화면 왼쪽 1/3 탭 = 이전, 오른쪽 1/3 = 다음, 가운데 = 위 바 숨김/보임. 좌우로 50px 넘게 밀면 넘기기
  pic.addEventListener('pointerdown', e => { x0 = e.clientX; });
  pic.addEventListener('pointerup', e => { if (x0 === null) return; const dx = e.clientX - x0, w = stage.clientWidth; x0 = null;
    if (Math.abs(dx) > 50) return go(i + (dx < 0 ? 1 : -1));
    if (e.clientX < w / 3) go(i - 1); else if (e.clientX > w * 2 / 3) go(i + 1); else { barHidden = !barHidden; stage.classList.toggle('bar-hidden', barHidden); } });
  document.addEventListener('keydown', onKey); document.addEventListener('visibilitychange', onVis);
  document.body.append(stage); stage.focus(); paint(); lock();
  document.documentElement.requestFullscreen?.().catch(() => {});
}
async function openInvite() {
  const c=location.hash.slice(3);
  showEntry();
  if(!validCode(c)){showEntry('초대 링크가 잘못됐어요');return;}
  try {const d=await readOnce('churches/'+c);if(d)await enter(c,d);else showEntry('초대 링크가 잘못됐어요');}
  catch {showEntry('불러오지 못했어요. 인터넷 연결을 확인해 주세요.');}
}
addEventListener('hashchange',()=>{if(store && location.hash.startsWith('#c='))openInvite();});
