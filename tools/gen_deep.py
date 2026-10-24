# 큐티 단락마다 '심화' 해설: 매튜 헨리 주석 요약판(1706, 저작권 만료·CC0 판 mh-src/)의 해당 절 원문을
# 무료 AI가 한국어로 풀어 deep-src/<책>.json {ref: 글} 에 쌓는다. qt-src와 따로 둬서 큐티 생성과 부딪히지 않는다.
# 실행: python tools/gen_deep.py   (끊겨도 다시 돌리면 이어서 함)
import json, re, sys, time
from pathlib import Path
sys.path.insert(0, r'C:\Users\these\juyeol_chango\pipeline')
from run import ask_model, load_env
load_env()
MODELS = ('ddgw/gpt-5.4-mini', 'cfp/openai/gpt-oss-120b', 'auto/best-free', 'auto/chat')
SLUGS = ('genesis exodus leviticus numbers deuteronomy joshua judges ruth 1-samuel 2-samuel 1-kings 2-kings 1-chronicles 2-chronicles '
         'ezra nehemiah esther job psalms proverbs ecclesiastes song-of-solomon isaiah jeremiah lamentations ezekiel daniel hosea joel amos '
         'obadiah jonah micah nahum habakkuk zephaniah haggai zechariah malachi matthew mark luke john acts romans 1-corinthians 2-corinthians '
         'galatians ephesians philippians colossians 1-thessalonians 2-thessalonians 1-timothy 2-timothy titus philemon hebrews james 1-peter '
         '2-peter 1-john 2-john 3-john jude revelation').split()
INDEX = json.loads(Path('bible/index.json').read_text(encoding='utf-8'))
assert len(SLUGS) == len(INDEX) == 66
P = """아래는 매튜 헨리의 성경 주석(1706년, 저작권 만료) 원문이다. 각 본문마다 이 원문을 한국어로 충실하게 풀어 써라.
규칙: 4~6문장, 쉬운 존댓말 아닌 평서문(~다). 원문에 없는 내용·역사 사실을 덧붙이지 말 것. 지금 시대에 거친 표현(다른 종교·민족 비하 등)은 뜻만 부드럽게 옮길 것.
출력: 설명 없이 JSON 배열만. 형식: [{"ref":"...","deep":"..."}]
"""

def sections(slug, ch):
    # chapter-N.md 를 [(시작절, 끝절, 글)] 로
    f = Path('mh-src') / slug / f'chapter-{ch}.md'
    if not f.exists(): return []
    out = []
    for m in re.finditer(r'^## Verses? (\d+)(?:[–-](\d+))?\s*\n(.*?)(?=^## |\Z)', f.read_text(encoding='utf-8'), re.M | re.S):
        out.append((int(m[1]), int(m[2] or m[1]), m[3].strip()))
    return out

def source(ref, slug):
    # ref 예: '몬 1:1-7', '창 1:1-2:3' → 겹치는 절의 원문을 이어 붙인다
    m = re.match(r'\S+ (\d+):(\d+)-(?:(\d+):)?(\d+)', ref)
    c1, v1, c2, v2 = int(m[1]), int(m[2]), int(m[3] or m[1]), int(m[4])
    parts = []
    for ch in range(c1, c2 + 1):
        lo, hi = (v1 if ch == c1 else 1), (v2 if ch == c2 else 999)
        parts += [t for a, b, t in sections(slug, ch) if a <= hi and b >= lo]
    return '\n'.join(dict.fromkeys(parts))[:4000]

def ask(prompt, _tries=0):
    try:  # Gemini(무료) 먼저
        from office import gemini
        t = gemini(prompt)
        if t: return t
    except Exception as e: print('gemini 실패', str(e)[:80], flush=True)
    for m in MODELS:
        try:
            t = ask_model(m, prompt)
            if t: return t
        except Exception as e: print(m, '실패', str(e)[:80], flush=True)
    try:  # OmniRoute가 다 막히면 Gemini(무료) → 실패 시 GPT(office.gpt)
        from office import gemini, gpt
        try: t = gemini(prompt)
        except Exception: t = gpt(prompt)
        if t: return t
    except Exception as e: print('gemini/gpt 실패', str(e)[:80], flush=True)
    if _tries < 10:  # 무료 모델이 다 막히면(사용량 초과) 3분 쉬고 다시
        print('모두 막힘, 3분 대기', flush=True); time.sleep(180); return ask(prompt, _tries + 1)
    return ''

Path('deep-src').mkdir(exist_ok=True)
for b, slug in zip(INDEX, SLUGS):
    name = b['name'].replace('2서', '이서').replace('3서', '삼서')
    src = Path('qt-src') / f'{name}.json'
    if not src.exists() or (sys.argv[1:] and name not in sys.argv[1:]): continue
    units = json.loads(src.read_text(encoding='utf-8'))['units']
    f = Path('deep-src') / f'{name}.json'
    done = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}
    todo = [(u['ref'], source(u['ref'], slug)) for u in units if u['ref'] not in done]
    todo = [(r, s) for r, s in todo if s]
    for i in range(0, len(todo), 3):
        batch = todo[i:i+3]
        txt = ask(P + '\n\n'.join(f"본문: {r}\n원문: {s}" for r, s in batch))
        try: got = json.loads(txt[txt.index('['):txt.rindex(']') + 1])
        except Exception as e: print('JSON 실패', batch[0][0], e, flush=True); continue
        for g in got:
            if g.get('ref') in dict(batch) and len(g.get('deep', '')) > 80: done[g['ref']] = g['deep']
        f.write_text(json.dumps(done, ensure_ascii=False, indent=1), encoding='utf-8')
    print(name, len(done), '/', len(units), flush=True)
