# IoT & Voice Orchestrator Server

Eine zentrale, visuelle Anwendung (ähnlich Node-RED) zur Orchestrierung von IoT-Clients (ESP32) und externen KI-Diensten (STT, TTS, Workflow) über WebSockets.

## 🎯 Features

### Core-Funktionalität
- ✅ **WebSocket-Server** mit binärem Streaming-Protokoll für ESP32-Clients
- ✅ **Universal Stream Object (USO)** für einheitliche Datenströme
- ✅ **Flow-Engine** mit Event-basierter Architektur
- ✅ **Visueller Flow-Editor** mit React Flow
  - Drag & Drop für Nodes von Toolbar auf Canvas
  - Intelligente Verbindungsvalidierung nach Datentypen (Audio/Text)
  - Node-spezifische Input/Output-Handles
  - Edge-Management (Auswahl, Löschen mit Delete-Taste)
  - Icons auf Canvas-Nodes für bessere Übersicht
  - Verbesserte Handle-Sichtbarkeit mit Glow-Effekten
- ✅ **Node-System** mit modularen, erweiterbaren Nodes
- ✅ **Authentifizierung** für Admin-UI und ESP32-Clients
- ✅ **Secret-Management** mit AES-256 Verschlüsselung
- ✅ **MongoDB** für Persistenz von Flows, Geräten und Secrets
- ✅ **Winston-Logging** mit strukturiertem JSON-Format und Live-Log-Viewer
- ✅ **Dark Mode** mit automatischer System-Erkennung im gesamten Frontend
- ✅ **Nginx-Ready** für Production-Deployment
- ✅ **Web-UI Konfiguration** für alle externen Services (keine .env-Variablen nötig)
- ✅ **Server-Verwaltung** - Zentrale Verwaltung von Vosk, Piper und Flowise-Servern in Einstellungen
- ✅ **Direkte Node-Konfiguration** - Server direkt in Node-Panels hinzufügen, bearbeiten und testen
- ✅ **Toast-Benachrichtigungen** - Moderne Benachrichtigungen statt Browser-Popups
- ✅ **Confirm-Dialoge** - Elegante Bestätigungsdialoge für kritische Aktionen
- ✅ **Debug Events System** - Live-Monitoring aller Debug-Node-Ausgaben im Flow-Editor
  - WebSocket-basierte Echtzeit-Events (Port 8082)
  - 3 Ansichtsmodi: Kompakt, Detailliert, JSON
  - Filterung nach Datentyp, Flow-spezifisch
  - Vollständige Text-Preview und Context-Anzeige
- ✅ **Context-Informationen** - Metadaten-System für personalisierte KI-Interaktionen
  - Zeit (automatisch), Person, Location, Client-Name in jedem USO
  - Konfigurierbare Weitergabe pro WS_In Node (aktiviert/deaktiviert)
  - Automatische Weitergabe durch die gesamte Pipeline
  - Sichtbar in Debug Events und Logs
  - Opt-out Modell: Kann bei Bedarf deaktiviert werden (z.B. für Privacy oder Token-Optimierung)
- ✅ **Flow-Status-Management** - Start/Stop Buttons und Live-Status im Flow-Editor
  - Start/Stop Button direkt im Editor (oben rechts)
  - Live Status-Anzeige mit pulsierendem Badge
  - Automatische Status-Synchronisation zwischen Editor und Flow-Liste
  - Tab-Fokus-Erkennung für Status-Updates

### Verfügbare Nodes

**Datenquellen (nur Output):**
- ✅ **Mikrofon Node:** Empfängt Audio von ESP32-Client → Output: Audio
- ✅ **WebSocket In Node:** Empfängt Daten von externen WebSocket-Clients → Output: Audio/Text/Raw (konfigurierbar)

**Datenverarbeitung (Input + Output):**
- ✅ **STT Node:** Speech-to-Text mit Vosk → Input: Audio, Output: Text
- ✅ **AI Node:** KI-Verarbeitung mit Flowise AI-Engine **mit Echtzeit-Streaming** ⚡ → Input: Text, Output: Text
  - Token-für-Token Ausgabe wie ChatGPT
  - Start-to-First-Token: < 1 Sekunde
  - Unterstützt Flowise Server-Sent Events (SSE)
- ✅ **TTS Node:** Text-to-Speech mit Piper → Input: Text, Output: Audio

**Datenziele (nur Input):**
- ✅ **Speaker Node:** Sendet Audio an ESP32-Client ← Input: Audio
- ✅ **Debug Node:** Zeigt USO-Datenströme im Log an ← Input: Any (akzeptiert alle Typen)
- ✅ **WebSocket Out Node:** Sendet Daten an externe WebSocket-Server ← Input: Audio/Text/Raw (konfigurierbar)
  - **Content-Only Modus** für minimalen Overhead (perfekt für Streaming!)
  - Health-Status mit Reconnect-Anzeige
  - Automatisches Cleanup (keine "Zombie-Connections" mehr)

> **Hinweis:** Detaillierte Informationen zur API und Funktionsweise der externen Services (Vosk, Piper, Flowise) finden Sie in der [SERVICES.md](./SERVICES.md).

## 🏗️ Architektur

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx Reverse Proxy                   │
│              (SSL/TLS, WebSocket-Tunneling)              │
└──────────────┬─────────────────────┬────────────────────┘
               │                     │
         ┌─────▼─────┐         ┌─────▼─────┐
         │  Frontend │◄────────│  Backend  │
         │ (Next.js) │  8082   │ (NestJS)  │
         │  Port 3001│ Debug   │  Port 3000│
         └───────────┘ Events  └─────┬─────┘
                                     │
                ┌────────────────────┼────────────────────┐
                │                    │                    │
          ┌─────▼─────┐      ┌──────▼──────┐     ┌──────▼──────┐
          │ WebSocket │      │  MongoDB    │     │  External   │
          │  Devices  │      │  Database   │     │  Services   │
          │ Port 8080 │      │             │     │ (STT/TTS/AI)│
          └─────┬─────┘      └─────────────┘     └─────────────┘
                │
         ┌──────▼──────┐
         │ ESP32 Clients│
         │ (IoT Devices)│
         └─────────────┘
                                ┌──────────────┐
                                │  WS_In Nodes │
                                │  Port 8081+  │
                                │ (External WS)│
                                └──────────────┘
```

### 🔌 Ports & Verbindungen

| Port | Service | Zweck | Protokoll |
|------|---------|-------|-----------|
| **3000** | Backend HTTP/API | REST API für Flows, Devices, Settings | HTTP |
| **3001** | Frontend | Next.js Web-UI | HTTP |
| **8080** | WebSocket (Devices) | ESP32-Clients, Bidirektionale Kommunikation | WebSocket |
| **8081+** | WS_In Nodes | Externe WebSocket-Eingänge (konfigurierbar pro Node) | WebSocket |
| **8082** | Debug Events | Live Debug-Events für Frontend | WebSocket |
| **27017** | MongoDB | Datenbank (nur intern in Docker) | MongoDB Protocol |

## 📁 Projekt-Struktur

```
Server_anwendung/
├── backend/                    # NestJS Backend
│   ├── src/
│   │   ├── common/            # Logger, Encryption Utils
│   │   ├── types/             # USO, INode Interfaces
│   │   ├── modules/
│   │   │   ├── auth/          # Authentifizierung & Secrets
│   │   │   ├── devices/       # WebSocket-Server & Devices
│   │   │   ├── flow-core/     # Flow-Engine & Management
│   │   │   └── nodes/         # Node-Implementierungen
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── package.json
│   └── README.md
│
├── frontend/                   # Next.js Frontend
│   ├── src/
│   │   ├── app/               # Next.js Pages
│   │   │   ├── login/
│   │   │   ├── flows/
│   │   │   │   └── editor/    # Flow-Editor
│   │   │   ├── devices/
│   │   │   ├── logs/
│   │   │   └── settings/
│   │   ├── components/
│   │   │   ├── Layout.tsx
│   │   │   └── flow-editor/   # React Flow Komponenten
│   │   └── lib/
│   │       ├── api.ts         # API-Client
│   │       └── websocket.ts   # WebSocket-Client
│   ├── package.json
│   └── README.md
│
├── nginx.conf.example          # Nginx-Konfiguration
└── README.md                   # Diese Datei
```

## 🚀 Quick Start

### Voraussetzungen

- Node.js >= 18
- MongoDB >= 6.0
- npm oder yarn

**ODER** verwenden Sie Docker Compose (empfohlen):

- Docker >= 20.10
- Docker Compose >= 2.0

### 🐳 Option A: Docker Compose (Empfohlen)

**Schnellster Weg** - Alles mit einem Befehl starten:

```bash
# Repository klonen
git clone <repository-url>
cd Server_anwendung

# .env erstellen (optional, nur für Secrets nötig)
cat > .env << EOF
JWT_SECRET=dev-jwt-secret-change-in-production
ENCRYPTION_KEY=dev-encryption-key-must-be-32-chars-long
EOF

# HINWEIS: Externe Services (Vosk, Piper, Flowise) werden NICHT über .env
# konfiguriert, sondern über die Web-UI (Einstellungen & Node-Konfiguration)!

# Alles starten (MongoDB, Backend, Frontend)
docker-compose up --build

# Oder im Hintergrund:
docker-compose up -d --build
```

**Das war's!** 🎉
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000/api
- WebSocket: ws://localhost:8080

**Hinweis:** Vosk, Piper und Flowise müssen separat gestartet werden (optional). Server werden zentral unter **Einstellungen** verwaltet oder direkt in Node-Konfigurationen hinzugefügt!

📖 **Vollständige Docker-Anleitung:** [DOCKER.md](./DOCKER.md)

---

### 💻 Option B: Manuelle Installation

### 1. Repository klonen

```bash
git clone <repository-url>
cd Server_anwendung
```

### 2. Backend einrichten

```bash
cd backend

# Dependencies installieren
npm install

# .env erstellen und anpassen
cp .env.example .env

# WICHTIG: Encryption-Key setzen (mind. 32 Zeichen)
# ENCRYPTION_KEY=your-secure-32-char-key-here

# MongoDB starten (falls lokal)
# mongod --dbpath /path/to/data

# Backend starten
npm run start:dev
```

Backend läuft auf:
- HTTP API: http://localhost:3000/api
- WebSocket (ESP32): ws://localhost:8080
- WebSocket (Debug Events): ws://localhost:8082

### 3. Frontend einrichten

```bash
cd frontend

# Dependencies installieren
npm install

# .env.local erstellen
cp .env.local.example .env.local

# Anpassen falls nötig:
# NEXT_PUBLIC_API_URL=http://localhost:3000/api
# NEXT_PUBLIC_WS_URL=ws://localhost:8080

# Frontend starten
npm run dev
```

Frontend läuft auf: http://localhost:3001

### 4. Erstes Login

```
URL: http://localhost:3001/login
Benutzername: admin
Passwort: admin (oder der Wert aus ADMIN_PASSWORD in .env)
```

## 🔍 Startup-Checks & Betriebssicherheit

Der Server führt beim Start automatische Sicherheitsprüfungen durch, um einen zuverlässigen Betrieb zu gewährleisten.

### Dreistufiger Startup-Prozess

#### ✅ Stage 1: Dependency Check (KRITISCH)
- **Wird ausgeführt:** VOR dem NestJS Bootstrap
- **Prüft:**
  - Existenz des `node_modules` Ordners
  - Vorhandensein kritischer Dependencies (@nestjs/core, mongoose, ws, winston)
- **Bei Fehler:** Server startet NICHT
- **Aktion:** Klare Fehlermeldung mit Anweisung `npm install` auszuführen

#### ✅ Stage 2: MongoDB Connection (KRITISCH)
- **Wird ausgeführt:** NACH NestJS Bootstrap, VOR dem Start des HTTP-Servers
- **Prüft:**
  - Verbindung zur MongoDB-Datenbank (10 Sekunden Timeout)
  - Korrektheit der Connection-URI
- **Bei Fehler:** Server startet NICHT
- **Aktion:** Klare Fehlermeldung mit Setup-Anweisungen für MongoDB

#### ✅ Stage 3: Optional Services Check (NUR WARNUNG)
- **Wird ausgeführt:** NACH MongoDB-Check
- **Prüft:**
  - Vosk STT Service (nur wenn bereits in MongoDB konfiguriert)
  - Piper TTS Service (nur wenn bereits in MongoDB konfiguriert)
  - Flowise AI Engine (nur wenn bereits in MongoDB konfiguriert)
- **Intelligente Prüfung:** Wenn keine Flows existieren oder keine Services konfiguriert sind, wird die Prüfung übersprungen
- **Bei Fehler:** Server startet TROTZDEM
- **Aktion:** Warnung im Log, betroffene Nodes funktionieren nicht

### Beispiel: Erfolgreicher Start (Erstmaliger Start, keine Flows)

```
🔍 Stage 1: Checking dependencies...
✅ All dependencies are installed
✅ Stage 1 complete

[Nest] 12345 - LOG [NestFactory] Starting Nest application...
...

🔍 Stage 3: Checking external services (from MongoDB)...
✅ MongoDB connection successful
💡 No flows configured yet. Skipping optional service checks.

✅ Stage 3 complete

🚀 Backend server running on http://localhost:3000
📡 API available at http://localhost:3000/api
🔌 WebSocket server on port 8080
```

### Beispiel: Start mit konfigurierten Services

```
🔍 Stage 3: Checking external services (from MongoDB)...
✅ MongoDB connection successful

Found configured services:
  - Vosk: 1 URL
  - Piper: 1 URL
  - Flowise: 1 URL

✅ Vosk service reachable (ws://localhost:2700)
✅ Piper service reachable (ws://localhost:5002)
✅ Flowise service reachable (https://flowise.example.com)
✅ Reachable services (3): Vosk, Piper, Flowise

✅ All configured external services are reachable
✅ Stage 3 complete

🚀 Backend server running on http://localhost:3000
```

### Beispiel: Fehlgeschlagener Start (MongoDB fehlt)

```
🔍 Stage 1: Checking dependencies...
✅ All dependencies are installed
✅ Stage 1 complete

[Nest] 12345 - LOG [NestFactory] Starting Nest application...

🔍 Stage 3: Checking external services...
❌ MongoDB connection failed

================================================================================
🚨 STARTUP ERROR
================================================================================

CRITICAL: Cannot connect to MongoDB!

Error: connect ECONNREFUSED 127.0.0.1:27017
URI: mongodb://localhost:27017/iot-orchestrator

💡 MongoDB is not running. Please start MongoDB:

   Option 1 - Homebrew (macOS):
      brew services start mongodb-community

   Option 2 - Docker:
      docker run -d --name mongodb -p 27017:27017 mongo:latest

   Option 3 - Manual:
      mongod --dbpath /path/to/data

================================================================================
```

### Konfiguration der Checks

Alle Checks sind **fest implementiert** und können nicht deaktiviert werden.

**MongoDB (KRITISCH):**
```bash
# In .env oder als Umgebungsvariable
MONGODB_URI=mongodb://localhost:27017/iot-orchestrator
```

**Externe Services (OPTIONAL):**
- ✅ **Keine .env-Konfiguration mehr nötig!**
- 🎨 Service-URLs werden über die **Web-UI** im **Flow-Editor** konfiguriert
- 📦 Konfigurationen werden in **MongoDB** gespeichert (Teil der Node-Konfiguration)
- 🔍 Startup-Checks prüfen **nur** die in der Datenbank gespeicherten URLs
- ⚡ **Schnellerer Start** wenn keine Services konfiguriert sind (keine unnötigen Checks)

**Logging:**
- 📝 Logs werden in **Dateien** geschrieben (nicht in MongoDB)
- 📂 Speicherort: `backend/logs/app-YYYY-MM-DD.log`
- 🔄 Automatische tägliche Rotation
- 🗑️ Alte Logs werden nach 14 Tagen gelöscht
- ⚙️ Aktivierung: `FILE_LOGGING=true` (Docker) oder `NODE_ENV=production`

## 📖 Verwendung

### Web-UI Features

#### Server-Verwaltung
Zentrale Verwaltung externer Services in den **Einstellungen**:

- **Vosk-Server (STT):** WebSocket-basierte Speech-to-Text Server
- **Piper-Server (TTS):** WebSocket-basierte Text-to-Speech Server
- **Flowise-Server (AI):** Flowise AI-Flows mit Script-basiertem Setup
- **Direktes Hinzufügen:** Server können direkt in Node-Konfigurationen hinzugefügt werden
- **Bearbeiten & Testen:** Server können bearbeitet und getestet werden
- **Zentrale Verwaltung:** Alle konfigurierten Server an einem Ort

#### Moderne UI/UX
- **Toast-Benachrichtigungen:** Elegante Erfolgs-/Fehlermeldungen oben rechts
- **Confirm-Dialoge:** Moderne Bestätigungsdialoge für kritische Aktionen (Löschen)
- **Keine Browser-Popups:** Alle `alert()` und `confirm()` durch schöne UI ersetzt
- **Animationen:** Smooth Slide-In und Scale-In Animationen

#### Dark Mode
Das Frontend bietet einen vollständigen Dark Mode:

- **Automatische Erkennung:** Nutzt die System-Präferenz (`prefers-color-scheme`)
- **Manueller Toggle:** Klicken Sie auf das Mond/Sonne-Icon in der Sidebar
- **Persistenz:** Ihre Wahl wird in localStorage gespeichert
- **Vollständige Unterstützung:** Alle Seiten und Komponenten (Login, Flow-Editor, Geräte, Logs, Settings)
- **Kein Flash:** Sanftes Laden ohne "Flash of Wrong Theme"

#### Log-Viewer
- **Auto-Refresh** alle 5 Sekunden (optional)
- **Filter** nach Log-Level (Error, Warning, Info, Debug)
- **Suche** in Log-Nachrichten
- **Live-Updates** mit Echtzeit-Anzeige
- **Anzeige** der letzten 200 Log-Einträge
- **File-basiert:** Logs werden aus `backend/logs/app-*.log` gelesen (nicht aus Datenbank)
- **Performance:** Liest maximal die letzten 3 Log-Dateien
- **Format:** Strukturiertes Parsing von Timestamp, Level, Context, Message und Meta

#### Flow-Editor
Ein visueller, intuitiver Editor zur Erstellung von Workflows:

**Grundlegende Bedienung:**
1. **Drag & Drop:** Ziehen Sie Nodes von der linken Toolbar direkt auf die Canvas
2. **Verbinden:** Ziehen Sie von einem Output-Handle (grün, rechts) zu einem Input-Handle (blau, links)
3. **Auswählen:** Klicken Sie auf Nodes oder Edges (Verbindungen) zum Auswählen
4. **Löschen:** Drücken Sie die `Delete`-Taste zum Löschen ausgewählter Elemente
5. **Konfigurieren:** Klicken Sie auf eine Node, um das Konfigurations-Panel zu öffnen

**Intelligente Verbindungsvalidierung:**
- **Audio-Verbindungen:** Mikrofon → STT, TTS → Lautsprecher
- **Text-Verbindungen:** STT → KI, KI → TTS
- **Automatische Validierung:** Ungültige Verbindungen werden blockiert
- **Datentyp-System:** Audio, Text, und Raw/JSON werden unterschieden

**Node-Handles:**
Jede Node hat nur die Handles, die sie benötigt:
- **Nur Output:** Mikrofon, WS Input (Datenquellen)
- **Nur Input:** Lautsprecher, Debug, WS Output (Datenziele)
- **Input + Output:** STT, KI, TTS (Datenverarbeitung)

**WebSocket-Nodes:**
- **Konfigurierbare Datentypen:** Audio, Text, oder Raw/JSON
- **Intelligente Validierung:** WS Input (text) kann direkt an KI verbunden werden
- **Flexible Workflows:** Externe Systeme nahtlos integrieren

**Visuelle Features:**
- **Icons auf Canvas:** Jede Node zeigt ihr charakteristisches Icon
- **Farbkodierte Handles:** Blaue Input-Handles (links), grüne Output-Handles (rechts)
- **Glow-Effekte:** Handles leuchten beim Hover für bessere Sichtbarkeit
- **Auswahlhighlighting:** Ausgewählte Edges werden blau hervorgehoben
- **Dark Mode Support:** Optimale Lesbarkeit in beiden Modi

### Flow erstellen

1. Navigieren Sie zu **Flows** in der Sidebar
2. Klicken Sie auf **"Neuer Flow"**
3. **Drag & Drop:** Ziehen Sie Nodes aus der Toolbar auf die Canvas
4. **Verbinden:** Ziehen Sie von einem grünen Output-Handle zu einem blauen Input-Handle
5. **Konfigurieren:** Klicken Sie auf Nodes und passen Sie Einstellungen im rechten Panel an
6. **Testen:** Verbindungen werden automatisch validiert (nur kompatible Typen)
7. **Speichern:** Klicken Sie auf "Speichern" (Strg/Cmd + S)
8. **Starten:** Aktivieren Sie den Flow über die Flow-Liste

### ESP32-Client verbinden

```cpp
// ESP32 Arduino Code (Beispiel)
#include <WebSocketsClient.h>

WebSocketsClient webSocket;

void setup() {
  // WebSocket-Verbindung mit Authentifizierung
  webSocket.begin("your-server.com", 8080, "/ws?clientId=esp32_001&secret=your-secret");
  
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();
}
```

Client-Secret muss vorher über die **Settings**-Seite gespeichert werden:
- Key: `client_secret_esp32_001`
- Type: `client_secret`

### Audio-Streaming (USO-Protokoll)

**Phase 1:** Header senden (JSON)
```json
{
  "id": "session-uuid",
  "type": "audio",
  "sourceId": "esp32_001",
  "timestamp": 1697123456789,
  "final": false,
  "audioMeta": {
    "sampleRate": 16000,
    "channels": 1,
    "encoding": "pcm_s16le"
  }
}
```

**Phase 2:** Audio-Daten senden (Binär)
- Chunks von 20-50ms
- PCM 16-bit signed little-endian
- 16kHz Mono empfohlen

## 🔧 Konfiguration

### Backend (.env)

```env
# Server
PORT=3000
NODE_ENV=development

# WebSocket
WS_PORT=8080
WS_SSL_ENABLED=false

# MongoDB
MONGODB_URI=mongodb://localhost:27017/iot-orchestrator

# Security
JWT_SECRET=your-jwt-secret-change-this
ADMIN_PASSWORD=admin
ENCRYPTION_KEY=your-32-char-encryption-key-here

# Proxy (für Nginx)
TRUST_PROXY=true

# HINWEIS: Externe Services (Vosk, Piper, Flowise) werden NICHT mehr über .env konfiguriert!
# Verwenden Sie stattdessen:
# - Einstellungen-Seite für zentrale Server-Verwaltung
# - Direkt in Node-Konfigurationen (Buttons "Neu" und "Bearbeiten")
```

### Frontend (.env.local)

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8080
```

## 🌐 Production Deployment

### Mit Nginx Reverse Proxy

1. **SSL-Zertifikate erstellen** (z.B. mit Let's Encrypt)

```bash
sudo certbot certonly --nginx -d your-domain.com
```

2. **Nginx-Konfiguration anpassen**

```bash
cp nginx.conf.example /etc/nginx/sites-available/iot-orchestrator
sudo ln -s /etc/nginx/sites-available/iot-orchestrator /etc/nginx/sites-enabled/
```

In der Konfiguration anpassen:
- `server_name your-domain.com`
- SSL-Zertifikat-Pfade
- Upstream-Server-Adressen

3. **Backend & Frontend für Production bauen**

```bash
# Backend
cd backend
npm run build
npm run start:prod

# Frontend
cd frontend
npm run build
npm start
```

4. **Nginx neu starten**

```bash
sudo nginx -t
sudo systemctl restart nginx
```

5. **Environment-Variablen anpassen**

Backend `.env`:
```env
NODE_ENV=production
TRUST_PROXY=true
```

Frontend `.env.local`:
```env
NEXT_PUBLIC_API_URL=https://your-domain.com/api
NEXT_PUBLIC_WS_URL=wss://your-domain.com/ws
```

### Mit Docker (geplant)

```bash
# Wird noch implementiert
docker-compose up -d
```

## 🔐 Sicherheit

### Wichtige Sicherheitsmaßnahmen

1. **Encryption-Key setzen** (mind. 32 Zeichen)
2. **Admin-Passwort ändern**
3. **JWT-Secret ändern**
4. **SSL/TLS aktivieren** (Production)
5. **Firewall konfigurieren**
6. **MongoDB-Authentifizierung aktivieren**

### Client-Authentifizierung

ESP32-Clients müssen sich mit einem Client-Secret authentifizieren:

1. Secret über Settings-Seite speichern
2. Format: `client_secret_<clientId>`
3. Bei WebSocket-Verbindung als Query-Parameter übergeben

## 📊 API-Dokumentation

### REST API

Siehe `backend/README.md` für vollständige API-Dokumentation.

Wichtigste Endpoints:

- `POST /api/auth/login` - Admin-Login
- `GET /api/flows` - Flows auflisten
- `POST /api/flows` - Flow erstellen
- `POST /api/flows/:id/start` - Flow starten
- `GET /api/devices` - Geräte auflisten

### WebSocket-Protokoll

Siehe Backend-Dokumentation für das vollständige USO-Protokoll.

## 🛠️ Entwicklung

### Neue Node hinzufügen

1. **Backend:** Node-Klasse erstellen in `backend/src/modules/nodes/`

```typescript
import { BaseNode } from '../../types/INode';
import { UniversalStreamObject } from '../../types/USO';

export class MyNode extends BaseNode {
  async start(): Promise<void> {
    // Initialisierung
  }

  async process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void> {
    // USO verarbeiten
  }

  async stop(): Promise<void> {
    // Cleanup
  }
}
```

2. **Backend:** Node in `node-factory.ts` registrieren

3. **Frontend:** Node-Typ zur Toolbar hinzufügen

4. **Frontend:** Konfigurationsfelder im `NodePanel.tsx` hinzufügen

### Tests ausführen

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

## 🔄 Wichtiger Hinweis für bestehende Installationen

**Wenn Sie bereits eine ältere Version verwenden:**

Die Konfiguration externer Services wurde von der `.env`-Datei in die **Web-UI** verlagert und massiv verbessert:

📖 **Migrations-Anleitung:** [MIGRATION_WEB_UI_CONFIG.md](./MIGRATION_WEB_UI_CONFIG.md)

**Was ist neu:**
- ❌ `VOSK_URL`, `PIPER_URL`, `N8N_URL` aus `.env` entfernen
- ✅ **Flowise** statt N8N für AI-Nodes (moderner, flexibler)
- ✅ **Zentrale Server-Verwaltung** in Einstellungen
- ✅ **Direkte Konfiguration** in Node-Panels (Buttons "Neu" und "Bearbeiten")
- ✅ **Toast-Benachrichtigungen** statt Browser-Popups
- ✅ **Confirm-Dialoge** für kritische Aktionen
- ✅ **Script-basiertes Setup** für Flowise (einfach Python-Script einfügen)
- ✅ Server startet schneller (keine unnötigen Checks mehr)
- ✅ Verschiedene Server pro Node möglich

## 📝 TODO / Roadmap

### ✅ Abgeschlossen
- ✅ Alle 8 Kern-Nodes implementiert (Debug, Mic, STT, AI, TTS, Speaker, WS In, WS Out)
- ✅ Service-Wrapper für Vosk, Piper und Flowise
- ✅ Reconnect-Logik für Vosk und WSOut
- ✅ Health-Status-Anzeige auf Nodes
- ✅ Vollständige Node-Dokumentation (NODES.md + ADVANCED_NODES.md)
- ✅ Metadaten-Vererbung durch alle Nodes
- ✅ Externe WebSocket-Schnittstellen
- ✅ **Web-UI-basierte Service-Konfiguration** (keine .env-Variablen mehr nötig)
- ✅ **Intelligente Startup-Checks** (nur konfigurierte Services werden geprüft)
- ✅ **Docker Compose Setup** mit Live-Reload
- ✅ **Migrations-Dokumentation** für bestehende Installationen
- ✅ **Flowise-Integration** statt N8N (moderne AI-Engine)
- ✅ **Zentrale Server-Verwaltung** in Einstellungen (Vosk, Piper, Flowise)
- ✅ **Direkte Node-Konfiguration** (Server hinzufügen/bearbeiten im Node-Panel)
- ✅ **Toast-Benachrichtigungen** & **Confirm-Dialoge** (moderne UI/UX)
- ✅ **Script-basiertes Flowise-Setup** (Python-Script aus Flowise einfügen)
- ✅ **Debug Events Panel** - Live-Monitoring aller Debug-Node-Ausgaben im Flow-Editor
- ✅ **Context-Informationen** - Metadaten-System (Person, Location, Client-Name)
- ✅ **USO-Protokoll Erweiterung** - Context-Feld im USO-Header
- ✅ **Text-Preview in Debug Events** - Vollständiger Text-Inhalt sichtbar
- ✅ **Umfassende Debug-Dokumentation** - Vollständiger Guide zum Debug Events System
- ✅ **Flow-Status-Management** - Start/Stop Buttons im Editor, Live-Status-Synchronisation
- ✅ **Node Health Status** - Live WebSocket-Verbindungsstatus für WS_In Nodes
- ✅ **Tab-Fokus-Erkennung** - Automatische Status-Updates bei Tab-Wechsel
- ✅ **Context-Weitergabe-Option** - Konfigurierbare Context-Weitergabe in WS_In Nodes
- ✅ **Automatische Zeit-Hinzufügung** - Zeitstempel wird automatisch zum Context hinzugefügt
- ✅ **Flowise AI Streaming** ⚡ - Token-für-Token Echtzeit-Ausgabe wie ChatGPT
- ✅ **Server-Sent Events (SSE) Parser** - Unterstützt verschachteltes Flowise-Event-Format
- ✅ **WS-Out Content-Only Modus** - Minimaler Overhead für Streaming (nur reiner Text/Daten)
- ✅ **WebSocket Cleanup-Fix** - Keine "Zombie-Connections" mehr (removeAllListeners)
- ✅ **WS-Out Health-Status** - Live-Anzeige mit Reconnect-Versuchen
- ✅ **Test-Scripts für WS-Out** - Python WebSocket-Server mit Streaming-Support
- ✅ **Umfassende Streaming-Dokumentation** - STREAMING_GUIDE.md mit allen Details

### 🚧 In Arbeit
- [ ] Connection-Test API-Endpoint
- [ ] Log-Level-Statistiken im Dashboard

### 🔜 Geplant
- [ ] Undo/Redo im Flow-Editor
- [ ] Auto-Layout für Flows
- [ ] Docker-Setup (Docker Compose)
- [ ] Automatische Tests (Jest, Cypress)
- [ ] Performance-Optimierungen
- [ ] Sample-Rate-Conversion
- [ ] Mehr Audio-Codecs (Opus)
- [ ] Vosk-Model-Auswahl
- [ ] Audio-Visualisierung im Frontend

## 📚 Dokumentation

### Haupt-Dokumentation
- **[README.md](README.md)** - Dieses Dokument (Überblick, Installation, Features)
- **[QUICKSTART.md](QUICKSTART.md)** - Schnellstart-Anleitung für Einsteiger
- **[SCHNELLTEST.md](SCHNELLTEST.md)** - Schneller Test mit Python-Script

### Technische Dokumentation
- **[STREAMING_GUIDE.md](STREAMING_GUIDE.md)** ⭐ **NEU!** - Komplette Anleitung für Echtzeit AI-Streaming
  - Was ist Streaming? (Token-für-Token Ausgabe)
  - Wie funktioniert Flowise SSE?
  - Architektur-Überblick & Datenfluss
  - AI Node Konfiguration
  - WS-Out Content-Only Modus
  - Test-Workflow mit test-ws-out.py
  - Troubleshooting & Performance-Metriken
  - **Empfohlen für alle AI-basierten Flows!** ⚡
- **[DEBUG_EVENTS_GUIDE.md](DEBUG_EVENTS_GUIDE.md)** ⭐ - Vollständige Erklärung des Debug Events Systems
  - Wie funktioniert Live-Monitoring?
  - Datenfluss Schritt-für-Schritt
  - Context-Informationen
  - USO-Protokoll
  - Troubleshooting
- **[FLOW_STATUS_MANAGEMENT.md](FLOW_STATUS_MANAGEMENT.md)** ⭐ - Flow-Status-Synchronisation im Detail
  - Wie funktionieren Start/Stop Buttons im Editor?
  - Backend-Frontend-Kommunikation
  - Status-Synchronisation zwischen Editor und Flow-Liste
  - Technische Implementierung (useEffect, API-Calls)
  - Fehlerbehebung und Best Practices
- **[CONTEXT_MANAGEMENT.md](CONTEXT_MANAGEMENT.md)** ⭐ - Context-Informationen & Weitergabe-Option
  - Was sind Context-Informationen? (Zeit, Person, Standort, Client)
  - Automatische Zeit-Hinzufügung im Detail
  - Konfigurierbare Context-Weitergabe in WS_In Nodes
  - Anwendungsfälle (Personalisierung, Privacy, Token-Optimierung)
  - Technische Implementierung (Backend, Frontend, Client)
  - Best Practices und Troubleshooting
- **[TEST_SCRIPTS_README.md](TEST_SCRIPTS_README.md)** - WebSocket Test-Scripts
  - Python Test-Client für WS_In Nodes
  - **Python WebSocket-Server für WS_Out Nodes** (mit Streaming!)
  - Context-Informationen eingeben
  - USO-Format testen
- **[NODES.md](NODES.md)** - Alle verfügbaren Nodes (Basis-Dokumentation)
  - **AI Node** - Flowise mit Streaming
  - **WS-Out Node** - Content-Only & Health-Status
  - **WS-In Node** - Server mit Health-Status
  - Mikrofon, STT, TTS, Lautsprecher, Debug
- **[SERVICES.md](SERVICES.md)** - Externe Services (Vosk, Piper, Flowise)
- **[DEBUG_EVENTS.md](DEBUG_EVENTS.md)** - Debug Events System (Original-Dokumentation)

### Setup & Deployment
- **[DOCKER.md](DOCKER.md)** - Docker Compose Setup & Production
- **[MIGRATION_WEB_UI_CONFIG.md](MIGRATION_WEB_UI_CONFIG.md)** - Migration von .env zu Web-UI

### Backend & Frontend
- **[backend/README.md](backend/README.md)** - NestJS Backend Dokumentation
- **[frontend/README.md](frontend/README.md)** - Next.js Frontend Dokumentation

### Archivierte Dokumentation
- **[archive/](archive/)** - Alte Dokumentationen und Migrations-Guides

---

**💡 Tipp:** Für detaillierte Informationen zum **Debug Events System** (Live-Monitoring, Context-Infos, etc.), siehe [DEBUG_EVENTS_GUIDE.md](DEBUG_EVENTS_GUIDE.md)!

## 🤝 Contributing

Beiträge sind willkommen! Bitte öffnen Sie ein Issue oder Pull Request.

## 📄 Lizenz

MIT

## 📧 Kontakt

Bei Fragen oder Problemen öffnen Sie bitte ein Issue.

---

**Hinweis:** Dies ist eine Entwicklungsversion. Für Production-Einsatz bitte zusätzliche Sicherheitsmaßnahmen treffen und gründlich testen.

