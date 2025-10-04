# OrderlyChaos

## Musik-Presets

Lege vorbereitete Audio-Dateien im Ordner `Musik/` ab. Beim Laden der Seite werden alle Einträge aus `Musik/playlist.json` automatisch als Playlist geladen und können sofort abgespielt werden.

### Playlist-Manifest aktualisieren

Führe nach dem Hinzufügen oder Entfernen von Dateien aus dem Ordner `Musik/` den folgenden Befehl aus, um das Manifest zu aktualisieren:

```bash
node scripts/generate-preset-playlist.mjs
```

Das Skript erstellt bzw. aktualisiert `Musik/playlist.json` und ermittelt Dateigröße sowie MIME-Typ. Anschließend stehen die Titel bei der nächsten Aktualisierung der Seite direkt in der App bereit.


## Entwicklung

Installiere Abhängigkeiten und starte die Vite-Entwicklungsumgebung:

```bash
npm install
npm run dev
```

Für einen Produktionsbuild:

```bash
npm run build
```
