# Git Remote URL Troubleshooting

Viele der älteren Automationsskripte und Dokumente beziehen sich auf eine Umgebungsvariable namens `GitRemoteURL`, während neuere
Playbooks `GIT_REMOTE_URL` (mit Unterstrichen) verwenden. Wenn weder die eine noch die andere Variante gesetzt ist, schlagen Skripte
wie das Rebase-Playbook mit der Meldung `GitRemoteURL not set` fehl.

## Vorgehen

1. **Vorhandene Variablen prüfen**
   ```bash
   echo "GIT_REMOTE_URL=${GIT_REMOTE_URL:-<leer>}"
   echo "GitRemoteURL=${GitRemoteURL:-<leer>}"
   ```
   - Ist nur die CamelCase-Variante gefüllt, kann sie temporär gespiegelt werden:
     ```bash
     export GIT_REMOTE_URL="$GitRemoteURL"
     ```

2. **Skript zur Remote-Konfiguration nutzen**
   ```bash
   GIT_REMOTE_URL="https://github.com/<owner>/<repo>.git" ./scripts/bootstrap-remote.sh
   ```
   - Das Skript akzeptiert automatisch auch `GitRemoteURL` oder `GITREMOTEURL`, falls `GIT_REMOTE_URL` leer ist.
   - Mit `--skip-fetch` lässt sich ein sofortiger `git fetch` unterdrücken (z. B. in Offline-Snapshots).

3. **GitHub Actions / CI**
   ```yaml
   env:
     GIT_REMOTE_URL: ${{ secrets.GIT_REMOTE_URL }}
   ```
   - Falls das Secret anders heißt (`GitRemoteURL`), kann es ebenfalls gemappt werden:
     ```yaml
     env:
       GIT_REMOTE_URL: ${{ secrets.GitRemoteURL }}
     ```

4. **Fehler weiterhin vorhanden?**
   - Prüfe, ob `scripts/bootstrap-remote.sh` aus dem Repository verfügbar ist (mindestens Commit `ce4b9ea`).
   - Falls das Skript in einer anderen Umgebung läuft, eventuell `git remote set-url origin ...` manuell ausführen.
   - Notiere den Befehl und die Shell-Ausgabe im Projekt-Log, damit nachvollzogen werden kann, wann der Remote gesetzt wurde.

## Hintergrund

Der neue Workflow vereinheitlicht alle Dokumente auf `GIT_REMOTE_URL`, die CamelCase-Schreibweise bleibt als Fallback erhalten. So
können vorhandene Secrets/Variablen weitergenutzt werden, ohne dass mehrere Systeme parallel angepasst werden müssen.
