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
  const url = new URL(address); url.hash = ''; // 링크에 코드를 넣지 않는다: 링크만 퍼져서는 못 들어오게
  return name + ' 사역 웹에 함께해요!\n1) 아래 주소를 열고 [교회 선택하기]를 눌러 주세요.\n2) 교회 코드 ' + code + ' 를 넣어 주세요.\n' + url.href;
}
// 구글 계정에 저장된 교회 목록 {코드: {name, at}} → 최근 들어간 순 배열
export function mineList(churches) {
  return Object.entries(churches || {}).filter(([c, v]) => validCode(c) && v && typeof v.name === 'string')
    .map(([code, v]) => ({ code, name: v.name, at: v.at || '' })).sort((a, b) => b.at.localeCompare(a.at));
}
// 카톡 안 브라우저(구글이 로그인을 막음) 알아보기와, 기본 브라우저로 여는 주소
export const isKakaoInApp = ua => /KAKAOTALK/i.test(ua || '');
export const kakaoExternalUrl = url => 'kakaotalk://web/openExternal?url=' + encodeURIComponent(url);
// 앱 안 브라우저(카톡·네이버·인스타·페이스북·라인·Claude 등 웹뷰)는 구글이 로그인을 막는다
export const isInAppBrowser = ua => /KAKAOTALK|NAVER|Instagram|FBAN|FBAV|Line\/|; wv\)|Claude/i.test(ua || '')
  || (/iPhone|iPad/.test(ua || '') && !/Safari\//.test(ua || ''));
const LOGIN_ERRORS = {
  'auth/unauthorized-domain': '이 주소에서는 로그인이 허용되지 않았어요.',
  'auth/popup-blocked': '팝업이 막혔어요. 브라우저 설정에서 팝업을 허용해 주세요.',
  'auth/network-request-failed': '인터넷 연결이 불안정해요. 다시 시도해 주세요.',
  'auth/web-storage-unsupported': '이 브라우저는 로그인 정보를 저장할 수 없어요. 사파리나 크롬으로 열어 주세요.',
  'auth/operation-not-allowed': '구글 로그인이 아직 켜지지 않았어요.',
};
export const loginErrorText = code => (LOGIN_ERRORS[code] || '구글 로그인을 하지 못했어요. 다시 시도해 주세요.') + (code ? ` (${code})` : '');

// 이전 단일 부서 설정도 읽으며 호출자가 원본 배열을 바꾸지 않게 복사한다.
export function deptsOf(settings) {
  const values = Array.isArray(settings?.depts) ? settings.depts : [settings?.dept];
  return [...new Set(values.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()))];
}
export function toggleDept(settings, dept) {
  const selected = deptsOf(settings);
  return selected.includes(dept) ? (selected.length > 1 ? selected.filter(v => v !== dept) : selected) : [...selected, dept];
}

// 고른 부서만 반환하며, 이전 규모는 부서 규모로 읽는다. 원본은 바꾸지 않는다.
export function sizeOf(settings) {
  const legacy = {s:'b',m:'c',l:'d'}[settings?.size] || 'b';
  return Object.fromEntries(deptsOf(settings).map(dept => {
    const value = settings?.deptSize?.[dept];
    return [dept, ['a','b','c','d'].includes(value) ? value : legacy];
  }));
}
export function sizeTips(settings) {
  return Object.entries(sizeOf(settings)).map(([dept, size]) => dept + ' · ' + (
    size === 'd' ? '대형 시설 · D-12주 장소 예약 · 교사 1:7~8' :
    size === 'c' ? '수련원 · 교사 1:5~6' : '교회 안/1박 2일 위주 · 교사 1:3~4'));
}
// 앱 안 화면에서 크롬·사파리로 바로 여는 주소. 아이폰: 크롬은 googlechromes://, 사파리는 x-safari-https:// / 안드로이드: 크롬 intent
export function chromeUrl(url, ua) {
  const u = new URL(url);
  if (/Android/i.test(ua || '')) return `intent://${u.host}${u.pathname}${u.search}${u.hash}#Intent;scheme=https;package=com.android.chrome;end`;
  return 'googlechromes://' + u.host + u.pathname + u.search + u.hash;
}
export const safariUrl = url => 'x-safari-' + url;
