// 처음 온 사람 3단계 안내: ① 할 일 하나 [다 했어요] ② 이번 주 콘티 만들기 ③ 리더들에게 초대 링크 보내기
// 보기 모드(로그인 안 함)는 누를 수 없는 일 대신 ① 할 일 눌러 준비 방법 읽기 ② 이번 주 콘티 보기(본 것은 기기 저장 read·conti)
// 셋 다 했거나 [닫기]를 눌렀으면 안 보인다(show=false)
export function onboardSteps({ anyDone = false, contiSongs = 0, invited = false, closed = false, viewer = false, read = false, contiSeen = false } = {}) {
  const steps = viewer ? [['task', '맨 위 할 일을 눌러 준비 방법 읽어 보기', !!read], ['conti', '이번 주 찬양 콘티 보기', !!contiSeen], ['invite', '리더들에게 초대 링크 보내기', !!invited]]
    : [['task', '이번 주 할 일 하나 [다 했어요] 눌러 보기', !!anyDone], ['conti', '이번 주 콘티 만들기', contiSongs > 0], ['invite', '리더들에게 초대 링크 보내기', !!invited]];
  return { steps, show: !closed && steps.some(s => !s[2]) };
}
// 기기 저장(사생활 모드 등에서 막혀도 화면은 그대로)
export const onbGet = k => { try { return localStorage.getItem('church:onb:' + k) === '1'; } catch { return false; } };
export const onbSet = k => { try { localStorage.setItem('church:onb:' + k, '1'); } catch { /* 저장 못 해도 넘어간다 */ } };
