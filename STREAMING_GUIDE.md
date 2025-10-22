# 🔥 Streaming Guide - Echtzeit AI-Antworten

Komplette Anleitung für das **Streaming-Feature** des IoT & Voice Orchestrators mit Flowise AI.

## 📖 Inhaltsverzeichnis

1. [Was ist Streaming?](#was-ist-streaming)
2. [Warum Streaming?](#warum-streaming)
3. [Wie funktioniert es?](#wie-funktioniert-es)
4. [Konfiguration](#konfiguration)
5. [Technische Details](#technische-details)
6. [Troubleshooting](#troubleshooting)

---

## Was ist Streaming?

**Streaming** bedeutet, dass die AI-Antwort **Wort für Wort** (Token für Token) gesendet wird, während sie generiert wird - ähnlich wie bei ChatGPT.

### Vorher (ohne Streaming):
```
Benutzer: "Erzähl mir eine Geschichte"
[⏳ 5-10 Sekunden Wartezeit...]
AI: "Es war einmal ein tapferer Ritter..."
```

### Jetzt (mit Streaming):
```
Benutzer: "Erzähl mir eine Geschichte"
AI: Es [⚡ sofort]
AI: war [⚡ sofort]
AI: einmal [⚡ sofort]
AI: ein [⚡ sofort]
AI: tapferer [⚡ sofort]
AI: Ritter... [⚡ sofort]
```

---

## Warum Streaming?

### ✅ Vorteile:

1. **Schnellere Reaktion**
   - Erste Tokens kommen **sofort** (< 1 Sekunde)
   - Benutzer sieht sofort dass etwas passiert
   
2. **Bessere Benutzererfahrung**
   - Keine lange Wartezeit ohne Feedback
   - Live-Anzeige wie bei ChatGPT
   
3. **Effizientere Ausgabe**
   - Text kann bereits gesprochen werden während er noch generiert wird
   - Perfekt für Voice-Assistenten
   
4. **Niedriger Latenz**
   - Start-to-First-Token: ~0.5-1 Sekunde
   - Token-to-Token: ~0.1-0.2 Sekunden

### ❌ Ohne Streaming:

- Wartezeit: 5-30 Sekunden je nach Antwort-Länge
- Keine Rückmeldung während der Generierung
- Benutzer weiß nicht ob System noch arbeitet

---

## Wie funktioniert es?

### 1. **Architektur-Überblick**

```
┌─────────────┐
│   Benutzer  │
│  (WS-In)    │
└──────┬──────┘
       │ "Hallo AI!"
       ▼
┌─────────────┐
│  AI Node    │ ← Streaming: ON ✅
└──────┬──────┘
       │ Sendet zu Flowise
       ▼
┌─────────────┐
│   Flowise   │
│   Server    │ → Generiert Token für Token
└──────┬──────┘
       │ Server-Sent Events (SSE)
       │ event: token
       │ data: "Hallo"
       │
       │ event: token
       │ data: "!"
       ▼
┌─────────────┐
│  AI Node    │ ← Empfängt jeden Token
└──────┬──────┘
       │ Erstellt USO für jeden Token
       │ final: false, false, false, ... true
       ▼
┌─────────────┐
│  WS-Out     │
│   Node      │
└──────┬──────┘
       │ Sendet jeden Token sofort
       ▼
┌─────────────┐
│ test-ws-    │
│  out.py     │ → Zeigt Text live
└─────────────┘
```

### 2. **Datenfluss im Detail**

#### Phase 1: Start
```json
{
  "event": "start",
  "data": ""
}
```

#### Phase 2: Tokens (mehrere)
```json
{
  "event": "token",
  "data": "Hello"
}
{
  "event": "token",
  "data": " "
}
{
  "event": "token",
  "data": "world"
}
```

#### Phase 3: Metadaten (optional)
```json
{
  "event": "metadata",
  "data": "{\"chatId\":\"abc\",\"messageId\":\"xyz\"}"
}
```

#### Phase 4: Ende
```json
{
  "event": "end",
  "data": ""
}
```

### 3. **USO-Format beim Streaming**

Die AI Node erstellt für **jeden Token** ein eigenes USO:

**Token 1-N (Streaming-Chunks):**
```json
{
  "header": {
    "id": "session-123",
    "type": "text",
    "sourceId": "ai_node",
    "timestamp": 1697123456789,
    "final": false,  // ⚡ WICHTIG: false = weitere Chunks kommen!
    "control": {
      "action": "ai_response",
      "data": {
        "model": "flowise",
        "event": "token",
        "chunkNumber": 1
      }
    }
  },
  "payload": "Hello"  // Nur dieses eine Wort/Token
}
```

**Finales USO (Abschluss):**
```json
{
  "header": {
    "id": "session-123",
    "type": "text",
    "sourceId": "ai_node",
    "timestamp": 1697123460000,
    "final": true,  // ⚡ WICHTIG: true = Stream beendet!
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
  "payload": "Hello world!"  // Kompletter Text (optional)
}
```

---

## Konfiguration

### 1. **AI Node Einstellungen**

Im Flow-Editor:

```
┌─────────────────────────────────┐
│  KI / Flowise Node              │
├─────────────────────────────────┤
│                                 │
│  Flowise-Server: [Dropdown ▼]  │
│  ✅ Streaming aktivieren        │  ← Standard: AN
│                                 │
└─────────────────────────────────┘
```

**Optionen:**
- ✅ **Streaming aktivieren (empfohlen)**
  - Tokens werden sofort gesendet
  - Beste User-Experience
  - Niedrigste Latenz
  
- ❌ **Streaming deaktivieren**
  - Wartet auf komplette Antwort
  - Nur empfohlen wenn Downstream-Node komplette Antwort benötigt

### 2. **Flowise Server Konfiguration**

Dein Flowise-Server muss **nichts Spezielles** konfigurieren - Streaming wird automatisch aktiviert wenn die AI Node es anfordert.

**API-URL Format:**
```
http://localhost:3000/api/v1/prediction/your-chatflow-id
```

### 3. **WS-Out Node für Streaming**

Empfohlene Einstellungen:

```
┌─────────────────────────────────┐
│  WebSocket Out Node             │
├─────────────────────────────────┤
│  Ziel-URL:                      │
│    ws://localhost:8084/endpoint │
│                                 │
│  Sende-Format:                  │
│    ⚪ Nur Content ← Empfohlen!  │
│    ⚪ Komplettes USO (JSON)     │
│                                 │
└─────────────────────────────────┘
```

**"Nur Content"** ist perfekt für Streaming weil:
- Nur der reine Text wird gesendet
- Kein JSON-Overhead
- Live-Display im Terminal

---

## Technische Details

### Server-Sent Events (SSE)

Flowise nutzt das **SSE-Protokoll** für Streaming:

```
HTTP/1.1 200 OK
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

event: start
data: 

event: token
data: Hello

event: token
data:  world

event: end
data: 
```

### FlowiseService Implementation

**Backend: `flowise.service.ts`**

```typescript
async sendToFlowiseStreaming(
  config: FlowiseConfig,
  question: string,
  sessionId: string | undefined,
  chunkCallback: (chunk: string, event: string) => void,
  metadataCallback?: (metadata: any) => void
): Promise<void>
```

**Wichtige Features:**
1. ✅ Parst Server-Sent Events
2. ✅ Unterstützt verschachteltes JSON-Format von Flowise
3. ✅ Callback für jeden Token
4. ✅ Sammelt Metadaten
5. ✅ Error-Handling

### Verschachteltes Event-Format

**Problem:** Flowise sendet Events manchmal verschachtelt:

```json
{
  "event": "message",
  "data": "{\"event\":\"token\",\"data\":\"Hello\"}"
}
```

**Lösung:** Der Parser entpackt automatisch:
```typescript
if (event === 'message') {
  const nested = JSON.parse(data);
  actualEvent = nested.event;  // "token"
  actualData = nested.data;    // "Hello"
}
```

### AI Node Implementation

**Backend: `ai.node.ts`**

```typescript
private async processStreaming(
  uso: UniversalStreamObject,
  text: string,
  emitter: EventEmitter
): Promise<void> {
  let fullText = '';
  let chunkCount = 0;

  await this.flowiseService.sendToFlowiseStreaming(
    this.flowiseConfig!,
    text,
    uso.header.id,
    (chunk: string, event: string) => {
      // Für jeden Token:
      fullText += chunk;
      chunkCount++;
      
      // Erstelle USO mit final=false
      const chunkUso = this.createOutputUSO(
        uso,
        chunk,
        false,  // Nicht final!
        { event, chunkNumber: chunkCount }
      );
      
      this.emitOutput(emitter, chunkUso);
    }
  );
  
  // Am Ende: Finales USO mit final=true
  const finalUso = this.createOutputUSO(
    uso,
    fullText,
    true,
    { streamingComplete: true, totalChunks: chunkCount }
  );
  
  this.emitOutput(emitter, finalUso);
}
```

### test-ws-out.py Implementation

**Streaming-Erkennung:**

```python
# Session-Tracking
streaming_sessions = {}

# Chunk empfangen
if not is_final:
    if session_id not in streaming_sessions:
        # ERSTER CHUNK - Zeige Header
        print("🔥 STREAMING gestartet!")
        print("AI Antwort: ", end='', flush=True)
        
        streaming_sessions[session_id] = {
            'chunks': [],
            'chunk_count': 0
        }
    
    # Live-Anzeige
    print(payload, end='', flush=True)
    streaming_sessions[session_id]['chunks'].append(payload)

# Finales Paket
else:
    if session_id in streaming_sessions:
        print("\n✓ STREAMING abgeschlossen!")
        full_text = ''.join(session['chunks'])
        print(f"Gesamtlänge: {len(full_text)} Zeichen")
```

---

## Test-Workflow

### Kompletter Test-Ablauf:

```bash
# 1. Backend starten
cd "Server_anwendung"
docker-compose up -d

# 2. Test-Server starten (Terminal 1)
./test-ws-out.sh

# 3. Sende Frage (Terminal 2)
./test-ws-in.sh
# Eingabe: "Erzähl mir eine kurze Geschichte"

# 4. Beobachte Live-Streaming in Terminal 1! ✨
```

### Erwartete Ausgabe:

**Terminal 1 (test-ws-out.py):**

```
[14:50:12.123] 📩 Nachricht #1 empfangen
  → Client ID: 4392873296

  → USO-Format erkannt!
    • USO-Typ: text
    • Source: ai_node_123
    • Session ID: abc-123-def...
    • Context:
      - person: Moritz Haslbeck
      - location: Schlafzimmer
      - time: 2025-10-21 14:50:12

  🔥 STREAMING gestartet!

  AI Antwort: Once upon a time, in a small village nestled between rolling hills, there lived a curious young fox named Finn. Finn loved exploring the forest...

[14:50:18.456] 📩 Final-Nachricht #78 empfangen
  ✓ STREAMING abgeschlossen!
    • Chunks: 147
    • Gesamtlänge: 523 Zeichen
    • Server-Chunks: 147
    • Server-Länge: 523 Zeichen
────────────────────────────────────────────────────────────
```

**Beobachtungen:**
- ✅ Text erscheint **sofort** Wort für Wort
- ✅ Keine Verzögerung zwischen Tokens
- ✅ Komplette Statistik am Ende
- ✅ Context-Info nur **einmal** am Anfang

---

## Troubleshooting

### Problem: Keine Tokens ankommen

**Symptome:**
```
totalChunks: 0
totalLength: 0
Leerer Payload
```

**Lösung:**
1. Backend neu starten: `docker-compose restart backend`
2. Prüfe Flowise-Server ist erreichbar
3. Prüfe Backend-Logs: `docker-compose logs -f backend | grep Flowise`

### Problem: "Unknown Flowise event"

**Symptome:**
```
debug [FlowiseService] Unknown Flowise event { event: "message", data: "..." }
```

**Ursache:** Verschachteltes Event-Format (bereits behoben in v2.0)

**Lösung:** Backend-Version prüfen und aktualisieren

### Problem: Streaming funktioniert nicht

**Checkliste:**
- [ ] AI Node: "Streaming aktivieren" ist ✅ AN
- [ ] Flowise-Server ist erreichbar
- [ ] Backend wurde neu kompiliert (`npm run build`)
- [ ] Backend wurde neu gestartet (`docker-compose restart backend`)
- [ ] test-ws-out.py verwendet neueste Version

### Problem: Text erscheint nicht live

**Symptome:** Alle Chunks auf einmal statt einzeln

**Lösung:** 
- `test-ws-out.py` verwendet jetzt `end='', flush=True` für Live-Display
- Stelle sicher du hast die neueste Version

### Problem: Doppelte Antworten

**Symptome:** Text erscheint zweimal

**Ursache:** Sowohl Chunks als auch finales Paket enthalten den Text

**Lösung:** Normal! Das finale Paket ist die Zusammenfassung.

---

## Performance-Metriken

### Typische Werte:

| Metrik | Wert | Beschreibung |
|--------|------|--------------|
| **Start-to-First-Token** | 0.5-1.5s | Zeit bis erster Token |
| **Token-to-Token** | 0.1-0.3s | Zeit zwischen Tokens |
| **Tokens pro Sekunde** | 10-30 | Generierungs-Geschwindigkeit |
| **Overhead pro Token** | ~400 bytes | USO-Header + Metadaten |
| **Netzwerk-Latenz** | < 10ms | Lokales Netzwerk |

### Vergleich:

```
Ohne Streaming:
├─ Frage senden: 0.1s
├─ AI denkt: 10s ⏳⏳⏳
└─ Antwort empfangen: 0.1s
Total: 10.2s bis erste Anzeige

Mit Streaming:
├─ Frage senden: 0.1s
├─ Erster Token: 0.8s ⚡
├─ Token 2-147: 0.2s pro Token ⚡⚡⚡
└─ Fertig: 10.0s
Total: 0.9s bis erste Anzeige! 🚀
```

**11x schnellere Wahrnehmung!**

---

## Best Practices

### 1. **Verwende Streaming immer wenn möglich**
   - Standard-Setting: ✅ AN
   - Nur deaktivieren wenn Downstream-Node komplette Antwort braucht

### 2. **WS-Out: "Nur Content" für Live-Display**
   - Perfekt für Text-Anzeige
   - Minimal Overhead
   - Beste Performance

### 3. **Error-Handling**
   - AI Node hat automatisches Retry
   - Reconnect bei Verbindungsverlust
   - Fehler werden geloggt

### 4. **Testing**
   - Verwende `test-ws-out.py` für Live-Ansicht
   - Debug-Events Panel im Frontend für Details
   - Backend-Logs für Troubleshooting

### 5. **Production-Ready**
   - Streaming ist stabil und getestet
   - Kein zusätzlicher Setup nötig
   - Funktioniert mit allen Flowise-Flows

---

## Weiterführende Dokumentation

- **[TEST_SCRIPTS_README.md](TEST_SCRIPTS_README.md)** - Test-Scripts Verwendung
- **[NODES.md](NODES.md)** - Alle Node-Dokumentationen
- **[DEBUG_EVENTS_GUIDE.md](DEBUG_EVENTS_GUIDE.md)** - Debug-Events Panel
- **[CONTEXT_MANAGEMENT.md](CONTEXT_MANAGEMENT.md)** - Context-System

---

## Changelog

### Version 2.0 (Oktober 2025)
- ✅ Flowise Streaming implementiert
- ✅ Server-Sent Events (SSE) Parser
- ✅ Verschachteltes Event-Format unterstützt
- ✅ Live-Display in test-ws-out.py
- ✅ AI Node: enableStreaming Config-Option
- ✅ Automatisches Chunk-Tracking
- ✅ Health-Status für WS-Out Node
- ✅ Umfassende Dokumentation

---

**Erstellt:** Oktober 2025  
**Version:** 2.0  
**Autor:** AI Assistant & Moritz Haslbeck

