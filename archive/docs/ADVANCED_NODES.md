# Erweiterte Nodes-Dokumentation

Dokumentation für die finalen Kern-Nodes: AI, WebSocket In und WebSocket Out.

## 🤖 KI / Workflow Node (AINode)

### Beschreibung
Die AI-Node integriert externe Workflow-Engines (initial n8n) zur intelligenten Verarbeitung von Text-Input. Sie sendet alle USO-Metadaten an den Workflow und ermöglicht kontextbewusste KI-Antworten.

### Konfiguration

**n8n Webhook URL** (erforderlich)
- Typ: String
- Default: `http://localhost:5678/webhook`
- Beschreibung: HTTP-URL des n8n Webhooks
- Beispiel: `http://localhost:5678/webhook/workflow-id`

**Model / Workflow Name**
- Typ: String
- Default: `n8n`
- Beschreibung: Identifikation des verwendeten Models/Workflows

**Streaming-Modus**
- Typ: Boolean
- Default: `false`
- Beschreibung: Empfängt Antwort als Stream (Chunk für Chunk)

### Verhalten

1. **Start:** Node wird gestartet
2. **Process:**
   - Akzeptiert nur USO mit `type: 'text'`
   - Sendet komplettes USO-Objekt an n8n (inkl. Metadaten)
   - Empfängt Antwort (single oder streaming)
   - Emittiert Text-USO mit KI-Antwort
3. **Stop:** Node wird gestoppt

### USO-Transformation

**Input:**
```json
{
  "header": {
    "type": "text",
    "sourceId": "stt-node-id",
    "speakerInfo": {
      "confidence": 0.95,
      "language": "de"
    },
    "websocketInfo": {
      "connectionId": "conn_123",
      "clientIp": "192.168.1.100"
    }
  },
  "payload": "Wie ist das Wetter heute?"
}
```

**An n8n gesendet:**
```json
{
  "uso": {
    "id": "session-uuid",
    "type": "text",
    "sourceId": "stt-node-id",
    "timestamp": 1697123456789,
    "final": true
  },
  "text": "Wie ist das Wetter heute?",
  "metadata": {
    "speaker": {
      "confidence": 0.95,
      "language": "de"
    },
    "websocket": {
      "connectionId": "conn_123",
      "clientIp": "192.168.1.100",
      "connectedAt": 1697123450000
    }
  }
}
```

**Output:**
```json
{
  "header": {
    "type": "text",
    "sourceId": "ai-node-id",
    "final": true,
    "speakerInfo": {
      "confidence": 0.95,
      "language": "de"
    },
    "websocketInfo": {
      "connectionId": "conn_123",
      "clientIp": "192.168.1.100"
    },
    "control": {
      "action": "ai_response",
      "data": {
        "model": "n8n"
      }
    }
  },
  "payload": "Das Wetter heute ist sonnig mit 23 Grad."
}
```

### n8n-Setup

**1. n8n installieren und starten:**
```bash
docker run -it -p 5678:5678 n8nio/n8n:latest
```

**2. Workflow erstellen:**
1. Öffnen Sie n8n: http://localhost:5678
2. Erstellen Sie einen neuen Workflow
3. Fügen Sie einen "Webhook" Trigger-Node hinzu
4. Konfigurieren Sie den Webhook:
   - Method: POST
   - Path: `/webhook/your-workflow-id`
   - Response Mode: Last Node

**3. Beispiel-Workflow:**
```
Webhook → Set Node (Daten vorbereiten) → HTTP Request (zu OpenAI/Claude) → Respond to Webhook
```

**Set Node (Daten vorbereiten):**
```json
{
  "text": "{{ $json.text }}",
  "speakerInfo": "{{ $json.metadata.speaker }}",
  "websocketInfo": "{{ $json.metadata.websocket }}"
}
```

**HTTP Request (zu OpenAI):**
```
Method: POST
URL: https://api.openai.com/v1/chat/completions
Headers:
  Authorization: Bearer YOUR_API_KEY
  Content-Type: application/json

Body:
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "{{ $json.text }}"
    }
  ]
}
```

**Respond to Webhook:**
```json
{
  "text": "{{ $json.choices[0].message.content }}",
  "metadata": {
    "model": "gpt-4"
  }
}
```

### Streaming-Modus

Im Streaming-Modus sendet die Node mehrere USO-Frames:

```json
// Chunk 1 (final: false)
{
  "header": { "final": false, "control": { "data": { "chunkIndex": 1 }}},
  "payload": "Das "
}

// Chunk 2 (final: false)
{
  "header": { "final": false, "control": { "data": { "chunkIndex": 2 }}},
  "payload": "Wetter "
}

// Final (final: true)
{
  "header": { "final": true, "control": { "data": { "totalChunks": 2 }}},
  "payload": "Das Wetter ist sonnig."
}
```

### Fehlerbehandlung

Bei Fehlern sendet die Node ein Control-USO:
```json
{
  "header": {
    "type": "control",
    "action": "error",
    "message": "n8n error: 500 - Internal Server Error"
  },
  "payload": ""
}
```

---

## 🔌 WebSocket Input Node (WSInNode)

### Beschreibung
Die WebSocket Input Node erstellt einen externen WebSocket-Endpunkt, über den externe Systeme Daten in den Flow einspeisen können.

### Konfiguration

**Port** (erforderlich)
- Typ: Number
- Default: `8081`
- Range: 1024-65535
- Beschreibung: Port für den WebSocket-Server

**Pfad** (erforderlich)
- Typ: String
- Default: `/ws/external`
- Beschreibung: WebSocket-Pfad (muss mit / beginnen)

**Datentyp**
- Typ: Select
- Default: `text`
- Optionen:
  - `text` - Text-Daten
  - `audio` - Audio-Daten (PCM)
  - `raw` - Raw/JSON-Daten

### Verhalten

1. **Start:** 
   - Erstellt WebSocket-Server auf konfiguriertem Port/Pfad
   - Wartet auf Client-Verbindungen
2. **Process:**
   - Empfängt Daten von externen Clients
   - Konvertiert zu USO-Frames
   - Emittiert USO an Flow
3. **Stop:** 
   - Schließt alle Client-Verbindungen
   - Stoppt WebSocket-Server

### USO-Erstellung

**Text-Daten:**
```json
{
  "header": {
    "id": "generated-uuid",
    "type": "text",
    "sourceId": "wsin-node-id",
    "timestamp": 1697123456789,
    "final": true,
    "websocketInfo": {
      "connectionId": "wsin_1697123450_abc123",
      "clientIp": "external",
      "connectedAt": 1697123450000
    }
  },
  "payload": "Text vom externen Client"
}
```

**Audio-Daten:**
```json
{
  "header": {
    "id": "generated-uuid",
    "type": "audio",
    "sourceId": "wsin-node-id",
    "timestamp": 1697123456789,
    "final": false,
    "audioMeta": {
      "sampleRate": 16000,
      "channels": 1,
      "encoding": "pcm_s16le"
    },
    "websocketInfo": {
      "connectionId": "wsin_1697123450_abc123",
      "clientIp": "external",
      "connectedAt": 1697123450000
    }
  },
  "payload": <Buffer>
}
```

### Client-Beispiele

**JavaScript/Browser:**
```javascript
const ws = new WebSocket('ws://localhost:8081/ws/external');

ws.onopen = () => {
  console.log('Connected to WSIn Node');
  ws.send('Hallo vom Browser!');
};

ws.onmessage = (event) => {
  console.log('Server response:', event.data);
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};
```

**Node.js:**
```javascript
const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:8081/ws/external');

ws.on('open', () => {
  console.log('Connected to WSIn Node');
  ws.send('Hallo von Node.js!');
});

ws.on('message', (data) => {
  console.log('Server response:', data.toString());
});
```

**Python:**
```python
import websocket
import json

ws = websocket.WebSocket()
ws.connect('ws://localhost:8081/ws/external')

# Text senden
ws.send('Hallo von Python!')

# JSON senden
data = {'message': 'Hallo', 'timestamp': 1697123456}
ws.send(json.dumps(data))

# Empfangen
result = ws.recv()
print(f'Server response: {result}')

ws.close()
```

### Anwendungsfälle

1. **Dashboard-Integration:** Senden Sie Daten von Web-Dashboards in Flows
2. **API-Gateway:** Nutzen Sie die Node als WebSocket-API-Endpunkt
3. **IoT-Integration:** Verbinden Sie zusätzliche IoT-Geräte ohne ESP32
4. **Testing:** Senden Sie Test-Daten für Flow-Entwicklung

---

## 📡 WebSocket Output Node (WSOutNode)

### Beschreibung
Die WebSocket Output Node sendet USO-Daten an einen externen WebSocket-Server. Sie implementiert Reconnect-Logik und flexible Output-Formate.

### Konfiguration

**Ziel WebSocket-URL** (erforderlich)
- Typ: String
- Default: `ws://localhost:8082`
- Beschreibung: WebSocket-URL des externen Servers
- Beispiel: `ws://external-server.com/endpoint`

**Sende-Format**
- Typ: Select
- Default: `uso_full`
- Optionen:
  - `payload_only` - Nur Payload senden
  - `uso_full` - Komplettes USO als JSON
  - `header_then_payload` - Header → Payload (wie ESP32)

**Fehler emittieren**
- Typ: Boolean
- Default: `false`
- Beschreibung: Sendet Control-USO bei Verbindungsfehlern

### Verhalten

1. **Start:** 
   - Verbindet zu externem WebSocket-Server
   - Startet Reconnect-Logik bei Bedarf
2. **Process:**
   - Sendet USO-Daten im konfigurierten Format
   - Reconnect bei Verbindungsabbruch
3. **Stop:** 
   - Schließt WebSocket-Verbindung
   - Stoppt Reconnect-Timer

### Sende-Formate

**1. Payload Only:**
```javascript
// Für Text-USO
ws.send("Text-Payload");

// Für Audio-USO
ws.send(Buffer<audio-data>);
```

**2. USO Full (JSON):**
```json
{
  "header": {
    "id": "session-uuid",
    "type": "text",
    "sourceId": "ai-node-id",
    "timestamp": 1697123456789,
    "final": true
  },
  "payload": "Text-Payload (oder Base64 für Binär)"
}
```

**3. Header then Payload:**
```javascript
// Frame 1: Header (JSON)
ws.send(JSON.stringify({
  "id": "session-uuid",
  "type": "audio",
  "sourceId": "tts-node-id",
  "timestamp": 1697123456789,
  "final": false
}));

// Frame 2: Payload (Binary)
ws.send(Buffer<audio-data>);
```

### Reconnect-Logik

- Max. 5 Reconnect-Versuche
- Exponential Backoff: 1s, 2s, 4s, 8s, 16s (max. 30s)
- Verbindungsfehler brechen Flow nicht ab (sofern emitErrors=false)

```javascript
// Log-Beispiel
INFO: WSOut connected
WARN: WSOut connection closed
INFO: Scheduling reconnect (attempt 1/5, delay 2000ms)
INFO: WSOut connected
```

### Server-Beispiele

**Node.js WebSocket-Server:**
```javascript
const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8082 });

wss.on('connection', (ws) => {
  console.log('WSOut Node connected');

  ws.on('message', (data) => {
    // Empfange Daten von WSOut Node
    console.log('Received:', data.toString());

    // Optional: Antworten
    ws.send('Received!');
  });

  ws.on('close', () => {
    console.log('WSOut Node disconnected');
  });
});

console.log('WebSocket server listening on ws://localhost:8082');
```

**Python WebSocket-Server:**
```python
import asyncio
import websockets

async def handle_client(websocket, path):
    print('WSOut Node connected')
    try:
        async for message in websocket:
            print(f'Received: {message}')
            await websocket.send('Received!')
    except websockets.exceptions.ConnectionClosed:
        print('WSOut Node disconnected')

start_server = websockets.serve(handle_client, 'localhost', 8082)

print('WebSocket server listening on ws://localhost:8082')
asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
```

### Anwendungsfälle

1. **Dashboard-Output:** Senden Sie Flow-Ergebnisse an Web-Dashboards
2. **External Logging:** Leiten Sie Daten zu externen Logging-Systemen
3. **Notification Services:** Verbinden Sie mit Benachrichtigungs-Servern
4. **Multi-System-Integration:** Senden Sie Daten an andere Orchestrator-Instanzen

---

## 🔗 Beispiel-Flows

### 1. Voice Assistant mit KI

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  Mic    │──▶│   STT   │──▶│   AI    │──▶│   TTS   │──▶│ Speaker │
│ (ESP32) │   │ (Vosk)  │   │  (n8n)  │   │ (Piper) │   │ (ESP32) │
└─────────┘   └─────────┘   └─────────┘   └─────────┘   └─────────┘
```

**Konfiguration:**
- AI Node: n8n mit ChatGPT-Integration
- n8n erhält: Text + Speaker-Info + WebSocket-Info
- n8n kann kontextbewusst antworten

### 2. External Input zu Voice Output

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  WS In  │──▶│   AI    │──▶│   TTS   │──▶│ Speaker │
│  :8081  │   │  (n8n)  │   │ (Piper) │   │ (ESP32) │
└─────────┘   └─────────┘   └─────────┘   └─────────┘
```

**Verwendung:** Browser sendet Text → KI verarbeitet → ESP32 spricht Antwort

### 3. Bidirektionale Integration

```
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  WS In  │──▶│Processing│──▶│  WS Out │──▶│ External│
│  :8081  │   │  Nodes   │   │  :8082  │   │  System │
└─────────┘   └─────────┘   └─────────┘   └─────────┘
```

**Verwendung:** Orchestrierung zwischen verschiedenen Systemen

### 4. Multi-Channel Output

```
                            ┌─────────┐
                       ┌───▶│ Speaker │
                       │    │ (ESP32) │
┌─────┐   ┌─────┐    ┌┴──┐ └─────────┘
│ Mic │──▶│ STT │───▶│AI │
└─────┘   └─────┘    └┬──┘ ┌─────────┐
                       │    │  WS Out │
                       └───▶│Dashboard│
                            └─────────┘
```

**Verwendung:** Gleiche AI-Antwort an mehrere Ausgänge

---

## 🧪 Testing

### AI Node testen

```bash
# n8n starten
docker run -it -p 5678:5678 n8nio/n8n:latest

# Test-Webhook
curl -X POST http://localhost:5678/webhook/test \
  -H "Content-Type: application/json" \
  -d '{
    "uso": {"id": "test", "type": "text"},
    "text": "Hallo n8n!",
    "metadata": {}
  }'
```

### WS In Node testen

```javascript
// test-wsin-client.js
const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:8081/ws/external');

ws.on('open', () => {
  console.log('Connected');
  ws.send('Test message');
});

ws.on('message', (data) => {
  console.log('Response:', data.toString());
  ws.close();
});
```

### WS Out Node testen

```javascript
// test-wsout-server.js
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8082 });

wss.on('connection', (ws) => {
  console.log('WSOut connected');
  ws.on('message', (data) => {
    console.log('Received:', data.toString());
  });
});

console.log('Test server on ws://localhost:8082');
```

---

## 📚 Weiterführende Ressourcen

- **n8n Dokumentation:** https://docs.n8n.io
- **WebSocket Protocol:** https://datatracker.ietf.org/doc/html/rfc6455
- **USO-Protokoll:** `backend/src/types/USO.ts`
- **Node-Entwicklung:** `NODES.md`

Bei Fragen oder Problemen öffnen Sie bitte ein Issue auf GitHub.

