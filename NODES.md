# Node-Dokumentation

Diese Datei beschreibt alle verfügbaren Nodes im IoT & Voice Orchestrator.

## 📋 Übersicht

| Node | Typ | Input | Output | Beschreibung |
|------|-----|-------|--------|--------------|
| **Mikrofon** | Input | - | Audio | Empfängt Audio von ESP32-Client |
| **Device TXT Input** | Input | - | Text | Empfängt Text von ESP32-Client |
| **STT** | Processing | Audio | Text | Speech-to-Text (Vosk) |
| **AI** | Processing | Text | Text | KI-Verarbeitung mit Flowise (Streaming) |
| **TTS** | Processing | Text | Audio | Text-to-Speech (Piper) |
| **Lautsprecher** | Output | Audio | - | Gibt Audio auf ESP32-Client wieder |
| **Device TXT Output** | Output | Text | - | Sendet Text an ESP32-Client |
| **WS-In** | Input | - | Any | WebSocket-Server (empfängt Daten) |
| **WS-Out** | Output | Any | - | WebSocket-Client (sendet Daten) |
| **Debug** | Utility | Any | - | Zeigt USO-Datenströme im Log |

## 🎤 Mikrofon Node (MicNode)

### Beschreibung
Die Mikrofon-Node empfängt Audio-Streams von einem ESP32-Client und leitet sie an die nächste Node im Flow weiter.

### Konfiguration

**Gerät** (erforderlich)
- Typ: Dropdown
- Beschreibung: Wählen Sie einen ESP32-Client mit Mikrofon-Fähigkeit
- Hinweis: Nur verbundene Geräte werden angezeigt

### Verhalten

1. **Start:** Node registriert sich für Audio-Streams vom konfigurierten Device
2. **Process:** 
   - Akzeptiert nur USO-Frames mit `type: 'audio'`
   - Filtert nach `sourceId` (muss dem konfigurierten Device entsprechen)
   - Leitet Audio-USOs direkt weiter
3. **Stop:** Beendet aktive Sessions

### USO-Transformation

**Input:** Keine (erste Node im Flow)

**Output:**
```json
{
  "header": {
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
  },
  "payload": <Buffer>
}
```

### ESP32-Integration

Der ESP32-Client muss:
1. Mit WebSocket verbunden sein
2. Capability `mic` gemeldet haben
3. Audio im PCM-Format senden (16kHz, mono, 16-bit)

**Beispiel ESP32-Code:**
```cpp
// Audio-Aufnahme starten
void startRecording() {
  // Header senden
  String header = "{\"id\":\"" + sessionId + "\",\"type\":\"audio\",\"sourceId\":\"esp32_001\",\"timestamp\":" + 
                  String(millis()) + ",\"final\":false,\"audioMeta\":{\"sampleRate\":16000,\"channels\":1,\"encoding\":\"pcm_s16le\"}}";
  webSocket.sendTXT(header);
  
  // Audio-Chunks senden
  while(recording) {
    int16_t audioBuffer[320]; // 20ms @ 16kHz
    i2s_read(I2S_NUM_0, audioBuffer, sizeof(audioBuffer), &bytesRead, portMAX_DELAY);
    webSocket.sendBIN((uint8_t*)audioBuffer, sizeof(audioBuffer));
  }
  
  // Finales Frame
  String finalHeader = "{\"id\":\"" + sessionId + "\",\"type\":\"audio\",\"sourceId\":\"esp32_001\",\"timestamp\":" + 
                       String(millis()) + ",\"final\":true}";
  webSocket.sendTXT(finalHeader);
}
```

---

## 🗣️ Speech-to-Text Node (STTNode)

### Beschreibung
Konvertiert Audio-Streams zu Text mittels Vosk Speech Recognition.

### Konfiguration

**Vosk Server URL** (erforderlich)
- Typ: String
- Default: `ws://localhost:2700`
- Beschreibung: WebSocket-URL des Vosk-Servers

**Sprache**
- Typ: Select
- Optionen: `de` (Deutsch), `en` (English)
- Default: `de`

**Sample Rate**
- Typ: Number
- Default: `16000`
- Beschreibung: Muss mit Audio-Input übereinstimmen

**Partielle Ergebnisse**
- Typ: Boolean
- Default: `false`
- Beschreibung: Sendet Zwischenergebnisse während der Erkennung

### Verhalten

1. **Start:** Node wird gestartet, aber keine Vosk-Verbindung erstellt
2. **Process:**
   - Akzeptiert nur USO mit `type: 'audio'`
   - Erstellt WebSocket-Verbindung zu Vosk (bei erstem Audio-Frame)
   - Streamt Audio-Buffer an Vosk
   - Emittiert Text-USOs bei Erkennungsergebnissen
3. **Stop:** Schließt alle Vosk-Verbindungen

### USO-Transformation

**Input:**
```json
{
  "header": {
    "type": "audio",
    "sourceId": "esp32_001",
    ...
  },
  "payload": <Buffer>
}
```

**Output:**
```json
{
  "header": {
    "type": "text",
    "sourceId": "stt-node-id",
    "final": true,
    "speakerInfo": {
      "confidence": 0.95,
      "language": "de"
    }
  },
  "payload": "Dies ist der erkannte Text"
}
```

### Vosk-Server Setup

**Docker:**
```bash
docker run -d -p 2700:2700 alphacep/kaldi-de:latest
```

**Manuell:**
```bash
git clone https://github.com/alphacep/vosk-server
cd vosk-server/websocket
pip3 install -r requirements.txt
python3 asr_server.py --model-path model
```

### Fehlerbehandlung

- **Verbindungsfehler:** Sendet Control-USO mit `action: 'error'`
- **Timeout:** 30 Sekunden ohne Audio = Verbindung wird geschlossen
- **Reconnect:** 3 Versuche mit exponential backoff

---

## 🔊 Text-to-Speech Node (TTSNode)

### Beschreibung
Konvertiert Text zu Audio mittels Piper TTS.

### Konfiguration

**Piper Server URL** (erforderlich)
- Typ: String
- Default: `http://localhost:5000`
- Beschreibung: HTTP-URL des Piper-Servers

**Stimme / Voice Model**
- Typ: Select
- Default: `de_DE-thorsten-medium`
- Optionen:
  - `de_DE-thorsten-medium` - Deutsch (männlich, mittel)
  - `de_DE-thorsten-low` - Deutsch (männlich, schnell)
  - `en_US-lessac-medium` - English (weiblich)
  - `en_GB-alan-medium` - English (männlich)

**Sample Rate**
- Typ: Number
- Default: `22050`
- Beschreibung: Output-Sample-Rate

**Streaming-Modus**
- Typ: Boolean
- Default: `false`
- Beschreibung: Teilt lange Texte in Sätze

**Erweiterte Einstellungen:**
- **Length Scale:** Sprechgeschwindigkeit (0.5-2.0, Default: 1.0)
- **Noise Scale:** Variabilität (0-1, Default: 0.667)
- **Noise W:** Weitere Variabilität (0-1, Default: 0.8)

### Verhalten

1. **Start:** Node wird gestartet
2. **Process:**
   - Akzeptiert nur USO mit `type: 'text'`
   - Ruft Piper-API auf (HTTP POST)
   - Emittiert Audio-USO mit generiertem Audio
3. **Stop:** Keine Cleanup-Aktionen nötig

### USO-Transformation

**Input:**
```json
{
  "header": {
    "type": "text",
    ...
  },
  "payload": "Hallo, dies ist ein Test."
}
```

**Output:**
```json
{
  "header": {
    "type": "audio",
    "sourceId": "tts-node-id",
    "final": true,
    "audioMeta": {
      "sampleRate": 22050,
      "channels": 1,
      "encoding": "pcm_s16le",
      "bitDepth": 16
    }
  },
  "payload": <Buffer>
}
```

### Piper-Server Setup

**Docker:**
```bash
docker run -d -p 5000:5000 \
  -v /path/to/models:/models \
  rhasspy/piper:latest \
  --model /models/de_DE-thorsten-medium.onnx
```

**Manuell:**
```bash
pip install piper-tts
piper --model de_DE-thorsten-medium --output-file output.wav < input.txt
```

---

## 📢 Lautsprecher Node (SpeakerNode)

### Beschreibung
Sendet Audio-Streams an einen ESP32-Client zur Wiedergabe.

### Konfiguration

**Gerät** (erforderlich)
- Typ: Dropdown
- Beschreibung: Wählen Sie einen ESP32-Client mit Lautsprecher-Fähigkeit
- Hinweis: Nur verbundene Geräte werden angezeigt

### Verhalten

1. **Start:** Node wird gestartet
2. **Process:**
   - Akzeptiert nur USO mit `type: 'audio'`
   - Prüft ob Device verbunden ist
   - Sendet Audio-USO über WebSocket an Device
   - Signalisiert Ende bei `final: true`
3. **Stop:** Stoppt aktive Wiedergabe

### USO-Transformation

**Input:**
```json
{
  "header": {
    "type": "audio",
    ...
  },
  "payload": <Buffer>
}
```

**Output:** Keine (letzte Node im Flow)

### ESP32-Integration

Der ESP32-Client muss:
1. Mit WebSocket verbunden sein
2. Capability `speaker` gemeldet haben
3. Audio im PCM-Format empfangen können

**Beispiel ESP32-Code:**
```cpp
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_TEXT: {
      // USO-Header empfangen
      DynamicJsonDocument doc(1024);
      deserializeJson(doc, payload);
      
      if (doc["type"] == "audio") {
        sessionId = doc["id"].as<String>();
        
        if (doc["final"] == true) {
          stopPlayback();
        }
      }
      break;
    }
    
    case WStype_BIN: {
      // Audio-Daten empfangen
      int16_t* audioBuffer = (int16_t*)payload;
      size_t samples = length / 2;
      
      // Über I2S ausgeben
      size_t bytesWritten;
      i2s_write(I2S_NUM_0, audioBuffer, length, &bytesWritten, portMAX_DELAY);
      break;
    }
  }
}
```

---

## 📝 Device TXT Input Node (DeviceTxtInputNode)

### Beschreibung
Die Device TXT Input Node empfängt Text-Streams von einem ESP32-Client und leitet sie an die nächste Node im Flow weiter. Diese Node ist für Geräte mit `txt_input` Capability gedacht.

### Konfiguration

**Gerät** (erforderlich)
- Typ: Dropdown
- Beschreibung: Wählen Sie einen ESP32-Client mit txt_input-Fähigkeit
- Hinweis: Nur verbundene Geräte werden angezeigt

### Verhalten

1. **Start:** Node registriert sich für Text-Streams vom konfigurierten Device
2. **Process:**
   - Akzeptiert nur USO-Frames mit `type: 'text'`
   - Filtert nach `sourceId` (muss dem konfigurierten Device entsprechen)
   - Leitet Text-USOs direkt weiter
   - Sendet automatisch Debug-Events für alle empfangenen Texte
3. **Stop:** Beendet aktive Sessions

### USO-Transformation

**Input:** Keine (erste Node im Flow)

**Output:**
```json
{
  "header": {
    "id": "txt_python-voice-device_1234567890",
    "type": "text",
    "sourceId": "python-voice-device",
    "timestamp": 1697123456789,
    "final": true
  },
  "payload": "Hallo, wie geht es dir?"
}
```

### ESP32-Integration

Der ESP32-Client muss:
1. Mit WebSocket verbunden sein
2. Capability `txt_input` gemeldet haben
3. Text im USO-Protokoll senden (Header + Payload)

**Beispiel ESP32-Code:**
```cpp
// Text senden
void sendText(const String& text) {
  // Header senden
  String header = "{\"id\":\"" + sessionId + "\",\"type\":\"text\",\"sourceId\":\"esp32_001\",\"timestamp\":" + String(millis()) + ",\"final\":true}";
  webSocket.sendTXT(header);
  
  // Payload senden
  webSocket.sendTXT(text);
}
```

### Automatische Debug-Events

Die Device TXT Input Node sendet automatisch Debug-Events für alle empfangenen Texte. Diese erscheinen im Event-Panel des Flow-Editors, **ohne dass eine zusätzliche Debug-Node benötigt wird**.

---

## 📤 Device TXT Output Node (DeviceTxtOutputNode)

### Beschreibung
Die Device TXT Output Node sendet Text-Streams an einen ESP32-Client zur Anzeige. Diese Node ist für Geräte mit `txt_output` Capability gedacht.

### Konfiguration

**Gerät** (erforderlich)
- Typ: Dropdown
- Beschreibung: Wählen Sie einen ESP32-Client mit txt_output-Fähigkeit
- Hinweis: Nur verbundene Geräte werden angezeigt

### Verhalten

1. **Start:** Node wird gestartet
2. **Process:**
   - Akzeptiert nur USO mit `type: 'text'`
   - Prüft ob Device verbunden ist
   - Sendet Text-USO über WebSocket an Device
   - Unterstützt Streaming (token-für-token bei AI-Antworten)
3. **Stop:** Stoppt aktive Wiedergabe

### USO-Transformation

**Input:**
```json
{
  "header": {
    "type": "text",
    ...
  },
  "payload": "Das Wetter ist heute sonnig."
}
```

**Output:** Keine (letzte Node im Flow)

### ESP32-Integration

Der ESP32-Client muss:
1. Mit WebSocket verbunden sein
2. Capability `txt_output` gemeldet haben
3. Text im USO-Protokoll empfangen können

**Beispiel ESP32-Code:**
```cpp
void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_TEXT: {
      DynamicJsonDocument doc(1024);
      deserializeJson(doc, payload);
      
      if (doc["type"] == "text") {
        awaitingTextPayload = true;
        sessionId = doc["id"].as<String>();
      }
      break;
    }
    
    case WStype_BIN: {
      // Text-Payload empfangen
      String text = String((char*)payload);
      displayText(text); // Auf Display anzeigen
      break;
    }
  }
}
```

### Streaming-Unterstützung

Die Node unterstützt **token-für-token Streaming** bei AI-Antworten:

```
AI Node → Device TXT Output
  "Das"     → "Das"
  " Wetter" → " Wetter"
  " ist"    → " ist"
```

Der Text wird **live** auf dem ESP32-Display angezeigt, während die KI antwortet.

---

## 🐛 Debug Node (DebugNode)

### Beschreibung
Zeigt USO-Datenströme im Log an (für Entwicklung und Debugging).

### Konfiguration

**Aktiviert**
- Typ: Boolean
- Default: `true`

**Payload anzeigen**
- Typ: Boolean
- Default: `true`
- Beschreibung: Zeigt den Inhalt des Payloads

**Max. Payload-Größe**
- Typ: Number
- Default: `1024`
- Beschreibung: Maximale Bytes für Payload-Anzeige

### Verhalten

1. **Start:** Node wird gestartet
2. **Process:**
   - Akzeptiert USOs aller Typen
   - Loggt Header und Payload-Info
   - Emittiert `debug:log` Event für Frontend
3. **Stop:** Node wird gestoppt

### Log-Output

```
🔍 DEBUG NODE - USO Received
{
  nodeId: 'debug-1',
  header: {
    id: 'session-uuid',
    type: 'audio',
    sourceId: 'mic-node-1',
    timestamp: 1697123456789,
    final: false
  }
}

📦 DEBUG NODE - Binary Payload
{
  nodeId: 'debug-1',
  payloadSize: 640,
  preview: 'ff00ff00ff00...'
}
```

---

## 🤖 AI Node (AINode)

### Beschreibung
Die AI Node integriert Flowise AI-Flows für intelligente Text-Verarbeitung mit **Echtzeit-Streaming**.

### Konfiguration

**Flowise-Server** (erforderlich)
- Typ: Dropdown
- Beschreibung: Wählen Sie einen konfigurierten Flowise-Server
- Hinweis: Muss in den Einstellungen hinzugefügt werden

**Streaming aktivieren** ⚡
- Typ: Boolean
- Default: `true` (empfohlen!)
- Beschreibung: Sendet AI-Antwort token-für-token (wie ChatGPT)

### Verhalten

1. **Start:** Node wird gestartet, keine Verbindung zu Flowise
2. **Process:**
   - Akzeptiert nur USO mit `type: 'text'`
   - Sendet Text an Flowise-API
   - Bei Streaming: Emittiert jeden Token sofort (`final: false`)
   - Am Ende: Finales USO mit kompletter Antwort (`final: true`)
3. **Stop:** Beendet laufende Streams

### USO-Transformation

**Input:**
```json
{
  "header": {
    "type": "text",
    "sourceId": "stt-node-1",
    ...
  },
  "payload": "Wie ist das Wetter?"
}
```

**Output (Streaming):**

*Chunk 1:*
```json
{
  "header": {
    "id": "session-123",
    "type": "text",
    "sourceId": "ai_node",
    "timestamp": 1697123456789,
    "final": false,
    "control": {
      "action": "ai_response",
      "data": {
        "model": "flowise",
        "event": "token",
        "chunkNumber": 1
      }
    }
  },
  "payload": "Das"
}
```

*Chunk 2-N:*
```json
{
  "header": {
    "final": false,
    ...
  },
  "payload": " Wetter"
}
```

*Final:*
```json
{
  "header": {
    "final": true,
    "control": {
      "action": "ai_response",
      "data": {
        "model": "flowise",
        "streamingComplete": true,
        "totalChunks": 147,
        "totalLength": 523
      }
    }
  },
  "payload": "Das Wetter ist heute sonnig..."
}
```

### Flowise-Server Setup

**Docker:**
```bash
docker run -d -p 3000:3000 \
  -v /path/to/flowise:/root/.flowise \
  flowiseai/flowise
```

**URL-Format:**
```
http://localhost:3000/api/v1/prediction/your-chatflow-id
```

### Features

✅ **Echtzeit-Streaming**
- Token-für-Token Ausgabe
- Start-to-First-Token: < 1 Sekunde
- Token-to-Token: ~0.1-0.2 Sekunden

✅ **Server-Sent Events (SSE)**
- Unterstützt Flowise SSE-Format
- Automatisches Parsing verschachtelter Events
- Event-Typen: `start`, `token`, `metadata`, `end`, `error`

✅ **Automatisches Error-Handling**
- Retry bei Verbindungsfehlern
- Timeout-Handling
- Fehler-Events an Frontend

### Beispiel-Flow mit Streaming

```
┌────────────┐    ┌────────────┐    ┌────────────┐
│    STT     │───▶│  AI Node   │───▶│  WS-Out    │
│  (Vosk)    │    │ Streaming: │    │ (content   │
│            │    │    ✅ AN   │    │   only)    │
└────────────┘    └────────────┘    └────────────┘
                         │
                         │ Token für Token
                         ▼
               "Das" → "Wetter" → "ist" → ...
```

### Siehe auch:
- **[STREAMING_GUIDE.md](STREAMING_GUIDE.md)** - Komplette Streaming-Dokumentation
- **[SERVICES.md](SERVICES.md)** - Flowise Service Details

---

## 📡 WebSocket In Node (WSInNode)

### Beschreibung
Die WS-In Node erstellt einen **WebSocket-Server** und empfängt Daten von externen Clients.

### Konfiguration

**Port** (erforderlich)
- Typ: Number
- Default: `8080`
- Beschreibung: TCP-Port für den WebSocket-Server
- Bereich: `8080-8090` (im Docker freigegeben)

**Pfad** (erforderlich)
- Typ: String
- Default: `/endpoint`
- Beschreibung: WebSocket-Endpunkt-Pfad
- Beispiel: `/endpoint` → `ws://localhost:8080/endpoint`

**Akzeptiere-Format**
- Typ: Select
- Default: `auto`
- Optionen:
  - `auto` - Automatische Erkennung (USO oder Plain Text)
  - `uso_json` - Nur komplette USO-Objekte
  - `text_plain` - Nur Plain Text
  - `binary_raw` - Binärdaten (Audio, etc.)

### Verhalten

1. **Start:** 
   - Erstellt WebSocket-Server auf konfiguriertem Port
   - Wartet auf Client-Verbindungen
   - Zeigt "Healthy" Status wenn Server läuft
   
2. **Process:**
   - Empfängt Nachrichten von verbundenen Clients
   - Konvertiert zu USO-Format (falls nötig)
   - Emittiert USO an nächste Node im Flow
   
3. **Stop:**
   - Schließt alle Client-Verbindungen sauber
   - Stoppt WebSocket-Server
   - Entfernt alle Event-Listener (verhindert "Zombie-Connections")

### USO-Transformation

**Input:** WebSocket-Nachricht (Text oder Binary)

**Output:**
```json
{
  "header": {
    "id": "generated-session-id",
    "type": "text",
    "sourceId": "wsin_node_id",
    "timestamp": 1697123456789,
    "final": true,
    "context": {
      "remoteAddress": "192.168.1.100",
      "path": "/endpoint"
    }
  },
  "payload": "Empfangene Nachricht"
}
```

### Health-Status

Die Node zeigt ihren Status im Flow-Editor:

- 🟢 **Healthy:** Server läuft, N Clients verbunden
- 🟡 **Degraded:** Server läuft, keine Clients
- 🔴 **Error:** Server konnte nicht gestartet werden

### Beispiel-Client (Python)

```python
import asyncio
import websockets

async def test_client():
    uri = "ws://localhost:8080/endpoint"
    async with websockets.connect(uri) as websocket:
        await websocket.send("Hallo vom Client!")
        response = await websocket.recv()
        print(f"Antwort: {response}")

asyncio.run(test_client())
```

### Docker Port-Mapping

Im `docker-compose.yml` sind Ports 8080-8090 freigegeben:

```yaml
services:
  backend:
    ports:
      - "8080:8080"
      - "8081:8081"
      - "8082:8082"
      - "8083:8083"
      - "8084:8084"
      - "8085:8085"
      - "8086:8086"
      - "8087:8087"
      - "8088:8088"
      - "8089:8089"
      - "8090:8090"
```

### Test-Script

**Verwende `test-ws-in.py` zum Testen:**

```bash
# WS-In Node Port & Pfad konfigurieren
export WS_PORT=8080
export WS_PATH=/endpoint

# Client starten
./test-ws-in.sh
```

Siehe **[TEST_SCRIPTS_README.md](TEST_SCRIPTS_README.md)** für Details.

---

## 📤 WebSocket Out Node (WSOutNode)

### Beschreibung
Die WS-Out Node erstellt einen **WebSocket-Client** und sendet Daten an einen externen Server.

### Konfiguration

**Ziel-URL** (erforderlich)
- Typ: String
- Default: `ws://localhost:8084/endpoint`
- Beschreibung: Komplette WebSocket-URL des Ziel-Servers
- Format: `ws://host:port/path` oder `wss://` für verschlüsselt

**Sende-Format** ⚡
- Typ: Select
- Default: `uso_full`
- Optionen:
  - `content_only` - **Nur Content** (reiner Text/Daten) - **Empfohlen für Streaming!**
  - `payload_only` - Nur Payload (ohne Header)
  - `uso_full` - Komplettes USO-Objekt als JSON
  - `header_then_payload` - Header als JSON, dann Payload als Binary

**Datentyp**
- Typ: Select
- Default: `text`
- Optionen:
  - `text` - Text/JSON Daten
  - `audio` - Audio-Buffer
  - `raw` - Binärdaten

**Automatisches Reconnect**
- Typ: Boolean
- Default: `true`
- Beschreibung: Verbindet automatisch neu bei Verbindungsverlust

**Reconnect-Versuche**
- Typ: Number
- Default: `5`
- Beschreibung: Maximale Anzahl Reconnect-Versuche

### Verhalten

1. **Start:**
   - Stellt Verbindung zum Ziel-Server her
   - Zeigt "Healthy" Status bei erfolgreicher Verbindung
   
2. **Process:**
   - Akzeptiert USOs aller Typen
   - Konvertiert zu konfiguriertem Format
   - Sendet über WebSocket an Server
   
3. **Stop:**
   - Schließt WebSocket-Verbindung sauber
   - Entfernt alle Event-Listener (verhindert "Zombie-Connections")
   - Stoppt Reconnect-Logik

### Health-Status

Die Node zeigt ihren Status im Flow-Editor:

- 🟢 **Healthy:** Verbunden
- 🟡 **Degraded:** Verbindung getrennt, versuche Reconnect (N/5)
- 🔴 **Error:** Verbindung fehlgeschlagen, keine Reconnects mehr

### Sende-Formate im Detail

#### 1. Content Only (empfohlen für Streaming!)

**Input USO:**
```json
{
  "header": { ... },
  "payload": "Das Wetter ist sonnig"
}
```

**Gesendet über WebSocket:**
```
Das Wetter ist sonnig
```

Perfekt für:
- ✅ Live-Streaming AI-Antworten
- ✅ Terminal-Ausgabe
- ✅ Minimaler Overhead

#### 2. Payload Only

**Gesendet:**
```json
"Das Wetter ist sonnig"
```

#### 3. USO Full (JSON)

**Gesendet:**
```json
{
  "header": {
    "id": "session-123",
    "type": "text",
    ...
  },
  "payload": "Das Wetter ist sonnig"
}
```

#### 4. Header → Payload

**Gesendet (2 Nachrichten):**
1. Text: `{"id":"session-123","type":"text",...}`
2. Binary: `<Buffer>`

### Beispiel-Flow mit Streaming

```
┌────────────┐    ┌────────────┐    ┌────────────┐
│  AI Node   │───▶│  WS-Out    │───▶│ External   │
│ Streaming: │    │  Format:   │    │  Server    │
│   ✅ AN    │    │  content   │    │ (test-ws-  │
│            │    │   _only    │    │   out.py)  │
└────────────┘    └────────────┘    └────────────┘
       │                 │                 │
       │ final: false    │ "Das"           │ Zeigt live:
       │ "Das"           │ ──────────────▶ │ Das
       │                 │                 │
       │ final: false    │ " Wetter"       │
       │ " Wetter"       │ ──────────────▶ │ Wetter
       │                 │                 │
       │ final: false    │ " ist"          │
       │ " ist"          │ ──────────────▶ │ ist
       │                 │                 │
       │ final: true     │ " sonnig"       │
       │ " sonnig"       │ ──────────────▶ │ sonnig
```

### Test-Script

**Verwende `test-ws-out.py` zum Testen:**

```bash
# WS-Out Test-Server starten
export WS_PORT=8084
export WS_PATH=/endpoint
./test-ws-out.sh

# Im Flow Editor: WS-Out Node konfigurieren
# URL: ws://localhost:8084/endpoint
# Format: content_only

# Sende Daten durch den Flow!
```

Siehe **[TEST_SCRIPTS_README.md](TEST_SCRIPTS_README.md)** für Details.

### Cleanup & Zombie-Connections

**Problem:** Alte Verbindungen blieben aktiv nach Flow-Stop/Löschung.

**Lösung (implementiert):**
- `ws.removeAllListeners()` vor Close
- Explizite `ws.close(1000, 'Node stopped')` 
- Reconnect-State zurücksetzen
- Cleanup in `start()` für alte Connections

→ **Keine "Zombie-Connections" mehr!** ✅

### Siehe auch:
- **[TEST_SCRIPTS_README.md](TEST_SCRIPTS_README.md)** - Test-Scripts
- **[STREAMING_GUIDE.md](STREAMING_GUIDE.md)** - Streaming mit WS-Out

---

## 🔗 Beispiel-Flow: Voice Assistant

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  Mikrofon   │───▶│     STT     │───▶│   Debug     │───▶│     TTS     │
│  (ESP32)    │    │   (Vosk)    │    │             │    │   (Piper)   │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                  │
                                                                  ▼
                                                          ┌─────────────┐
                                                          │ Lautsprecher│
                                                          │   (ESP32)   │
                                                          └─────────────┘
```

**Flow-Konfiguration:**

1. **Mikrofon Node:**
   - Gerät: `esp32_001`

2. **STT Node:**
   - Service URL: `ws://localhost:2700`
   - Sprache: `de`
   - Sample Rate: `16000`

3. **Debug Node:**
   - Aktiviert: ✓
   - Payload anzeigen: ✓

4. **TTS Node:**
   - Service URL: `http://localhost:5000`
   - Stimme: `de_DE-thorsten-medium`

5. **Lautsprecher Node:**
   - Gerät: `esp32_001`

**Datenfluss:**

1. ESP32 sendet Audio → Mikrofon Node
2. Audio → STT Node → Text: "Wie ist das Wetter?"
3. Text → Debug Node (Log-Ausgabe)
4. Text → TTS Node → Audio: "Das Wetter ist..."
5. Audio → Lautsprecher Node → ESP32 spielt ab

---

## 🔧 Entwicklung eigener Nodes

### Backend (Node-Klasse)

```typescript
import { BaseNode } from '../../types/INode';
import { UniversalStreamObject } from '../../types/USO';
import { EventEmitter } from 'events';

export class MyCustomNode extends BaseNode {
  async start(): Promise<void> {
    this.isRunning = true;
    // Initialisierung
  }

  async process(uso: UniversalStreamObject, emitter: EventEmitter): Promise<void> {
    try {
      // USO verarbeiten
      const result = this.doSomething(uso);
      
      // Neues USO emittieren
      this.emitOutput(emitter, result);
    } catch (error) {
      this.emitError(emitter, error, uso.header.id);
    }
  }

  async stop(): Promise<void> {
    this.isRunning = false;
    // Cleanup
  }
}
```

### Node-Factory registrieren

```typescript
// In node-factory.ts
case 'mycustom':
  return new MyCustomNode(id, type, config);
```

### Frontend (Konfiguration)

```tsx
// src/components/node-ui/MyCustomNodeConfig.tsx
export default function MyCustomNodeConfig({ config, onChange }) {
  return (
    <div>
      <input
        value={config.myParameter}
        onChange={(e) => onChange('myParameter', e.target.value)}
      />
    </div>
  );
}
```

### NodePanel erweitern

```typescript
// In NodePanel.tsx
case 'mycustom':
  return <MyCustomNodeConfig config={config} onChange={handleConfigChange} />;
```

---

## 📚 Weitere Ressourcen

- **Backend README:** `backend/README.md`
- **Frontend README:** `frontend/README.md`
- **USO-Protokoll:** `backend/src/types/USO.ts`
- **INode-Interface:** `backend/src/types/INode.ts`

Bei Fragen oder Problemen öffnen Sie bitte ein Issue auf GitHub.

