# Deployment in einem Proxmox LXC-Container

Diese Anleitung richtet einen schlanken Debian-LXC-Container ein, in dem
`spotify-history-sync` dauerhaft per systemd läuft.

## 1. LXC-Container anlegen

Im Proxmox Web-UI: **Create CT** (oder per CLI, siehe unten).

Empfohlene Werte für diesen leichten Dienst:

- **Template**: Debian 12 (bookworm) – Standard-Container-Template
- **Unprivileged container**: ja (Standard, sicherer)
- **CPU**: 1 Core
- **RAM**: 512 MB (1 GB, falls MariaDB im selben Container laufen soll)
- **Disk**: 4–8 GB
- **Netzwerk**: an dieselbe Bridge (z. B. `vmbr0`) wie euer restliches Netz,
  damit der Container sowohl **Internet** (Spotify-API) als auch die
  **MariaDB** (falls im LAN/anderem Container) erreicht. DHCP oder statische IP.

Per CLI auf dem Proxmox-Host (Beispiel, VMID 200 anpassen):

```bash
pct create 200 local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst \
  --hostname spotify-sync \
  --cores 1 \
  --memory 512 \
  --rootfs local-lvm:4 \
  --net0 name=eth0,bridge=vmbr0,ip=dhcp \
  --unprivileged 1 \
  --onboot 1 \
  --start 1
```

(Template-Name ggf. mit `pveam available` bzw. `pveam list local` prüfen/anpassen.)

## 2. In den Container einloggen

```bash
pct enter 200
```

(oder über die Proxmox-Web-Konsole)

## 3. System vorbereiten

```bash
apt update && apt upgrade -y
apt install -y curl git ca-certificates
```

## 4. Node.js installieren (LTS, Version 20)

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
node --version   # sollte v20.x zeigen
```

## 5. Dedizierten Systemnutzer anlegen

```bash
useradd --system --home /opt/spotify-history-sync --shell /usr/sbin/nologin spotify-sync
mkdir -p /opt/spotify-history-sync
```

## 6. Projekt in den Container bringen

Am einfachsten von deinem Windows-Rechner aus per `scp` (Git Bash/PowerShell mit
OpenSSH), von außerhalb des Containers auf die Proxmox-/Container-IP:

```bash
# Auf deinem Windows-Rechner, im Projektordner ausgeführt:
scp -r . root@<container-ip>:/opt/spotify-history-sync
```

`.env`, `node_modules` und `.git` können dabei ruhig mitkopiert werden (oder
`node_modules` weglassen und im Container neu installieren, siehe Schritt 7).

Alternativ, falls das Projekt in einem Git-Repo liegt:

```bash
# Im Container
su - spotify-sync -s /bin/bash -c "git clone <repo-url> /opt/spotify-history-sync"
```

Danach Besitzrechte setzen:

```bash
chown -R spotify-sync:spotify-sync /opt/spotify-history-sync
```

## 7. Abhängigkeiten installieren

```bash
cd /opt/spotify-history-sync
su - spotify-sync -s /bin/bash -c "cd /opt/spotify-history-sync && npm install --omit=dev"
```

## 8. `.env` prüfen

Falls noch nicht mitkopiert:

```bash
nano /opt/spotify-history-sync/.env
```

Wichtig: `DB_HOST` muss vom Container aus erreichbar sein (IP/Hostname der
MariaDB, nicht `localhost`, außer die DB läuft im selben Container).
Rechte einschränken:

```bash
chown spotify-sync:spotify-sync /opt/spotify-history-sync/.env
chmod 600 /opt/spotify-history-sync/.env
```

## 9. Testlauf

```bash
su - spotify-sync -s /bin/bash -c "cd /opt/spotify-history-sync && npm run sync-once"
```

Sollte die zuletzt gehörten Songs loggen und in `spotify_tracks` speichern.
Bei Verbindungsfehlern zur DB: Netzwerk/Firewall zwischen Container und
DB-Host prüfen (z. B. `nc -zv <db-host> 3306` im Container).

## 10. Als systemd-Dienst dauerhaft einrichten

```bash
cp /opt/spotify-history-sync/deploy/spotify-history.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now spotify-history.service
systemctl status spotify-history.service
```

Logs live verfolgen:

```bash
journalctl -u spotify-history.service -f
```

Der Dienst führt beim Start sofort einen Sync aus und danach stündlich weiter
(`SYNC_CRON` in der `.env`). Bei einem Absturz startet systemd ihn automatisch
neu.

## 11. Container-Autostart sicherstellen

Falls beim Erstellen nicht schon gesetzt:

```bash
# Auf dem Proxmox-Host
pct set 200 --onboot 1
```

Damit startet der Container automatisch mit, wenn der Proxmox-Host neu bootet
– und mit ihm der systemd-Dienst.

## Wartung

- **Update deployen**: neuen Code hochladen (Schritt 6), dann
  `systemctl restart spotify-history.service`.
- **Refresh Token erneut holen** (falls widerrufen): lokal auf deinem
  Rechner `npm run authorize` laufen lassen (siehe Haupt-README), neuen
  `SPOTIFY_REFRESH_TOKEN` in die `.env` im Container eintragen, Dienst neu
  starten.
- **Backup**: normales Proxmox-`vzdump` des Containers reicht, `.env` und
  Code sind darin enthalten.
