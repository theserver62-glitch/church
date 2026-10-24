export const equipment = {
  "마이크": [
    "유선 마이크",
    "무선 마이크",
    "마이크 스탠드",
    "마이크 홀더",
    "팝 필터"
  ],
  "케이블(XLR 등)": [
    "XLR 케이블",
    "TRS 케이블",
    "HDMI 케이블",
    "케이블 타이",
    "케이블 테스터기"
  ],
  "악기(기타·건반·드럼 등)": [
    "통기타",
    "일렉기타",
    "전자 피아노",
    "드럼 세트",
    "카혼",
    "기타 튜너",
    "악기 케이블"
  ],
  "스피커·모니터": [
    "메인 스피커",
    "모니터 스피커",
    "스피커 스탠드",
    "DI 박스"
  ],
  "앰프": [
    "파워 앰프",
    "기타 앰프",
    "건반 앰프"
  ],
  "믹서": [
    "아날로그 믹서",
    "디지털 믹서",
    "믹서 커버",
    "페이더 클리너"
  ],
  "컴퓨터·영상(프로젝터·노트북 등)": [
    "프로젝터",
    "노트북",
    "HDMI 분배기",
    "프레젠터(리모컨)",
    "웹캠"
  ],
  "소모품(건전지 등)": [
    "9V 건전지",
    "AA 건전지",
    "AAA 건전지",
    "가퍼 테이프",
    "전원 멀티탭",
    "클리닝 티슈"
  ]
};

// 분류와 품목명으로 고정 ID를 만든다. Firestore 필드 경로 문자는 인코딩한다.
export const equipmentId=(cat,name)=>'eq_'+[cat,name].map(part=>Array.from(part,c=>c.codePointAt(0).toString(16)).join('_')).join('__');
export function equipmentRows(saved={}) {
 const rows=Object.entries(saved).filter(([,v])=>v).map(([id,v])=>[id,{qty:0,state:'없음',memo:'',...v}]),used=new Set(),out=[];
 // 순서는 기본 목록 순서로 고정(수량을 바꿔 저장돼도 줄이 움직이지 않게). 직접 넣은 품목은 그 뒤에 이름순
 for(const [cat,names] of Object.entries(equipment))for(const name of names){const hit=rows.filter(([,v])=>v.cat===cat&&v.name===name);hit.forEach(r=>used.add(r));out.push(...(hit.length?hit:[[equipmentId(cat,name),{cat,name,qty:0,state:'없음',memo:''}]]));}
 return [...out,...rows.filter(r=>!used.has(r)).sort((x,y)=>String(x[1].name||'').localeCompare(String(y[1].name||''),'ko'))];
}

// ---------- 구매 도움(equip-products.json: {cat, name, why, price, url, partner}) ----------
// 장비 분류 이름 → 추천 상품 분류
const PRODUCT_CAT = { '케이블(XLR 등)': '케이블', '악기(기타·건반·드럼 등)': '악기 소모품', '컴퓨터·영상(프로젝터·노트북 등)': '컴퓨터·영상', '소모품(건전지 등)': '소모품' };
export const productCat = cat => PRODUCT_CAT[cat] || cat;
export const productsFor = (cat, list = []) => list.filter(p => p?.cat === productCat(cat) && /^https:\/\//.test(p.url || ''));
// 쿠팡 링크: 파트너스 링크가 있으면 그것, 없으면 상품 주소
export const productLink = p => (typeof p.partner === 'string' && p.partner.startsWith('https://') ? p.partner : p.url);
export const compareLink = name => 'https://search.shopping.naver.com/search/all?query=' + encodeURIComponent(name);
export const buyNotice = list => list.some(p => typeof p.partner === 'string' && p.partner.startsWith('https://'))
  ? '가격은 바뀔 수 있어요. 쿠팡 링크는 쿠팡 파트너스 활동의 일환으로 수수료를 받을 수 있어요.'
  : '가격은 바뀔 수 있어요. 최저가는 가격 비교에서 확인하세요.';
