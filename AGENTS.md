# GitHub Push Setup (SSH über Port 443)

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

  2. Lege eine SSH-Config an, die GitHub über Port 443 anspricht:
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

  3. Stelle sicher, dass Git das SSH-Remote nutzt:
     ```bash
     git remote set-url origin git@github.com:cognifex/OrderlyChaos.git
     ```

  4. Teste die Verbindung:
     ```bash
     ssh -T git@github.com
     ```

  5. Zum Pushen:
     ```bash
     git push -u origin work
     ```
