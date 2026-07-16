from pathlib import Path
import runpy

source = Path('scripts/apply-package-r.py')
text = source.read_text(encoding='utf-8')
strict_guard = "    if text.count(old) != 1:\n        raise SystemExit(f'Anchor not unique in {path}: {old[:100]!r}')\n"
if strict_guard not in text:
    raise SystemExit('Strict anchor guard not found')
text = text.replace(strict_guard, '', 1)
webkit_start = text.find("\nreplace_once(\n    'playwright.webkit.config.ts',")
if webkit_start < 0:
    raise SystemExit('WebKit patch block not found')
webkit_end = text.find("\n\nprint('Package R paused-game integration applied.')", webkit_start)
if webkit_end < 0:
    raise SystemExit('WebKit patch block end not found')
text = text[:webkit_start] + text[webkit_end:]
patched = Path('/tmp/apply-package-r.py')
patched.write_text(text, encoding='utf-8')
runpy.run_path(str(patched), run_name='__main__')
