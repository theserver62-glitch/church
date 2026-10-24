// 절기 = 프로젝트: 할 일의 '몇 주 전' 숫자 하나로 구간 6개에 나누고, 홈 '지금 할 일'(밀린 일 + 앞으로 14일)을 뽑는다.
import { addDays } from './calendar.js?v=202610250051';
import { occurrences, tasksAround } from './custom-events.js?v=202610250051';

export const PHASES = ['계획', '준비', '알리기·연습', '최종 점검', '당일', '정리·기록'];
// 4주 이상 계획 · 3 준비 · 2 알리기·연습 · 1 최종 점검 · 0 당일 · 음수 정리·기록
export const phaseOf = weeks => weeks >= 4 ? 0 : weeks >= 3 ? 1 : weeks >= 2 ? 2 : weeks >= 1 ? 3 : weeks >= 0 ? 4 : 5;
// 구간이 끝나는 날(= 그 구간 할 일의 기한): D-28, D-21, D-14, D-7, D, D+7
export const phaseEnds = date => [-28, -21, -14, -7, 0, 7].map(n => addDays(date, n));
// 오늘이 들어 있는 구간(0~5). 정리·기록까지 끝났으면 6
export const currentPhase = (date, today) => { const i = phaseEnds(date).findIndex(end => today <= end); return i < 0 ? 6 : i; };
export const evKey = ev => ev.id + '_' + ev.date;
export const ofEvent = (tasks, ev) => tasks.filter(t => t.key.startsWith(evKey(ev) + '_'));

// 정리·기록 할 일이 없는 절기에 붙이는 할 일(D+7). key 끝이 _wrap이라 events.js 순번 key와 겹치지 않는다
export const WRAP_TEXT = '잘된 점·아쉬운 점·내년엔 3줄 정리';
// tasksAround + 자동 정리 할 일. 할 일이 0개인 절기는 프로젝트가 아니라서(달력에만) 붙이지 않는다
export function seasonTasks(today, settings = {}) {
  const y = +today.slice(0, 4);
  const wraps = occurrences([y - 1, y, y + 1], settings).filter(ev => ev.tasks.length && !ev.tasks.some(t => Number(t[0]) < 0)).map(ev => {
    const key = evKey(ev) + '_wrap';
    return { key, event: ev.name, eventDate: ev.date, due: settings.taskDue?.[key] || addDays(ev.date, 7), weeks: -1, text: WRAP_TEXT, who: '리더 모임', doc: '', auto: true };
  });
  return [...tasksAround(today, settings), ...wraps].map(t => ({ ...t, phase: phaseOf(Number(t.weeks) || 0) })).sort((a, b) => a.due.localeCompare(b.due));
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
