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
| #11 | Offen | Plan erstellt | Rebase-Branch anlegen & Konflikte lösen |
| #12 | Offen | Plan erstellt | Auf aktualisierten #11 rebasen |
| #14 | Offen | Plan erstellt | Nach Abschluss #12 rebasen |
| #15 | Offen | Plan erstellt | Auf aktualisierten #14 rebasen |
| #16 | Offen | Plan erstellt | Auf aktualisierten #15 rebasen |
| #18 | Offen | Plan erstellt | Auf aktualisierten #16 rebasen |
| #3  | Beobachtung | Außerhalb Scope (02.10.) | Nach Serienabschluss prüfen |

## Kommunikation
- Nach jedem abgeschlossenen Schritt kurze Statusmeldung (Commit-Hash/Push-Link, Testergebnisse, offene Fragen).
- Blocker frühzeitig eskalieren (z. B. fehlende Rechte auf Fork-Branch, widersprüchliche Änderungen in `main`).
