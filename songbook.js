// 교회 곡 목록. 교회 문서의 songbook: { "제목 (키)": {title, key, note, theme, mood, sheet} }.
// note는 '시와찬미 47'·'악보 있음' 같은 메모, theme은 시와찬미 6주제, mood는 신나게/보통/잔잔하게(AI 추정).
export const label = s => (s.key ? `${s.title} (${s.key})` : s.title);

// "제목,키,메모,주제,분위기,악보 주소" CSV(뒤 칸은 없어도 됨)를 곡 목록으로. 첫 줄이 머리글(제목)이면 건너뛴다. 따옴표 안의 쉼표도 처리한다.
export function parseCsv(text) {
  const book = {};
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const cells = [...line.matchAll(/("([^"]*(?:""[^"]*)*)"|[^,]*)(,|$)/g)].map(m => (m[2] ?? m[1]).replace(/""/g, '"').trim());
    const [title, key = '', note = '', theme = '', mood = '', sheet = ''] = cells;
    if (!title || title === '제목') continue;
    const s = { title: title.slice(0, 100), key: key.slice(0, 10), ...(note && { note: note.slice(0, 60) }),
      ...(theme && { theme: theme.slice(0, 20) }), ...(mood && { mood: mood.slice(0, 10) }), ...(sheet.startsWith('https://') && { sheet }) };
    book[label(s)] = s;
  }
  return book;
}

// 보기별로 묶기. by: 'key' | 'mood' | 'theme'. [[묶음 이름, [곡...]], ...] 정해진 순서로.
const ORDER = {
  key: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Ab', 'Bb', 'Eb', '단조'],
  mood: ['신나게', '보통', '잔잔하게'],
  theme: ['경배와 찬양', '은혜와 사랑', '회개와 고백', '기도와 간구', '축복과 교제', '선교와 승리'],
};
export function groupSongs(book, by) {
  const g = {};
  for (const s of Object.values(book)) (g[(by === 'key' && /m$/.test(s.key || '') ? '단조' : s[by]) || '기타'] ||= []).push(s);
  const rank = k => (ORDER[by].indexOf(k) + 1 || 99);
  return Object.entries(g).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([k, list]) => [k, list.sort((a, b) => a.title.localeCompare(b.title))]);
}

// 기본 분류를 유지하면서 교회의 메모·악보·수정 값을 우선한다.
export function mergeLibrary(defaults = [], songbook = {}) {
  const merged = new Map(defaults.map(s => [label(s), { ...s }]));
  for (const [name, s] of Object.entries(songbook || {})) {
    if (!s) continue;
    const id = s.title ? label(s) : name;
    merged.set(id, { ...merged.get(id), ...s });
  }
  return Object.fromEntries(merged);
}

// 모든 선택 조건을 함께 적용하고 새 배열을 곡명순으로 반환한다.
export function filterSongs(list, { key = '', theme = '', mood = '', q = '' } = {}) {
  const query = q.trim().toLocaleLowerCase();
  return list.filter(s => (!key || key === '전체' || (key === '단조' ? ['Am','Bm','Dm','Em','F#m'].includes(s.key) : s.key === key))
    && (!theme || theme === '전체' || s.theme === theme)
    && (!mood || mood === '전체' || s.mood === mood)
    && (!query || s.title.toLocaleLowerCase().includes(query)))
    .sort((a, b) => a.title.localeCompare(b.title, 'ko') || (a.key || '').localeCompare(b.key || ''));
}

// 키 글자: C, F#, Bb, Am, C#m 같은 것(♭·♯도 받는다)
const KEY = '[A-Ga-g][#b♭♯]?m?';
const keyFix = k => k ? k[0].toUpperCase() + k.slice(1).replace('♭', 'b').replace('♯', '#') : '';
// 한 줄을 곡명·키로: '곡명 (키)' 또는 '곡명 키'. 키가 없으면 곡명만.
export function splitTitleKey(line) {
  const t = line.trim().replace(/\s+/g, ' ');
  const m = t.match(new RegExp(String.raw`^(.+?)\s*[(（\[]\s*(${KEY})\s*[)）\]]$`)) || t.match(new RegExp(String.raw`^(.+?)\s+(${KEY})$`));
  return m ? { title: m[1].trim().slice(0, 100), key: keyFix(m[2]) } : { title: t.slice(0, 100), key: '' };
}
// "곡 한꺼번에 넣기": 한 줄에 한 곡. 빈 줄은 건너뛰고 같은 곡(제목+키)은 한 번만.
export function parseBulk(text) {
  const book = {};
  for (const line of String(text).split(/\r?\n/)) { const s = splitTitleKey(line); if (s.title) book[label(s)] = s; }
  return book;
}
// 파일 이름 '곡명 (키).jpg' → {title, key}. 밑줄은 띄어쓰기로.
export function nameFromFile(name) {
  const s = splitTitleKey(String(name).replace(/\.[^.]+$/, '').replace(/_/g, ' '));
  // 카메라·카톡이 붙인 이름(IMG 2031, KakaoTalk 2026…, 숫자만)은 곡명으로 쓰지 않는다
  return /^(img|dsc|pxl|kakaotalk|screenshot|image|photo)\b/i.test(s.title) || /^[\d\s-]+$/.test(s.title) ? { title: '', key: s.key } : s;
}
// 악보 id: 제목+'|'+키의 SHA-1 앞 16자리(소문자 hex)
export async function sheetId(title, key) {
  const buf = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(title + '|' + (key || '')));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
// 곡 보관함 순서: 즐겨찾기 → 악보 있는 곡 → 우리 교회 곡 → 기본 곡(같은 무리 안에서는 원래 순서).
// only면 악보 있는 곡만, onlyFav면 즐겨찾기만(favorites: {[label]: true|false}).
export function sheetFirst(list, sheets = {}, churchBook = {}, only = false, favorites = {}, onlyFav = false) {
  const has = s => Object.values(sheets).some(v => v?.title === s.title && (v.key || '') === (s.key || ''));
  const fav = s => favorites[label(s)] === true;
  const rank = s => (fav(s) ? 0 : has(s) ? 1 : churchBook[label(s)] ? 2 : 3);
  return list.filter(s => (!only || has(s)) && (!onlyFav || fav(s))).map((s, i) => [rank(s), i, s]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(r => r[2]);
}

// ---------- 곡 보관함(2026-10-24 개편): 조건 AND, 키별 악보, 0곡 까닭 ----------
const keyMatch = (k, want) => !want || want === '전체' || (want === '단조' ? /m$/.test(k || '') : k === want);
// 그 제목으로 올라온 악보의 키들(가나다·알파벳순)
export const sheetKeys = (title, sheets = {}) => [...new Set(Object.values(sheets).filter(v => v?.title === title).map(v => v.key || ''))].sort();
// 조건은 모두 AND. 악보만 켜면 '그 키의 악보가 실제로 있는 곡'만(같은 제목은 한 줄). sort: 'name' 가나다순 · 'rec' 즐겨찾기→악보→우리 교회
export function browseSongs(list, { sheets = {}, churchBook = {}, favorites = {}, onlySheets = false, onlyFav = false, key = '', theme = '', mood = '', q = '', sort = 'name' } = {}) {
  // 즐겨찾기: 그 곡(제목+키). 악보만 보기에서는 같은 제목의 다른 키 즐겨찾기도 인정
  const fav = s => Object.entries(favorites).some(([k, v]) => v === true && (k === label(s) || (onlySheets && (k === s.title || k.startsWith(s.title + ' (')))));
  const seen = new Set();
  let songs = filterSongs(list, { theme, mood, q }).filter(s => (!onlyFav || fav(s)) && (onlySheets ? sheetKeys(s.title, sheets).some(k => keyMatch(k, key)) : keyMatch(s.key, key)));
  if (onlySheets) songs = songs.filter(s => !seen.has(s.title) && seen.add(s.title));
  if (sort === 'rec') { const r = s => fav(s) ? 0 : sheetKeys(s.title, sheets).length ? 1 : churchBook[label(s)] ? 2 : 3; songs = songs.map((s, i) => [r(s), i, s]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]); }
  const reason = songs.length ? '' : onlyFav && !Object.values(favorites).some(v => v === true) ? 'noFav' : q.trim() ? 'search' : 'cond';
  return { songs, reason };
}
// 0곡일 때 안내와 풀 조건 하나(action: fav·key·theme·mood·sheets·reset)
export function emptyHint({ reason, onlyFav = false, onlySheets = false, key = '', theme = '', mood = '' }) {
  if (reason === 'noFav') return { text: '아직 즐겨찾기한 곡이 없어요', button: '즐겨찾기 끄기', action: 'fav' };
  if (reason === 'search') return { text: '현재 조건에 맞는 곡이 없어요', button: '초기화', action: 'reset' };
  const scope = onlyFav ? '즐겨찾기 중 ' : onlySheets ? '악보 있는 곡 중 ' : '';
  const conds = [key && (key === '단조' ? '단조' : key + '키'), theme, mood].filter(Boolean);
  const [button, action] = key ? ['키 조건 해제', 'key'] : theme ? ['주제 조건 해제', 'theme'] : mood ? ['분위기 조건 해제', 'mood'] : onlyFav ? ['즐겨찾기 끄기', 'fav'] : onlySheets ? ['악보만 끄기', 'sheets'] : ['초기화', 'reset'];
  return { text: scope + (conds.length ? conds.join(' · ') + '에 맞는 곡이 없어요' : '맞는 곡이 없어요'), button, action };
}

// ---------- 특송 고르기(specials.json: {title, by, form[], age[], season[], theme[], where, url}) ----------
// 절기 행사 → 특송 절기 이름
export const SPECIAL_SEASON = { advent: '대림·성탄', christmas: '대림·성탄', lent: '사순·고난', palm: '사순·고난', easter: '부활', pentecost: '성령강림', thanksgiving: '추수·맥추감사', summerThanks: '추수·맥추감사', yearEnd: '송구영신' };
// 다가오는 행사(가까운 순) 중 특송 절기가 있는 첫 행사 → {season, event}. 없으면 null
export function defaultSeason(upcoming = []) {
  const ev = upcoming.find(e => SPECIAL_SEASON[e.id]);
  return ev ? { season: SPECIAL_SEASON[ev.id], event: ev.name } : null;
}
// 형태·연령·절기·주제는 모두 AND(각각 그 값을 가진 곡만), 검색은 곡명·부른 이. 가나다순
export function filterSpecials(list, { form = '', age = '', season = '', theme = '', q = '' } = {}) {
  const query = q.trim().toLocaleLowerCase();
  const has = (arr, v) => !v || (arr || []).includes(v);
  return list.filter(s => has(s.form, form) && has(s.age, age) && has(s.season, season) && has(s.theme, theme)
    && (!query || (s.title + ' ' + (s.by || '')).toLocaleLowerCase().includes(query)))
    .sort((a, b) => a.title.localeCompare(b.title, 'ko'));
}
// 0곡일 때 안내와 풀 조건 하나(가장 최근에 좁힌 순서: 주제 → 절기 → 연령 → 형태)
export function specialEmpty({ form = '', age = '', season = '', theme = '', q = '' }) {
  if (q.trim()) return { text: '현재 조건에 맞는 특송이 없어요', button: '초기화', action: 'reset' };
  const conds = [form, age, season && season + ' 절기', theme].filter(Boolean);
  const [button, action] = theme ? ['주제 조건 해제', 'theme'] : season ? ['절기 조건 해제', 'season'] : age ? ['연령 조건 해제', 'age'] : form ? ['형태 조건 해제', 'form'] : ['초기화', 'reset'];
  return { text: (conds.length ? conds.join(' · ') + '에 맞는 특송이 없어요' : '특송 목록이 비어 있어요'), button, action };
}
// 특송 표시: by에서 '확인 필요' 조각은 빼고 확인된 부분만(예: "신상우 편곡")
export const cleanBy = by => String(by || '').split('/').map(x => x.trim()).filter(x => x && !x.includes('확인 필요')).join(' / ');
// 판매처 이름: 주소 도메인으로(악보통·중앙아트, 그 외는 도메인 이름)
export function seller(url) {
  let host = ''; try { host = new URL(url).hostname.replace(/^www\./, ''); } catch { return ''; }
  return /akbotong/.test(host) ? '악보통' : /joongangart/.test(host) ? '중앙아트' : host.split('.')[0];
}
