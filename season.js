// 절기 = 프로젝트: 할 일의 '몇 주 전' 숫자 하나로 구간 6개에 나누고, 홈 '지금 할 일'(밀린 일 + 앞으로 14일)을 뽑는다.
import { addDays } from './calendar.js?v=202610250147';
import { occurrences, tasksAround } from './custom-events.js?v=202610250147';
import { sizeOf } from './entry.js?v=202610250147';

export const PHASES = ['계획', '준비', '알리기·연습', '최종 점검', '당일', '정리·기록'];
// 4주 이상 계획 · 3 준비 · 2 알리기·연습 · 1 최종 점검 · 0 당일 · 음수 정리·기록
export const phaseOf = weeks => weeks >= 4 ? 0 : weeks >= 3 ? 1 : weeks >= 2 ? 2 : weeks >= 1 ? 3 : weeks >= 0 ? 4 : 5;
// 구간이 끝나는 날(= 그 구간 할 일의 기한): D-28, D-21, D-14, D-7, D, D+7
export const phaseEnds = date => [-28, -21, -14, -7, 0, 7].map(n => addDays(date, n));
// 오늘이 들어 있는 구간(0~5). 정리·기록까지 끝났으면 6
export const currentPhase = (date, today) => { const i = phaseEnds(date).findIndex(end => today <= end); return i < 0 ? 6 : i; };
export const evKey = ev => ev.id + '_' + ev.date;
export const ofEvent = (tasks, ev) => tasks.filter(t => t.key.startsWith(evKey(ev) + '_'));

// 모든 절기·행사 프로젝트에 붙는 자동 할 일 2개: 계획서 작성·보고(_plan) / 결과 보고(3줄 정리, 예전 key _wrap 그대로).
// key 끝이 _plan·_wrap이라 events.js 순번 key와 겹치지 않는다. 연간 사역계획서(annual_날짜_plan)는 해마다 하나
export const WRAP_TEXT = '잘된 점·아쉬운 점·내년엔 3줄 정리'; // 예전 이름(지난 기록·안내 호환)
export const planText = name => name + ' 계획서 작성·보고';
export const reportText = name => name + ' 결과 보고(3줄 정리)';
export const ANNUAL_TEXT = '내년 연간 사역계획서 작성·보고';
// 계획서 서류(docs.js 번호): 절기·템플릿 id → 번호. 수련회는 교회 규모(소 15 · 중 34 · 대 35), 맞는 게 없으면 41(절기 행사 계획서)
export const PLAN_DOC = { christmas: '20', easter: '21', bazaar: '10', outreach: '24', youth_mt: '08', trip_domestic: '12', trip_overseas: '11' };
export const REPORT_DOC = '26', ANNUAL_DOC = '03';
const RETREATS = ['retreat', 'winter_retreat'];
const tplOf = (ev, settings) => (ev.custom ? settings.customEvents?.[ev.id]?.tpl : ev.id) || '';
const retreatDoc = settings => { const size = Object.values(sizeOf(settings))[0] || 'b'; return size === 'd' ? '35' : size === 'c' ? '34' : '15'; };
export const planDoc = (ev, settings = {}) => { const tpl = tplOf(ev, settings); return RETREATS.includes(tpl) ? retreatDoc(settings) : PLAN_DOC[tpl] || '41'; };
// 생략 불가: 여름·겨울수련회(템플릿 id), 연간 사역계획서
export const reportLocked = (ev, settings = {}) => RETREATS.includes(tplOf(ev, settings));
// 12월 첫 주일
const firstDecSunday = y => { const d = new Date(Date.UTC(y, 11, 1)); d.setUTCDate(1 + (7 - d.getUTCDay()) % 7); return d.toISOString().slice(0, 10); };
// tasksAround + 자동 할 일. 할 일이 0개인 절기는 프로젝트가 아니라서(달력에만) 붙이지 않는다
export function seasonTasks(today, settings = {}) {
  const y = +today.slice(0, 4), skip = settings.skipReport || {};
  const auto = occurrences([y - 1, y, y + 1], settings).filter(ev => ev.tasks.length && (reportLocked(ev, settings) || !skip[ev.id])).flatMap(ev => {
    const plan = evKey(ev) + '_plan', wrap = evKey(ev) + '_wrap';
    // 계획서 기한: 첫 기본 할 일보다 1주 앞, 늦어도 D-4주
    const maxW = Math.max(0, ...ev.tasks.map(t => Number(t[0]) || 0)), due = [addDays(ev.date, -7 * maxW - 7), addDays(ev.date, -28)].sort()[0];
    const planDue = settings.taskDue?.[plan] || due;
    return [
      { key: plan, event: ev.name, eventDate: ev.date, due: planDue, weeks: Math.max(4, Math.round((Date.parse(ev.date) - Date.parse(planDue)) / 6048e5)), text: planText(ev.name), who: '부장·교사', doc: planDoc(ev, settings), auto: true, guide: 'PLAN' },
      // 결과 보고서(26)를 이미 쓰는 할 일이 있으면(여름수련회 정산 보고) 겹치지 않게 빼기
      !ev.tasks.some(t => String(t[3] || '') === REPORT_DOC) && { key: wrap, event: ev.name, eventDate: ev.date, due: settings.taskDue?.[wrap] || addDays(ev.date, 7), weeks: -1, text: reportText(ev.name), who: '리더 모임', doc: REPORT_DOC, auto: true, guide: 'REPORT' },
    ].filter(Boolean);
  });
  const annual = [y - 1, y, y + 1].map(yy => { const date = firstDecSunday(yy), key = 'annual_' + date + '_plan';
    return { key, event: (yy + 1) + '년 연간 사역계획', eventDate: date, due: settings.taskDue?.[key] || addDays(date, -7), weeks: 1, text: ANNUAL_TEXT, who: '부장·교사', doc: ANNUAL_DOC, auto: true, guide: 'ANNUAL' }; });
  return [...tasksAround(today, settings), ...auto, ...annual].map(t => ({ ...t, phase: phaseOf(Number(t.weeks) || 0) })).sort((a, b) => a.due.localeCompare(b.due));
}

// 홈 '지금 할 일': 안 챙긴 일 중 기한이 지난 일(그 절기가 아직 안 끝난 것만) + 앞으로 14일. 7일 안은 위(now), 8~14일은 접는 묶음(later)
export function nowTasks(tasks, today, handled = {}) {
  const open = tasks.filter(t => !handled[t.key] && t.due <= addDays(today, 14) && addDays(t.eventDate, 7) >= today);
  return { now: open.filter(t => t.due <= addDays(today, 7)), later: open.filter(t => t.due > addDays(today, 7)), overdue: open.filter(t => t.due < today).length };
}

// 프로젝트 한 줄 요약: 지금 구간, 구간별 할 일, 밀린 일, 시작 여부(첫 할 일 기한이 왔는지)
export function projectState(ev, tasks, today, handled = {}) {
  const mine = ofEvent(tasks, ev), phase = currentPhase(ev.date, today), first = mine[0]?.due || ev.date;
  return {
    mine, phase, first, started: today >= first, ended: phase === 6,
    byPhase: PHASES.map((_, i) => mine.filter(t => t.phase === i)),
    overdue: mine.filter(t => t.phase < phase && !handled[t.key]),
    doneCount: mine.filter(t => handled[t.key]).length,
  };
}

// 준비 안내(task-guides.json): 할 일 원문으로 찾는다. 없으면 undefined(화면은 원문·담당·서류만)
export const guideMap = list => new Map((Array.isArray(list) ? list : []).filter(g => g && typeof g.task === 'string').map(g => [g.task, g]));
// 할 일 하나의 안내: 자동 할 일(PLAN·REPORT·ANNUAL)은 그 키로 찾고 '{절기명}'을 실제 이름으로. 없으면 undefined
const fillName = (v, name) => typeof v === 'string' ? v.split('{절기명}').join(name) : Array.isArray(v) ? v.map(x => fillName(x, name)) : v;
export const guideFor = (map, t) => { const g = map?.get?.(t.guide || t.text); return g && t.guide ? Object.fromEntries(Object.entries(g).map(([k, v]) => [k, fillName(v, t.event)])) : g; };
