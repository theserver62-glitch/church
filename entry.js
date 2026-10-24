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
