# IoT & Voice Orchestrator - Backend

Backend-Server für den IoT & Voice Orchestrator, gebaut mit NestJS.

## Features

- ✅ **WebSocket-Server** für ESP32-Clients mit binärem Streaming-Protokoll
- ✅ **Universal Stream Object (USO)** für einheitliche Datenströme
- ✅ **Flow-Engine** mit Event-basierter Architektur
- ✅ **Node-System** mit modularen, erweiterbaren Nodes
- ✅ **Authentifizierung** für Admin-UI und ESP32-Clients
- ✅ **Secret-Management** mit AES-256 Verschlüsselung
- ✅ **MongoDB** für Persistenz
- ✅ **Winston-Logging** mit strukturiertem JSON-Format
- ✅ **Service-Integration** - Vosk (STT), Piper (TTS), Flowise (AI) - siehe [SERVICES.md](../SERVICES.md)
- ✅ **Flowise AI Streaming** ⚡ - Token-für-Token Echtzeit-Ausgabe mit Server-Sent Events (SSE)
- ✅ **Debug Events Gateway** - WebSocket-Server für Live-Debugging (Port 8082)
- ✅ **Context-Informationen** - Metadaten-System für personalisierte KI-Interaktionen
- ✅ **Health-Status für Nodes** - Live-Verbindungsstatus (WS-In, WS-Out) mit Reconnect-Tracking
- ✅ **Robustes WebSocket-Cleanup** - Automatisches removeAllListeners() verhindert "Zombie-Connections"

## Architektur

### Module

```
src/
├── common/              # Gemeinsame Utilities
│   ├── logger.ts       # Winston Logger
│   └── encryption.util.ts
├── types/              # TypeScript Interfaces
│   ├── USO.ts         # Universal Stream Object
│   └── INode.ts       # Node Interface
├── modules/
│   ├── auth/          # Authentifizierung & Secret-Management
│   ├── devices/       # WebSocket-Server & Device-Verwaltung
│   │   ├── websocket.gateway.ts     # ESP32 WebSocket-Server (Port 8080)
│   │   └── debug-events.gateway.ts  # Debug Events WebSocket (Port 8082)
│   ├── flow-core/     # Flow-Engine & Flow-Verwaltung
│   │   ├── flow-engine.ts           # Orchestriert Nodes und Events
│   │   └── node-factory.ts          # Erstellt Node-Instanzen
│   ├── nodes/         # Node-Implementierungen
│   │   ├── debug.node.ts            # Debug Node (emittiert debug:log Events)
│   │   ├── wsIn.node.ts             # WebSocket Input (empfängt externe WS)
│   │   └── ...                      # Weitere Nodes
│   └── services/      # Externe Service-Integration
│       ├── vosk.service.ts          # STT (Speech-to-Text)
│       ├── piper.service.ts         # TTS (Text-to-Speech)
│       └── flowise.service.ts       # AI (Flowise)
├── app.module.ts
└── main.ts
```

### Wichtige Module

#### 1. Debug Events Gateway (`debug-events.gateway.ts`)

Separater WebSocket-Server für Live-Debugging:

```typescript
@WebSocketGateway(8082, { cors: true })
export class DebugEventsGateway {
  broadcastDebugEvent(event: DebugEvent): void {
    // Sendet Events in Echtzeit an alle verbundenen Frontend-Clients
  }
}
```

**Features:**
- ✅ WebSocket auf Port 8082
- ✅ Broadcast an alle verbundenen Clients
- ✅ Keine Authentifizierung (nur für Development)
- ✅ Auto-Reconnect im Frontend

**Event-Format:**
```json
{
  "type": "debug:event",
  "event": {
    "flowId": "...",
    "flowName": "...",
    "nodeId": "...",
    "nodeLabel": "Debug",
    "timestamp": 1234567890,
    "uso": {
      "header": { "context": {...}, ... },
      "payloadType": "string",
      "payloadSize": 123,
      "payloadPreview": "Text-Inhalt..."
    }
  }
}
```

#### 2. Flow Engine (`flow-engine.ts`)

Orchestriert alle Nodes und routet Events:

- Startet/Stoppt Flows
- Registriert Event-Listener für `debug:log` Events
- Leitet Debug Events an `DebugEventsGateway` weiter
- Verwaltet Node-Verbindungen und Datenflüsse

#### 3. Node Factory (`node-factory.ts`)

- Erstellt Node-Instanzen basierend auf Typ
- Wendet Default-Konfigurationen an (z.B. `enabled: true` für Debug Node)
- Registriert neue Node-Types

#### 4. Flowise Service (`flowise.service.ts`)

Service für Flowise AI-Integration mit Streaming-Support:

```typescript
async sendToFlowiseStreaming(
  config: FlowiseConfig,
  question: string,
  sessionId: string | undefined,
  chunkCallback: (chunk: string, event: string) => void,
  metadataCallback?: (metadata: any) => void
): Promise<void>
```

**Features:**
- ✅ Server-Sent Events (SSE) Parser
- ✅ Verschachteltes JSON-Format-Support (`{"event":"message","data":"..."}`)
- ✅ Event-Types: `start`, `token`, `metadata`, `end`, `error`
- ✅ Callback für jeden Token (live streaming)
- ✅ Automatisches Metadata-Sammeln

**Event-Parsing:**
```typescript
// Flowise sendet:
event: message
data: {"event":"token","data":" Hello"}

// Parser extrahiert:
actualEvent = "token"
actualData = " Hello"
```

Siehe **[STREAMING_GUIDE.md](../STREAMING_GUIDE.md)** für Details!

### USO-Protokoll

Das **Universal Stream Object (USO)** ist das Herzstück der Datenkommunikation:

**Phase 1 (Header):** JSON-Text-Frame mit Metadaten
```json
{
  "id": "uuid-v4",
  "type": "audio|text|control",
  "sourceId": "esp32_001",
  "timestamp": 1697123456789,
  "final": false,
  "context": {
    "time": "2025-10-21 14:30:15",
    "person": "Moritz Haslbeck",
    "location": "Schlafzimmer",
    "clientName": "Laptop xyz"
  },
  "audioMeta": {
    "sampleRate": 16000,
    "channels": 1,
    "encoding": "pcm_s16le"
  },
  "websocketInfo": {
    "connectionId": "wsin_1234567890_abc123",
    "clientIp": "192.168.1.100",
    "connectedAt": 1697123456789
  }
}
```

**Context-Informationen** (optional):
- `time`: Aktuelle Uhrzeit im Format "YYYY-MM-DD HH:MM:SS" (wird automatisch hinzugefügt)
- `person`: Name der Person (für personalisierte KI-Antworten)
- `location`: Standort/Raum (für raumabhängige Automatisierungen)
- `clientName`: Geräte-Name (für Debugging und Tracking)

**Context-Weitergabe:**
- Context wird automatisch durch alle Nodes weitergegeben
- Kann pro WS_In Node aktiviert/deaktiviert werden (`includeContext` Config-Option)
- Standard: Aktiviert (Context wird weitergegeben)
- Wenn deaktiviert: Context wird aus USO entfernt (nützlich für Privacy oder Token-Optimierung)

📖 **Detaillierte Dokumentation:** [CONTEXT_MANAGEMENT.md](../CONTEXT_MANAGEMENT.md)

**Phase 2 (Payload):** Binär-Frame oder String-Daten

### Node-System

Alle Nodes implementieren das `INode`-Interface:

```typescript
interface INode {
  id: string;
  type: string;
  config: Record<string, any>;
  
  start(): Promise<void>;
  process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void>;
  stop(): Promise<void>;
  testConnection?(): Promise<{success: boolean, message: string}>;
  getHealthStatus?(): {status: 'healthy'|'degraded'|'error', message?: string};
}
```

## Installation

```bash
# Dependencies installieren
npm install

# MongoDB starten (oder anpassen in .env)
# Standard: mongodb://localhost:27017/iot-orchestrator

# .env Datei erstellen
cp .env.example .env

# WICHTIG: Encryption-Key setzen (mind. 32 Zeichen)
# ENCRYPTION_KEY=your-secure-32-char-key-here
```

## Development

```bash
# Development-Server starten
npm run start:dev

# Backend läuft auf:
# - HTTP API: http://localhost:3000/api
# - WebSocket: ws://localhost:8080
```

## Umgebungsvariablen

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
```

## API-Endpoints

### Auth
- `POST /api/auth/login` - Admin-Login
- `GET /api/auth/secrets` - Liste Secrets
- `POST /api/auth/secrets` - Secret speichern
- `DELETE /api/auth/secrets/:key` - Secret löschen

### Devices
- `GET /api/devices` - Alle Geräte
- `GET /api/devices/:clientId` - Gerät Details
- `POST /api/devices` - Gerät registrieren
- `DELETE /api/devices/:clientId` - Gerät löschen
- `GET /api/devices/connected/list` - Verbundene Clients

### Flows
- `GET /api/flows` - Alle Flows
- `GET /api/flows/schemas` - Node-Schemas
- `GET /api/flows/:id` - Flow Details
- `POST /api/flows` - Flow erstellen
- `PUT /api/flows/:id` - Flow aktualisieren
- `DELETE /api/flows/:id` - Flow löschen
- `POST /api/flows/:id/start` - Flow starten
- `POST /api/flows/:id/stop` - Flow stoppen

### Logs
- `GET /api/logs` - System-Logs mit Filter-Optionen
  - Query-Parameter:
    - `level` (optional): Filter nach Level (error, warn, info, debug, all)
    - `limit` (optional): Maximale Anzahl Logs (default: 100)
    - `offset` (optional): Offset für Pagination (default: 0)
  - Response: `{ logs: LogEntry[], total: number }`
- `GET /api/logs/live` - SSE-Stream für Live-Logs (geplant)

### Flowise Servers
- `GET /api/flowise-servers` - Alle Flowise-Server
- `POST /api/flowise-servers` - Flowise-Server erstellen
- `PUT /api/flowise-servers/:id` - Flowise-Server aktualisieren
- `DELETE /api/flowise-servers/:id` - Flowise-Server löschen
- `POST /api/flowise-servers/:id/test` - Verbindung testen
- `POST /api/flowise-servers/test-script` - Script testen (ohne zu speichern)

### Vosk Servers
- `GET /api/vosk-servers` - Alle Vosk-Server
- `POST /api/vosk-servers` - Vosk-Server erstellen
- `PUT /api/vosk-servers/:id` - Vosk-Server aktualisieren
- `DELETE /api/vosk-servers/:id` - Vosk-Server löschen

### Piper Servers
- `GET /api/piper-servers` - Alle Piper-Server
- `POST /api/piper-servers` - Piper-Server erstellen
- `PUT /api/piper-servers/:id` - Piper-Server aktualisieren
- `DELETE /api/piper-servers/:id` - Piper-Server löschen

## WebSocket-Authentifizierung (ESP32)

```
ws://localhost:8080?clientId=esp32_001&secret=your-client-secret
```

1. Client-Secret muss vorher in der Datenbank gespeichert werden
2. Format: `client_secret_<clientId>`
3. Verwende `/api/auth/secrets` Endpoint

## Production Deployment

### Mit Nginx Reverse Proxy

Siehe `nginx.conf.example` für Konfiguration.

Wichtig:
- `trust proxy` aktivieren
- WebSocket-Header korrekt forwarden
- SSL/TLS für WebSocket-Verbindungen

## Changelog

### v2.2.0 - AI Streaming & WebSocket-Verbesserungen (Oktober 2025)

**Flowise AI Streaming:** ⚡
- ✅ Token-für-Token Echtzeit-Ausgabe wie ChatGPT
- ✅ Server-Sent Events (SSE) Parser mit verschachteltem JSON-Support
- ✅ Start-to-First-Token: < 1 Sekunde
- ✅ AI Node: `enableStreaming` Config-Option (Default: AN)
- ✅ Automatisches Chunk-Tracking (`final: false/true` im USO)

**WebSocket-Node Verbesserungen:**
- ✅ WS-Out: `content_only` Sende-Format (minimaler Overhead für Streaming)
- ✅ WS-Out: Health-Status mit Reconnect-Tracking
- ✅ WS-In/WS-Out: Robustes Cleanup mit `removeAllListeners()`
- ✅ Keine "Zombie-Connections" mehr nach Flow-Stop/Delete
- ✅ WS-In: Health-Status zeigt Client-Anzahl
- ✅ Docker: Ports 8080-8090 freigegeben für Testing

**Test-Infrastructure:**
- ✅ `test-ws-out.py` - WebSocket-Server für WS-Out Testing
- ✅ Streaming-Erkennung in Test-Script
- ✅ Live-Display von AI-Antworten im Terminal
- ✅ `test-ws-out.sh` - Start-Script mit Dependency-Check

**Dokumentation:**
- ✅ **[STREAMING_GUIDE.md](../STREAMING_GUIDE.md)** - Komplette Streaming-Dokumentation
- ✅ **[NODES.md](../NODES.md)** - Erweitert um AI, WS-In, WS-Out Nodes
- ✅ **[TEST_SCRIPTS_README.md](../TEST_SCRIPTS_README.md)** - AI-Streaming Test-Workflow

### v2.1.0 - Flowise Integration & Server-Verwaltung

**Flowise-Integration:**
- ✅ Flowise statt N8N für AI-Nodes
- ✅ Server-Sent Events (SSE) Support für Streaming-Antworten
- ✅ Script-basiertes Setup (Python-Script aus Flowise)
- ✅ Robuste Verbindungstests mit SSL-Support

**Server-Verwaltung:**
- ✅ Zentrale Verwaltung von Vosk, Piper und Flowise-Servern
- ✅ MongoDB-basierte Server-Konfiguration
- ✅ CRUD-APIs für Server-Verwaltung
- ✅ Verbindungstests über API-Endpoints

### v2.0.0 - Node-System & Flow-Engine

**Implementierte Nodes:**
- ✅ Debug Node - Log-Ausgabe
- ✅ Mikrofon Node - Audio-Empfang von ESP32
- ✅ STT Node - Speech-to-Text (Vosk)
- ✅ KI Node - AI-Processing (Flowise)
- ✅ TTS Node - Text-to-Speech (Piper)
- ✅ Speaker Node - Audio-Ausgabe an ESP32
- ✅ WebSocket In/Out Nodes - Externe WebSocket-Kommunikation

**Flow-Engine:**
- ✅ Event-basierte Architektur
- ✅ Node-Pipeline mit USO-Streaming
- ✅ Flow-Verwaltung (Start/Stop/Edit)
- ✅ Datentyp-Validierung
- ✅ Service-Konfiguration über Web-UI

**Weitere Verbesserungen:**
- ✅ Logging-API für Live-Logs im Frontend
- ✅ Service-Wrapper für externe APIs (Vosk, Piper, n8n)
- ✅ Frontend vollständig integriert
- ✅ Dark Mode Support im gesamten UI

## Logging

### Log-Format

Das Backend verwendet Winston für strukturiertes Logging. Logs werden in folgenden Formaten geschrieben:

**Console-Output (entwicklerfreundlich, farbig):**
```
2025-10-20 17:22:42 info [Context] Message { "key": "value" }
```

**File-Output (logs/app-YYYY-MM-DD.log):**
```
2025-10-20 17:22:42 info [Context] Message {"key":"value"}
```

### Log-Konfiguration

Logs werden **automatisch in Dateien geschrieben** wenn:
- `NODE_ENV=production` ODER
- `FILE_LOGGING=true` (empfohlen für Docker)

**Log-Verzeichnis:** `./logs/app-*.log` (täglich rotierend)

**Docker Volume-Mapping:**
```yaml
volumes:
  - ./backend/logs:/app/logs  # Logs persistent speichern
```

### Logs-API Implementation

Der `LogsService` liest Log-Dateien und parst sie:

1. **Dateien lesen:** Liest die letzten 3 Log-Dateien (Performance)
2. **Parsen:** Regex-basiertes Parsing des Log-Formats
3. **Filtern:** Nach Level, Limit, Offset
4. **Sortieren:** Neueste Logs zuerst

**Wichtig:** Logs werden **NICHT** in MongoDB gespeichert, sondern nur in Dateien!

### Log-Levels

- `error` - Fehler und Exceptions
- `warn` - Warnungen
- `info` - Allgemeine Informationen (Standard)
- `debug` - Debug-Informationen (nur in Development)

**Konfiguration:**
```env
LOG_LEVEL=info  # oder: error, warn, debug
FILE_LOGGING=true  # Aktiviert File-Logging
```

## API-Endpoints

### Flow-Management

#### GET `/flows`
Gibt alle Flows mit `isRunning` Status zurück.

**Response:**
```json
[
  {
    "_id": "abc123",
    "name": "My Flow",
    "description": "...",
    "definition": {...},
    "active": true,
    "enabled": true,
    "isRunning": true,  // ← Berechnet aus FlowEngine.activeFlows
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```

**Wichtig:** `isRunning` wird **berechnet**, nicht aus der DB gelesen!

```typescript
@Get()
async getAllFlows() {
  const flows = await this.flowService.getAllFlows();
  const activeFlows = this.flowService.getActiveFlows(); // ← Holt aktive Flows
  
  return flows.map(flow => ({
    ...(flow as any).toObject(),
    isRunning: activeFlows.some(af => af.id === (flow as any)._id.toString()),
  }));
}
```

#### GET `/flows/:id`
Gibt einen Flow mit `isRunning` Status zurück.

**Response:**
```json
{
  "_id": "abc123",
  "name": "My Flow",
  "isRunning": true,  // ← Berechnet (seit v2.3.0)
  ...
}
```

**🎯 Kritischer Fix (v2.3.0):**  
Ursprünglich wurde `isRunning` hier NICHT berechnet, was zu Status-Inkonsistenzen im Frontend führte!

```typescript
@Get(':id')
async getFlow(@Param('id') id: string) {
  const flow = await this.flowService.getFlow(id);
  const activeFlows = this.flowService.getActiveFlows(); // ← NEU!
  
  return {
    ...(flow as any).toObject(),
    isRunning: activeFlows.some(af => af.id === (flow as any)._id.toString()), // ← NEU!
  };
}
```

#### POST `/flows/:id/start`
Startet einen Flow.

**Ablauf:**
1. Flow aus DB laden
2. `FlowEngine.startFlow()` aufrufen
3. Flow zur `activeFlows` Map hinzufügen
4. DB-Feld `active: true` setzen

**Response:**
```json
{
  "success": true,
  "message": "Flow started"
}
```

#### POST `/flows/:id/stop`
Stoppt einen Flow.

**Ablauf:**
1. `FlowEngine.stopFlow()` aufrufen
2. Alle Nodes stoppen
3. Flow aus `activeFlows` Map entfernen
4. DB-Feld `active: false` setzen

**Response:**
```json
{
  "success": true,
  "message": "Flow stopped"
}
```

### Flow-Status-Tracking

Der **tatsächliche** Flow-Status wird in `FlowEngine.activeFlows` verwaltet:

```typescript
export class FlowEngine {
  private activeFlows: Map<string, FlowInstance> = new Map();
  
  async startFlow(flowId: string, definition: any): Promise<void> {
    // ... Nodes erstellen und starten ...
    this.activeFlows.set(flowId, flowInstance); // ← Single Source of Truth
  }
  
  async stopFlow(flowId: string): Promise<void> {
    // ... Nodes stoppen ...
    this.activeFlows.delete(flowId); // ← Entfernt aus Map
  }
  
  getActiveFlows(): Array<{ id: string; nodeCount: number }> {
    return Array.from(this.activeFlows.values()).map(flow => ({
      id: flow.id,
      nodeCount: flow.nodes.size,
    }));
  }
}
```

**Wichtig:**
- `activeFlows` Map ist die **Single Source of Truth**
- DB-Feld `active` ist nur für Persistenz
- `isRunning` wird **dynamisch** berechnet aus `activeFlows`

📖 **Detaillierte Dokumentation:** [FLOW_STATUS_MANAGEMENT.md](../FLOW_STATUS_MANAGEMENT.md)

## Nächste Schritte

- [ ] Reconnect-Logik für externe Dienste
- [ ] Health-Checks für aktive Nodes
- [ ] Flow-Metriken und Performance-Monitoring
- [x] Log-Viewer mit File-basiertem Parsing
- [ ] WebSocket-Logging für Echtzeit-Updates (Live-Streaming)
- [ ] Rate-Limiting für API-Endpoints

## Lizenz

MIT

