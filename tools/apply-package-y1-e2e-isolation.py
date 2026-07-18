from pathlib import Path

path = Path(__file__).resolve().parents[1] / "e2e/player-management.spec.ts"
text = path.read_text(encoding="utf-8")
old = "  await page.addInitScript((games) => {\n    localStorage.clear()\n"
new = (
    "  await page.addInitScript((games) => {\n"
    "    // This journey validates local profile merge/undo only. Keep shared cloud\n"
    "    // history out so real family data cannot create duplicate names.\n"
    "    Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })\n"
    "    localStorage.clear()\n"
)
if text.count(old) != 1:
    raise RuntimeError(f"Expected one player-management setup, found {text.count(old)}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Player-management E2E isolated from shared cloud")
