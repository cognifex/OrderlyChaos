# OrderlyChaos

## Musik-Presets

Lege vorbereitete Audio-Dateien im Ordner `Musik/` ab. Beim Laden der Seite werden alle Einträge aus `Musik/playlist.json` automatisch als Playlist geladen und können sofort abgespielt werden.

### Playlist-Manifest aktualisieren

Führe nach dem Hinzufügen oder Entfernen von Dateien aus dem Ordner `Musik/` den folgenden Befehl aus, um das Manifest zu aktualisieren:

```bash
node scripts/generate-preset-playlist.mjs
```

Das Skript erstellt bzw. aktualisiert `Musik/playlist.json` und ermittelt Dateigröße sowie MIME-Typ. Anschließend stehen die Titel bei der nächsten Aktualisierung der Seite direkt in der App bereit.


## Lokaler Test ohne Build

Die Anwendung ist vollständig modularisiert und kann ohne Vite-Bundling direkt über `index.html` geladen werden. Starte einen
beliebigen statischen HTTP-Server im Projektverzeichnis (z. B. mit `npx serve .` oder `python -m http.server`) und öffne
anschließend `http://localhost:<port>/index.html` im Browser. Alle Module werden über relative Pfade geladen, sodass die Seite
auch auf GitHub Pages ohne Anpassungen lauffähig ist.

## Entwicklung & Linting

Für lokale Qualitätschecks oder wenn neue Vendor-Dateien aus `node_modules` übernommen werden sollen, können weiterhin die npm
Skripte genutzt werden:

```bash
npm ci
npm run lint
```

Optional steht die Vite-Entwicklungsumgebung für schnellere Iterationen bereit:

```bash
npm run dev
```

Ein Produktionsbuild über Vite ist nicht mehr erforderlich, kann aber bei Bedarf weiterhin mit `npm run build` erzeugt werden.

### Vendor-Dateien aktualisieren

Die Anwendung lädt Three.js als ES-Module direkt aus `src/vendor`. Wenn eine neue Version von `three` benötigt wird, führe nach
einem `npm ci` den folgenden Kopiervorgang aus, um die Dateien zu aktualisieren:

```bash
cp node_modules/three/build/three.{core,module}.js src/vendor/
```

Das stellt sicher, dass sowohl `three.module.js` als auch die zugehörige `three.core.js` für den statischen Import über relative
Pfade verfügbar sind.
