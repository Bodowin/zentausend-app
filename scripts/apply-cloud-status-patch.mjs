import fs from 'node:fs'

const path = 'src/components/StatsScreen.tsx'
let source = fs.readFileSync(path, 'utf8')

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1
  if (count !== 1) throw new Error(`${label}: expected 1 match, found ${count}`)
  source = source.replace(before, after)
}

function replaceCount(before, after, expected, label) {
  const count = source.split(before).length - 1
  if (count !== expected) throw new Error(`${label}: expected ${expected} matches, found ${count}`)
  source = source.split(before).join(after)
}

replaceOnce(
  "import { deleteGame, editGameEvent, syncAndMerge } from '../lib/cloud'",
  "import { deleteGame, editGameEvent, pendingEventEditCount, syncAndMerge } from '../lib/cloud'",
  'cloud import',
)

replaceOnce(
  "  const [online, setOnline] = useState(false)\n  const [filter, setFilter] = useState<string>('')",
  "  const [online, setOnline] = useState(false)\n  const [pendingSync, setPendingSync] = useState(() => pendingEventEditCount())\n  const [filter, setFilter] = useState<string>('')",
  'pending sync state',
)

replaceCount(
  "      setOnline(res.online)\n      setLoading(false)",
  "      setOnline(res.online)\n      setPendingSync(res.pending)\n      setLoading(false)",
  2,
  'sync result handling',
)

replaceOnce(
  "    if (res === 'denied') {\n      flash('Löschen nur mit Admin-Code.')",
  "    if (res === 'offline') {\n      flash('Offline – Spiel wurde nicht gelöscht.')\n      return\n    }\n    if (res === 'denied') {\n      flash('Löschen nur mit Admin-Code.')",
  'offline delete handling',
)

replaceOnce(
  "    setEditingGame(null)\n    flash('Anlass gespeichert.')\n    void editGameEvent(g, trimmed)",
  "    setEditingGame(null)\n    const sync = editGameEvent(g, trimmed)\n    setPendingSync(pendingEventEditCount())\n    flash('Anlass lokal gespeichert · Sync läuft…')\n    void sync.then((result) => {\n      setPendingSync(pendingEventEditCount())\n      if (result === 'ok') flash('Anlass synchronisiert.')\n      else if (result === 'denied') flash('Lokal gespeichert · Clique-Code prüfen.')\n      else flash('Lokal gespeichert · wird später synchronisiert.')\n    })",
  'event edit status',
)

replaceOnce(
  "            loading ? 'animate-pulse bg-gold-500' : online ? 'bg-mint-400' : 'bg-fog-600'",
  "            loading\n              ? 'animate-pulse bg-gold-500'\n              : pendingSync > 0\n                ? 'bg-gold-500'\n                : online\n                  ? 'bg-mint-400'\n                  : 'bg-fog-600'",
  'sync dot',
)

replaceOnce(
  "          {loading\n            ? 'Synchronisiere mit der Cloud…'\n            : online\n              ? 'Mit Cloud synchronisiert · auf allen Geräten gleich'\n              : cloudEnabled\n                ? 'Offline – nur dieses Gerät'\n                : 'Lokal – nur dieses Gerät'}",
  "          {loading\n            ? 'Synchronisiere mit der Cloud…'\n            : pendingSync > 0\n              ? `${pendingSync} ${pendingSync === 1 ? 'Änderung wartet' : 'Änderungen warten'} auf Cloud`\n              : online\n                ? 'Mit Cloud synchronisiert · auf allen Geräten gleich'\n                : cloudEnabled\n                  ? 'Offline – nur dieses Gerät'\n                  : 'Lokal – nur dieses Gerät'}",
  'sync status text',
)

fs.writeFileSync(path, source)
