// 자료실 '링크' 탭: links.json {dept:'유치·아동'|'중고등'|'청년'|'공통', kind, name, url, desc, free}
const LINK_DEPT = { 유치부: '유치·아동', 아동부: '유치·아동', 중등부: '중고등', 고등부: '중고등', 청년부: '청년' };
// 부서에 맞는 링크(mine)와 늘 아래에 붙는 공통(common). 전체는 공통 밖 모두. 주소는 https만
export function linksFor(list, dept) {
  const ok = (Array.isArray(list) ? list : []).filter(x => typeof x?.url === 'string' && x.url.startsWith('https://') && x.name);
  const common = ok.filter(x => x.dept === '공통');
  const mine = dept === '전체' ? ok.filter(x => x.dept !== '공통') : ok.filter(x => x.dept === LINK_DEPT[dept]);
  return { mine, common };
}
// 종류(kind)별 묶음, 처음 나온 순서대로
export const byKind = list => list.reduce((g, x) => { const k = x.kind || '기타'; (g.find(e => e[0] === k) || g[g.push([k, []]) - 1])[1].push(x); return g; }, []);
