from pathlib import Path

path = Path(__file__).resolve().parents[1] / "src/cloudIdentityWiring.test.ts"
text = path.read_text(encoding="utf-8")
old = "    expect(cloudSource).toContain('const identity = await syncPlayerIdentityState()')\n"
new = (
    "    expect(cloudSource).toContain('export async function syncCloudPrerequisites')\n"
    "    expect(cloudSource).toContain('Promise.all([identityTask(), gamesTask()])')\n"
    "    expect(cloudSource).toContain('const { identity, fetched } = await syncCloudPrerequisites()')\n"
)
if text.count(old) != 1:
    raise RuntimeError(f"Expected one legacy wiring assertion, found {text.count(old)}")
path.write_text(text.replace(old, new, 1), encoding="utf-8")
print("Cloud identity wiring expectation updated")
