# PR Conflict Remediation Plan — 2025-10-03

## Scope
- Analyse aller offenen Pull Requests vom 3. Oktober 2025 mit Konfliktstatus (`mergeable = CONFLICTING`).
- Grundlage ist die GitHub-GraphQL-Abfrage (`pullRequests` mit `orderBy: UPDATED_AT`), gespeichert in `docs/pr-conflict-plan-2025-10-03.prs.json`.
- Ziel: Schrittweises Auflösen der Konflikte, ohne neue Regressionen im `main`-Branch zu erzeugen.
- PR #3 (`work-2025-10-02-9sfkqk`) wurde ebenfalls im Snapshot erfasst, stammt jedoch vom 2. Oktober. Dieser Branch bleibt zunächst außerhalb des Scopes; der Status wird nach Abschluss der heutigen Serie erneut bewertet.

## Überblick über betroffene PRs (03.10.2025)

| PR | Branch | Titel | Konfliktbereiche | Hinweis zur Historie |
|----|--------|-------|------------------|----------------------|
| #18 | `work-2025-10-03-uzmrqn` | fix: clear tiny connectors when rebuild is skipped | `AGENTS.md`, `index.html` | Baut auf Commit `441e35e` auf und enthält nur einen Bugfix obenauf. |
| #16 | `work-2025-10-03-c4nup5` | fix: clamp star count bounds | `AGENTS.md`, `index.html` | Enthält Bugfix für Slider-Grenzen; basiert auf älterem Zustand ohne aktuelle Audio-/Panel-Anpassungen. |
| #15 | `work-2025-10-03-25i6p7` | fix: guard tiny connectors when no star positions | `AGENTS.md`, `index.html` | Entfernt Audio-Panel und weitere neue UI-Komponenten, weil Branch vor Integrationen abgezwigt wurde. |
| #14 | `work-2025-10-03-l9pgwl` | feat: add audio-reactive controls and processing | `AGENTS.md`, `index.html` | Führt Audio-Funktionen ein, kollidiert mit refaktoriertem Panel in `main`. |
| #12 | `work-2025-10-03-zldjrh` | Add numeric bounds controls for sliders | `AGENTS.md`, `index.html` | Fügt Einstellmöglichkeiten für Slider-Grenzen hinzu; Branch ist direkt auf `#11` aufgebaut. |
| #11 | `work-2025-10-03-ctyxpa` | feat: use absolute point category counts | `AGENTS.md`, `index.html` | Erste Stufe der aktuellen Serie; entfernt u. a. Audio- und Bewegungs-Features aus `main`. |

## Zentrale Beobachtungen
- **`AGENTS.md`**: Alle Branches enthalten den alten Remote-Workflow (ohne `$GIT_REMOTE_URL` und ohne differenzierten SSH-Hinweis). Dieser Abschnitt muss nach dem Rebase vollständig durch den neuen Stand aus `main` ersetzt werden.
- **`index.html`**: Jeder Branch basiert auf einem älteren UI-Zustand. Große Teile des Panels (Audio-Sektion, neue Parameter, Motion-Optionen) fehlen. Konflikte entstehen beim Rebase, weil `main` bereits weiterentwickelte Strukturen besitzt.
- **Branch-Stacking**: PR #11 bildet die Basis, #12 setzt darauf auf, #14 hängt wiederum an mehreren Zwischen-Branches. Fixes #15, #16, #18 hängen jeweils von denselben älteren Commits ab. Das Konfliktlösen sollte daher in Abhängigkeits-Reihenfolge erfolgen, um doppelte Arbeit zu vermeiden.

## Detaillierter Aufgabenplan
1. **Baseline vorbereiten**
   - Remote-Verbindung per Skript herstellen: `GIT_REMOTE_URL=<https-url> ./scripts/bootstrap-remote.sh`
     - Alternativ akzeptiert das Skript auch `GitRemoteURL` (CamelCase) aus älteren Setups.
   - `git fetch origin` (sobald Remote-Zugriff verfügbar) und lokale Aktualisierung von `main` (`git pull --ff-only origin main`).
   - Für jede Branch-Serie einen Arbeitsbranch `work/pr-<nr>-rebase` anlegen, um Zwischenschritte getrennt zu halten.
   - Smoke-Test-Szenario definieren: Laden der Demo-Seite, Interaktion mit Panel, Konsole auf Fehler prüfen.

2. **Rebase-Kette (Top-Down)**
   - **PR #11 (`work-2025-10-03-ctyxpa`)**
     - Rebase auf `origin/main` starten.
     - Konflikte auflösen (vor allem Panel-Struktur & Parameter-Logik) und Features aus `main` beibehalten.
     - Smoke-Test durchführen; Ergebnis dokumentieren.
     - Mit `git push --force-with-lease origin work-2025-10-03-ctyxpa` aktualisieren.
   - **PR #12 (`work-2025-10-03-zldjrh`)**
     - Nach aktualisiertem #11 rebasen, Slider-Bounds integrieren.
     - Sicherstellen, dass UI-Kontrollen nicht dupliziert werden.
     - Tests & Push wie oben.
   - **PR #14 (`work-2025-10-03-l9pgwl`)**
     - Audio-Funktionen einpflegen, neuere Panel-Struktur respektieren.
     - Audio-Initialisierung und State-Handling gegen aktuelle Module prüfen.
   - **PR #15 / #16 / #18 (Bugfix-Stack)**
     - Reihenfolge: #15 → #16 → #18, da jeder Fix auf dem vorherigen Bugfix bzw. Feature aufsetzt.
     - Guard-/Cleanup-Logik gegen aktuelle `index.html` validieren.

3. **Regressionen prüfen & Nachfassen**
   - Nach jedem Branch: Demo erneut laden, Interaktionen (Audio, Motion, Slider) testen.
   - Konsolen-Logs auf Warnungen/Fehler prüfen.
   - Ergebnisse im Plan ergänzen (Status „erledigt“, „Blocker“, „Folgenotiz“).

4. **Out-of-Scope PR (#3)**
   - Nach Abschluss der Tages-PRs Snapshot aktualisieren.
   - Falls #3 weiterhin Konflikte zeigt, gesonderten Plan erstellen (ältere UI-Generation, umfangreicher Merge zu erwarten).

## Annahmen & Risiken
- Schreibrechte auf die Feature-Branches sind vorhanden (`origin/work-…`).
- Keine weiteren Änderungen landen parallel in `main`, während die Rebase-Kette bearbeitet wird.
- Größtes Risiko: Umfangreiche manuelle Merges in `index.html` können Regressionen verursachen; sorgfältige Tests nötig.

## Fortschrittsprotokoll (wird iterativ ergänzt)
| PR | Status | Letzte Aktion | Nächster Schritt |
|----|--------|---------------|------------------|
| #11 | Blockiert | Lokale Analyse am 2025-10-03: Snapshot enthält nur `work` ohne Remote-Verlauf. | Zugriff auf Remote-Branches wiederherstellen, dann Rebase-Branch gemäß Plan anlegen. |
| #12 | Blockiert | Abhängig von #11; gleiche Datenlage verhindert Fortschritt. | Nach Aktualisierung von #11 auf denselben Stand rebasen. |
| #14 | Blockiert | Warten auf Abschluss von #11/#12; keine konfliktbereinigte Basis verfügbar. | Feature-Branch nachgelagert rebasen, sobald Abhängigkeiten gelöst. |
| #15 | Blockiert | Benötigt Audio-/Panel-Stand aus #14; aktuell kein Zugriff. | Nach Auflösung von #14 erneut bewerten. |
| #16 | Blockiert | Hängt an #15; ohne vorgelagerte Branches keine Umsetzung möglich. | Nach Fortschritt in #15 rebasen. |
| #18 | Blockiert | Baut auf #16 auf; ebenfalls kein Remote-Snapshot. | Sobald #16 aktualisiert ist, Konflikte lösen. |
| #3  | Beobachtung | Weiterhin außerhalb des Scopes; Remote-Zugriff fehlt ebenfalls. | Nach Abschluss der Serie erneut prüfen. |

## Bewertung nach Remote-Bootstrap

- **Durchführbarkeit:** Mit `scripts/bootstrap-remote.sh` lassen sich die fehlenden Remotes wieder anbinden. Sobald `git fetch origin` erfolgreich ist, steht die gesamte Branch-Historie zur Verfügung und die in diesem Plan beschriebene Rebase-Kette kann ohne weitere Blocker gestartet werden.
- **Konfliktauflösung:** Die einzelnen Rebase-Schritte sind im Abschnitt „Detaillierter Aufgabenplan“ bereits vorbereitet. Durch konsequentes Abarbeiten der Reihenfolge (#11 → #12 → #14 → #15 → #16 → #18) werden sämtliche Änderungen in `main` integriert; anschließend können die ursprünglichen PR-Branches entweder aktualisiert oder – falls die Änderungen komplett neu umgesetzt werden – gelöscht werden.
- **Alternativpfad (PRs schließen, Änderungen übernehmen):** Falls Rebase/Force-Push organisatorisch nicht gewünscht ist, lassen sich die Commits auch manuell auf neuen lokalen Branches nachbauen. Der Plan dient dann als Feature-Backlog: Nach jedem abgeschlossenen Feature wird ein eigener Commit auf `work` erstellt, die Ergebnisse getestet und dokumentiert. Sobald alle Funktions- und Bugfix-Punkte aus den PRs abgedeckt sind, können die alten Pull Requests geschlossen werden.
- **Abschlusskriterium:** Egal ob Rebase oder Neuimplementierung – nach dem letzten Schritt sollte das Fortschrittsprotokoll jeden PR mit „erledigt“ markieren. Danach empfiehlt sich eine kurze Konsolidierungs-Review (Smoke-Test + visuelle Kontrolle), bevor die Branches oder PRs endgültig aufgeräumt werden.

### Heutiger Arbeitsstand (2025-10-03 – Offline-Snapshot)

- **Scope-Check:** Repository enthält lediglich den aktuellen `work`-Stand ohne die in der Planung referenzierten Branches. Ein `git fetch` auf die in der Tabelle genannten Branches ist nicht möglich.
- **Durchführungsschritte:**
  1. Plan gesichtet und Konfliktbereiche in `index.html` sowie `AGENTS.md` verifiziert.
  2. Lokalen Zustand mit dem Plan abgeglichen (Panel-Struktur, Audio-Features, Tiny-Connector-Logik vorhanden).
  3. Blocker dokumentiert, da Rebase/Force-Push ohne Remote nicht möglich ist.
- **Annahmen aktualisiert:** Für die weitere Umsetzung wird Zugriff auf die jeweiligen Feature-Branches benötigt (z. B. über `git fetch origin work-2025-10-03-ctyxpa`). Ohne diesen Zugriff können die im Plan beschriebenen Rebase-Schritte nicht gestartet werden.
- **Empfohlene nächste Schritte nach Beseitigung des Blockers:**
  1. Remote-Verbindung herstellen (`git remote set-url origin …`, `git fetch origin --prune`).
  2. Arbeits-Branches wie im Plan vorgesehen (`work/pr-<nr>-rebase`) anlegen und Konfliktlösung starten.
  3. Nach jedem Rebase Smoke-Tests (Demo laden, Panel/Audio/Slider prüfen) durchführen und Ergebnisse erneut im Fortschrittsprotokoll notieren.

## Kommunikation
- Nach jedem abgeschlossenen Schritt kurze Statusmeldung (Commit-Hash/Push-Link, Testergebnisse, offene Fragen).
- Blocker frühzeitig eskalieren (z. B. fehlende Rechte auf Fork-Branch, widersprüchliche Änderungen in `main`).
