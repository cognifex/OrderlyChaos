#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const musikDir = path.resolve(__dirname, '..', 'Musik');
const manifestPath = path.join(musikDir, 'playlist.json');

async function main() {
  try {
    const entries = await fs.readdir(musikDir, { withFileTypes: true });
    const tracks = [];
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      const ext = path.extname(entry.name).toLowerCase();
      if (!['.mp3', '.wav', '.ogg', '.flac', '.m4a', '.aac'].includes(ext)) {
        continue;
      }
      const filePath = path.join(musikDir, entry.name);
      const stats = await fs.stat(filePath);
      tracks.push({
        src: `Musik/${entry.name}`,
        name: entry.name.replace(/_/g, ' '),
        size: stats.size,
        type: guessMimeType(ext)
      });
    }

    const manifest = {
      generatedAt: new Date().toISOString(),
      tracks: tracks.sort((a, b) => a.name.localeCompare(b.name, 'de'))
    };

    await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    console.log(`Schreibe ${manifest.tracks.length} Einträge nach ${path.relative(process.cwd(), manifestPath)}`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error('Ordner "Musik" nicht gefunden. Bitte zuerst anlegen.');
      process.exit(1);
    }
    console.error('Konnte Preset-Playlist nicht erzeugen:', error);
    process.exit(1);
  }
}

function guessMimeType(ext) {
  switch (ext) {
    case '.mp3':
      return 'audio/mpeg';
    case '.wav':
      return 'audio/wav';
    case '.ogg':
      return 'audio/ogg';
    case '.flac':
      return 'audio/flac';
    case '.m4a':
      return 'audio/mp4';
    case '.aac':
      return 'audio/aac';
    default:
      return 'audio/mpeg';
  }
}

main();
