from pathlib import Path
import runpy

source = Path('scripts/apply-package-r.py')
text = source.read_text(encoding='utf-8')
old = '''replace_once(
    'src/components/SetupScreen.tsx',
    "      <section className=\\"mb-3 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-3.5 shadow-2xl shadow-black/40 animate-rise\\">\\n",
    "      <PausedGamesPanel\\n"
    "        paused={pausedGames}\\n"
    "        archived={archivedGames}\\n"
    "        onResume={onResumePaused}\\n"
    "        onDelete={onDeletePaused}\\n"
    "      />\\n\\n"
    "      <section className=\\"mb-3 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-3.5 shadow-2xl shadow-black/40 animate-rise\\">\\n",
)
'''
new = '''replace_once(
    'src/components/SetupScreen.tsx',
    "      <section className=\\"mb-3 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-3.5 shadow-2xl shadow-black/40 animate-rise\\">\\n"
    "        <div className=\\"mb-3 flex items-center justify-between\\">\\n"
    "          <h2 className=\\"flex items-center gap-2 font-semibold text-fog-100\\">\\n"
    "            <IconUsers className=\\"h-5 w-5 text-gold-500\\" /> Wer spielt mit?\\n",
    "      <PausedGamesPanel\\n"
    "        paused={pausedGames}\\n"
    "        archived={archivedGames}\\n"
    "        onResume={onResumePaused}\\n"
    "        onDelete={onDeletePaused}\\n"
    "      />\\n\\n"
    "      <section className=\\"mb-3 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-3.5 shadow-2xl shadow-black/40 animate-rise\\">\\n"
    "        <div className=\\"mb-3 flex items-center justify-between\\">\\n"
    "          <h2 className=\\"flex items-center gap-2 font-semibold text-fog-100\\">\\n"
    "            <IconUsers className=\\"h-5 w-5 text-gold-500\\" /> Wer spielt mit?\\n",
)
'''
if old not in text:
    raise SystemExit('Generic setup-card patch block not found')
patched = Path('/tmp/apply-package-r.py')
patched.write_text(text.replace(old, new, 1), encoding='utf-8')
runpy.run_path(str(patched), run_name='__main__')
