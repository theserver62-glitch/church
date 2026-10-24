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

// ---------- 콘티 PPT의 악보 장 ----------
// 곡에 쓸 악보: 같은 제목+키, 없으면 같은 제목의 아무 키(키 순). 없으면 null
export function pickSheet(song, sheets = {}) {
  const same = Object.entries(sheets).filter(([, v]) => v?.title === song.title).sort((a, b) => (a[1].key || '').localeCompare(b[1].key || ''));
  return (same.find(([, v]) => (v.key || '') === (song.key || '')) || same[0])?.[0] || null;
}
// 곡 장 구성(콘티 순서): 악보 그림이 있으면 'sheet'(오른쪽 위 작게 "1. 곡명 · E"), 없으면 'song'(제목 장 "곡명 · E")
export function contiSlides(songs, images = {}) {
  return songs.filter(s => s.title?.trim()).map((s, i) => {
    const name = s.title + (s.key ? ' · ' + s.key : ''), image = images[s.title + '|' + (s.key || '')];
    return image ? { type: 'sheet', title: s.title, key: s.key || '', label: (i + 1) + '. ' + name, image } : { type: 'song', title: s.title, key: s.key || '', label: name };
  });
}
// 그림을 16:9 장(13.333×7.5in) 안에 비율대로 최대한 크게(자르지 않음). 위에 이름 자리 0.6in
export function fitImage(w, h, box = { x: 0.4, y: 0.6, w: 12.533, h: 6.75 }) {
  const r = Math.min(box.w / w, box.h / h), iw = w * r, ih = h * r;
  return { x: box.x + (box.w - iw) / 2, y: box.y + (box.h - ih) / 2, w: iw, h: ih };
}
// 특송 유튜브: 항목에 youtube(https)가 있으면 그것, 없으면 검색 결과(특정 영상을 지어내지 않는다)
export const youtubeLink = x => (typeof x.youtube === 'string' && /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//.test(x.youtube) ? x.youtube
  : 'https://www.youtube.com/results?search_query=' + encodeURIComponent([x.title, cleanBy(x.by), '특송'].filter(Boolean).join(' ')));

// ---------- 콘티 목록·새 콘티 ----------
// 콘티 문서(conti/{날짜}): 기본 예배는 songs(예전 자료 그대로), 다른 예배는 services[예배 id].songs
export const contiSongsOf = (doc, svc, def) => (svc && svc !== def ? doc?.services?.[svc]?.songs : doc?.songs) || [];
export const contiPatchOf = (svc, def, songs) => (svc && svc !== def ? { services: { [svc]: { songs } } } : { songs });
// 그 날짜 문서에 있는 예배들(기본 예배가 먼저)
export const contiServices = (doc, def) => [def, ...Object.keys(doc?.services || {}).filter(k => k !== def && doc.services[k])];
// 새 콘티 시작: 'empty' 빈 콘티 · 'copy' 지난주 같은 예배 곡 복사 · 'book' 빈 콘티로 열고 곡 보관함에서 고르기
export const newContiSongs = (method, lastDoc, svc, def) => (method === 'copy' ? contiSongsOf(lastDoc, svc, def).filter(s => s?.title).map(s => ({ title: s.title || '', key: s.key || '', memo: s.memo || '' })) : []);

// 첫 글자 초성(된소리는 예사소리로). 한글이 아니면 'A-Z·숫자'
const CHO = 'ㄱㄱㄴㄷㄷㄹㅁㅂㅂㅅㅅㅇㅈㅈㅊㅋㅌㅍㅎ';
const initial = t => { const c = (t || '').trim().charCodeAt(0) - 0xac00; return c >= 0 && c < 11172 ? CHO[Math.floor(c / 588)] : 'A-Z·숫자'; };
// 악보 있는 곡 묶어 보기: by 'key'(악보 키별, 여러 키면 각 묶음에) · 'theme' · 'mood' · 'name'(첫 글자 ㄱㄴㄷ). [[이름, 곡들]] 정해진 순서로
export function groupFor(songs, by, sheets = {}) {
  const g = new Map(), add = (k, s) => { if (!g.has(k)) g.set(k, []); g.get(k).push(s); };
  for (const s of songs) {
    if (by === 'key') { const ks = sheetKeys(s.title, sheets); (ks.length ? ks : [s.key || '']).forEach(k => add(/m$/.test(k) ? '단조' : k || '키 없음', s)); }
    else add(by === 'name' ? initial(s.title) : s[by] || (by === 'theme' ? '주제 없음' : '분위기 없음'), s);
  }
  const order = by === 'name' ? [...new Set(CHO)] : ORDER[by] || [];
  return [...g].sort((a, b) => { const ia = order.indexOf(a[0]), ib = order.indexOf(b[0]); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a[0].localeCompare(b[0], 'ko'); });
}

// 지난 콘티 꼬리표: source가 'kakao'이거나, 월계성도교회에서 source 없이 2026-10-24 전 날짜면 카톡 백업에서 가져온 것
export const fromKakao = (doc, day, code) => doc?.source === 'kakao' || (!doc?.source && day < '2026-10-24' && code === '7XWAJ-25432');

// 찬송가: 악보·PPT는 앱에 넣지 않고(한국찬송가공회 저작권) 구글 검색으로 연결
export const hymnLinks = x => { const q = t => 'https://www.google.com/search?q=' + encodeURIComponent(t); return { sheet: q(`새찬송가 ${x.no}장 ${x.title} 악보`), ppt: 'https://www.hymnkorea.org/48' }; }; // PPT는 한국찬송가공회 공식 자료실(공회가 직접 무료 제공)
// "123" · "123장"은 장 번호 앞자리로, 그 밖은 제목에 들어 있는지로 찾는다
export const filterHymns = (list, q = '') => { q = q.trim(); const n = q.replace(/장$/, ''); return !q ? list : /^\d+$/.test(n) ? list.filter(x => String(x.no).startsWith(n)) : list.filter(x => x.title.includes(q)); };

// 메모 속 주소를 링크로: [글자, 주소, 글자 …]로 나눈다(홀수 칸이 주소). http(s)만, 끝의 문장부호는 빼고
export const splitLinks = (text = '') => String(text).split(/(https?:\/\/[^\s<>"']+[^\s<>"'.,!?)\]])/);

// 콘티 보기 링크: ?v=교회코드&d=날짜(&s=예배). 받은 사람은 로그인 없이 악보 보기 화면으로
export const viewerLink = (base, code, date, svc = '') => base + '?v=' + encodeURIComponent(code) + '&d=' + date + (svc ? '&s=' + encodeURIComponent(svc) : '');
export function parseViewer(search = '') {
  const q = new URLSearchParams(search), code = (q.get('v') || '').toUpperCase(), date = q.get('d') || '', svc = q.get('s') || '';
  return /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code) && /^\d{4}-\d{2}-\d{2}$/.test(date) && /^[\w-]{0,40}$/.test(svc) ? { code, date, svc } : null;
}
// 보기 장: 곡마다 한 장(악보 id 또는 null = '악보 없음' 장). 제목 없는 줄은 뺀다
export const viewerPages = (songs = [], sheets = {}) => songs.filter(s => s?.title?.trim()).map(s => ({ title: s.title, key: s.key || '', sheet: pickSheet(s, sheets) }));

// ---------- 카톡에서 가져오기(2026-10-25): 콘티 글 붙여 넣기 · 악보 사진 이름 맞추기 ----------
// 곡명 비교용: 괄호 안 글자와 띄어쓰기·문장부호를 뺀 소문자
const PAREN = /[(\[（【][^)\]）】]*[)\]）】]/g;
const norm = t => String(t || '').replace(PAREN, '').replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
// 곡 목록(배열)에서 같은 곡 → {title: 목록의 곡명, key: 그 곡의 키가 하나뿐이면 그 키}. 없으면 null
export function matchSong(title, list = []) {
  const n = norm(title), hits = n ? list.filter(s => s?.title && norm(s.title) === n) : [];
  if (!hits.length) return null;
  const keys = [...new Set(hits.map(s => s.key || '').filter(Boolean))];
  return { title: hits[0].title, key: keys.length === 1 ? keys[0] : '' };
}
const K = '([A-Ga-g][#b♭♯]?m?)(?![A-Za-z#♭♯])', ARROW = String.raw`\s*(?:→|->|=>|⇒|➡|➔|>|~)\s*`;
// 키 모양: 앞의 넷은 괄호·'키'·구분 기호가 있는 것(가장 앞에 나온 것을 쓴다), 마지막은 줄 끝(또는 한글 앞)의 맨 키 글자
const KEY_FORMS = [
  new RegExp(String.raw`[(\[（【]\s*(?:key|키)?\s*:?\s*${K}(?:(?:${ARROW}|\s*-\s*|\s*에서\s*)${K})?\s*(?:키|key|조)?\s*(?:전조)?(?:\s*[,/·]\s*([^)\]）】]*))?[)\]）】]`, 'i'),
  new RegExp(String.raw`(?:key|키)\s*[:=]?\s*${K}(?:${ARROW}${K})?`, 'i'),
  new RegExp(String.raw`\s*[-–—/|:,]\s*${K}(?:${ARROW}${K})?(?:\s*(?:키|key))?`, 'i'),
  new RegExp(String.raw`\s${K}(?:${ARROW}${K})?\s*(?:키|key)`, 'i'),
  new RegExp(String.raw`\s${K}(?:${ARROW}${K})?(?=\s*$|\s+[^A-Za-z\s])`),
];
const tidy = t => t.replace(/\s+/g, ' ').replace(/^[\s\-–—•·*▶▷►♪♬♩~>→➡:,.]+|[\s\-–—/|:,.·]+$/g, '').replace(/^["'“”‘’「」]+|["'“”‘’「」]+$/g, '').trim();
const unparen = t => t.replace(/^[(\[（【](.*)[)\]）】]$/, '$1').trim();
const LABEL = /^(오프닝|찬양|경배|결단|봉헌|헌금|기도|응답|특송|파송|마무리|선포|입례|말씀|엔딩|클로징)\s*[:：/]\s*/;
const keyAt = s => { const first = rs => rs.map(r => s.match(r)).filter(m => m && m.index > 0).sort((a, b) => a.index - b.index)[0]; return first(KEY_FORMS.slice(0, 4)) || first(KEY_FORMS.slice(4)); };
// 곡 하나 → [곡, 남은 글]. 키 뒤에 '/'·'→'로 키 있는 곡이 또 이어지면(한 줄에 여러 곡) 남은 글로 돌려준다
function songAndRest(line, list) {
  const s = tidy(line), m = keyAt(s);
  let raw = m ? s.slice(0, m.index) : s, after = m ? unparen(tidy(s.slice(m.index + m[0].length))) : '', rest = '';
  const chain = m && s.slice(m.index + m[0].length).trim().match(/^(?:\/|→|->|➡|\|)\s*(.+)$/);
  if (chain && keyAt(tidy(chain[1]))) { rest = chain[1]; after = ''; }
  const label = raw.match(LABEL); if (label) raw = raw.slice(label[0].length);
  const k1 = m ? keyFix(m[1]) : '', k2 = m?.[2] ? keyFix(m[2]) : '';
  const hit = matchSong(raw, list), extra = (raw.match(PAREN) || []).filter(p => !hit?.title.includes(p)).map(unparen).filter(Boolean);
  const title = hit ? hit.title : tidy(raw.replace(PAREN, ' ')) || tidy(raw);
  const memo = [label?.[1], ...extra, k2 && k1 + '→' + k2, m?.[3]?.trim(), after].filter(Boolean).join(' · ');
  return [{ title: title.slice(0, 100), key: (k1 || hit?.key || '').slice(0, 10), memo: memo.slice(0, 100), known: !!hit }, rest];
}
const songsIn = (line, list) => { const out = []; for (let r = line, n = 0; r && n < 10; n++) { const [song, rest] = songAndRest(r, list); out.push(song); r = rest; } return out; };
// 곡 한 줄 → {title, key, memo, known}. 키 뒤 글자·곡명 속 괄호·'오프닝:' 같은 순서 표시는 메모, 'G→A'는 키 G + 메모 'G→A'. known = 곡 목록에 있는 곡
export const parseSongLine = (line, list = []) => songAndRest(line, list)[0];
// 글 속 첫 날짜 → {iso, at, text}. 연도가 없으면 today에서 가장 가까운 해
const DATE = /(?:(\d{4}|\d{2})\s*[.\/년-]\s*)?(?<!\d)(\d{1,2})\s*(?:\/|\.|월|-)\s*(\d{1,2})(?!\d)\s*일?/;
function findDate(t, today) {
  const m = t.match(DATE);
  if (!m) return null;
  const mo = +m[2], d = +m[3], ty = +today.slice(0, 4), pad = n => String(n).padStart(2, '0');
  const ok = y => d >= 1 && new Date(Date.UTC(y, mo - 1, d)).getUTCMonth() === mo - 1 && mo >= 1 && mo <= 12;
  const t0 = Date.parse(today + 'T00:00:00Z'), dist = y => Math.abs(Date.UTC(y, mo - 1, d) - t0);
  const y = (m[1] ? [m[1].length === 2 ? 2000 + +m[1] : +m[1]] : [ty - 1, ty, ty + 1]).filter(ok).sort((a, b) => dist(a) - dist(b))[0];
  return y ? { iso: `${y}-${pad(mo)}-${pad(d)}`, at: m.index, text: m[0] } : null;
}
// 카톡 콘티 글 → {date: 'YYYY-MM-DD' 또는 '', songs: [{title, key, memo, known}]}.
// 번호 있는 곡(한 줄에 여러 곡도)과, 인사·공지 같지 않은 곡 줄을 글 순서대로. list = 곡 목록(같은 곡이면 목록의 곡명으로)
export function parseKakaoConti(text, { today = new Date().toISOString().slice(0, 10), list = [] } = {}) {
  let date = '';
  const items = [], MARK = /(?:^|\s|(?<=[)\]）】]))(?:\d{1,2}\s*[.)．]|[①-⑳])\s*(?=\D)/g;
  for (let line of String(text).split(/\r?\n/)) {
    line = line.replace(/^\d{4}[.년]\s*\d{1,2}[.월]\s*\d{1,2}[.일]?\s*(?:오전|오후)\s*\d{1,2}:\d{2},?\s*[^:]{1,30}?\s:\s/, '') // 카톡 내보내기 '2026. 10. 24. 오후 9:13, 이름 : '
      .replace(/^\[[^\]]{1,30}\]\s*\[(?:오전|오후)\s*\d{1,2}:\d{2}\]\s*/, '') // PC 카톡 '[이름] [오후 9:13] '
      .replace(/(\d)\uFE0F?\u20E3/gu, '$1.').replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, ' ').trim();
    if (!line || /^[-=─]{3,}|https?:\/\/|^\d{4}년 \d{1,2}월 \d{1,2}일 [월화수목금토일]요일$/.test(line)) continue; // 구분선·주소·카톡 날짜 머리줄
    let marks = [...line.matchAll(MARK)];
    const d = findDate(line, today);
    // 날짜는 첫 번호보다 앞에 있을 때만. '3. 10,000 Reasons'처럼 번호와 겹치면 번호로 본다('10/25'·'10월'은 날짜)
    if (d && (!marks.length || d.at < marks[0].index || (d.at === marks[0].index && /[\/월년-]/.test(d.text)))) { date ||= d.iso; line = line.replace(d.text, ' '); marks = [...line.matchAll(MARK)]; }
    if (marks.length) { marks.forEach((x, i) => items.push({ text: line.slice(x.index + x[0].length, marks[i + 1]?.index ?? line.length), num: true })); continue; }
    const lead = line.match(/^\d{1,2}\s+(?=[^\d\s])/); // '1 곡명 E'
    if (lead) items.push({ text: line.slice(lead[0].length), num: true });
    else if (!d) items.push({ text: line, num: false });
  }
  // 번호 없는 줄: 키가 있고 문장(요·니다·!?~)이 아니면 곡. 키가 없으면 번호 있는 곡이 하나도 없을 때만, 짧고 인사·'이름:'·머리줄 같지 않은 줄을 곡으로
  const prose = t => /[.,!?~]$|요$|니다$|[〈《]/.test(t);
  const chat = t => prose(t) || t.replace(LABEL, '').length > 40 || /[:：]|콘티|찬양\s*(?:리스트|목록|순서)|연습|공지|^[#@[]|(?:주일|예배|찬양)$/.test(t.replace(LABEL, ''));
  const hasNum = items.some(x => x.num);
  const songs = items.flatMap(({ text, num }) => {
    const found = songsIn(text, list);
    return num ? found : found[0].key && !prose(text) ? found.filter(s => s.key) : !hasNum && !chat(text) ? found : [];
  });
  return { date, songs: songs.filter(s => s.title).slice(0, 30) };
}

// 한 주일 여러 예배 콘티: 탭 순서 = 기본 예배 → 교회가 기억한 예배(settings.contiServices) → 그 날짜에 곡이 있는 다른 예배
// 숨긴 예배(remembered[id] === false)는 그 날 곡이 있어도 탭에서 뺀다(데이터는 그대로)
export const contiTabs = (doc, def, remembered = {}) => [...new Set([def, ...Object.keys(remembered || {}).filter(k => remembered[k]), ...Object.keys(doc?.services || {}).filter(k => doc.services[k] && remembered?.[k] !== false)])];
// 짧은 예배 이름: '중고등부 예배' → '중고등부', '오후·찬양예배' → '오후·찬양'
export const svcShort = name => String(name || '').replace(/\(.*\)/, '').replace(/\s예배$/, '').replace(/(찬양|수요)예배$/, '$1').trim();
// '이번 주 콘티 모두 보내기' 카톡 글: 예배마다 ■ 이름 · 곡 목록 · 보기 링크. 곡 없는 예배는 뺀다
export const bundleShare = (title, blocks) => [title, ...blocks.filter(b => b.songs.some(s => s?.title)).map(b => '■ ' + b.name + '\n' + b.songs.filter(s => s?.title).map((s, i) => (i + 1) + '. ' + s.title + (s.key ? ' (' + s.key + ')' : '')).join('\n') + (b.link ? '\n악보로 보기: ' + b.link : ''))].join('\n\n');
