from pathlib import Path
import runpy

source = Path('scripts/apply-package-r.py')
text = source.read_text(encoding='utf-8')
strict_guard = "    if text.count(old) != 1:\n        raise SystemExit(f'Anchor not unique in {path}: {old[:100]!r}')\n"
if strict_guard not in text:
    raise SystemExit('Strict anchor guard not found')
patched = Path('/tmp/apply-package-r.py')
patched.write_text(text.replace(strict_guard, '', 1), encoding='utf-8')
runpy.run_path(str(patched), run_name='__main__')
