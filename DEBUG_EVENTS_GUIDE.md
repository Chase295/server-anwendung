# 🔍 Debug Events System - Vollständige Anleitung

**Detaillierte Erklärung des Live-Event-Monitoring-Systems**

---

## 📋 Inhaltsverzeichnis

1. [Überblick](#überblick)
2. [Wie funktioniert das System?](#wie-funktioniert-das-system)
3. [Architektur im Detail](#architektur-im-detail)
4. [Datenfluss Schritt-für-Schritt](#datenfluss-schritt-für-schritt)
5. [Context-Informationen](#context-informationen)
6. [USO-Protokoll](#uso-protokoll)
7. [Frontend-Integration](#frontend-integration)
8. [Praktische Beispiele](#praktische-beispiele)
9. [Troubleshooting](#troubleshooting)

---

## Überblick

Das Debug Events System ermöglicht es, **alle Datenströme in Echtzeit** zu überwachen, die durch Debug-Nodes in Ihren Flows fließen. Es ist wie ein "Fenster" in Ihr laufendes System.

### Was kann ich damit sehen?

- ✅ **Text-Nachrichten** mit vollem Inhalt
- ✅ **Audio-Daten** mit Metadaten (Größe, Format, Sample-Rate)
- ✅ **Context-Informationen** (Person, Standort, Client)
- ✅ **Timestamps** für jedes Event
- ✅ **Flow- und Node-Informationen**
- ✅ **Payload-Größe und Typ**

### Warum ist das wichtig?

Beim Entwickeln und Debuggen von Flows müssen Sie wissen:
- Kommen meine Daten an?
- Was steht genau in den Nachrichten?
- Von wem kommen die Daten?
- Funktioniert die Verbindung?

Das Debug Events System beantwortet all diese Fragen **in Echtzeit**, ohne dass Sie in Log-Dateien suchen müssen.

---

## Wie funktioniert das System?

### 1. Die Debug Node

Eine **Debug Node** ist wie ein "Lauscher" in Ihrem Flow:

```
[WS Input] → [Debug Node] → [KI Node] → [Speaker]
                    ↓
              Live Events
              ans Frontend
```

**Was macht die Debug Node?**
- Empfängt USO-Daten von der vorherigen Node
- Loggt die Daten im Backend (Console & Log-Files)
- Emittiert ein `debug:log` Event
- Gibt die Daten unverändert weiter (falls gewünscht)

**Code-Beispiel (vereinfacht):**
```typescript
// backend/src/modules/nodes/debug.node.ts
async process(uso: UniversalStreamObject, emitter: EventEmitter) {
  // 1. Header loggen
  this.logger.info('🔍 DEBUG NODE - USO Received', {
    header: uso.header,
  });
  
  // 2. Context-Infos loggen (wenn vorhanden)
  if (uso.header.context) {
    this.logger.info('👤 Context Info', {
      person: uso.header.context.person,
      location: uso.header.context.location,
      clientName: uso.header.context.clientName,
    });
  }
  
  // 3. Payload-Preview erstellen
  let payloadPreview = uso.payload; // Text
  if (Buffer.isBuffer(uso.payload)) {
    payloadPreview = uso.payload.toString('hex').substring(0, 64) + '...';
  }
  
  // 4. Event ans Frontend emittieren
  emitter.emit('debug:log', {
    nodeId: this.id,
    timestamp: Date.now(),
    uso: {
      header: uso.header,
      payloadType: typeof uso.payload,
      payloadSize: uso.payload?.length || 0,
      payloadPreview,
    },
  });
}
```

### 2. Die Flow Engine (Event-Router)

Die Flow Engine ist der "Vermittler" zwischen Debug Node und Frontend:

```typescript
// backend/src/modules/flow-core/flow-engine.ts
private handleDebugEvent(debugData: any): void {
  // 1. Finde den Flow für diese Node
  const flow = this.activeFlows.get(flowId);
  
  // 2. Finde Node-Label und Flow-Name
  const nodeLabel = nodeDef?.data?.label || 'Debug';
  const flowName = flow.definition.name || 'Unnamed Flow';
  
  // 3. Sende an DebugEventsGateway
  this.debugEventsGateway.broadcastDebugEvent({
    flowId,
    flowName,
    nodeId,
    nodeLabel,
    timestamp,
    uso: {
      header: uso.header,
      payloadType: uso.payloadType,
      payloadSize: uso.payloadSize,
      payloadPreview: uso.payloadPreview,
    },
  });
}
```

### 3. Der Debug Events Gateway (WebSocket-Server)

Ein separater WebSocket-Server auf Port **8082** für Live-Events:

```typescript
// backend/src/modules/devices/debug-events.gateway.ts
broadcastDebugEvent(event: DebugEvent): void {
  const message = JSON.stringify({
    type: 'debug:event',
    event,
    timestamp: Date.now(),
  });
  
  // An alle verbundenen Frontend-Clients senden
  this.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
}
```

### 4. Das Frontend (Event Panel)

Verbindet automatisch zum WebSocket-Server und zeigt Events an:

```typescript
// frontend/src/hooks/useDebugEvents.ts
export function useDebugEvents(flowId?: string) {
  const [events, setEvents] = useState<DebugEvent[]>([]);
  
  useEffect(() => {
    const ws = new WebSocket('ws://localhost:8082');
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'debug:event') {
        // Neues Event zur Liste hinzufügen
        setEvents(prev => [message.event, ...prev].slice(0, 50));
      }
    };
  }, []);
  
  return { events, isConnected, clearEvents };
}
```

---

## Architektur im Detail

### Gesamtübersicht

```
┌─────────────────────────────────────────────────────────────┐
│                     Client (Python/ESP32)                    │
│                  ws://localhost:8081/ws/external             │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ USO-Protokoll:
                             │ 1. Header (JSON)
                             │ 2. Payload (Text/Binary)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                       WS_In Node                             │
│  - Empfängt Header + Payload                                │
│  - Extrahiert Context-Infos                                 │
│  - Erstellt USO-Objekt                                      │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ UniversalStreamObject (USO)
                             │ {
                             │   header: {
                             │     id, type, sourceId, timestamp,
                             │     context: { person, location, clientName }
                             │   },
                             │   payload: "Text" | Buffer
                             │ }
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                       Debug Node                             │
│  - Empfängt USO                                             │
│  - Loggt Header, Context, Payload                           │
│  - Erstellt Payload-Preview                                 │
│  - Emittiert 'debug:log' Event                              │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ debug:log Event
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                      Flow Engine                             │
│  - Hört auf 'debug:log' Events                             │
│  - Findet Flow-ID und Node-Label                            │
│  - Reichert Event mit Metadaten an                          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ DebugEvent
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                 DebugEventsGateway (Port 8082)              │
│  - WebSocket-Server für interne Clients                     │
│  - Event-Cache für HTTP-Zugriff (max. 200 Events)          │
│  - Broadcast an alle verbundenen Clients                    │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ DebugEvent
                             │ (im Cache gespeichert)
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                   HTTP Endpoint                             │
│  GET /api/devices/debug-events                              │
│  - Liefert gecachte Events per HTTP                         │
│  - Filter nach flowId, since (Zeitstempel)                  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ HTTP Response
                             │ { events: [...] }
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Browser)                        │
│  useDebugEvents Hook → EventPanel Component                 │
│  - HTTP-Polling alle 2 Sekunden                            │
│  - Keine Nginx-Config nötig!                                │
│  - Empfängt Events in Echtzeit                              │
│  - Zeigt Events in 3 Modi an (Kompakt, Detailliert, JSON)  │
└─────────────────────────────────────────────────────────────┘
```

### Ports und Verbindungen

| Service | Port | Zweck | Verbindung |
|---------|------|-------|------------|
| **Backend HTTP/API** | 3000 | REST API für Flows, Devices, etc. | Frontend → Backend |
| **WebSocket (Devices)** | 8080 | ESP32-Clients, Bidirektionale Kommunikation | ESP32 → Backend |
| **WS_In Nodes** | 8081+ | Externe WebSocket-Eingänge | Python/Clients → WS_In Node |
| **Debug Events** | 8082 | Live Debug-Events (intern) | HTTP Polling (kein externes Config nötig) |
| **Frontend** | 3001 | Next.js Web-UI | Browser → Frontend |

---

## Datenfluss Schritt-für-Schritt

### Beispiel: Text-Nachricht mit Context

**Schritt 1: Client sendet Nachricht**

```python
# Python Test-Client
header = {
  "id": "uuid-123",
  "type": "text",
  "sourceId": "python_test_client",
  "timestamp": 1234567890,
  "final": True,
  "context": {
    "time": "2025-10-21 14:30:15",      # Wird automatisch hinzugefügt
    "person": "Moritz Haslbeck",
    "location": "Schlafzimmer",
    "clientName": "Laptop xyz"
  }
}
payload = "Hallo, wie geht es dir?"

# 1. Header senden (JSON)
ws.send(json.dumps(header))
# 2. Payload senden (Text)
ws.send(payload)
```

**Schritt 2: WS_In Node empfängt und verarbeitet**

```typescript
// Phase 1: Header empfangen
const header = JSON.parse(data.toString());
this.clientStates.set(clientId, {
  awaitingPayload: true,
  header,
});

// Phase 2: Payload empfangen
const text = data.toString(); // "Hallo, wie geht es dir?"

// USO erstellen mit Context-Infos
const uso = USOUtils.create('text', this.id, text, header.final, {
  id: header.id,
  context: header.context, // ← Context übernehmen!
  websocketInfo: { connectionId, clientIp, connectedAt },
});

// An Flow weiterleiten
this.emitOutput(this.flowEmitter, uso);
```

**Schritt 3: Debug Node verarbeitet USO**

```typescript
// Header loggen
this.logger.info('🔍 DEBUG NODE - USO Received', {
  nodeId: this.id,
  header: uso.header,
});

// Context loggen
if (uso.header.context) {
  this.logger.info('👤 DEBUG NODE - Context Info', {
    context: uso.header.context,
    // → { person: "Moritz Haslbeck", location: "Schlafzimmer", ... }
  });
}

// Payload loggen
this.logger.info('📝 DEBUG NODE - Text Payload', {
  payloadLength: uso.payload.length,
  payload: uso.payload, // → "Hallo, wie geht es dir?"
});

// Event emittieren
emitter.emit('debug:log', {
  nodeId: this.id,
  timestamp: Date.now(),
  uso: {
    header: uso.header,
    payloadType: 'string',
    payloadSize: 23,
    payloadPreview: "Hallo, wie geht es dir?",
  },
});
```

**Schritt 4: Flow Engine routet Event**

```typescript
// Event-Handler registriert
this.eventEmitter.on('debug:log', (debugData) => {
  this.handleDebugEvent(debugData);
});

// Event verarbeiten
private handleDebugEvent(debugData: any): void {
  // Flow-ID finden
  const flowId = this.findFlowForNode(debugData.nodeId);
  const flowName = flow.definition.name; // → "Mein Test-Flow"
  const nodeLabel = nodeDef.data.label;  // → "Debug"
  
  // An WebSocket-Gateway senden
  this.debugEventsGateway.broadcastDebugEvent({
    flowId: "68f7452259d21457d6b2643e",
    flowName: "Mein Test-Flow",
    nodeId: "node_123",
    nodeLabel: "Debug",
    timestamp: 1234567890,
    uso: {
      header: {
        id: "uuid-123",
        type: "text",
        context: {
          person: "Moritz Haslbeck",
          location: "Schlafzimmer",
          clientName: "Laptop xyz"
        }
      },
      payloadType: "string",
      payloadSize: 23,
      payloadPreview: "Hallo, wie geht es dir?"
    }
  });
}
```

**Schritt 5: WebSocket-Gateway sendet an Frontend**

```typescript
broadcastDebugEvent(event: DebugEvent): void {
  const message = {
    type: 'debug:event',
    event,
    timestamp: Date.now(),
  };
  
  // An ALLE verbundenen Frontend-Clients senden
  this.clients.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  });
  
  // Log: "Broadcasted debug event to 2 client(s)"
}
```

**Schritt 6: Frontend empfängt und zeigt an**

```typescript
// WebSocket-Verbindung
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'debug:event') {
    // Event zur Liste hinzufügen
    setEvents(prev => [message.event, ...prev].slice(0, 50));
  }
};

// EventPanel zeigt an:
// ┌────────────────────────────────────────┐
// │ TEXT  Debug  10:23:45.123  23 B       │
// │ 👤 Moritz Haslbeck 📍 Schlafzimmer    │
// │ 💻 Laptop xyz                          │
// │ ┌────────────────────────────────────┐ │
// │ │ Content:                           │ │
// │ │ Hallo, wie geht es dir?            │ │
// │ └────────────────────────────────────┘ │
// └────────────────────────────────────────┘
```

---

## Context-Informationen

### Was sind Context-Informationen?

Context-Informationen sind **zusätzliche Metadaten**, die mit jeder Nachricht mitgesendet werden können:

- **👤 Person**: Name der Person (z.B. "Moritz Haslbeck")
- **📍 Location**: Standort/Raum (z.B. "Schlafzimmer")
- **💻 Client Name**: Geräte-Name (z.B. "Laptop xyz")

### Warum sind sie wichtig?

**Für die KI:**
- Personalisierte Antworten: "Guten Morgen Moritz!"
- Raumabhängige Aktionen: "Licht im Schlafzimmer einschalten"
- Geräte-spezifische Befehle: "Zeig mir auf dem Laptop..."

**Für Debugging:**
- Schnell erkennen, von wem die Nachricht kommt
- Nachvollziehen, aus welchem Raum die Anfrage stammt
- Geräte-spezifische Probleme identifizieren

### Wie werden sie mitgesendet?

**Im Python Test-Script:**

```python
# Beim Start eingeben
👤 Person: Moritz Haslbeck
📍 Standort: Schlafzimmer
💻 Client: Laptop xyz

# Werden automatisch im USO-Header mitgesendet
header = {
  "context": {
    "time": "2025-10-21 14:30:15",      # Automatisch hinzugefügt
    "person": "Moritz Haslbeck",
    "location": "Schlafzimmer",
    "clientName": "Laptop xyz"
  }
}
```

**Im TypeScript Interface:**

```typescript
// backend/src/types/USO.ts
interface USO_Header {
  // ... andere Felder
  context?: {
    person?: string;
    location?: string;
    clientName?: string;
    [key: string]: any; // Erweiterbar!
  };
}
```

### Wie werden sie weitergegeben?

Context-Informationen werden durch die **gesamte Pipeline** weitergegeben:

```
Client → WS_In → Debug → AI → TTS → Speaker
   ↓        ↓       ↓     ↓    ↓      ↓
Context wird bei jedem Schritt im USO-Header mitgeführt
```

**Beispiel: KI nutzt Context**

```typescript
// In der AI Node kann die KI auf Context zugreifen:
const prompt = `
Du sprichst mit: ${uso.header.context.person}
Standort: ${uso.header.context.location}
User-Frage: ${uso.payload}
`;

// KI-Antwort: "Hallo Moritz! Im Schlafzimmer ist es aktuell 22°C..."
```

---

## USO-Protokoll

### Was ist das USO-Protokoll?

USO = **Universal Stream Object**

Ein standardisiertes Format für **alle Datenströme** im System (Audio, Text, Control).

### Warum ein einheitliches Format?

**Problem ohne USO:**
```
Mic → Audio-Format-A → STT (erwartet Format-B) → ❌ Fehler
```

**Lösung mit USO:**
```
Mic → USO(Audio) → STT → USO(Text) → AI → USO(Text) → TTS → USO(Audio)
     ✅ Einheitlich    ✅ Kompatibel   ✅ Kompatibel
```

### USO-Struktur

Ein USO besteht aus **2 Teilen**:

**1. Header (JSON)**
```json
{
  "id": "uuid",
  "type": "text|audio|control",
  "sourceId": "node_id",
  "timestamp": 1234567890,
  "final": true,
  "context": {
    "person": "Moritz Haslbeck",
    "location": "Schlafzimmer",
    "clientName": "Laptop xyz"
  },
  "audioMeta": {
    "sampleRate": 16000,
    "channels": 1,
    "encoding": "pcm_s16le"
  }
}
```

**2. Payload (Text oder Binary)**
```
"Hallo, wie geht es dir?"  (Text)
oder
<Buffer 00 01 02 03 ...>  (Audio-Daten)
```

### USO-Übertragung (WebSocket)

Bei WebSocket-Verbindungen werden Header und Payload **separat** gesendet:

```
Phase 1: Header senden (Text-Frame)
  ws.send(JSON.stringify(header))

Phase 2: Payload senden (Text oder Binary-Frame)
  ws.send(payload)
```

**Warum separat?**
- Header immer als JSON lesbar
- Payload kann binär sein (Audio)
- Backend kann Header parsen, bevor Payload empfangen wird
- Effizient bei großen Audio-Daten

### USO-Types

| Type | Payload | Verwendung |
|------|---------|------------|
| **text** | String | Chat-Nachrichten, Transkripte, KI-Antworten |
| **audio** | Buffer | Mikrofon-Audio, TTS-Audio |
| **control** | String (meist leer) | Fehler, Start/Stop-Signale, Status |

---

## Frontend-Integration

### useDebugEvents Hook

Der zentrale Hook für Debug Events:

```typescript
// Verwendung in einer Component
import { useDebugEvents } from '@/hooks/useDebugEvents';

function MyComponent() {
  const { events, isConnected, clearEvents } = useDebugEvents(flowId);
  
  return (
    <div>
      <p>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
      <p>Events: {events.length}</p>
      <button onClick={clearEvents}>Clear</button>
    </div>
  );
}
```

**Features:**
- ✅ HTTP-Polling alle 2 Sekunden (keine Nginx-Konfiguration nötig!)
- ✅ Automatischer Event-Cache (max. 200 Events im Backend)
- ✅ Filterung nach Flow-ID
- ✅ Event-Limit (50 Events im Frontend)
- ✅ Verbindungsstatus-Anzeige
- ✅ Sauberes Cleanup beim Unmount

### EventPanel Component

Zeigt Events in 3 Modi an:

**1. Kompakt-Modus**
```
10:23:45.123  TEXT  Debug  23 B  from: ws_in_node
👤 Moritz Haslbeck 📍 Schlafzimmer 💻 Laptop xyz
Hallo, wie geht es dir?
```

**2. Detailliert-Modus**
```
TEXT  Debug                              10:23:45.123

Payload: 23 B (string)    Source: ws_in_node
Session: uuid-123

┌─ Context ──────────────────────────────┐
│ 👤 Person: Moritz Haslbeck             │
│ 📍 Standort: Schlafzimmer              │
│ 💻 Client: Laptop xyz                  │
└────────────────────────────────────────┘

┌─ Content ──────────────────────────────┐
│ Hallo, wie geht es dir?                │
└────────────────────────────────────────┘
```

**3. JSON-Modus**
```json
{
  "flowId": "68f745...",
  "flowName": "Mein Test-Flow",
  "nodeId": "node_123",
  "nodeLabel": "Debug",
  "timestamp": 1234567890,
  "uso": {
    "header": {
      "context": {
        "person": "Moritz Haslbeck",
        "location": "Schlafzimmer",
        "clientName": "Laptop xyz"
      }
    },
    "payloadPreview": "Hallo, wie geht es dir?"
  }
}
```

---

## Praktische Beispiele

### Beispiel 1: Einfacher Text-Test

```bash
# 1. Flow starten (über UI oder API)
curl -X POST http://localhost:3000/api/flows/{flowId}/start

# 2. Test-Script ausführen
python3 test-ws-in.py

# Eingaben:
# Person: Moritz Haslbeck
# Standort: Schlafzimmer
# Client: Laptop xyz
# Nachricht: Hallo Test

# 3. Im Frontend öffnen:
# http://localhost:3001/flows/editor?id={flowId}

# 4. Event-Panel unten öffnen → Event erscheint!
```

### Beispiel 2: Audio-Stream testen

```python
import websockets
import asyncio

async def send_audio():
    async with websockets.connect('ws://localhost:8081/audio') as ws:
        # Header
        header = {
            "id": str(uuid.uuid4()),
            "type": "audio",
            "sourceId": "test_mic",
            "timestamp": int(time.time() * 1000),
            "final": False,
            "audioMeta": {
                "sampleRate": 16000,
                "channels": 1,
                "encoding": "pcm_s16le"
            },
            "context": {
                "person": "Moritz Haslbeck",
                "location": "Wohnzimmer",
                "clientName": "Test-Mic"
            }
        }
        await ws.send(json.dumps(header))
        
        # Audio-Daten
        audio_data = b'\x00\x01' * 1000  # 2000 Bytes Test-Audio
        await ws.send(audio_data)

asyncio.run(send_audio())
```

**Im Frontend sehen Sie:**
```
AUDIO  Debug  2.0 KB  from: test_mic
👤 Moritz Haslbeck 📍 Wohnzimmer 💻 Test-Mic
Audio: 16000Hz, 1ch, pcm_s16le
```

### Beispiel 3: Multi-Room Setup

```python
# Verschiedene Clients für verschiedene Räume
clients = [
    {"location": "Schlafzimmer", "port": 8081},
    {"location": "Wohnzimmer", "port": 8082},
    {"location": "Küche", "port": 8083},
]

for client in clients:
    # Jeder Client sendet mit seinem Standort
    header["context"]["location"] = client["location"]
    # ... senden
```

**Im Debug Panel:**
```
10:23:45  TEXT  Debug  "Licht an"
📍 Schlafzimmer

10:23:46  TEXT  Debug  "Musik abspielen"
📍 Wohnzimmer

10:23:47  TEXT  Debug  "Timer 5 Minuten"
📍 Küche
```

---

## Troubleshooting

### Problem: Keine Events im Frontend

**Checkliste:**
1. ✅ Flow läuft? → Prüfen in UI oder `GET /api/flows`
2. ✅ Debug Node im Flow? → Flow-Editor öffnen
3. ✅ WebSocket verbunden? → Browser Console öffnen
4. ✅ Backend läuft? → `docker logs iot-orchestrator-backend`
5. ✅ Port 8082 offen? → `curl -i http://localhost:8082`

**Lösung:**
```bash
# Backend-Logs prüfen
docker logs iot-orchestrator-backend | grep "Debug Events"
# Sollte zeigen: "Debug Events WebSocket server listening on port 8082"

# Frontend neu laden
# Cmd+Shift+R (Mac) oder Ctrl+Shift+R (Windows)

# WebSocket-Verbindung testen
wscat -c ws://localhost:8082
# Sollte "Welcome" Message zeigen
```

### Problem: Events kommen doppelt

**Ursache:** React Development Mode erstellt manchmal mehrere Verbindungen

**Lösung:**
```typescript
// useDebugEvents.ts hat bereits einen Fix:
if (wsRef.current?.readyState === WebSocket.OPEN) {
  console.log('Already connected, skipping');
  return;
}
```

**Wenn Problem weiterhin besteht:**
```bash
# Backend neu starten
docker-compose restart backend

# Browser Cache leeren
# Hard Reload durchführen
```

### Problem: Context-Infos fehlen

**Prüfen:**
```bash
# Backend-Logs
docker logs iot-orchestrator-backend --tail 50 | grep "context"

# Sollte zeigen:
# "hasContext": true
# "context": { "person": "...", ... }
```

**Häufige Fehler:**
1. ❌ Context nur im Payload statt im Header
2. ❌ Context-Felder falsch benannt (person ≠ personName)
3. ❌ Context nicht bei jedem Message-Type mitgesendet

**Korrekt:**
```python
header = {
  "context": {
    "person": "Moritz Haslbeck",      # ✅ Richtig
    "location": "Schlafzimmer",       # ✅ Richtig
    "clientName": "Laptop xyz"        # ✅ Richtig
  }
}
```

### Problem: Payload-Preview fehlt

**Prüfen:**
```bash
# Backend-Logs
docker logs iot-orchestrator-backend | grep "hasPreview"

# Sollte zeigen: "hasPreview": true
```

**Ursache:** Flow-Engine gibt Preview nicht weiter

**Fix bereits implementiert:**
```typescript
// flow-engine.ts Zeile 382
payloadPreview: uso.payloadPreview, // ✅ Wird weitergegeben
```

### Problem: Port bereits belegt

```
Error: listen EADDRINUSE: address already in use :::8082
```

**Lösung:**
```bash
# Prozess finden
lsof -i :8082

# Prozess beenden
kill -9 <PID>

# Oder Port in .env ändern
DEBUG_EVENTS_PORT=8083
```

---

## Best Practices

### 1. Debug Nodes strategisch platzieren

✅ **Gut:**
```
[WS Input] → [Debug] → [STT] → [Debug] → [AI] → [Debug] → [TTS] → [Speaker]
```

❌ **Schlecht:**
```
[WS Input] → [STT] → [AI] → [TTS] → [Speaker]
(Keine Debug Nodes → Kein Debugging möglich)
```

### 2. Context-Infos immer mitsenden

✅ **Gut:**
```python
header["context"] = {
    "person": "Moritz Haslbeck",
    "location": "Schlafzimmer",
    "clientName": "Laptop xyz"
}
```

❌ **Schlecht:**
```python
header["context"] = {}  # Leer
```

### 3. Event-Panel beim Entwickeln offen lassen

- Sehen Sie sofort, wenn Daten ankommen
- Erkennen Sie Probleme in Echtzeit
- Verstehen Sie den Datenfluss besser

### 4. Log-Levels richtig setzen

```env
# Entwicklung
LOG_LEVEL=debug

# Produktion
LOG_LEVEL=info
```

---

## Weiterführende Links

- [USO-Spezifikation](backend/src/types/USO.ts)
- [Debug Node Implementation](backend/src/modules/nodes/debug.node.ts)
- [Flow Engine](backend/src/modules/flow-core/flow-engine.ts)
- [Debug Events Gateway](backend/src/modules/devices/debug-events.gateway.ts)
- [Frontend Hook](frontend/src/hooks/useDebugEvents.ts)
- [Event Panel Component](frontend/src/components/flow-editor/EventPanel.tsx)

---

**Erstellt:** 2025-10-21  
**Version:** 2.0  
**Letzte Aktualisierung:** Context-Informationen Feature

---

Bei Fragen oder Problemen: Siehe [Troubleshooting](#troubleshooting) oder Backend-Logs prüfen! 🚀

