import { IconX } from './Icons'

const RULES: { icon: string; title: string; text: string }[] = [
  {
    icon: '🎯',
    title: 'Ziel',
    text: 'Wer als Erste:r 10.000 Punkte oder mehr erreicht, gewinnt.',
  },
  {
    icon: '🎲',
    title: 'So tippst du',
    text: 'Würfelt physisch mit 6 Würfeln. Tippe danach nur die Würfel ein, die Punkte zählen.',
  },
  {
    icon: '🔢',
    title: 'Punkte',
    text: 'Einzelne 1 = 100, einzelne 5 = 50. Drilling = Augenzahl × 100 (drei 1er = 1000, drei 5er = 500). Jeder weitere gleiche Würfel: +1000. Straße (1–6) und drei Paare = je 1500.',
  },
  {
    icon: '✅',
    title: 'Sichern oder weiter',
    text: 'Ab einem wertenden Würfel darfst du Sichern (Punkte aufs Konto, Zug endet). Beim ersten Mal brauchst du mind. 350 Punkte ("Einstieg"). Oder Weiter: die restlichen Würfel riskieren.',
  },
  {
    icon: '💀',
    title: 'Niete',
    text: 'Bringt ein Wurf keinen wertenden Würfel, ist der Zug futsch – alle ungesicherten Punkte des Zuges sind weg.',
  },
  {
    icon: '🔥',
    title: 'Heiße Würfel',
    text: 'Hast du in einem Zug alle 6 Würfel gewertet, bekommst du 6 frische Würfel und würfelst weiter – die Punkte sind im Zwischenspeicher sicher.',
  },
  {
    icon: '🏁',
    title: 'Letzte Chance',
    text: 'Knackt jemand die 10.000, dürfen die übrigen Spieler noch genau einmal – und müssen die Vorgabe überbieten.',
  },
  {
    icon: '🧠',
    title: 'Risiko-Coach',
    text: 'Bei jedem Wurf zeigt dir die App die Chance, dass Weiterwürfeln klappt – und eine Empfehlung.',
  },
]

export function IntroScreen({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-ink-950/95 backdrop-blur-sm">
      <div className="mx-auto flex h-full w-full max-w-md flex-col px-5 pt-[max(env(safe-area-inset-top),1.5rem)] safe-pb">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-black tracking-tighter text-gold-500">10.000</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-fog-500">Die Clique</span>
            </div>
            <p className="mt-1 text-sm text-fog-400">So funktioniert der Begleit-Rechner</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-fog-500 hover:text-fog-200"
            aria-label="Schließen"
          >
            <IconX />
          </button>
        </div>

        <div className="scrollbar-hide flex-1 space-y-2.5 overflow-y-auto pb-4">
          {RULES.map((r) => (
            <div
              key={r.title}
              className="flex gap-3 rounded-2xl border border-ink-700/70 bg-ink-850/70 p-4"
            >
              <span className="text-2xl leading-none">{r.icon}</span>
              <div>
                <h3 className="font-bold text-fog-100">{r.title}</h3>
                <p className="mt-0.5 text-sm leading-relaxed text-fog-400">{r.text}</p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          className="my-4 w-full shrink-0 rounded-2xl bg-gradient-to-b from-mint-400 to-mint-500 py-4 text-lg font-bold text-ink-950 shadow-lg transition-all active:scale-[0.98]"
        >
          Los geht's!
        </button>
      </div>
    </div>
  )
}
