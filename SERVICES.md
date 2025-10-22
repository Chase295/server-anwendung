# Externe Service-APIs

Diese Dokumentation beschreibt die Kommunikation mit externen Services (Vosk, Piper, Flowise) und deren API-Spezifikationen.

---

## 📋 Inhaltsverzeichnis

- [Vosk (Speech-to-Text)](#vosk-speech-to-text)
- [Piper (Text-to-Speech)](#piper-text-to-speech)
- [Flowise (AI Flow Engine)](#flowise-ai-flow-engine)

---

## 🎤 Vosk (Speech-to-Text)

### Protokoll
**WebSocket-basiert** (`ws://` oder `wss://`)

### Server-Anforderungen
- Vosk-Server mit aktiviertem WebSocket-Endpoint
- Empfohlenes Docker-Image: `alphacep/kaldi-de` oder ähnliche Vosk-Modelle

### Verbindungsaufbau

```javascript
const ws = new WebSocket('ws://vosk-server:2700');

// Nach erfolgreicher Verbindung Konfiguration senden
ws.on('open', () => {
  ws.send(JSON.stringify({
    config: {
      sample_rate: 16000,  // Audio-Sample-Rate in Hz
      words: false          // true = Wort-Timestamps, false = nur Text
    }
  }));
});
```

### Audio-Daten senden

```javascript
// Binäre Audio-Daten (PCM 16-bit, mono) als Buffer senden
ws.send(audioBuffer);

// Ende des Audio-Streams signalisieren
ws.send(JSON.stringify({ eof: 1 }));
```

### Antwort-Format

**Partielle Ergebnisse** (während der Erkennung):
```json
{
  "partial": "das ist ein test"
}
```

**Finale Ergebnisse** (nach Pause oder EOF):
```json
{
  "text": "Das ist ein Test.",
  "confidence": 0.98
}
```

Mit `words: true`:
```json
{
  "text": "Das ist ein Test.",
  "result": [
    {
      "word": "das",
      "start": 0.0,
      "end": 0.2,
      "conf": 0.99
    },
    {
      "word": "ist",
      "start": 0.2,
      "end": 0.4,
      "conf": 0.98
    }
  ]
}
```

### Implementierung im Backend

**Service:** `backend/src/modules/services/vosk.service.ts`

```typescript
// Verbindung aufbauen
const connection = await voskService.connect(sessionId, {
  serviceUrl: 'ws://vosk-server:2700',
  sampleRate: 16000,
  language: 'de',
  words: false
});

// Audio-Daten senden
connection.ws.send(audioBuffer);

// Events empfangen
connection.emitter.on('partial', (text) => {
  console.log('Partial:', text);
});

connection.emitter.on('result', (result) => {
  console.log('Final:', result.text, 'Confidence:', result.confidence);
});
```

### Connection Test

```javascript
// Einfacher WebSocket-Test
const ws = new WebSocket('ws://vosk-server:2700');

ws.on('open', () => {
  console.log('✅ Verbindung erfolgreich');
  ws.close();
});

ws.on('error', (error) => {
  console.error('❌ Verbindungsfehler:', error);
});
```

---

## 🔊 Piper (Text-to-Speech)

### Protokoll
**WebSocket-basiert** (`ws://` oder `wss://`)

### Server-Anforderungen
- Piper-TTS-Server mit WebSocket-Support
- Verfügbare Voice-Modelle (z.B. `de_DE-thorsten-medium`)

### Verbindungsaufbau

```javascript
const ws = new WebSocket('ws://piper-server:10300');

ws.on('open', () => {
  console.log('Piper verbunden');
});
```

### Synthese-Anfrage

```javascript
const request = {
  text: "Hallo, wie geht es dir?",
  voice: "de_DE-thorsten-medium",
  speaker_id: 0,                  // Optional: Multi-Speaker-Modelle
  length_scale: 1.0,              // Geschwindigkeit (0.5 = schneller, 2.0 = langsamer)
  noise_scale: 0.667,             // Variabilität der Stimme
  noise_w: 0.8                    // Phonem-Variabilität
};

ws.send(JSON.stringify(request));
```

### Antwort-Format

**Audio-Stream** (binär):
- Format: WAV (PCM 16-bit, mono, 22050 Hz)
- Gestreamt in Chunks
- Nach vollständiger Übertragung wird die Verbindung geschlossen oder kann wiederverwendet werden

```javascript
ws.on('message', (audioChunk) => {
  // audioChunk ist ein Buffer mit WAV-Audio-Daten
  // Kann direkt abgespielt oder gespeichert werden
  processAudioChunk(audioChunk);
});

ws.on('close', () => {
  console.log('Audio-Stream abgeschlossen');
});
```

### Implementierung im Backend

**Service:** `backend/src/modules/services/piper.service.ts`

**Hinweis:** Die aktuelle Backend-Implementierung verwendet noch HTTP POST statt WebSocket. Dies wird in einer zukünftigen Version angepasst.

```typescript
// HTTP-basiert (aktuell)
const audioBuffer = await piperService.synthesize(text, {
  serviceUrl: 'http://piper-server:10300',
  voiceModel: 'de_DE-thorsten-medium',
  lengthScale: 1.0,
  noiseScale: 0.667,
  noiseW: 0.8
});
```

**Geplant (WebSocket):**
```typescript
const connection = await piperService.connect(sessionId, config);
connection.ws.send(JSON.stringify({ text, voice, ... }));
connection.emitter.on('audio', (chunk) => { ... });
```

### Connection Test

```javascript
// WebSocket-Test
const ws = new WebSocket('ws://piper-server:10300');

ws.on('open', () => {
  // Test-Synthese
  ws.send(JSON.stringify({
    text: "Test",
    voice: "de_DE-thorsten-medium"
  }));
});

ws.on('message', (data) => {
  console.log('✅ Audio empfangen:', data.length, 'bytes');
  ws.close();
});

ws.on('error', (error) => {
  console.error('❌ Verbindungsfehler:', error);
});
```

---

## 🤖 Flowise (AI Flow Engine)

### Protokoll
**HTTP REST API mit Server-Sent Events (SSE)** für Streaming

### Server-Anforderungen
- Flowise-Server mit konfigurierten Flows
- API-Keys für gesicherte Endpoints
- HTTPS empfohlen (selbst-signierte Zertifikate werden unterstützt)

### API-Endpoint

```
POST https://flowise.example.com/api/v1/prediction/{flowId}
```

### Authentifizierung

```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
```

### Request-Format

**Standard-Anfrage:**
```json
{
  "question": "Wie geht es dir?",
  "streaming": false
}
```

**Streaming-Anfrage (SSE):**
```json
{
  "question": "Erkläre mir Quantencomputing",
  "streaming": true
}
```

**Mit zusätzlichen Parametern:**
```json
{
  "question": "Übersetze ins Deutsche: Hello World",
  "streaming": true,
  "overrideConfig": {
    "temperature": 0.7,
    "maxTokens": 500
  }
}
```

### Antwort-Format

**Ohne Streaming:**
```json
{
  "text": "Mir geht es gut, danke!",
  "metadata": {
    "flowId": "49b3fd51-c6de-45de-8080-c58cb850a5b7",
    "timestamp": "2025-10-19T10:30:00Z"
  }
}
```

**Mit Streaming (SSE):**
```
event: start
data: {"flowId":"49b3fd51..."}

event: token
data: {"token":"Mir "}

event: token
data: {"token":"geht "}

event: token
data: {"token":"es "}

event: token
data: {"token":"gut!"}

event: end
data: {}
```

**Bei Fehlern:**
```
event: error
data: {"message":"Invalid API key"}
```

### Server-Sent Events (SSE) Verarbeitung

```javascript
const response = await fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    question: text,
    streaming: true
  })
});

// SSE-Stream verarbeiten
const reader = response.body.getReader();
const decoder = new TextDecoder();

let buffer = '';
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split('\n');
  buffer = lines.pop() || '';
  
  for (const line of lines) {
    if (line.startsWith('event: ')) {
      const event = line.substring(7);
      
      if (event === 'token') {
        // Nächste Zeile enthält die Token-Daten
      } else if (event === 'error') {
        // Fehler behandeln
      }
    }
    
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.substring(6));
      if (data.token) {
        console.log(data.token); // Token ausgeben
      }
    }
  }
}
```

### Implementierung im Backend

**Service:** `backend/src/modules/services/flowise.service.ts`

```typescript
// Flowise-Script parsen (aus Flowise-UI kopiert)
const config = flowiseService.parseFlowiseScript(`
import requests

API_URL = "https://flowise.example.com/api/v1/prediction/abc123"
headers = {"Authorization": "Bearer xyz789"}

def query(payload):
    response = requests.post(API_URL, headers=headers, json=payload)
    return response.json()
`);

// Ergebnis:
// {
//   apiUrl: "https://flowise.example.com/api/v1/prediction/abc123",
//   authToken: "xyz789"
// }

// USO an Flowise senden
const response = await flowiseService.sendUSOToFlowise(uso, {
  apiUrl: config.apiUrl,
  authToken: config.authToken,
  streaming: true,
  timeout: 120000
});

// Response enthält:
// {
//   text: "AI-Antwort...",
//   metadata: { ... }
// }
```

### Connection Test

```javascript
// Test mit Streaming
const response = await fetch(apiUrl, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'Accept': 'text/event-stream'
  },
  body: JSON.stringify({
    question: 'test',
    streaming: true
  })
});

if (response.ok) {
  // Prüfe auf SSE-Events
  const reader = response.body.getReader();
  const { value } = await reader.read();
  const chunk = new TextDecoder().decode(value);
  
  if (chunk.includes('event: error')) {
    console.error('❌ Flowise-Fehler');
  } else if (chunk.includes('event: token') || chunk.includes('event: start')) {
    console.log('✅ Verbindung erfolgreich');
  }
  
  reader.cancel();
}
```

### Python-Script aus Flowise UI

Flowise generiert automatisch Python-Code, der in die Anwendung eingefügt werden kann:

```python
import requests

API_URL = "https://flowise.example.com/api/v1/prediction/49b3fd51-c6de-45de-8080-c58cb850a5b7"
headers = {"Authorization": "Bearer dkSjdaLRLVD8d9YUyuppzvDBB3HUujvQloEf5vtdcIc"}

def query(payload):
    response = requests.post(API_URL, headers=headers, json=payload)
    return response.json()

output = query({
    "question": "Hey, how are you?",
})
```

Dieser Code wird von `parseFlowiseScript()` automatisch geparst und die `apiUrl` und `authToken` extrahiert.

### SSL-Zertifikate

Bei selbst-signierten Zertifikaten:

```typescript
// Backend (automatisch)
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

// Frontend/Node.js
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
```

---

## 🔄 Vergleich der Services

| Feature | Vosk | Piper | Flowise |
|---------|------|-------|---------|
| **Protokoll** | WebSocket | WebSocket* | HTTP + SSE |
| **Datenformat** | Binär (Audio) | Binär (Audio) | JSON + Text |
| **Streaming** | ✅ Echtzeit | ✅ Chunks | ✅ SSE-Events |
| **Authentifizierung** | Keine | Keine | Bearer Token |
| **SSL** | Optional | Optional | Empfohlen |
| **Bidirektional** | ✅ Ja | ❌ Nein | ❌ Nein |
| **Timeout** | 10s | 30s | 120s |
| **Reconnect** | ✅ Ja | ⚠️ Limitiert | ❌ Nein |

*Hinweis: Piper-Backend verwendet aktuell noch HTTP POST, WebSocket-Migration geplant.

---

## 🛠️ Backend-Services

### Vosk-Service
- **Datei:** `backend/src/modules/services/vosk.service.ts`
- **Controller:** `backend/src/modules/services/vosk-servers.controller.ts`
- **Schema:** `backend/src/modules/services/schemas/vosk-server.schema.ts`
- **Test-Endpoint:** `GET /api/vosk-servers/test/:id`

### Piper-Service
- **Datei:** `backend/src/modules/services/piper.service.ts`
- **Controller:** `backend/src/modules/services/piper-servers.controller.ts`
- **Schema:** `backend/src/modules/services/schemas/piper-server.schema.ts`
- **Test-Endpoint:** `GET /api/piper-servers/test/:id`

### Flowise-Service
- **Datei:** `backend/src/modules/services/flowise.service.ts`
- **Controller:** `backend/src/modules/services/flowise-servers.controller.ts`
- **Schema:** `backend/src/modules/services/schemas/flowise-server.schema.ts`
- **Test-Endpoints:** 
  - `POST /api/flowise-servers/test/:id`
  - `POST /api/flowise-servers/test-script` (Script-Parser + Test)

---

## 📚 Weitere Ressourcen

### Vosk
- **Offizielle Dokumentation:** https://alphacephei.com/vosk/
- **Docker-Images:** https://hub.docker.com/r/alphacep/kaldi-de
- **Modelle:** https://alphacephei.com/vosk/models

### Piper
- **GitHub:** https://github.com/rhasspy/piper
- **Voice-Modelle:** https://github.com/rhasspy/piper/blob/master/VOICES.md
- **Docker:** https://hub.docker.com/r/rhasspy/piper

### Flowise
- **Offizielle Website:** https://flowiseai.com/
- **GitHub:** https://github.com/FlowiseAI/Flowise
- **Dokumentation:** https://docs.flowiseai.com/
- **API-Dokumentation:** https://docs.flowiseai.com/api-reference

---

## ⚠️ Wichtige Hinweise

1. **Timeouts:** 
   - Vosk: 10 Sekunden
   - Piper: 30 Sekunden
   - Flowise: 120 Sekunden (AI-Antworten können länger dauern)

2. **SSL-Zertifikate:**
   - Selbst-signierte Zertifikate werden akzeptiert
   - In Produktion echte Zertifikate verwenden!

3. **Fehlerbehandlung:**
   - Alle Services haben umfangreiche Fehlerbehandlung
   - Toast-Benachrichtigungen im Frontend
   - Detaillierte Logs im Backend

4. **Connection Management:**
   - Vosk: Automatische Reconnects
   - Piper: Keine automatischen Reconnects
   - Flowise: Keine persistenten Verbindungen

5. **Performance:**
   - Vosk: Echtzeit-Transkription
   - Piper: ~2-5 Sekunden pro Satz
   - Flowise: Abhängig vom AI-Modell (5-60 Sekunden)

---

## 🔍 Debugging

### Vosk-Probleme

```bash
# WebSocket-Test mit wscat
npm install -g wscat
wscat -c ws://vosk-server:2700

# Nach Verbindung:
> {"config": {"sample_rate": 16000}}
```

### Piper-Probleme

```bash
# WebSocket-Test
wscat -c ws://piper-server:10300

# Nach Verbindung:
> {"text": "Test", "voice": "de_DE-thorsten-medium"}
```

### Flowise-Probleme

```bash
# HTTP-Test mit curl
curl -X POST \
  https://flowise.example.com/api/v1/prediction/abc123 \
  -H "Authorization: Bearer xyz789" \
  -H "Content-Type: application/json" \
  -d '{"question": "test", "streaming": false}'

# Streaming-Test
curl -X POST \
  https://flowise.example.com/api/v1/prediction/abc123 \
  -H "Authorization: Bearer xyz789" \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"question": "test", "streaming": true}'
```

### Backend-Logs prüfen

```bash
# Docker-Logs anzeigen
docker-compose logs -f backend

# Nach Service filtern
docker-compose logs -f backend | grep "VoskService"
docker-compose logs -f backend | grep "PiperService"
docker-compose logs -f backend | grep "FlowiseService"
```

---

**Stand:** v2.1.0 (Oktober 2025)

