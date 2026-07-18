from __future__ import annotations

import base64
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FILES = [
    "src/App.tsx",
    "src/components/AnalysisScreen.tsx",
    "src/components/DiceArena.tsx",
    "src/components/GameScreen.tsx",
    "src/components/StatsScreen.tsx",
    "src/lib/cloud.ts",
    "src/lib/cloud.parallel.test.ts",
    "e2e/audit-fixes.spec.ts",
]

for relative in FILES:
    encoded = base64.b64encode((ROOT / relative).read_bytes()).decode("ascii")
    print(f"Y1_FILE_BEGIN {relative}")
    for offset in range(0, len(encoded), 120):
        print(encoded[offset : offset + 120])
    print(f"Y1_FILE_END {relative}")
