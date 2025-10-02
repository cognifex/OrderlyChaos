# GitHub Push Setup (HTTPS mit gh oder SSH Fallback)

- Wenn der Container startet:

  1. Prüfe, ob `~/.ssh/id_ed25519` existiert.
     - Falls nicht, erzeuge einen SSH-Key:
       ```bash
       ssh-keygen -t ed25519 -C "codex@workspace" -f ~/.ssh/id_ed25519 -N ""
       eval "$(ssh-agent -s)"
       ssh-add ~/.ssh/id_ed25519
       ```
       ⚠️ Kopiere den Inhalt von `~/.ssh/id_ed25519.pub` und füge ihn bei GitHub unter
       **Settings → SSH and GPG Keys → New SSH Key** ein.

  2. **GitHub CLI installieren (falls nicht vorhanden):**
     ```bash
     if ! command -v gh &> /dev/null; then
       apt-get update
       apt-get install -y gh
     fi
     ```

  3. **Authentifizierung mit Token (falls GH_TOKEN gesetzt ist):**
     ```bash
     if [ -n "$GH_TOKEN" ]; then
       echo "$GH_TOKEN" | gh auth login --with-token
       git remote set-url origin https://github.com/cognifex/OrderlyChaos.git
     fi
     ```

  4. **SSH-Fallback einrichten (wenn HTTPS blockiert ist):**
     - Prüfe, ob ein Key existiert:
       ```bash
       if [ ! -f ~/.ssh/id_ed25519 ]; then
         ssh-keygen -t ed25519 -C "codex@workspace" -f ~/.ssh/id_ed25519 -N ""
         eval "$(ssh-agent -s)"
         ssh-add ~/.ssh/id_ed25519
         echo "⚠️ Bitte diesen Public Key bei GitHub unter Settings → SSH and GPG Keys einfügen:"
         cat ~/.ssh/id_ed25519.pub
       fi
       ```

     - Konfiguriere SSH über Port 443:
       ```bash
       mkdir -p ~/.ssh
       cat <<EOF > ~/.ssh/config
       Host github.com
         HostName ssh.github.com
         Port 443
         User git
         IdentityFile ~/.ssh/id_ed25519
       EOF
       chmod 600 ~/.ssh/config
       ```

     - Setze Remote auf SSH:
       ```bash
       git remote set-url origin git@github.com:cognifex/OrderlyChaos.git
       ```

  5. **Verbindung testen:**
     ```bash
     if [ -n "$GH_TOKEN" ]; then
       gh auth status
     else
       ssh -T git@github.com || true
     fi
     ```

  6. **Push-Befehl:**
     ```bash
     git push -u origin work
     ```

## Workflow-Erinnerungen

- Arbeite ausschließlich auf dem Branch `work`. Falls er noch nicht existiert, von `main` aus erstellen.
- Vor jeder Änderung synchronisieren:
  ```bash
  git fetch origin
  git pull --ff-only origin work || git pull --rebase origin work
  ```
- Nach Änderungen immer `git add -A` und konventionelle Commits nutzen (z. B. `feat:`, `fix:`, Doku mit `[skip ci]`).
- Direkt nach jedem Commit pushen. Erster Push: `git push -u origin work`, danach `git push`.

## Qualitätssicherung

- Respektiere vorhandene Lockfiles und nutze die passenden Install-Befehle (`pnpm i --frozen-lockfile`, `npm ci`, `yarn install --frozen-lockfile`, `pip install -r requirements.txt`, …).
- Führe bei Codeänderungen die relevanten Linter und Tests aus. Wenn nur Dokumentation angepasst wird, darf mit `[skip ci]` committet werden.
- Keine Secrets in Dateien oder Logs ablegen; stattdessen Umgebungsvariablen verwenden.

## Transparenz & Kommunikation

- Größere Änderungen vorher kurz planen (Scope, Deliverables, Tests, Annahmen).
- Nach dem Push Commit-SHA und Link bereitstellen.
- Blockaden früh melden und mögliche Lösungen skizzieren.
