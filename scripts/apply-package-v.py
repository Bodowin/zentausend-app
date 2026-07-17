from pathlib import Path


path = Path('src/components/StatsScreen.tsx')
text = path.read_text()

if "import { EventCupScreen } from './EventCupScreen'" in text:
    raise SystemExit(0)

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
        "            <Chip key={e} active={filter === e} onClick={() => setFilter(e)}>\n              {e}\n            </Chip>\n",
        "            <Chip\n              key={e}\n              active={filter === e}\n              onClick={() => {\n                setFilter(e)\n                setEventCup(e)\n              }}\n            >\n              {e}\n            </Chip>\n",
    ),
]

for old, new in replacements:
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'Expected exactly one match, found {count}: {old[:80]!r}')
    text = text.replace(old, new, 1)

path.write_text(text)
