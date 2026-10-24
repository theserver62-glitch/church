import { addDays, nextSunday } from './calendar.js?v=202610242003';

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
