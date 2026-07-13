# Paket G – Release-Checkliste

- [x] Supabase-Projekt wiederhergestellt und inventarisiert
- [x] Bestehende Spielzeile serverseitig gesichert
- [x] Legacy-Codes gehasht und öffentlich bekannten Default rotiert
- [x] Grants, SECURITY-DEFINER-Funktionen und RLS gehärtet
- [x] `clique_state` mit Versionierung und CAS provisioniert
- [x] Alle angewendeten Migrationen im Repository dokumentiert
- [x] RLS-Pfade als Rolle `anon` mit Rollback geprüft
- [x] Security Advisors ohne Befund
- [x] Drei-Wege-Merge und Dirty-Basis per Unit-Test geprüft
- [x] Standard-CI mit Production-Build erfolgreich
- [x] Dauerhafter Chromium-Workflow einschließlich CAS und Code-Warnung erfolgreich
- [ ] Finaler Vercel-Preview für den unveränderten Merge-Head READY
- [ ] Squash-Merge mit Expected-Head-Schutz
- [ ] Produktions-Deployment und öffentliche Aliase READY
