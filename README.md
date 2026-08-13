# Spotify History Sync

Holt stündlich per Cron die zuletzt gehörten Spotify-Songs ab (`/me/player/recently-played`)
und speichert neue Songs in einer MariaDB-Tabelle (`spotify_tracks`). Ersetzt den bisherigen
n8n-Workflow.

## Funktionsweise

- Beim Start und danach nach dem Cron-Zeitplan (`SYNC_CRON`, Standard stündlich) wird geprüft,
  welcher `played_at`-Zeitstempel zuletzt in der DB gespeichert wurde.
- Von Spotify werden nur Songs abgerufen, die **danach** gespielt wurden (`after`-Parameter).
  Falls seit dem letzten Lauf mehr als 50 Songs gehört wurden, wird automatisch paginiert.
- Neue Songs werden per `INSERT IGNORE` gespeichert. Der bestehende Unique Key
  `(track_id, played_at)` verhindert Duplikate, falls sich Zeiträume überschneiden.
- Läuft der Access Token ab, wird er automatisch über den Refresh Token erneuert.

## Setup

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. `.env` anlegen

```bash
cp .env.example .env
```

Werte eintragen:

- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`: aus deiner Spotify App
  (developer.spotify.com/dashboard).
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_TABLE`: Zugangsdaten
  zu deiner MariaDB (Tabelle `spotify_tracks` muss bereits existieren, siehe
  `deploy/spotify_tracks.sql`).
- `SPOTIFY_REFRESH_TOKEN`: bleibt zunächst leer, siehe Schritt 3.

### 3. Refresh Token holen (einmalig)

Im Spotify Dashboard bei deiner App unter "Redirect URIs" folgende URL eintragen:

```
http://127.0.0.1:8888/callback
```

Dann:

```bash
npm run authorize
```

Den ausgegebenen Link im Browser öffnen und mit dem gewünschten Spotify-Account einloggen.
Nach der Bestätigung wird `SPOTIFY_REFRESH_TOKEN` automatisch in die `.env` geschrieben.
Läuft die App später auf dem V-Server ohne Browser, diesen Schritt einmalig lokal
ausführen und den fertigen `SPOTIFY_REFRESH_TOKEN`-Wert aus der `.env` auf den Server
übertragen.

### 4. Testlauf (einmalig, ohne Dauerbetrieb)

```bash
npm run sync-once
```

Prüfen, ob neue Zeilen in `spotify_tracks` auftauchen und ob die Logs plausibel aussehen.

### 5. Dauerbetrieb auf dem V-Server (systemd)

Für ein komplettes Setup in einem eigenen Proxmox LXC-Container siehe
[`deploy/PROXMOX_SETUP.md`](deploy/PROXMOX_SETUP.md) (inkl. Container
anlegen, Node.js installieren, Deployment, systemd-Dienst).

Allgemeine Schritte (gelten für jeden Linux-Server):

```bash
sudo useradd --system --home /opt/spotify-history-sync --shell /usr/sbin/nologin spotify-sync
sudo mkdir -p /opt/spotify-history-sync
# Projekt nach /opt/spotify-history-sync kopieren (inkl. node_modules oder dort npm install ausführen)
sudo chown -R spotify-sync:spotify-sync /opt/spotify-history-sync

sudo cp deploy/spotify-history.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now spotify-history.service
sudo systemctl status spotify-history.service
journalctl -u spotify-history.service -f
```

Die App läuft dann dauerhaft, führt beim Start sofort einen Sync aus und danach stündlich
weiter. Bei einem Absturz startet systemd den Dienst automatisch neu (`Restart=on-failure`).

## Konfigurierbar über `.env`

| Variable | Beschreibung | Standard |
|---|---|---|
| `SYNC_CRON` | Cron-Ausdruck für den Sync-Intervall | `0 * * * *` (stündlich) |
| `TZ` | Zeitzone für die Cron-Auswertung | Systemstandard |

## Troubleshooting

- **401 beim Token-Refresh**: Refresh Token ungültig/widerrufen — neu über den
  Spotify-OAuth-Flow (Authorization Code) mit Scope `user-read-recently-played` erzeugen.
- **Keine neuen Songs trotz Musikhören**: `played_at` in der DB prüfen (`SELECT MAX(played_at)
  FROM spotify_tracks`) und mit der aktuellen Zeit vergleichen — ggf. `SYNC_CRON` verkürzen.
