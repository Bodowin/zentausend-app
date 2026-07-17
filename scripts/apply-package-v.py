from pathlib import Path


def replace_once(path: str, old: str, new: str, required: bool = True) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count == 0 and not required:
        return
    if count != 1:
        raise RuntimeError(f'Expected exactly one match in {path}, found {count}: {old[:80]!r}')
    file.write_text(text.replace(old, new, 1))


stats_path = 'src/components/StatsScreen.tsx'
stats_text = Path(stats_path).read_text()
if "import { EventCupScreen } from './EventCupScreen'" not in stats_text:
    replacements = [
        (
            "import { BulkEventAssignmentDialog } from './BulkEventAssignmentDialog'\n",
            "import { BulkEventAssignmentDialog } from './BulkEventAssignmentDialog'\nimport { EventCupScreen } from './EventCupScreen'\n",
        ),
        (
            "  const [profileId, setProfileId] = useState<string | null>(null)\n",
            "  const [profileId, setProfileId] = useState<string | null>(null)\n  const [eventCup, setEventCup] = useState<string | null>(null)\n",
        ),
        (
            "  if (analysisGame) {\n    return <AnalysisScreen game={analysisGame} onBack={() => setAnalysisGame(null)} />\n  }\n\n  return (\n",
            "  if (analysisGame) {\n    return <AnalysisScreen game={analysisGame} onBack={() => setAnalysisGame(null)} />\n  }\n\n  if (eventCup) {\n    return (\n      <EventCupScreen\n        event={eventCup}\n        games={games}\n        onBack={() => setEventCup(null)}\n        onOpenGame={setAnalysisGame}\n        onAssignUnassigned={() => {\n          setEventCup(null)\n          setBulkAssignOpen(true)\n        }}\n      />\n    )\n  }\n\n  return (\n",
        ),
        (
            "          {filter !== '' && stats.length > 0 && <EventPodium event={filter} top={stats.slice(0, 3)} />}\n",
            "          {filter !== '' && stats.length > 0 && (\n            <>\n              <EventPodium event={filter} top={stats.slice(0, 3)} />\n              <button\n                type=\"button\"\n                onClick={() => setEventCup(filter)}\n                className=\"mb-6 flex w-full items-center justify-center gap-2 rounded-2xl border border-gold-500/35 bg-gold-500/10 px-4 py-3 text-sm font-black text-gold-300 transition-colors hover:bg-gold-500/15\"\n              >\n                <IconTrophy className=\"h-5 w-5\" /> Urlaubs-Cup öffnen\n              </button>\n            </>\n          )}\n",
        ),
    ]
    for old, new in replacements:
        replace_once(stats_path, old, new)

replace_once(
    'src/lib/eventCup.ts',
    "interface MutableStanding extends Omit<EventCupStanding, 'rank' | 'averagePlacement' | 'bustRate'> {",
    "interface MutableStanding extends Omit<EventCupStanding, 'rank' | 'winRate' | 'averagePlacement' | 'bustRate'> {",
    required=False,
)
replace_once(
    'src/lib/eventCup.test.ts',
    "import { beforeEach, describe, expect, it } from 'vitest'",
    "import { describe, expect, it } from 'vitest'",
    required=False,
)
replace_once(
    'src/lib/eventCup.test.ts',
    "\nbeforeEach(() => localStorage.clear())\n",
    "\n",
    required=False,
)
replace_once(
    'src/lib/eventCup.test.ts',
    "player('a', 'Anna', 14_900), player('b', 'Bodo', 15_050)",
    "player('a', 'Anna', 14_000), player('b', 'Bodo', 20_050)",
    required=False,
)
