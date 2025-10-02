# GitHub Push Setup (HTTPS mit gh oder SSH Fallback)

- Wenn der Container startet:

  1. **GitHub CLI installieren (falls nicht vorhanden):**
     ```bash
     if ! command -v gh &> /dev/null; then
       apt-get update
       apt-get install -y gh
     fi
     ```

  2. **Authentifizierung mit Token (falls GH_TOKEN gesetzt ist):**
     ```bash
     if [ -n "$GH_TOKEN" ]; then
       echo "$GH_TOKEN" | gh auth login --with-token
       git remote set-url origin https://github.com/cognifex/OrderlyChaos.git
     fi
     ```

  3. **SSH-Fallback einrichten (wenn HTTPS blockiert ist):**
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

  4. **Verbindung testen:**
     ```bash
     if [ -n "$GH_TOKEN" ]; then
       gh auth status
     else
       ssh -T git@github.com || true
     fi
     ```

  5. **Push-Befehl:**
     ```bash
     git push -u origin work
     ```
