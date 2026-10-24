// 교회 곡 목록. 교회 문서의 songbook: { "제목 (키)": {title, key, note, theme, mood, sheet} }.
// note는 '시와찬미 47'·'악보 있음' 같은 메모, theme은 시와찬미 6주제, mood는 신나게/보통/잔잔하게(AI 추정).
export const label = s => (s.key ? `${s.title} (${s.key})` : s.title);

// "제목,키,메모,주제,분위기,악보 주소" CSV(뒤 칸은 없어도 됨)를 곡 목록으로. 첫 줄이 머리글(제목)이면 건너뛴다. 따옴표 안의 쉼표도 처리한다.
export function parseCsv(text) {
  const book = {};
  for (const line of text.replace(/^﻿/, '').split(/\r?\n/)) {
    const cells = [...line.matchAll(/("([^"]*(?:""[^"]*)*)"|[^,]*)(,|$)/g)].map(m => (m[2] ?? m[1]).replace(/""/g, '"').trim());
    const [title, key = '', note = '', theme = '', mood = '', sheet = ''] = cells;
    if (!title || title === '제목') continue;
    const s = { title: title.slice(0, 100), key: key.slice(0, 10), ...(note && { note: note.slice(0, 60) }),
      ...(theme && { theme: theme.slice(0, 20) }), ...(mood && { mood: mood.slice(0, 10) }), ...(sheet.startsWith('https://') && { sheet }) };
    book[label(s)] = s;
  }
  return book;
}

// 보기별로 묶기. by: 'key' | 'mood' | 'theme'. [[묶음 이름, [곡...]], ...] 정해진 순서로.
const ORDER = {
  key: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'Ab', 'Bb', 'Eb', '단조'],
  mood: ['신나게', '보통', '잔잔하게'],
  theme: ['경배와 찬양', '은혜와 사랑', '회개와 고백', '기도와 간구', '축복과 교제', '선교와 승리'],
};
export function groupSongs(book, by) {
  const g = {};
  for (const s of Object.values(book)) (g[(by === 'key' && /m$/.test(s.key || '') ? '단조' : s[by]) || '기타'] ||= []).push(s);
  const rank = k => (ORDER[by].indexOf(k) + 1 || 99);
  return Object.entries(g).sort(([a], [b]) => rank(a) - rank(b) || a.localeCompare(b))
    .map(([k, list]) => [k, list.sort((a, b) => a.title.localeCompare(b.title))]);
}
