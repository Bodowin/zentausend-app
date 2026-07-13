# Paket D – PR-Notizen

- Branch basiert auf Produktions-Commit `753b5c67616189b5039813800c7ab04515c51c57`.
- Keine Supabase-Migration erforderlich.
- Historische Datensätze werden nicht umgeschrieben.
- Neue optionale Felder: `players[].playerId` und `turns[].playerId`.
- Kader-Umbenennungen erzeugen eine lokale Alias-Verknüpfung auf dieselbe stabile ID.
- Finale Freigabe erst nach vollständiger Unit-Test-Suite, TypeScript-/Vite-Build, sauberem Diff und Vercel-Preview.
