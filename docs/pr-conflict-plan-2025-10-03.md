# PR Conflict Remediation Plan — 2025-10-03

## Scope
- Analyse aller offenen Pull Requests vom 3. Oktober 2025 mit Konfliktstatus (`mergeable = CONFLICTING`).
- Grundlage ist die GitHub-GraphQL-Abfrage (`pullRequests` mit `orderBy: UPDATED_AT`), gespeichert in `docs/pr-conflict-plan-2025-10-03.prs.json`.
- Ziel: Schrittweises Auflösen der Konflikte, ohne neue Regressionen im `main`-Branch zu erzeugen.

## Überblick über betroffene PRs

| PR | Branch | Titel | Konfliktbereiche | Hinweis zur Historie |
|----|--------|-------|------------------|----------------------|
| #18 | `work-2025-10-03-uzmrqn` | fix: clear tiny connectors when rebuild is skipped | `AGENTS.md`, `index.html` | Baut auf Commit `441e35e` auf und enthält nur einen Bugfix obenauf. |
| #16 | `work-2025-10-03-c4nup5` | fix: clamp star count bounds | `AGENTS.md`, `index.html` | Enthält Bugfix für Slider-Grenzen; basiert auf älterem Zustand ohne aktuelle Audio-/Panel-Anpassungen. |
| #15 | `work-2025-10-03-25i6p7` | fix: guard tiny connectors when no star positions | `AGENTS.md`, `index.html` | Entfernt Audio-Panel und weitere neue UI-Komponenten, weil Branch vor Integrationen abgezwigt wurde. |
| #14 | `work-2025-10-03-l9pgwl` | feat: add audio-reactive controls and processing | `AGENTS.md`, `index.html` | Führt Audio-Funktionen ein, kollidiert mit refaktoriertem Panel in `main`. |
| #12 | `work-2025-10-03-zldjrh` | Add numeric bounds controls for sliders | `AGENTS.md`, `index.html` | Fügt Einstellmöglichkeiten für Slider-Grenzen hinzu; Branch ist direkt auf `#11` aufgebaut. |
| #11 | `work-2025-10-03-ctyxpa` | feat: use absolute point category counts | `AGENTS.md`, `index.html` | Erste Stufe der aktuellen Serie; entfernt u. a. Audio- und Bewegungs-Features aus `main`.

## Zentrale Beobachtungen
- **`AGENTS.md`**: Alle Branches enthalten den alten Remote-Workflow (ohne `$GIT_REMOTE_URL` und ohne differenzierten SSH-Hinweis). Dieser Abschnitt muss nach dem Rebase vollständig durch den neuen Stand aus `main` ersetzt werden.
- **`index.html`**: Jeder Branch basiert auf einem älteren UI-Zustand. Große Teile des Panels (Audio-Sektion, neue Parameter, Motion-Optionen) fehlen. Konfikte entstehen beim Rebase, weil `main` bereits weiterentwickelte Strukturen besitzt.
- **Branch-Stacking**: PR #11 bildet die Basis, #12 setzt darauf auf, #14 hängt wiederum an mehreren Zwischen-Branches. Fixes #15, #16, #18 hängen jeweils von denselben älteren Commits ab. Das Konfliktlösen sollte daher in Abhängigkeits-Reihenfolge erfolgen, um doppelte Arbeit zu vermeiden.

## Roadmap & Aufgabenpakete
1. **Baseline-Synchronisation vorbereiten**
   - Lokale Kopien der Branches (`git fetch origin work-…`).
   - Sicherstellen, dass `main` aktuell ist.
   - Testszenario definieren: Mindestens `npm test`/`npm run build` (falls vorhanden) bzw. manuelles Laden der Demo im Browser.

2. **Rebase-Kette aufbauen**
   - Start mit PR #11 (`work-2025-10-03-ctyxpa`):
     - `git switch` auf temporären Arbeitsbranch (z. B. `work/pr-11-rebase`).
     - `git rebase origin/main` und Konflikte in `AGENTS.md`/`index.html` lösen, wobei neue Features aus `main` beibehalten und PR-spezifische Änderungen integriert werden.
     - Lokale Smoke-Tests (Laden der Seite, Fokus auf Kategorie-Zählung).
     - Push zurück auf `work-2025-10-03-ctyxpa` (force-with-lease).
   - Anschließend fortlaufend für #12, #14, #15, #16, #18. Jede Stufe basiert auf der jeweils aktualisierten Vorgänger-Branch-Version.

3. **Validierung & Regressionstests**
   - Nach jedem Rebase: visuelles Smoke-Testing (Browser), Interaktionsprüfungen der neuen Controls, Konsolenfehler checken.
   - Optional automatisierte Tests, falls Skripte vorhanden (zurzeit nicht ersichtlich).

4. **Kommunikation**
   - Fortschritt je PR dokumentieren (Status-Update im Repo bzw. hier im Plan ergänzen).
   - Bei nicht lösbaren Konflikten Risiken und Alternativen dokumentieren (z. B. Feature-Abspaltung in neue Branches).

## Annahmen & Risiken
- Schreibrechte auf die Feature-Branches sind vorhanden (`origin/work-…`).
- Keine weiteren Änderungen landen parallel in `main`, während die Rebase-Kette bearbeitet wird.
- Größtes Risiko: Umfangreiche manuelle Merges in `index.html` können Regressionen verursachen; sorgfältige Tests nötig.

## Nächste konkrete Schritte
1. Rebase-Session für PR #11 vorbereiten (Branch-Checkout, Konfliktlösung fokussiert auf Parameter-Logik).
2. Nach erfolgreichem Abschluss #12 übernehmen (Slider-Grenzen).
3. Audio-Feature (#14) im Anschluss, dann Fix-Branches (#15, #16, #18) jeweils gegen aktualisierte Basis prüfen.
4. Fortschrittsprotokoll nach jedem Schritt aktualisieren.

