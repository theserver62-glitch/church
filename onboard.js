// 처음 온 사람 3단계 안내: ① 할 일 하나 [다 했어요] ② 이번 주 콘티 만들기 ③ 리더들에게 초대 링크 보내기
// 셋 다 했거나 [닫기]를 눌렀으면 안 보인다(show=false)
export function onboardSteps({ anyDone = false, contiSongs = 0, invited = false, closed = false } = {}) {
  const steps = [['task', '이번 주 할 일 하나 [다 했어요] 눌러 보기', !!anyDone], ['conti', '이번 주 콘티 만들기', contiSongs > 0], ['invite', '리더들에게 초대 링크 보내기', !!invited]];
  return { steps, show: !closed && steps.some(s => !s[2]) };
}
// 기기 저장(사생활 모드 등에서 막혀도 화면은 그대로)
export const onbGet = k => { try { return localStorage.getItem('church:onb:' + k) === '1'; } catch { return false; } };
export const onbSet = k => { try { localStorage.setItem('church:onb:' + k, '1'); } catch { /* 저장 못 해도 넘어간다 */ } };
