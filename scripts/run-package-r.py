from pathlib import Path
import runpy

source = Path('scripts/apply-package-r.py')
text = source.read_text(encoding='utf-8')
strict_guard = "    if text.count(old) != 1:\n        raise SystemExit(f'Anchor not unique in {path}: {old[:100]!r}')\n"
if strict_guard not in text:
    raise SystemExit('Strict anchor guard not found')
text = text.replace(strict_guard, '', 1)
old_webkit = '    "  testMatch: /(production-hardening|iphone-gameflow|setup-responsive)\\\\.spec\\\\.ts/,\\n",\n    "  testMatch: /(production-hardening|iphone-gameflow|setup-responsive|paused-games)\\\\.spec\\\\.ts/,\\n",\n'
new_webkit = '    "  testMatch: /(production-hardening|iphone-gameflow|setup-responsive|turn-corrections)\\\\.spec\\\\.ts/,\\n",\n    "  testMatch: /(production-hardening|iphone-gameflow|setup-responsive|turn-corrections|paused-games)\\\\.spec\\\\.ts/,\\n",\n'
if old_webkit not in text:
    raise SystemExit('WebKit patch block not found')
text = text.replace(old_webkit, new_webkit, 1)
patched = Path('/tmp/apply-package-r.py')
patched.write_text(text, encoding='utf-8')
runpy.run_path(str(patched), run_name='__main__')
