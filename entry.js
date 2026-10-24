export function formatCodeInput(raw) {
  const s = String(raw ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  return s.length > 5 ? s.slice(0, 5) + '-' + s.slice(5) : s;
}
export const validCode = code => /^[A-Z0-9]{5}-[A-Z0-9]{5}$/.test(code);
export function nameKey(name) {
  return String(name ?? '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '').slice(0, 60);
}
export function recentChurches(items, church) {
  const list = Array.isArray(items) ? items : [];
  return [church, ...list].filter(x => x && validCode(x.code) && typeof x.name === 'string')
    .filter((x, i, all) => all.findIndex(y => y.code === x.code) === i).slice(0, 5);
}
export function inviteText(name, code, address) {
  const url = new URL(address); url.hash = 'c=' + code;
  return name + ' 사역 웹에 함께해요! 아래 링크를 누르면 바로 들어와요.\n' + url.href;
}
// 구글 계정에 저장된 교회 목록 {코드: {name, at}} → 최근 들어간 순 배열
export function mineList(churches) {
  return Object.entries(churches || {}).filter(([c, v]) => validCode(c) && v && typeof v.name === 'string')
    .map(([code, v]) => ({ code, name: v.name, at: v.at || '' })).sort((a, b) => b.at.localeCompare(a.at));
}
// 카톡 안 브라우저(구글이 로그인을 막음) 알아보기와, 기본 브라우저로 여는 주소
export const isKakaoInApp = ua => /KAKAOTALK/i.test(ua || '');
export const kakaoExternalUrl = url => 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
