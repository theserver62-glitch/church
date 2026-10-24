// 책 개관(book-intro.json)과 심화 해석 글 다루기 — 화면 없이 순수 함수만
// 개관 접기의 칸 순서: 배경 시대 · 흐름 · 저자와 연대 · 주요 논쟁점 · 해석사의 흐름 · 설교·공과 준비 때 유의점
export const INTRO_FIELDS = [['period', '배경 시대'], ['summary', '흐름'], ['authorship', '저자와 연대'], ['debates', '주요 논쟁점'], ['history', '해석사의 흐름'], ['reading', '설교·공과 준비 때 유의점']];
export const introSections = entry => entry ? INTRO_FIELDS.map(([k, label]) => [label, entry[k]]).filter(([, v]) => Array.isArray(v) ? v.length : typeof v === 'string' && v.trim()) : [];
// 참고 출처는 도메인만(겹치면 한 번)
export const sourceDomains = list => [...new Set((Array.isArray(list) ? list : []).map(u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }).filter(Boolean))];
// 심화 해석 글: "[배경과 해석] …"이면 머리표 '배경과 해석', 아니면 매튜 헨리 해설. 끝의 "[출처: …]"는 따로
export function deepParts(text = '') {
  let body = String(text).trim(), label = '심화 · 매튜 헨리 주석', kind = 'mh', source = '';
  if (body.startsWith('[배경과 해석]')) { label = '배경과 해석'; kind = 'bg'; body = body.slice('[배경과 해석]'.length).trim(); }
  const m = body.match(/\s*\[출처:\s*([^\]]*)\]\s*$/);
  if (m) { source = m[1].trim(); body = body.slice(0, m.index).trim(); }
  return { label, kind, body, source };
}
