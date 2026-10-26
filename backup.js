import { addDays, nextSunday } from './calendar.js?v=202610262337';
import { DELETE } from './store.js?v=202610262337';

const record = v => v !== null && typeof v === 'object' && !Array.isArray(v);
// 깊게 합치는 저장소에 위험한 키가 들어가지 않게 중첩된 값도 검사한다.
function checkKeys(v) {
  if (!v || typeof v !== 'object') return;
  for (const [k, value] of Object.entries(v)) {
    if (['__proto__', 'constructor', 'prototype'].includes(k)) throw new Error('백업에 사용할 수 없는 항목 이름이 있어요');
    checkKeys(value);
  }
}
export function parseBackup(obj) {
  if (!record(obj)) throw new Error('백업은 JSON 객체여야 해요');
  checkKeys(obj);
  let church = {}, source;
  if (Object.hasOwn(obj, 'version')) {
    if (obj.version !== 1) throw new Error('지원하지 않는 백업 버전이에요');
    if (!record(obj.church) || !record(obj.conti)) throw new Error('교회 정보와 콘티가 있는 백업 파일을 골라 주세요');
    for (const key of ['name', 'settings', 'songbook', 'equipment']) {
      if (!Object.hasOwn(obj.church, key)) continue;
      const value = obj.church[key];
      if (key === 'name' ? typeof value !== 'string' : !record(value)) throw new Error('교회 정보 형식이 올바르지 않아요');
      church[key] = value;
    }
    for (const song of Object.values(church.songbook || {})) {
      if (!record(song) || typeof song.title !== 'string') throw new Error('곡 목록의 제목은 문자열이어야 해요');
      if (song.sheet !== undefined && (typeof song.sheet !== 'string' || !song.sheet.startsWith('https://'))) throw new Error('악보 주소는 https://로 시작해야 해요');
    }
    source = obj.conti;
  } else {
    if (!Object.keys(obj).length) throw new Error('지난 콘티가 없는 파일이에요');
    source = obj;
  }
  const conti = {};
  for (const [date, value] of Object.entries(source)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date + 'T00:00:00Z')) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) throw new Error('콘티 날짜는 올바른 YYYY-MM-DD 형식이어야 해요');
    const songs = Object.hasOwn(obj, 'version') ? (record(value) ? value.songs : undefined) : value;
    if (!Array.isArray(songs)) throw new Error('콘티의 songs는 배열이어야 해요');
    if (songs.length > 200) throw new Error('한 콘티에 곡을 200개 넘게 넣을 수 없어요');
    conti[date] = { songs: songs.map(song => {
      if (!record(song) || typeof song.title !== 'string') throw new Error('곡 제목은 문자열이어야 해요');
      for (const key of ['key', 'memo']) if (song[key] !== undefined && typeof song[key] !== 'string') throw new Error('곡의 키와 메모는 문자열이어야 해요');
      return { title: song.title, key: song.key || '', memo: song.memo || '' };
    }) };
  }
  return { church, conti };
}

// 오늘 앞뒤 52주 범위 안의 주일. 지난 콘티는 선택일보다 앞선 주일 12개.
export function backupSundays(today) {
  const dates = [], end = addDays(today, 364);
  for (let day = nextSunday(addDays(today, -364)); day <= end; day = addDays(day, 7)) dates.push(day);
  return dates;
}
export function previousSundays(date) {
  const first = addDays(nextSunday(date), -7);
  return Array.from({ length: 12 }, (_, i) => addDays(first, -7 * i));
}

// ---------- 매일 스냅샷 · 되돌리기 · 변경 기록 ----------
// 관리자 목록·권한 요청은 스냅샷에 담지도, 되돌리지도 않는다(되돌리기로 권한이 바뀌면 안 되니까)
const SNAP_SKIP = ['admins', 'adminRequests', 'members', 'joinRequests'];
export const churchPart = doc => Object.fromEntries(Object.entries(doc || {}).filter(([k]) => !SNAP_SKIP.includes(k)));
export const contiPart = doc => Object.fromEntries(['songs', 'services'].filter(k => doc?.[k] !== undefined).map(k => [k, doc[k]]));
const bytes = v => new TextEncoder().encode(JSON.stringify(v)).length;
// 스냅샷 내용: 교회 문서(관리자 표만 빼고 그대로 — 규칙이 지금 문서와 같은지 확인한다) + 오늘에서 가까운 주부터 콘티.
// 문서 한도 1MB를 넘지 않게 max 바이트(JSON 기준, 여유 둠)까지만 담고 먼 주부터 뺀다. 교회 문서만으로 넘으면 null(그날은 건너뜀).
export function snapshotOf(church, weeks, today, max = 900000) {
  if (!record(church)) return null;
  const c = churchPart(church), t = Date.parse(today), conti = {};
  let size = bytes(c) + 300;
  if (size > max) return null;
  const near = weeks.filter(([, d]) => record(d) && (Array.isArray(d.songs) || record(d.services))).sort(([a], [b]) => Math.abs(Date.parse(a) - t) - Math.abs(Date.parse(b) - t));
  for (const [day, d] of near) {
    const w = contiPart(d);
    size += bytes(w) + 20;
    if (size > max) break;
    conti[day] = w;
  }
  return { church: c, conti };
}
// 스냅샷 콘티 중 되돌릴 수 있는 것만(날짜 이름·songs 배열). 로그인한 누구나 스냅샷을 만들 수 있어서 내용을 한 번 더 거른다
export const snapWeeks = snap => Object.entries(snap?.conti || {}).filter(([d, w]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && record(w) && (w.songs === undefined || Array.isArray(w.songs)));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// 지금(cur)을 목표(target)와 똑같이 만드는 합치기 쓰기: 목표에 없는 칸은 DELETE, 같은 칸은 빼고 바뀐 칸만 넣는다.
// 빈 맵 {}을 합치기로 보내면 Firestore가 그 칸을 통째로 비우므로, 바뀐 게 없는 하위 맵은 아예 넣지 않는다.
export function replacePatch(cur, target) {
  const out = {};
  for (const k of Object.keys(cur || {})) if (!Object.hasOwn(target, k)) out[k] = DELETE;
  for (const [k, v] of Object.entries(target)) {
    if (record(v) && record(cur?.[k])) { const p = replacePatch(cur[k], v); if (Object.keys(p).length) out[k] = p; }
    else if (!same(v, cur?.[k])) out[k] = v;
  }
  return out;
}
const count = o => Object.values(o || {}).filter(Boolean).length;
// 되돌리기 미리보기 한 줄
export const snapSummary = snap => ['콘티 ' + count(snap?.conti) + '주', '장비 ' + count(snap?.church?.equipment) + '종', '우리 교회 곡 ' + count(snap?.church?.songbook) + '곡', '행사 ' + count(snap?.church?.customEvents) + '개', '체크한 일 ' + count(snap?.church?.done) + '개'].join(' · ');
export const KEY_LABEL = { name: '교회 이름', createdAt: '만든 날', settings: '설정', songbook: '곡 목록', equipment: '장비', customEvents: '행사', done: '할 일 체크', skipped: '할 일 건너뛰기', favorites: '즐겨찾기', retreatForms: '수련회 서류', records: '절기 기록', worshipOrders: '예배 순서', sheets: '악보 사진', admins: '관리자', adminRequests: '관리자 요청' };
const SETTING_LABEL = { dates: '일정 날짜 변경', enabled: '절기·행사 켜고 끄기', depts: '부서·규모', deptSize: '부서·규모', churchSize: '부서·규모', taskDue: '할 일 기한', creeds: '신앙고백 문안' };
// 변경 기록 한 줄(최상위 칸 기준). 교회 문서와 콘티만 남기고, 그 밖(악보 그림·큐티 묵상)은 ''
export function changeLabel(path, patch) {
  const p = path.split('/');
  if (p.length === 4 && p[2] === 'conti') return '콘티 ' + Number(p[3].slice(5, 7)) + '/' + Number(p[3].slice(8, 10)) + ' 고침';
  if (p.length !== 2 || p[0] !== 'churches' || !record(patch)) return '';
  const parts = Object.entries(patch).flatMap(([k, v]) => !record(v) ? [KEY_LABEL[k] || k]
    : k === 'settings' ? Object.keys(v).map(s => SETTING_LABEL[s] || '설정')
    : k === 'equipment' ? Object.values(v).map(e => ('장비 ' + (e?.name || '')).trim())
    : k === 'customEvents' ? Object.values(v).map(e => !e ? '행사 삭제' : e.name ? '행사 ' + e.name : e.date ? '일정 날짜 변경' : '행사')
    : [KEY_LABEL[k] || k]);
  return [...new Set(parts)].join(', ').slice(0, 80);
}
