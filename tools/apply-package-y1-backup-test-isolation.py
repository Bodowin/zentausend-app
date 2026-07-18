from pathlib import Path

path = Path(__file__).resolve().parents[1] / "e2e/app.spec.ts"
text = path.read_text(encoding="utf-8")
old = "  test('imports a backup through the real statistics file input', async ({ page }) => {\n    await openCleanApp(page)\n"
new = (
    "  test('imports a backup through the real statistics file input', async ({ page }) => {\n"
    "    // This journey validates the local file-import path. Keep shared cloud\n"
    "    // history out so real family games cannot replace the imported fixture.\n"
    "    await page.addInitScript(() => {\n"
    "      Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => false })\n"
    "    })\n"
    "    await openCleanApp(page)\n"
)
if text.count(old) != 1:
    raise RuntimeError(f"Expected one backup import setup, found {text.count(old)}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Backup import E2E isolated from shared cloud")
