// 예배 순서(worship.json)와 부서별 예배 PPT 장 구성. 화면·파일 만들기와 떼어 둔 순수 함수(테스트용).
import { splitVerse, passageLabel } from './home.js?v=202610250239';

// 교회가 고친 순서가 있으면 그것, 없으면(null·빈 값) 기본 순서
export const orderFor = (service, saved = {}) => (Array.isArray(saved?.[service.id]) && saved[service.id].length ? saved[service.id] : service.steps).map(s => ({ name: s.name || '', who: s.who || '', note: s.note || '' }));
export const isPastorOnly = step => /목사/.test(step.who || '') && !/평신도|사회자|다 함께/.test(step.who || '');
// 절기 행사 → 예배
export const SEASON_SERVICE = { advent: 'advent', christmas: 'christmas', lent: 'lent', palm: 'palm', easter: 'easter', pentecost: 'pentecost', thanksgiving: 'thanksgiving', summerThanks: 'thanksgiving', yearEnd: 'yearend', retreat: 'retreat-open' };
export const recommendService = (upcoming = [], services = []) => { const ev = upcoming.find(e => SEASON_SERVICE[e.id]); const sv = ev && services.find(s => s.id === SEASON_SERVICE[ev.id]); return sv ? { service: sv, event: ev } : null; };

// 테마: 어두운 기본과 밝은 대안(퍼플렉시티 사양)
export const PALETTE = {
  dark: { bg: '111827', text: 'F9FAFB', sub: 'D1D5DB', accent: 'FBBF24' },
  light: { bg: 'FFFFFF', text: '111827', sub: '374151', accent: '92400E' },
};
// 부서 7개: 같은 구조, 강조색·표지 문구·기본 테마·글자 키움만 다르다
export const DEPTS = [
  { id: 'preschool', name: '유치부', base: 'light', plus: 4, accent: { light: 'B45309', dark: 'FBBF24' }, cover: '하나님과 함께 기뻐해요', service: 'kids-preschool' },
  { id: 'elementary', name: '초등부', base: 'light', plus: 4, accent: { light: '047857', dark: '34D399' }, cover: '말씀으로 자라요', service: 'kids-elementary' },
  { id: 'middle', name: '중등부', base: 'dark', plus: 0, accent: { light: '1E40AF', dark: '60A5FA' }, cover: '함께 예배해요', service: 'youth' },
  { id: 'high', name: '고등부', base: 'dark', plus: 0, accent: { light: '5B21B6', dark: 'A78BFA' }, cover: '함께 예배해요', service: 'youth' },
  { id: 'young', name: '청년부', base: 'dark', plus: 0, accent: { light: '92400E', dark: 'FBBF24' }, cover: '예배로 한 주를 시작해요', service: 'young-adult' },
  { id: 'youth-all', name: '중고청 통합', base: 'dark', plus: 0, accent: { light: '065F46', dark: '34D399' }, cover: '한 몸으로 예배해요', service: 'youth' },
  { id: 'adult', name: '장년부', base: 'light', plus: 4, accent: { light: '92400E', dark: 'FBBF24' }, cover: '주일 예배', service: 'sunday-main' },
];
export function themeFor(deptId, mode = '') {
  const d = DEPTS.find(x => x.id === deptId) || DEPTS[6], m = mode === 'dark' || mode === 'light' ? mode : d.base;
  const p = PALETTE[m];
  return { dept: d, mode: m, ...p, accent: d.accent[m], size: { title: 48 + d.plus, lyric: 40 + d.plus, bible: 34 + d.plus, notice: 30 + d.plus, sub: 22 + d.plus } };
}
const isPraise = n => /찬송|찬양/.test(n) && !/찬양대|특송/.test(n);
const isBible = n => /성경봉독|봉독|말씀 읽기/.test(n);
const isSermon = n => /설교|말씀 선포|메시지/.test(n) && !/후 기도/.test(n);
const isNotice = n => /광고|교회 소식|알림/.test(n);
const isBenediction = n => /축도/.test(n);
const isCreed = n => /신앙고백|사도신경/.test(n);
// 본문 장: 한 장에 2~3절(글자 많으면 덜), 절 번호를 붙인다("4. 하나님께서…"). 긴 절은 나눈다
export function bibleGroups(p, maxChars = 150, maxN = 3) {
  const out = []; let cur = null;
  const push = () => { if (cur?.lines.length) out.push(cur); cur = null; };
  for (const v of p.verses) {
    const head = p.name + ' ' + v.c + '장', line = v.v + '. ' + v.text;
    if (line.length > maxChars) { push(); splitVerse(v.text, maxChars - 4).forEach((t, i) => out.push({ head, lines: [(i ? '' : v.v + '. ') + t] })); continue; }
    if (cur && (cur.head !== head || cur.lines.length >= maxN || cur.chars + line.length > maxChars)) push();
    cur ??= { head, lines: [], chars: 0 }; cur.lines.push(line); cur.chars += line.length;
  }
  push();
  return out.map(({ head, lines }) => ({ head, lines }));
}
// 고백문(교회가 붙여 넣은 번역 문안)을 장으로: 빈 줄로 나눈 덩어리, 덩어리가 길면 4줄씩
const textSlides = (title, text) => { const lines = String(text || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean); return chunk(lines, 4).map(part => ({ type: 'creed', title, lines: part })); };
// 광고는 여러 줄 입력을 한 장에 6줄까지, 넘치면 장을 나눈다(글자를 줄이지 않는다)
export const chunk = (lines, n = 6) => { const out = []; for (let i = 0; i < lines.length; i += n) out.push(lines.slice(i, i + n)); return out; };

// 예배 PPT 장 구성. songs: [{title, key, image?}], passages: 말씀 PPT와 같은 모양, notices: 문자열 줄들
export function worshipSlides({ service, steps, dept, churchName = '', date = '', time = '', pastor = false, songs = [], passages = [], sermon = {}, notices = [], blank = false, people = [], creeds = true, creedText = {} }) {
  const S = [], d = DEPTS.find(x => x.id === dept) || DEPTS[6];
  S.push({ type: 'wait', title: d.name + ' 예배', sub: (time ? time + ' 시작 · ' : '') + '예배를 준비하는 시간이에요', church: churchName });
  S.push({ type: 'title', title: service.name, sub: [d.name, date, churchName].filter(Boolean).join(' · '), cover: d.cover });
  // 순서 장 머리말: "10월 25일 예배"
  const head = date ? (+date.slice(5, 7)) + '월 ' + (+date.slice(8, 10)) + '일 예배' : service.name;
  const section = (title, i, who) => ({ type: 'section', head, title, sub: people[i] || who || '', church: churchName });
  let praised = false, noticed = false;
  const noticeSlides = i => { noticed = true; const lines = notices.map(x => x.trim()).filter(Boolean); if (!lines.length && !blank) return; S.push(section('광고', i, '')); for (const part of chunk(lines.length ? lines : ['광고 1', '광고 2', '광고 3'])) S.push({ type: 'notice', lines: part }); };
  steps.forEach((st, i) => {
    const n = st.name, last = i === steps.length - 1;
    if (!noticed && (isBenediction(n) || (last && !isNotice(n))) && !steps.some(x => isNotice(x.name))) noticeSlides(-1);
    if (isBenediction(n) && !pastor) { S.push(section('주기도문', -1, '다 함께')); if (creeds) S.push(...textSlides('주기도문', creedText.lords)); return; }
    if (isNotice(n)) { noticeSlides(i); return; }
    if (isCreed(n) && creeds) { S.push(section('사도신경', i, '다 함께')); S.push(...textSlides('사도신경', creedText.apostles)); return; }
    S.push(section(n, i, st.who));
    if (isPraise(n) && !praised) { praised = true; for (const sg of (songs.length ? songs : blank ? [{ title: '찬양 곡명', key: '' }] : [])) S.push(sg.image ? { type: 'sheet', label: sg.title + (sg.key ? ' · ' + sg.key : ''), image: sg.image } : { type: 'song', title: sg.title, sub: sg.key ? sg.key + '키' : '' }); }
    if (isBible(n)) { if (passages.length) { S[S.length - 1].sub = passages.map(passageLabel).join(' / ') + ' · 개역한글'; for (const p of passages) for (const g of bibleGroups(p)) S.push({ type: 'bible', head: g.head, lines: g.lines }); } else if (blank) S[S.length - 1].sub = '본문 (예: 막 4:1-9) · 개역한글'; }
    if (isSermon(n)) S.push({ type: 'sermon', title: sermon.title || (blank ? '설교 제목' : '말씀'), sub: [sermon.text || (blank ? '본문' : ''), sermon.preacher || (blank ? '설교자' : '')].filter(Boolean).join(' · ') });
  });
  S.push({ type: 'after', title: '예배 후 안내', sub: '함께 예배해 주셔서 고마워요', foot: '찬양 가사·악보는 교회 저작권 범위 안에서 사용하세요' });
  return S;
}
export const worshipFileName = (date, deptName, serviceName) => (date ? date + ' ' : '') + deptName + ' ' + serviceName + '.pptx';

// 예배 순서 이름 → 순서별 안내(worship.json elements). 이름 전체가 key·match와 같으면 그것,
// 아니면 '·'·'또는'으로 나눈 조각마다 같은 것 → 없으면 key 핵심어(괄호·'·'로 나눈 말)를 포함하는 것(긴 말 먼저). 겹치면 한 번만
const squash = s => String(s || '').replace(/\([^)]*\)/g, '').replace(/\s+/g, '');
const cores = el => [...new Set([...[el.key, ...String(el.key).replace(/[()]/g, '·').split('·')].map(squash).filter(w => w.length >= 2), ...(el.match || []).map(squash).filter(w => w.length >= 4)])]; // match 낱말은 4글자 이상만(흔한 말에 잘못 걸리지 않게)
export function elementsFor(name, elements = []) {
  const els = Array.isArray(elements) ? elements : [], same = (el, p) => [el.key, ...(el.match || [])].some(m => squash(m) === p);
  const whole = els.find(el => same(el, squash(name)));
  if (whole) return [whole];
  const out = [];
  for (const p of String(name || '').replace(/\([^)]*\)/g, '').split(/·|\s또는\s/).map(squash).filter(Boolean)) {
    const hit = els.find(el => same(el, p)) || els.map(el => [el, cores(el).filter(c => p.includes(c)).sort((a, b) => b.length - a.length)[0]]).filter(([, c]) => c).sort((a, b) => b[1].length - a[1].length)[0]?.[0];
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}

// ---------- 예배로 부름 본문 모음: 이번 주일의 교회력 이름(callToWorship.name과 맞춘다) ----------
// evs = occurrences()의 기본 절기({id, date}). 대림절 n주·사순절 n주·주님의 세례주일·산상변모주일·승천주일·삼위일체주일·종교개혁주일·신년주일도 계산
const dayN = s => Date.parse(s + 'T00:00:00Z') / 864e5, plus = (s, n) => new Date((dayN(s) + n) * 864e5).toISOString().slice(0, 10);
export function sundayName(sun, evs = []) {
  const at = id => evs.filter(e => e.id === id).map(e => e.date), near = id => at(id).sort((a, b) => Math.abs(dayN(a) - dayN(sun)) - Math.abs(dayN(b) - dayN(sun)))[0];
  const exact = { palm: '종려·고난주일', easter: '부활절', pentecost: '성령강림주일', summerThanks: '맥추감사주일', thanksgiving: '추수감사주일', king: '왕 되신 그리스도 주일', epiphany: '주현절' };
  for (const [id, name] of Object.entries(exact)) if (at(id).includes(sun)) return name;
  const adv = near('advent'), xmas = near('christmas'), lent = near('lent'), palm = near('palm'), easter = near('easter'), pent = near('pentecost'), epi = near('epiphany');
  if (adv && xmas && sun >= adv && sun < xmas) return '대림절 ' + Math.min(4, Math.floor((dayN(sun) - dayN(adv)) / 7) + 1) + '주';
  if (xmas && sun === xmas) return '성탄절';
  if (xmas && sun > xmas && sun <= plus(xmas, 7)) return '성탄 후 첫 주';
  if (sun.slice(5) <= '01-07') return '신년주일';
  if (epi && sun > epi && sun <= plus(epi, 7)) return '주님의 세례주일';
  if (lent && sun === plus(lent, -3)) return '산상변모주일';
  if (lent && palm && sun > lent && sun < palm) return '사순절 ' + Math.min(5, Math.ceil((dayN(sun) - dayN(lent)) / 7)) + '주';
  if (pent && sun === plus(pent, -7)) return '승천주일';
  if (easter && pent && sun > easter && sun < pent) return '부활절 2~7주';
  if (pent && sun === plus(pent, 7)) return '삼위일체주일';
  if (sun.slice(5, 7) === '10' && plus(sun, 7).slice(5, 7) === '11') return '종교개혁주일';
  return '';
}
// 절기 이름마다 앞으로 1년 안의 날짜(가장 가까운 것) — 본문 모음에서 '언제 쓰는지' 보여 주고 날짜 순으로 놓으려고
export function nameDates(fromSun, evs = []) {
  const out = {}, put = (n, d) => { if (n && !out[n]) out[n] = d; };
  for (let k = 0; k < 53; k++) { const d = plus(fromSun, 7 * k); put(sundayName(d, evs), d); }
  const next = id => evs.filter(e => e.id === id && e.date >= fromSun).map(e => e.date).sort()[0];
  put('성탄절', next('christmas')); put('주현절', next('epiphany')); put('재의 수요일', next('lent')); put('성금요일', next('goodFriday') || next('goodfriday')); put('송구영신', next('yearEnd') || next('yearend'));
  return out;
}
// 이번 주 추천: 교회력 이름이 맞는 본문들, 없으면 평상시 주제 하나를 주차로 돌려서
export function callRec(list = [], sun, evs = []) {
  const name = sundayName(sun, evs), hit = list.filter(x => x.name === name);
  if (hit.length) return { name, items: hit };
  const themes = [...new Set(list.filter(x => x.group === '평상시').map(x => x.name))];
  if (!themes.length) return { name: '', items: [] };
  const t = themes[Math.floor(dayN(sun) / 7) % themes.length];
  return { name: t, items: list.filter(x => x.name === t), plain: true };
}
