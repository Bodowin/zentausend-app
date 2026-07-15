import fs from 'node:fs'

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before)
  if (first < 0) throw new Error(`Marker fehlt: ${label}`)
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Marker mehrfach gefunden: ${label}`)
  return source.slice(0, first) + after + source.slice(first + before.length)
}

let source = fs.readFileSync('src/components/SetupScreen.tsx', 'utf8')

source = replaceOnce(
  source,
  `<div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pt-[max(env(safe-area-inset-top),1.25rem)]">`,
  `<div data-testid="setup-screen" className="mx-auto flex h-[100dvh] min-h-0 w-full max-w-md flex-col overflow-hidden px-3 pt-[max(env(safe-area-inset-top),0.65rem)] sm:px-4">`,
  'Setup-Viewport',
)

source = replaceOnce(
  source,
  `<header className="mb-7 mt-2 flex items-center justify-between animate-rise">`,
  `<header className="mb-2.5 flex shrink-0 items-center justify-between gap-2 animate-rise">`,
  'kompakter Header',
)

source = replaceOnce(
  source,
  `<div className="flex items-baseline gap-2.5">\n          <span className="font-display text-4xl font-black tracking-tighter text-gold-500">10.000</span>\n          <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-fog-500">Die Clique</span>\n        </div>`,
  `<div className="flex min-w-0 items-baseline gap-2">\n          <span className="font-display text-3xl font-black tracking-tighter text-gold-500 min-[390px]:text-4xl">10.000</span>\n          <span className="hidden text-[10px] font-bold uppercase tracking-[0.22em] text-fog-500 min-[350px]:inline">Die Clique</span>\n        </div>`,
  'responsive Logo',
)

source = replaceOnce(
  source,
  `className="flex items-center gap-1.5 rounded-xl border border-ink-700 bg-ink-800/70 px-3 py-2 text-xs font-semibold text-fog-300 transition-colors hover:border-ink-600 hover:text-fog-100"\n          >\n            <IconChart className="h-4 w-4" /> Statistik`,
  `className="flex items-center gap-1 rounded-xl border border-ink-700 bg-ink-800/70 px-2.5 py-2 text-xs font-semibold text-fog-300 transition-colors hover:border-ink-600 hover:text-fog-100"\n            aria-label="Statistik"\n          >\n            <IconChart className="h-4 w-4" />\n            <span className="hidden min-[380px]:inline">Statistik</span>\n            <span className="min-[380px]:hidden">Stats</span>`,
  'responsive Statistik',
)

source = replaceOnce(
  source,
  `      {/* Einmaliger Hinweis: Clique-Code eingeben, um die Cloud-Sync zu aktivieren. */}`,
  `      <main data-testid="setup-scroll-area" className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-1 scrollbar-hide">\n      {/* Einmaliger Hinweis: Clique-Code eingeben, um die Cloud-Sync zu aktivieren. */}`,
  'Setup-Inhaltsbereich Start',
)

source = replaceOnce(
  source,
  `      {/* Würfel-Modus + Start kleben unten → beides immer sichtbar, kein Scrollen nötig. */}`,
  `      </main>\n\n      {/* Würfel-Modus + Start bleiben außerhalb des Inhaltsbereichs immer sichtbar. */}`,
  'Setup-Inhaltsbereich Ende',
)

source = source
  .replace('mb-5 flex items-center gap-3 rounded-2xl border border-gold-500/40 bg-gold-500/10 p-4', 'mb-3 flex items-center gap-2.5 rounded-2xl border border-gold-500/40 bg-gold-500/10 p-3')
  .replace('mb-5 rounded-2xl border border-gold-500/40 bg-gold-500/10 p-4', 'mb-3 rounded-2xl border border-gold-500/40 bg-gold-500/10 p-3')
  .replace('mb-5 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-5', 'mb-3 rounded-3xl border border-ink-700/80 bg-ink-850/80 p-3.5')
  .replace('mb-4 flex items-center justify-between', 'mb-3 flex items-center justify-between')
  .replace('mb-4 grid grid-cols-2 gap-2.5', 'mb-3 grid grid-cols-2 gap-2')
  .replace('rounded-2xl border-2 px-3 py-3.5 text-sm font-bold', 'rounded-xl border-2 px-3 py-2.5 text-sm font-bold')
  .replace('mb-5 flex gap-2', 'mb-3 flex gap-2')
  .replace('bg-ink-950/60 px-4 py-3 text-fog-100 placeholder:text-fog-600', 'bg-ink-950/60 px-3 py-2.5 text-sm text-fog-100 placeholder:text-fog-600')
  .replace('grid w-12 place-items-center rounded-xl', 'grid w-11 place-items-center rounded-xl')
  .replace('<div className="space-y-2">', '<div className="space-y-1.5">')
  .replace('className="py-3 text-center text-sm italic text-fog-600"', 'className="py-2 text-center text-sm italic text-fog-600"')
  .replace('bg-ink-900/60 px-3 py-2 animate-pop', 'bg-ink-900/60 px-3 py-1.5 animate-pop')
  .replace('<div className="mb-4">\n        <button', '<div className="mb-2">\n        <button')
  .replace('bg-ink-850/60 px-4 py-3 text-left', 'bg-ink-850/60 px-4 py-2.5 text-left')

source = replaceOnce(
  source,
  `<div className="sticky bottom-0 z-20 -mx-4 mt-auto bg-gradient-to-t from-ink-900 via-ink-900 to-transparent px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-5">`,
  `<div data-testid="setup-actions" className="z-20 -mx-3 shrink-0 bg-gradient-to-t from-ink-900 via-ink-900 to-transparent px-3 pb-[max(env(safe-area-inset-bottom),0.55rem)] pt-2 sm:-mx-4 sm:px-4">`,
  'fixierte Startaktionen',
)

source = source
  .replace('className="mb-2.5 grid grid-cols-2 gap-2"', 'className="mb-2 grid grid-cols-2 gap-2"')
  .replace('className={`rounded-xl border-2 py-2 text-sm font-bold', 'className={`rounded-xl border-2 py-1.5 text-sm font-bold')
  .replace('className="w-full rounded-2xl bg-gradient-to-b from-mint-400 to-mint-500 py-4 text-lg', 'className="w-full rounded-2xl bg-gradient-to-b from-mint-400 to-mint-500 py-3 text-base min-[390px]:py-3.5 min-[390px]:text-lg')

fs.writeFileSync('src/components/SetupScreen.tsx', source)
console.log('Paket P Setup-Patch angewendet')
