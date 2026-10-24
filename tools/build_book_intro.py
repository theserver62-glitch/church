"""책 개관 합치기: res-src/book-intro*.json(구약·구약2·신약) → 루트 book-intro.json. 없는 파일은 건너뛴다."""
import json, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
out = {}
for name in ['book-intro.json', 'book-intro-ot2.json', 'book-intro-nt.json']:
    p = root / 'res-src' / name
    if p.exists():
        out.update(json.loads(p.read_text(encoding='utf-8')))
(root / 'book-intro.json').write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(len(out), '권')
