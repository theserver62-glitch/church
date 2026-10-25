// 화면 첫 방문 안내(게임 튜토리얼처럼): 화면을 어둡게 덮고 버튼 하나만 밝혀 "이건 뭐고 어떻게 쓰는지" 알려 준다.
// 화면·탭마다 한 번(기기 저장 'tour:<id>'). 'tour:off'면 전부 끔. 대상이 없거나 안 보이면 그 단계는 건너뛴다.
// when: 이 투어를 띄울 때 보여야 하는 선택자(배열이면 모두). covers: 끝날 때 같이 본 것으로 치는 투어(그때 보이면)
// 홈은 넓은 화면(960px~)이면 준비 방법이 목록 옆에, 폰이면 아래에 나온다
const where = () => (globalThis.matchMedia?.('(min-width:960px)').matches ? '옆에' : '아래에');
export const TOURS = [
  { id: 'home', screen: 'home', when: '.pj-head', steps: [
    { sel: '.home-tabs', title: '지금 할 일 | 달력', text: '달력을 보려면 [달력]을 눌러요. 다시 [지금 할 일]을 누르면 여기로 와요.' },
    { sel: '.pj-list', title: '지금 할 일', text: () => '기한 지난 일은 빨간색이에요. 하나 누르면 ' + where() + ' 준비 방법이 나와요.' },
    { sel: '.pj-focus', title: '준비 방법', text: '목표·이렇게 해요·안내문까지 있어요. 읽고 그대로 하면 돼요.' },
    { sel: '.pj-focus-head button.primary', title: '[다 했어요]', text: '끝내면 눌러요. 누가 언제 했는지 기록으로 남아요.' },
    { sel: '.pj-share', title: '할 일 카톡으로 보내기', text: '지금 할 일을 글로 만들어 카톡방에 보내요.' },
    { sel: '.pj-rest > section', title: '준비 중인 절기·행사', text: '절기마다 준비 구간과 진행률이 보여요. 누르면 자세히 볼 수 있어요.' }] },
  { id: 'events', screen: 'events', when: '.home-bar', steps: [
    { sel: '.period-controls', title: '기간 옮기기', text: '◀ ▶로 달을 옮겨요. [오늘]을 누르면 이번 달로 돌아와요.' },
    { sel: '.view-select', title: '보기 바꾸기', text: '일·주·월·년 보기 중에서 골라요.' },
    { sel: '.calendar', title: '달력', text: '색 칸은 행사일, 띠는 준비 기간이에요. 날짜를 누르면 그날 할 일이 나와요.' },
    { sel: '.fab', title: '+ 행사 추가', text: '수련회·바자회·성경학교를 넣으면 준비할 일이 저절로 생겨요.' }] },
  { id: 'seasons', screen: 'seasons', when: '.pj-lists > section', steps: [
    { sel: '.pj-proj', title: '절기 한 줄', text: '남은 날과 완료한 할 일 수가 보여요. 누르면 구간별 할 일과 준비 방법이 나와요.' },
    { sel: '.pj-phasebar', title: '구간 막대', text: '준비 구간 6칸이에요. 색칠된 칸까지 왔어요.' },
    { sel: '.pj-lists > section:nth-of-type(2)', title: '지난 기록', text: '끝난 절기는 3줄 정리·한 일·서류가 기록으로 남아요.' },
    { sel: '.segments.only-narrow', title: '절기 | 행사', text: '우리 교회가 넣은 행사는 [행사]에 모여요.' }] },
  { id: 'ourEvents', screen: 'ourEvents', when: '.pj-lists > section', steps: [
    { sel: '.schedule-bar .primary', title: '+ 행사 추가', text: '수련회·바자회처럼 우리 교회 행사와 준비할 일을 넣어요.' },
    { sel: '.pj-proj', title: '행사 한 줄', text: '누르면 할 일·날짜 바꾸기·삭제가 있어요.' },
    { sel: '.pj-lists > section:nth-of-type(2)', title: '지난 기록', text: '끝난 행사는 기록으로 남아요.' }] },
  { id: 'project', screen: 'project', when: '.pj-stepper', steps: [
    { sel: '.pj-stepper', title: '준비 구간', text: "6칸 중 '진행 중' 칸이 지금 할 구간이에요." },
    { sel: '.pj-list', title: '이번 구간 할 일', text: () => '하나 누르면 준비 방법이 나와요.' + (globalThis.document?.body.classList.contains('ro') ? '' : ' 끝내면 왼쪽 네모를 눌러요.') },
    { sel: '.pj-rest > section.pj-side', title: '지난해 기록', text: '작년에 남긴 3줄 정리가 여기에 떠요.' },
    { sel: '.pj-head > button', title: '카톡으로 보내기', text: '남은 할 일을 글로 만들어 카톡방에 보내요.' }] },
  { id: 'conti', screen: 'conti', when: '.conti-editor', covers: ['conti:ccm'], steps: [
    { sel: '.song-browser input[type=search]', title: '곡 찾기', text: '곡명을 치고 [+ 담기]를 누르면 콘티에 들어가요.' },
    { sel: '.pick-tabs', title: 'CCM · 특송 · 찬송가', text: '탭을 바꿔 특송과 찬송가에서도 곡을 담아요.' },
    { sel: '.conti-tabs', title: '콘티 화면 탭', text: '콘티·CCM·특송·찬송가·지난 콘티를 오가요.' },
    { sel: '.song-browser .browse-chips', title: '빠른 / 느린 찬양', text: '칩을 누르면 빠르기·즐겨찾기로 바로 걸러요.' },
    { sel: '.conti-editor', title: '이번 콘티', text: '담은 곡이 여기에 쌓여요. 저절로 저장돼요.' },
    { sel: '.conti-top .share-menu', title: '[공유·출력]', text: '카톡 보내기·인쇄·PPT·보기 링크가 있어요.' },
    { sel: '.conti-more', title: '카톡 글 붙여 넣기', text: '카톡에 올린 콘티 글을 붙여 넣으면 곡이 한 번에 들어가요.' }] },
  { id: 'conti:ccm', screen: 'conti', when: '.song-browser', steps: [
    { sel: '.song-browser input[type=search]', title: '곡 찾기', text: '곡명을 쳐서 찾아요.' },
    { sel: '.song-browser .browse-chips', title: '빠른 / 느린 찬양', text: '칩을 누르면 빠르기·즐겨찾기로 바로 걸러요.' },
    { sel: '.song-browser .add-button', title: '[+ 담기]', text: '누르면 이번 콘티에 들어가요.' }] },
  { id: 'conti:special', screen: 'conti', when: '.special-list', steps: [
    { sel: '.special-browser .browse-chips', title: '형태 · 연령 · 절기', text: '골라서 맞는 특송만 봐요. 다가오는 절기는 미리 켜져 있어요.' },
    { sel: '.special-list .yt-link', title: '▶ 유튜브', text: '먼저 들어 보고 골라요.' },
    { sel: '.special-list .buy', title: '악보', text: '악보는 판매처에서 사요(유료).' },
    { sel: '.special-list .add-button', title: '[+ 담기]', text: "콘티에 '특송'으로 들어가요." }] },
  { id: 'conti:hymn', screen: 'conti', when: '.hymn-browser .song-group', steps: [
    { sel: '.hymn-browser input[type=search]', title: '찬송가 찾기', text: '장 번호(예: 305)나 제목으로 찾아요.' },
    { sel: '.hymn-browser .group-head', title: '주제별 묶음', text: '누르면 펼쳐져요. 줄마다 [악보↗][PPT↗][+ 담기]가 있어요.' },
    { sel: '.hymn-list .sub-link', title: '[악보↗] [PPT↗]', text: '새 창에서 악보와 공식 PPT를 찾아요.' },
    { sel: '.hymn-list .add-button', title: '[+ 담기]', text: '누르면 이번 콘티에 들어가요.' }] },
  { id: 'conti:history', screen: 'conti', when: '.conti-history', steps: [
    { sel: '.conti-list', title: '콘티 고르기', text: '이번 주·다음 주 콘티를 고르거나 [+ 새 콘티]로 만들어요.' },
    { sel: '.conti-date', title: '다른 날짜 열기', text: '날짜를 고르면 그날 콘티가 열려요.' },
    { sel: '.conti-history', title: '지난 콘티', text: '지난 12주 콘티예요. 펼쳐서 [이 콘티 그대로 가져오기]로 다시 써요.' }] },
  { id: 'sermon', screen: 'sermon', when: '.bible-pick', steps: [
    { sel: '.bible-pick', title: '본문 고르기', text: '구약·신약 → 성경 → 장·절 순서로 고르면 바로 본문이 나와요.' },
    { sel: '.direct-input', title: '직접 입력', text: '막 4:1-9처럼 쳐서 찾아도 돼요.' },
    { sel: '.reading', title: '본문과 해설', text: '본문과 6단계 해설이 여기에 나와요. 본문을 고르면 아래에 [PPT로 내보내기]가 생겨요.' },
    { sel: '.switcher', title: '주일설교 | 큐티', text: '큐티는 여기서 바꿔요.' }] },
  { id: 'qt', screen: 'qt', when: '.qt-head', steps: [
    { sel: '#view > .row:not(.screen-heading)', title: '날짜 옮기기', text: '이전·다음을 누르면 그날 큐티가 나와요.' },
    { sel: '#view > .card:has(.scripture)', title: '성경 본문', text: '오늘 읽을 본문이에요(개역한글).' },
    { sel: '#view > .card:has(.qt-head)', title: '해설', text: '뜻·맥락·인물·이유·신학·적용 6단계로 읽어요.' },
    { sel: '#view > form.card', title: '묵상 나누기', text: '짧게 적어 [올리기]를 누르면 리더들과 나눠져요.' }] },
  { id: 'worship', screen: 'worship', when: '.worship-list', steps: [
    { sel: '.worship-top .browse-chips', title: '예배 묶음', text: '정기·절기·교회학교처럼 묶음을 골라요.' },
    { sel: '.worship-list', title: '예배 고르기', text: '예배를 누르면 아래에 순서가 나와요.' },
    { sel: '.ws-table', title: '순서 표', text: '순서·담당·메모가 보여요. [순서 고치기]로 우리 교회 순서로 바꿔요.' },
    { sel: '.worship-actions', title: '마무리', text: '순서지를 인쇄하거나 예배 PPT를 만들어요.' }] },
  { id: 'docs', screen: 'docs', when: ['.doc-tabs > button:nth-child(1)[aria-pressed="true"]', '.doc-list .doc-group'], steps: [
    { sel: '.dept-picker', title: '부서 고르기', text: '부서를 고르면 우리 부서 자료만 보여요.' },
    { sel: '.doc-tabs', title: '자료 종류', text: '서류·커리큘럼·나들이·링크 탭을 바꿔 봐요.' },
    { sel: '.doc-search', title: '자료 찾기', text: '수련회·회의록처럼 낱말로 찾아요.' },
    { sel: '.doc-list .doc-group', title: '서류 묶음', text: '펼쳐서 서류 이름을 누르면 미리보기와 [받기]가 나와요.' }] },
  { id: 'docs:cur', screen: 'docs', when: ['.doc-tabs > button:nth-child(2)[aria-pressed="true"]', '.res-section'], steps: [
    { sel: '.res-section', title: '커리큘럼·교재 비교', text: '대상·가격·장점을 한눈에 비교해요. 이름을 누르면 공식 사이트가 열려요.' },
    { sel: '.dept-picker', title: '부서 고르기', text: '부서를 바꾸면 그 부서에 맞는 것만 보여요.' },
    { sel: '.res-note', title: '가격 확인', text: '조사 시점 기준이에요. 신청 전에 공식 사이트에서 확인하세요.' }] },
  { id: 'docs:trip', screen: 'docs', when: ['.doc-tabs > button:nth-child(3)[aria-pressed="true"]', '.res-section'], steps: [
    { sel: '.res-section', title: '나들이·수련회 장소', text: '지역·알맞은 인원·가격으로 비교해요. 이름을 누르면 공식 사이트가 열려요.' },
    { sel: '.dept-picker', title: '부서 고르기', text: '부서를 바꾸면 그 부서에 맞는 곳만 보여요.' },
    { sel: '.res-note', title: '가격 확인', text: '조사 시점 기준이에요. 예약 전에 확인하세요.' }] },
  { id: 'docs:links', screen: 'docs', when: ['.doc-tabs > button:nth-child(4)[aria-pressed="true"]', '.link-list .doc-group'], steps: [
    { sel: '.link-list .doc-group', title: '추천 사이트', text: '종류별로 묶여 있어요. 이름을 누르면 새 창으로 열려요.' },
    { sel: '.dept-picker', title: '부서 고르기', text: '부서를 바꾸면 그 부서용 링크가 보여요.' }] },
  { id: 'equipment', screen: 'equipment', when: '.equipment-category', steps: [
    { sel: '.eq-fold', title: '묶음 제목', text: '누르면 품목 목록이 접히고 펼쳐져요.' },
    { sel: '.equipment-category tbody tr', title: '품목 한 줄', text: '−/+로 수량을 바꾸고, 문제가 있으면 [점검 필요]·[고장]을 눌러 메모해요.' },
    { sel: '.equipment-summary', title: '모아 보기', text: '점검 필요·고장 품목만 골라 볼 수 있어요.' },
    { sel: '.eq-buy', title: '[살 곳 보기]', text: '추천 상품과 가격 비교 링크가 나와요(쿠팡 파트너스 링크 포함).' },
    { sel: '.equipment-add', title: '품목 추가', text: '목록에 없는 장비는 여기서 넣어요.' }] },
  { id: 'set', screen: 'set', when: '.settings-grid', steps: [
    { sel: '.fold-set-invite', title: '멤버 초대', text: '[초대 링크 복사]를 눌러 리더들에게 카톡으로 보내요.' },
    { sel: '.fold-set-admin', title: '관리자', text: '관리자는 교회 정보·부서·절기 설정을 바꾸고 다른 사람을 승인해요.' },
    { sel: '.fold-set-skip', title: '계획서·보고 생략', text: '보고가 필요 없는 절기는 여기서 체크해요.' },
    { sel: '.fold-set-account', title: '내 기기·계정', text: '구글 로그인, 내 역할 이름, 튜토리얼 다시 하기가 여기 있어요.' }] },
  { id: 'more', screen: 'more', when: '.more-list', steps: [
    { sel: '.more-list', title: '더보기', text: '말씀·예배·자료실·장비·설정을 여기서 열어요.' },
    { sel: '#tabs', title: '아래 탭', text: '홈·절기·콘티는 아래 탭으로 바로 가요.' }] },
];
// 콘티의 CCM·특송·찬송가 메뉴는 한 화면(안쪽 탭으로 나뉨)
export const screenOf = tab => ({ ccm: 'conti', special: 'conti', hymn: 'conti' })[tab] || tab;

// ---------- 기록(기기 저장). 저장이 막혀도 이번 접속 동안은 메모리로 한 번만 ----------
const KEY = 'tour:', mem = new Set();
const ls = () => { try { return globalThis.localStorage || null; } catch { return null; } };
export function tourSeen(id, st = ls()) {
  if (mem.has('off') || mem.has(id)) return true;
  try { return st?.getItem(KEY + 'off') === '1' || st?.getItem(KEY + id) === '1'; } catch { return false; }
}
export function markSeen(id, st = ls()) { mem.add(id); try { st?.setItem(KEY + id, '1'); } catch { /* 메모리로 충분 */ } }
export const tourOff = (st = ls()) => markSeen('off', st);
// '튜토리얼 다시 하기': tour:off 포함 tour:* 전부 지운다
export function resetTours(st = ls()) {
  mem.clear();
  try { for (let i = (st?.length || 0) - 1; i >= 0; i--) { const k = st.key(i); if (k?.startsWith(KEY)) st.removeItem(k); } } catch { /* 지우지 못해도 메모리는 비웠다 */ }
}
const all = w => (Array.isArray(w) ? w : [w]);
// 지금 화면에서 띄울 투어: 이 화면 것 + when이 모두 보임 + (again이 아니면) 아직 안 봄
export function pickTour(screen, isShown, { again = false, seen = tourSeen } = {}) {
  return TOURS.find(t => t.screen === screen && all(t.when).every(isShown) && (again || !seen(t.id))) || null;
}
export const liveSteps = (steps, isShown) => steps.filter(s => isShown(s.sel));

// ---------- 코치마크 자리 계산(순수 함수) ----------
// r: 대상 사각형, vis: 지금 보이는 화면 {l,t,r,b}(아래 버튼 줄 위까지), tw·th: 설명 글 크기. 모두 같은 화면 좌표.
// 구멍은 화면 안(가장자리 8px)으로 자르고, 글은 대상 위·아래 중 넓은 쪽에. 둘 다 모자라면(대상이 화면만 하면) 구멍 위쪽만 남기고 글을 그 아래에.
export const ARROW = 48;
export function coachLayout(r, vis, tw, th, { pad = 6, m = 8, gap = 8, minHole = 96 } = {}) {
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
  const hole = { left: clamp(r.left - pad, vis.l + m, vis.r - m), right: clamp(r.right + pad, vis.l + m, vis.r - m), top: clamp(r.top - pad, vis.t + m, vis.b - m), bottom: clamp(r.bottom + pad, vis.t + m, vis.b - m) };
  const need = gap + ARROW + th, above = hole.top - (vis.t + m) - need, below = vis.b - m - hole.bottom - need;
  let side = below >= above ? 'below' : 'above';
  if (above < 0 && below < 0) { side = 'below'; hole.bottom = Math.max(hole.top + minHole, vis.b - m - need); hole.bottom = Math.min(hole.bottom, vis.b - m); }
  const cx = (hole.left + hole.right) / 2;
  const left = clamp(cx - tw / 2, vis.l + 24, vis.r - 24 - tw);
  const arrowX = clamp(cx, left + 12, left + tw - 12);
  const top = side === 'below' ? Math.min(hole.bottom + gap + ARROW, vis.b - m - th) : hole.top - gap - ARROW - th;
  return { hole, side, left, top, arrowX, arrowY: side === 'below' ? hole.bottom + gap : hole.top - gap - ARROW };
}

// ---------- 화면 ----------
const find = sel => { try { return [...document.querySelectorAll(sel)].find(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; }) || null; } catch { return null; } };
const shown = sel => !!find(sel);
const busy = () => !!document.querySelector('dialog[open], .guide-pop:not([hidden]), .viewer-stage');
let cur = '', running = null, stopRun = null, timer = 0, tries = 0;

// show()가 부른다: 화면이 바뀌면 새 화면의 투어를 기다린다(자료가 늦게 와도 최대 8초)
export function tourScreen(tab) { cur = screenOf(tab); if (running && running.screen !== cur) stopRun(false); tries = 0; poll(32); } // 안내 중에 화면이 바뀌면 그 안내는 접는다(본 것으로 치지 않음)
// 0.25초마다 확인. 여러 번 불려도 기다릴 횟수는 큰 쪽을 따른다(화면 이동 직후 클릭 확인이 짧게 덮어쓰지 않게)
function poll(n) { tries = Math.max(tries, n); if (!timer) timer = setTimeout(tick, 250); }
function tick() {
  timer = 0;
  if (running) { tries = 0; return; }
  const t = !busy() && pickTour(cur, shown);
  if (t) { tries = 0; return runTour(t); }
  if (--tries > 0) timer = setTimeout(tick, 250);
}
// 화면 안 탭(자료실 서류|링크, 콘티 특송 등)을 눌렀을 때도 그 탭 투어를 찾는다
if (globalThis.document) document.addEventListener('click', e => { if (cur && !running && !e.target.closest?.('.tour')) poll(6); });
// '사용법 다시 보기'
export function tourAgain() { const t = cur && pickTour(cur, shown, { again: true }); if (t) runTour(t); return !!t; }

function runTour(t) {
  const steps = liveSteps(t.steps, shown);
  if (!steps.length) return markSeen(t.id);
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const h = (tag, cls, text) => { const el = document.createElement(tag); if (cls) el.className = cls; if (text) el.textContent = text; return el; };
  // 덮개(fixed, 탭 받기·아래 버튼 줄)와 그림층(body 아래 absolute)을 나눈다: 구멍·글을 대상과 같은 좌표계에 두어 iOS 사파리의 fixed 좌표 어긋남을 피한다
  const root = h('div', 'tour'), layer = h('div', 'tour-layer' + (calm ? ' calm' : '')), hole = h('div', 'tour-hole');
  const tip = h('div', 'tour-tip'), title = h('h2', 'tour-title'), text = h('p', 'tour-text');
  const arrow = h('div', 'tour-arrow'); arrow.innerHTML = '<svg viewBox="0 0 32 48" width="32" height="48" aria-hidden="true"><path d="M21 46C11 38 10 22 16 4" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M8 12l8-9 7 10" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const bar = h('div', 'tour-bar'), skip = h('button', 'tour-skip', '건너뛰기'), count = h('p', 'tour-count'), next = h('button', 'tour-next');
  const ask = h('div', 'tour-ask'), askText = h('p', 'tour-ask-text', '다른 화면 안내도 끌까요?'), justHere = h('button', 'tour-skip', '이 화면만 끄기'), off = h('button', 'tour-next tour-off', '모든 안내 끄기');
  for (const b of [skip, next, justHere, off]) b.type = 'button';
  title.id = 'tour-title'; text.id = 'tour-text';
  bar.setAttribute('role', 'dialog'); bar.setAttribute('aria-modal', 'true'); bar.setAttribute('aria-labelledby', 'tour-title'); bar.setAttribute('aria-describedby', 'tour-text');
  tip.setAttribute('aria-live', 'polite'); tip.append(title, text);
  ask.hidden = true; ask.append(askText, justHere, off);
  bar.append(skip, count, next, ask); layer.append(hole, arrow, tip); root.append(bar);
  let i = 0, raf = 0;
  const place = () => {
    const el = find(steps[i].sel); if (!el) return;
    const vv = globalThis.visualViewport, L = layer.getBoundingClientRect(), r = el.getBoundingClientRect();
    // 보이는 화면(핀치 확대·주소창 변화 반영) — getBoundingClientRect와 같은 기준(레이아웃 뷰포트)
    const vl = vv ? vv.offsetLeft : 0, vt = vv ? vv.offsetTop : 0, vw = vv ? vv.width : innerWidth, vh = vv ? vv.height : innerHeight;
    const vis = { l: vl, t: vt, r: vl + vw, b: Math.min(vt + vh, bar.getBoundingClientRect().top - 16) }; // 아래 버튼 줄과 16px 띄움
    const tw = Math.min(360, vw - 48); tip.style.width = tw + 'px';
    const o = coachLayout(r, vis, tw, tip.offsetHeight);
    const px = (el, x, y) => { el.style.left = (x - L.left) + 'px'; el.style.top = (y - L.top) + 'px'; };
    px(hole, o.hole.left, o.hole.top); hole.style.width = (o.hole.right - o.hole.left) + 'px'; hole.style.height = Math.max(o.hole.bottom - o.hole.top, 0) + 'px';
    px(tip, o.left, o.top); px(arrow, o.arrowX - 16, o.arrowY); arrow.classList.toggle('up', o.side === 'above');
  };
  const later = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => (raf = requestAnimationFrame(place))); };
  const go = n => {
    i = n; const s = steps[i], last = i === steps.length - 1;
    count.textContent = (i + 1) + '/' + steps.length; count.setAttribute('aria-label', steps.length + '단계 중 ' + (i + 1) + '단계');
    title.textContent = s.title; text.textContent = typeof s.text === 'function' ? s.text() : s.text; next.textContent = last ? '시작하기' : '다음';
    const el = find(s.sel); // 화면보다 큰 대상은 제목이 보이게 위쪽부터
    if (el) { const x = scrollX; el.scrollIntoView({ block: el.getBoundingClientRect().height > innerHeight * 0.6 ? 'start' : 'center', behavior: 'instant' }); if (scrollX !== x) scrollTo(x, scrollY); } // 가로로는 움직이지 않게
    place(); later(); next.focus({ preventScroll: true });
  };
  const forward = () => (i < steps.length - 1 ? go(i + 1) : end());
  const mo = new MutationObserver(later), vv = globalThis.visualViewport;
  const end = (seen = true) => {
    running = null; if (seen) { markSeen(t.id); for (const id of t.covers || []) { const c = TOURS.find(x => x.id === id); if (c && all(c.when).every(shown)) markSeen(id); } }
    mo.disconnect(); removeEventListener('resize', later); removeEventListener('scroll', later, true); vv?.removeEventListener('resize', later); vv?.removeEventListener('scroll', later);
    document.removeEventListener('keydown', key, true); document.removeEventListener('focusin', trap); cancelAnimationFrame(raf);
    document.body.classList.remove('tour-on'); root.remove(); layer.remove();
    poll(4); // 같은 화면에 이어 볼 탭 투어가 있으면
  };
  const asking = on => { ask.hidden = !on; layer.classList.toggle('asking', on); for (const b of [skip, count, next]) b.hidden = on; (on ? justHere : next).focus({ preventScroll: true }); };
  const key = e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); end(); }
    else if (!ask.hidden) return;
    else if (e.key === 'ArrowRight' || (e.key === 'Enter' && !e.target.closest?.('.tour button'))) { e.preventDefault(); e.stopPropagation(); forward(); }
  };
  const trap = e => { if (!root.contains(e.target)) (ask.hidden ? next : justHere).focus({ preventScroll: true }); };
  next.onclick = forward; justHere.onclick = () => end(); skip.onclick = () => asking(true); off.onclick = () => { tourOff(); end(); };
  root.onclick = e => { if (!bar.contains(e.target) && !ask.hidden) asking(false); }; // 어두운 곳은 넘기지 않음(닫으려다 넘어가는 실수 방지) — 묻는 중이면 묻기만 닫기
  running = t; stopRun = end; document.body.classList.add('tour-on'); document.body.append(layer, root);
  mo.observe(document.getElementById('view') || document.body, { childList: true, subtree: true });
  addEventListener('resize', later); addEventListener('scroll', later, true); vv?.addEventListener('resize', later); vv?.addEventListener('scroll', later);
  document.addEventListener('keydown', key, true); document.addEventListener('focusin', trap);
  go(0); requestAnimationFrame(() => layer.classList.add('ready')); // 첫 자리는 움직이지 않고 바로
}
