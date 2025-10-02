# GitHub Push Setup (HTTPS mit Token)

- Verwende die Umgebungsvariable `GH_TOKEN`.
- Melde dich an:
  ```bash
  echo "$GH_TOKEN" | gh auth login --with-token
