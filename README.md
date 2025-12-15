# OrderlyChaos

## Musik-Presets

Lege vorbereitete Audio-Dateien im Ordner `Musik/` ab. Beim Laden der Seite werden alle Einträge aus `Musik/playlist.json` automatisch als Playlist geladen und können sofort abgespielt werden.

### Playlist-Manifest aktualisieren

Führe nach dem Hinzufügen oder Entfernen von Dateien aus dem Ordner `Musik/` den folgenden Befehl aus, um das Manifest zu aktualisieren:

```bash
node scripts/generate-preset-playlist.mjs
```

Das Skript erstellt bzw. aktualisiert `Musik/playlist.json` und ermittelt Dateigröße sowie MIME-Typ. Anschließend stehen die Titel bei der nächsten Aktualisierung der Seite direkt in der App bereit.

## Container-Setup

### Überblick

- Die App ist ein statisches Frontend und wird im Container von `nginx:alpine` ausgeliefert.
- Die Dateien aus diesem Repository werden unter `/usr/share/nginx/html` bereitgestellt.
- Der Server ist vorkonfiguriert für Audio-Streaming (Range Requests), gzip-Komprimierung und lange Cache-Header für statische Assets.

### Voraussetzungen

- Docker und Docker Compose Plugin
- Optional: Node.js (nur nötig, wenn du `Musik/playlist.json` vor dem Build mit dem Playlist-Skript aktualisieren möchtest)

### Schnelles Starten mit Docker Compose (lokal)

1. Optional Playlist aktualisieren:
   ```bash
   node scripts/generate-preset-playlist.mjs
   ```
2. Container bauen:
   ```bash
   docker compose build
   ```
3. Container starten (Standard-Port 8080 → Container-Port 80):
   ```bash
   MUSIC_HTTP_PORT=8080 docker compose up -d
   ```
4. Verfügbarkeit prüfen:
   ```bash
   curl -I http://localhost:8080
   ```

## Deployment auf Debian (music.rtfx.fyi)

### 1) System vorbereiten

```bash
sudo apt update
sudo apt install -y ca-certificates curl gnupg ufw docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker $USER # danach neu einloggen
```

### 2) Firewall und Ports

```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS (für TLS oder Reverse Proxy)
sudo ufw enable
sudo ufw status
```

### 3) DNS-Records für music.rtfx.fyi

- Lege einen **A-Record** für `music.rtfx.fyi` auf die öffentliche IPv4-Adresse des Servers.
- Optional: Lege zusätzlich einen **AAAA-Record** auf die IPv6-Adresse an.
- Typische TTL: 300–600 Sekunden; überprüfe die Propagierung mit `dig music.rtfx.fyi`.

### 4) Quellcode holen und Playlist pflegen

```bash
cd /opt
sudo git clone https://github.com/cognifex/OrderlyChaos.git
cd OrderlyChaos
# Optional: Playlist neu erzeugen, wenn du neue Titel abgelegt hast
node scripts/generate-preset-playlist.mjs
```

### 5) Container bauen und starten

```bash
# Für den Produktivbetrieb Port 80 auf dem Host nutzen
export MUSIC_HTTP_PORT=80
sudo docker compose build
sudo docker compose up -d
sudo docker compose ps
```

### 6) HTTPS/Reverse Proxy (empfohlen)

- Setze vor den Container einen Reverse Proxy (z. B. Caddy, Traefik oder Nginx) auf demselben Host.
- Beispiel Caddyfile (Container hört auf Port 80):
  ```
  music.rtfx.fyi {
    reverse_proxy 127.0.0.1:80
  }
  ```
- Starte den Proxy getrennt (eigenes Compose-Setup oder nativer Dienst), sodass er Ports 80/443 bedient und automatisch TLS-Zertifikate via Let's Encrypt verwaltet.

### 7) Betrieb und Wartung

```bash
sudo docker compose logs -f
sudo docker compose pull && sudo docker compose build && sudo docker compose up -d
sudo docker compose down  # Container stoppen, Daten bleiben erhalten
```

Nach erfolgreichem Start solltest du die Seite über `http://music.rtfx.fyi` bzw. `https://music.rtfx.fyi` (mit Proxy) erreichen.
