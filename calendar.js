// 예장 통합 교회력 날짜 계산과 "이번 주 할 일" 뽑기. 날짜는 모두 'YYYY-MM-DD' 문자열.
// 시간대 문제를 피하려고 내부 계산은 UTC 자정 Date로만 한다.
import { EVENTS } from './events.js?v=202610242212';

const D = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const add = (dt, n) => new Date(dt.getTime() + n * 864e5);
export const iso = dt => dt.toISOString().slice(0, 10);
export const parse = s => D(+s.slice(0, 4), +s.slice(5, 7), +s.slice(8, 10));
export const addDays = (s, n) => iso(add(parse(s), n));
export const todayIso = () => { const t = new Date(); return iso(D(t.getFullYear(), t.getMonth() + 1, t.getDate())); };

// 부활절(그레고리력, Meeus/Jones/Butcher)
export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return D(y, month, day);
}
const sundayOnOrAfter = dt => add(dt, (7 - dt.getUTCDay()) % 7);
export const nthSunday = (y, m, n) => add(sundayOnOrAfter(D(y, m, 1)), 7 * (n - 1));
export const adventSunday = y => add(D(y, 12, 25), -(D(y, 12, 25).getUTCDay() || 7) - 21);

// 해마다 바뀌는 기준일. events.js의 date 이름과 맞춘다.
export function dateOf(rule, y) {
  const E = easter(y);
  const r = {
    epiphany: D(y, 1, 6),
    ashWednesday: add(E, -46),
    palmSunday: add(E, -7),
    easter: E,
    pentecost: add(E, 49),
    summerThanksgiving: nthSunday(y, 7, 1),
    creation: nthSunday(y, 9, 1),
    thanksgiving: nthSunday(y, 11, 3),
    kingSunday: add(adventSunday(y), -7),
    advent: adventSunday(y),
    christmas: D(y, 12, 25),
    yearEnd: D(y, 12, 31),
    // 수련회 기본값(교회가 날짜를 넣기 전 임시): 7월 넷째 주일 다음 금요일
    retreat: add(nthSunday(y, 7, 4), 5),
  }[rule];
  if (!r) throw new Error('모르는 날짜 규칙: ' + rule);
  return iso(r);
}

const isOn = (ev, settings) => settings.enabled?.[ev.id] ?? ev.on;

// 교회가 그 해 날짜를 직접 정했으면(settings.dates.retreat = '2027-07-29' 등) 그 날짜
const dateFor = (ev, y, settings) => settings.dates?.[ev.id]?.startsWith(y + '-') ? settings.dates[ev.id] : dateOf(ev.date, y);

// 그 해들의 절기·행사(켜진 것만)
export function occurrences(years, settings = {}) {
  return years.flatMap(y => EVENTS.filter(ev => isOn(ev, settings)).map(ev => ({ ...ev, date: dateFor(ev, y, settings) })))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 할 일 하나하나. key는 완료 체크를 저장하는 이름이라 바꾸면 안 된다.
export function tasksAround(today, settings = {}) {
  const y = +today.slice(0, 4);
  return occurrences([y - 1, y, y + 1], settings).flatMap(ev => ev.tasks.map(([weeks, text, who, doc], i) => ({
    key: `${ev.id}_${ev.date}_${i}`, event: ev.name, eventDate: ev.date, due: settings.taskDue?.[ev.id+'_'+ev.date+'_'+i] || addDays(ev.date, -7 * weeks), weeks, text, who: who || '', doc: doc || '',
  }))).sort((a, b) => a.due.localeCompare(b.due));
}

// 이번 주(월~주일)에 마감인 일, 지난 4주 안에 못 한 일, 앞으로 8주 안의 절기
export function thisWeek(today, settings = {}, done = {}) {
  const mon = addDays(today, -((parse(today).getUTCDay() + 6) % 7)), sun = addDays(mon, 6);
  const all = tasksAround(today, settings);
  return {
    mon, sun,
    week: all.filter(t => t.due >= today && t.due <= sun),
    overdue: all.filter(t => t.due < today && t.due >= addDays(mon, -28) && !done[t.key]),
    upcoming: occurrences([+today.slice(0, 4), +today.slice(0, 4) + 1], settings).filter(e => e.date >= today && e.date <= addDays(today, 56)),
  };
}

// 다음 주일(오늘이 주일이면 오늘) — 콘티 기본 날짜
export const nextSunday = today => iso(sundayOnOrAfter(parse(today)));

// month는 1~12. 연말 마감인 다음 해 준비 일정도 포함한다.
export function monthItems(year, month, settings = {}) {
  const prefix = year + '-' + String(month).padStart(2, '0');
  return [
    ...tasksAround(prefix + '-01', settings).filter(t => t.due.startsWith(prefix)).map(t => ({ type: 'task', date: t.due, task: t })),
    ...occurrences([year], settings).filter(e => e.date.startsWith(prefix)).map(e => ({ type: 'event', date: e.date, event: e })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

export function qtIndex(date, length) {
  if (!Number.isInteger(length) || length <= 0) return -1;
  const days = Math.round((parse(date) - parse('2026-10-25')) / 864e5);
  return ((days % length) + length) % length;
}
