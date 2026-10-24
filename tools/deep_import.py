# 퍼플렉시티 답(페이지 글 그대로)을 deep-src/<책>.json {ref: 심화 해석}에 합친다.
# 실행: python tools/deep_import.py <책이름> <답 텍스트 파일>   예: python tools/deep_import.py 마가복음 res-src/deep-raw/마가복음-1.txt
import json, re, sys
from pathlib import Path
book, src = sys.argv[1], Path(sys.argv[2])
refs = set(Path(f'res-src/deep-units/{book}.txt').read_text(encoding='utf-8').split('\n')) | set(json.loads(Path(f'qt-src/{book}.json').read_text(encoding='utf-8')) and [u['ref'] for u in json.loads(Path(f'qt-src/{book}.json').read_text(encoding='utf-8'))['units']])
text = src.read_text(encoding='utf-8')
out_f = Path(f'deep-src/{book}.json')
out = json.loads(out_f.read_text(encoding='utf-8')) if out_f.exists() else {}
# 표 한 줄: "<ref> <해석...> <http 출처>" — ref로 시작하는 위치마다 자른다
pat = re.compile(r'(?m)^(' + '|'.join(re.escape(r) for r in sorted(refs, key=len, reverse=True)) + r')\s+')
ms = list(pat.finditer(text)); n = 0
for i, m in enumerate(ms):
    body = text[m.end(): ms[i + 1].start() if i + 1 < len(ms) else len(text)]
    body = re.split(r'\n(?:출처|후속 질문|\d+개 출처)', body)[0]
    body = re.sub(r'https?://\S+', '', body); body = re.sub(r'\n(biblehub|ccel|[a-z.]+)\s*(\+\d+)?\s*(?=\n|$)', '\n', body)
    body = ' '.join(body.split()).strip()
    if len(body) > 60 and m.group(1) not in out:
        out[m.group(1)] = body; n += 1
out_f.write_text(json.dumps(out, ensure_ascii=False, indent=0), encoding='utf-8')
print(book, '추가', n, '총', len(out))
