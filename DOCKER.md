# 🐳 Docker Compose Setup

Komplette Entwicklungsumgebung mit Docker Compose für den IoT & Voice Orchestrator Server.

## 📋 Übersicht

Die `docker-compose.yml` startet **drei Services**:

| Service | Beschreibung | Ports | Live-Reload |
|---------|--------------|-------|-------------|
| **mongodb** | MongoDB Datenbank | 27017 | - |
| **backend** | NestJS API & WebSocket Server | 3000, 8080 | ✅ |
| **frontend** | Next.js Web-Interface | 3001 | ✅ |

**Wichtig:** Vosk, Piper und n8n sind **NICHT** in der Compose-Datei enthalten - diese laufen extern auf dem Host-System.

## 🚀 Quick Start

### 1. Umgebungsvariablen konfigurieren (Optional)

Erstellen Sie eine `.env` Datei im Hauptverzeichnis (nur für Secrets):

```bash
# .env
JWT_SECRET=my-super-secret-jwt-key
ENCRYPTION_KEY=my-32-char-encryption-key-here
```

**Wichtig:** Externe Services (Vosk, Piper, n8n) werden **NICHT** über `.env` konfiguriert!
- ✅ Service-URLs werden über die **Web-UI** im **Flow-Editor** eingegeben
- 📦 Konfigurationen werden in **MongoDB** gespeichert
- 🔍 Der Server prüft beim Start nur die in der DB gespeicherten URLs

**Hinweis:** Falls keine `.env` Datei existiert, werden Standardwerte für Secrets verwendet.

### 2. Container starten

```bash
# Alle Services starten (im Vordergrund)
docker-compose up

# Oder: Im Hintergrund starten
docker-compose up -d

# Logs anzeigen
docker-compose logs -f

# Nur bestimmte Services starten
docker-compose up mongodb backend
```

### 3. Erstmaliger Start (Build erforderlich)

Beim ersten Start müssen die Images gebaut werden:

```bash
docker-compose up --build
```

### 4. Zugriff auf die Anwendung

| Service | URL | Beschreibung |
|---------|-----|--------------|
| **Frontend** | http://localhost:3001 | Web-Interface |
| **Backend API** | http://localhost:3000/api | REST API |
| **WebSocket** | ws://localhost:8080 | ESP32 Clients |
| **MongoDB** | mongodb://localhost:27017 | Datenbank |

**Login:**
- Benutzername: `admin`
- Passwort: `admin`

## 🔧 Entwicklung mit Live-Reload

### Source-Code Änderungen

Alle Änderungen am Source-Code werden **automatisch erkannt**:

```bash
# Backend ändern
backend/src/modules/...
  ↓
  NestJS erkennt Änderung → Automatischer Neustart

# Frontend ändern  
frontend/src/app/...
  ↓
  Next.js erkennt Änderung → Hot-Module-Replacement
```

### Dependencies hinzufügen

Wenn Sie neue Dependencies hinzufügen, müssen Sie die Container neu bauen:

```bash
# Backend: package.json geändert
cd backend
npm install neues-paket

# Container neu bauen
docker-compose up --build backend

# ODER: Manuell im Container installieren (temporär)
docker-compose exec backend npm install neues-paket
```

## 🌐 Externe Services (Vosk, Piper, n8n)

### Warum NICHT in Docker Compose?

Die externen Services (Vosk, Piper, n8n) sind **bewusst nicht** in der `docker-compose.yml` enthalten, weil:

1. **Flexibilität:** Sie können unterschiedliche Versionen/Konfigurationen testen
2. **Ressourcen:** Diese Services sind ressourcenintensiv (GPU, große Models)
3. **Unabhängigkeit:** Der Server startet auch ohne diese Services (nur mit Warnung)

### Externe Services auf Host starten

#### Option 1: Docker (separater Container)

```bash
# Vosk STT
docker run -d --name vosk -p 2700:2700 alphacep/kaldi-de:latest

# Piper TTS
docker run -d --name piper -p 5000:5000 rhasspy/piper:latest

# n8n Workflow
docker run -d --name n8n -p 5678:5678 n8nio/n8n:latest
```

#### Option 2: Lokale Installation

```bash
# Vosk: Python-Server starten
python vosk_server.py --port 2700

# Piper: HTTP-Server starten
piper --port 5000

# n8n: Node.js starten
npx n8n start --port 5678
```

### Verbindung zum Host-System

Das Backend kann externe Services über **`host.docker.internal`** erreichen:

```bash
# KEINE .env-Konfiguration nötig!
# Stattdessen: URLs im Flow-Editor eingeben

# Beispiel für STT Node im Flow-Editor:
Service-URL: ws://host.docker.internal:2700

# Beispiel für TTS Node im Flow-Editor:
Service-URL: http://host.docker.internal:5000

# Beispiel für AI Node im Flow-Editor:
Webhook-URL: http://host.docker.internal:5678/webhook/...
```

**Workflow:**
1. 🚀 Server starten (ohne externe Services)
2. 🎨 Flow im Editor erstellen
3. ⚙️ Node-Konfiguration öffnen
4. 📝 Service-URL eingeben (z.B. `ws://host.docker.internal:2700`)
5. 🔍 "Test Connection" klicken
6. 💾 Flow speichern
7. ▶️ Flow starten

**Linux-Hinweis:** `host.docker.internal` wird automatisch via `extra_hosts` in `docker-compose.yml` gesetzt.

## 🛠️ Nützliche Befehle

### Container verwalten

```bash
# Status anzeigen
docker-compose ps

# Services neu starten
docker-compose restart

# Services stoppen
docker-compose stop

# Services stoppen UND entfernen
docker-compose down

# Services + Volumes entfernen (ACHTUNG: Löscht MongoDB-Daten!)
docker-compose down -v

# Logs anzeigen (Console-Output)
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb

# Log-Dateien direkt lesen (persistente Logs)
tail -f backend/logs/app-$(date +%Y-%m-%d).log
```

### In Container einsteigen

```bash
# Backend Shell
docker-compose exec backend sh

# Frontend Shell
docker-compose exec frontend sh

# MongoDB Shell
docker-compose exec mongodb mongosh
```

### Dependencies aktualisieren

```bash
# Backend Dependencies neu installieren
docker-compose exec backend npm ci

# Frontend Dependencies neu installieren
docker-compose exec frontend npm ci

# Oder: Container neu bauen
docker-compose up --build
```

### Datenbank-Backup

```bash
# MongoDB exportieren
docker-compose exec mongodb mongodump --db iot-orchestrator --out /tmp/backup

# Backup vom Container kopieren
docker cp iot-orchestrator-mongodb:/tmp/backup ./mongodb-backup

# Backup wiederherstellen
docker cp ./mongodb-backup iot-orchestrator-mongodb:/tmp/backup
docker-compose exec mongodb mongorestore /tmp/backup
```

## 📝 Logging

### Log-Dateien

Das Backend schreibt Logs in **zwei Formate**:

1. **Console-Output** (Docker-Logs): Farbig, entwicklerfreundlich
2. **File-Output** (`backend/logs/`): Strukturiert, persistent

**Log-Verzeichnis:**
```bash
backend/logs/
├── app-2025-10-20.log  # Heutiges Log
├── app-2025-10-19.log  # Gestriges Log
└── app-2025-10-18.log  # Vorletztes Log
```

**Wichtig:**
- Das Volume `./backend/logs:/app/logs` ist in `docker-compose.yml` gemappt
- Logs sind persistent (bleiben nach Container-Neustart erhalten)
- Logs werden täglich rotiert (neue Datei pro Tag)
- Alte Logs werden nach 14 Tagen automatisch gelöscht
- `FILE_LOGGING=true` ist gesetzt (in docker-compose.yml)

### Logs ansehen

**Option 1: Docker-Logs (Console-Output)**
```bash
# Live-Logs anzeigen
docker-compose logs -f backend

# Letzte 100 Zeilen
docker-compose logs --tail 100 backend

# Nur Fehler anzeigen
docker-compose logs backend | grep -i error
```

**Option 2: Log-Dateien (File-Output)**
```bash
# Live-Tail auf heutige Log-Datei
tail -f backend/logs/app-$(date +%Y-%m-%d).log

# Alle Logs anzeigen
cat backend/logs/app-*.log

# Nach Fehlern suchen
grep -i error backend/logs/app-*.log

# Nach Level filtern
grep " warn " backend/logs/app-$(date +%Y-%m-%d).log
grep " error " backend/logs/app-$(date +%Y-%m-%d).log
```

**Option 3: Web-UI (Frontend)**
```bash
# Im Browser öffnen: http://localhost:3001/logs
# → Auto-Refresh alle 5 Sekunden
# → Filter nach Level (error, warn, info, debug)
# → Suche in Log-Nachrichten
# → Zeigt die letzten 200 Einträge
```

### Log-Format

```
YYYY-MM-DD HH:mm:ss LEVEL [CONTEXT] Message {"meta":"data"}
```

**Beispiele:**
```
2025-10-20 17:22:42 info [Global] Server successfully started
2025-10-20 17:22:42 warn [FlowEngine] Flow not found {"flowId":"abc123"}
2025-10-20 17:22:42 error [WebSocketGateway] Connection failed {"clientId":"esp32_001"}
2025-10-20 17:22:42 debug [STTNode] Processing audio chunk {"size":1024}
```

### Log-Konfiguration

In `docker-compose.yml`:
```yaml
environment:
  - FILE_LOGGING=true      # Aktiviert File-Logging
  - LOG_LEVEL=info         # oder: error, warn, debug
```

**Log-Levels:**
- `error` - Fehler und Exceptions
- `warn` - Warnungen
- `info` - Allgemeine Informationen (Standard)
- `debug` - Debug-Informationen (nur in Development)

### Logs-API

Das Backend stellt eine REST-API für Logs bereit:

```bash
# Alle Logs (max. 100)
curl http://localhost:3000/api/logs

# Mit Level-Filter
curl http://localhost:3000/api/logs?level=error

# Mit Pagination
curl http://localhost:3000/api/logs?limit=50&offset=0
```

**Response:**
```json
{
  "logs": [
    {
      "timestamp": "2025-10-20 17:22:42",
      "level": "info",
      "message": "Server started",
      "context": "Global",
      "meta": {}
    }
  ],
  "total": 42
}
```

## 🐛 Troubleshooting

### Problem: "Cannot connect to MongoDB"

**Lösung:**
```bash
# MongoDB-Container prüfen
docker-compose ps mongodb

# Logs anzeigen
docker-compose logs mongodb

# Health-Check manuell
docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')"
```

### Problem: "Port already in use"

**Lösung:**
```bash
# Prüfen welcher Prozess Port 3000 verwendet
lsof -i :3000

# Port in docker-compose.yml ändern
ports:
  - "3002:3000"  # Statt 3000:3000
```

### Problem: "node_modules not found"

**Lösung:**
```bash
# Container neu bauen (Dependencies werden installiert)
docker-compose up --build

# Oder: Manuell installieren
docker-compose exec backend npm ci
docker-compose exec frontend npm ci
```

### Problem: "Changes not reflected (no live-reload)"

**Lösung:**
```bash
# Prüfen ob Volumes korrekt gemappt sind
docker-compose config

# Container neu starten
docker-compose restart backend frontend

# Oder: Hard-Rebuild
docker-compose down
docker-compose up --build
```

### Problem: "Cannot reach Vosk/Piper from Backend"

**Ursachen:**
1. Service läuft nicht auf Host-System
2. Falsche URL in Node-Konfiguration (Web-UI)
3. Firewall blockiert Verbindung
4. `host.docker.internal` funktioniert nicht (Linux-Problem)

**Lösung:**
```bash
# 1. Prüfen ob Service auf Host läuft
curl http://localhost:5000  # Piper
wscat -c ws://localhost:2700  # Vosk

# 2. Von Backend-Container aus testen
docker-compose exec backend curl http://host.docker.internal:5000
docker-compose exec backend curl http://host.docker.internal:2700

# 3. Linux: Alternative (host-gateway) prüfen
docker-compose exec backend cat /etc/hosts | grep host.docker.internal

# 4. Node-Konfiguration in Web-UI prüfen
# → Flow-Editor → Node auswählen → Konfiguration → Service-URL
# → "Test Connection" klicken

# 5. Logs des Backend-Containers prüfen
docker-compose logs backend | grep -i "vosk\|piper\|n8n"
```

**Hinweis:** Service-URLs werden NICHT mehr über `.env` konfiguriert, sondern über die Web-UI!

### Problem: "Logs werden nicht angezeigt"

**Ursachen:**
1. Log-Dateien existieren nicht
2. Volume-Mapping fehlt in docker-compose.yml
3. FILE_LOGGING nicht aktiviert
4. Falsches Log-Format (Parser erkennt nicht)

**Lösung:**
```bash
# 1. Prüfen ob Log-Dateien existieren
ls -lh backend/logs/

# 2. Prüfen ob Volume gemappt ist
docker inspect iot-orchestrator-backend | grep -A5 "Mounts"

# 3. Prüfen ob FILE_LOGGING gesetzt ist
docker-compose exec backend env | grep FILE_LOGGING

# 4. Backend neu erstellen (Volume-Mapping übernehmen)
docker-compose up -d --force-recreate backend

# 5. Web-UI testen
# → http://localhost:3001/logs
# → Sollte jetzt Logs anzeigen

# 6. API direkt testen
curl http://localhost:3000/api/logs | jq
```

**Wichtig:**
- Das Volume `./backend/logs:/app/logs` muss in `docker-compose.yml` vorhanden sein
- Nach Änderungen an docker-compose.yml: `docker-compose up -d --force-recreate`
- Logs werden erst geschrieben wenn `FILE_LOGGING=true` oder `NODE_ENV=production`

## 🔐 Sicherheit

### Entwicklungsumgebung

Die aktuelle Konfiguration ist für **Entwicklung** optimiert:

- ⚠️ Standardpasswörter für Admin-Login
- ⚠️ Keine MongoDB-Authentifizierung
- ⚠️ Keine SSL/TLS-Verschlüsselung
- ⚠️ Exposed Ports (3000, 8080, 27017)

### Produktion

Für Production-Deployment:

1. **Nginx Reverse Proxy** verwenden (siehe `nginx.conf.example`)
2. **SSL/TLS** mit Let's Encrypt einrichten
3. **MongoDB-Authentifizierung** aktivieren
4. **Starke Secrets** in `.env` setzen
5. **Firewall-Regeln** für Ports einrichten
6. **Production-Dockerfile** verwenden (ohne node_modules-Volume)

## 📊 Performance

### Ressourcen-Verbrauch

| Service | CPU | RAM | Disk |
|---------|-----|-----|------|
| MongoDB | ~5% | ~100MB | ~500MB |
| Backend | ~10% | ~200MB | ~300MB |
| Frontend | ~15% | ~250MB | ~500MB |
| **Gesamt** | ~30% | ~550MB | ~1.3GB |

### Optimierungen

```bash
# Build-Cache nutzen (schnellere Rebuilds)
docker-compose build --parallel

# Nur geänderte Services neu starten
docker-compose up -d --no-deps backend

# Alte Images aufräumen
docker image prune -a
```

## 📚 Weitere Informationen

- **Hauptdokumentation:** [README.md](./README.md)
- **Node-Dokumentation:** [NODES.md](./NODES.md), [ADVANCED_NODES.md](./ADVANCED_NODES.md)
- **Nginx-Konfiguration:** [nginx.conf.example](./nginx.conf.example)
- **Quick-Start:** [QUICKSTART.md](./QUICKSTART.md)

## 🎯 Best Practices

### Development Workflow

```bash
# 1. Änderungen am Code machen
vim backend/src/modules/...

# 2. Automatisch neu laden (Live-Reload)
#    → Keine Aktion nötig!

# 3. Logs im Blick behalten
docker-compose logs -f backend

# 4. Bei größeren Änderungen: Container neu starten
docker-compose restart backend

# 5. Abends: Alles herunterfahren
docker-compose down
```

### Git-Workflow

```bash
# Vor jedem Commit: Container testen
docker-compose up -d
# ... Tests durchführen ...
docker-compose down

# .env NICHT committen (in .gitignore)
git add docker-compose.yml
git commit -m "Add Docker Compose setup"
```

## ✅ Checkliste: Erste Schritte

- [ ] `.env` Datei erstellen (optional)
- [ ] Externe Services starten (Vosk/Piper, optional)
- [ ] `docker-compose up --build` ausführen
- [ ] http://localhost:3001 öffnen
- [ ] Login mit `admin/admin`
- [ ] Ersten Flow erstellen
- [ ] ESP32-Client verbinden

🎉 **Fertig!** Das System läuft jetzt vollständig in Docker.

