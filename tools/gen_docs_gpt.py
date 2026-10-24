# 무료 AI가 막혀 빠진 서류(docs-src/NN_*.md 없음 또는 500자 미만)를 GPT(codex)로 채운다.
# 실행: python tools/gen_docs_gpt.py  (끝나면 md2docx·md2html도 돌린다)
import re, subprocess, sys
from pathlib import Path
src = Path('tools/gen_docs.py').read_text(encoding='utf-8')
common = re.search(r'COMMON = """(.*?)"""', src, re.S)[1]
for name, desc in re.findall(r"^ '(\d\d_[^']+)': '([^']+)',", src, re.M):
    f = Path('docs-src') / f'{name}.md'
    if f.exists() and f.stat().st_size > 500: continue
    brief = common + desc + '\n\n출력은 마크다운 문서 본문만. 파일을 만들거나 고치지 말고 답으로만 출력.'
    r = subprocess.run(['codex', 'exec', '--skip-git-repo-check', '--sandbox', 'read-only', '-o', str(f), '-'],
                       input=brief, capture_output=True, text=True, encoding='utf-8', shell=sys.platform == 'win32')
    print(name, f.stat().st_size if f.exists() else 'FAIL', r.stderr.strip()[-80:] if not f.exists() else '', flush=True)
subprocess.run([sys.executable, 'tools/md2docx.py']); subprocess.run([sys.executable, 'tools/md2html.py'])
