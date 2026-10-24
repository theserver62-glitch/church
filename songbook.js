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
