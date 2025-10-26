# 🎙️ Audio-Test-Scripts für Voice-Pipeline

Diese Scripts ermöglichen das Testen der kompletten **Voice-Pipeline** (Audio → STT → AI → TTS → Audio).

## 📁 Verfügbare Scripts

### 1. `test-ws-in-audio.py` - Audio-Client für WS-In-Node

Ein WebSocket-Client der **rohe Audio-Daten** an die WS-In-Node sendet (wie der ESP32).

**Features:**
- ✅ Sendet rohe Audio-Binärdaten (16kHz, 16-bit PCM mono)
- ✅ Ohne JSON-Header (Raw Audio Mode)
- ✅ Direkte Mikrofon-Erfassung
- ✅ Live-Transkription in der Debug-Node sichtbar

**Verwendung:**
```bash
python3 test-ws-in-audio.py
```

### 2. `test-ws-out-audio.py` - Audio-Empfänger für WS-Out-Node

Ein WebSocket-Server der **Audio-Daten** von der WS-Out-Node empfängt und abspielt.

**Features:**
- ✅ Empfängt Audio-USOs von WS-Out-Node
- ✅ Spielt Audio direkt über Lautsprecher ab (ffplay/afplay)
- ✅ Unterstützt verschiedene Audio-Formate

**Verwendung:**
```bash
python3 test-ws-out-audio.py
```

### 3. `test-ws-out-audio.sh` - Start-Script

Shell-Script zum einfachen Starten des Audio-Empfängers.

**Verwendung:**
```bash
./test-ws-out-audio.sh
```

---

## 🚀 Kompletter Voice-Pipeline Test

### Voraussetzungen

```bash
# Python 3.7+ mit websockets
pip3 install websockets

# Optional: ffmpeg für Audio-Abgabe
brew install ffmpeg  # macOS
sudo apt install ffmpeg  # Linux
```

### Schritt 1: Flow erstellen

Erstelle einen Flow mit folgenden Nodes:

```
┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐
│  WS-In    │───▶│  STT      │───▶│  AI       │───▶│  WS-Out   │
│  Node     │    │  (Vosk)   │    │ (Flowise) │    │  Node     │
└───────────┘    └───────────┘    └───────────┘    └───────────┘
```

**Konfiguration:**

1. **WS-In-Node:**
   - Port: `8081`
   - Pfad: `/ws/external`
   - Datentyp: **Audio**
   - **Raw Audio Mode:** ✅ Aktiviert

2. **STT-Node:**
   - Vosk-Server: Dein Vosk-Server
   - **Finaler Ergebnis Debounce:** 500ms
   - Sample Rate: 16000 Hz

3. **AI-Node:**
   - Flowise-Server: Dein Flowise-Server
   - Streaming-Modus: ✅ Aktiviert (optional)

4. **WS-Out-Node:**
   - Ziel-URL: `ws://localhost:8091/endpoint`
   - Datentyp: Audio
   - Sende-Format: **Content Only**

### Schritt 2: Audio-Empfänger starten (Terminal 1)

```bash
./test-ws-out-audio.sh
```

Du siehst:
```
============================================================
  WebSocket-Out Audio Tester (Server)
============================================================

🌐 Server: 0.0.0.0:8091/endpoint
📝 Protokoll: USO mit Audio-Daten

✓ Lokale IP-Adressen:
  ws://localhost:8091/endpoint

⏳ Starte WebSocket-Server...
✓ Server läuft!

────────────────────────────────────────────────────────────
Warte auf Verbindungen von WS-Out-Node...
Beende mit CTRL+C
────────────────────────────────────────────────────────────
```

### Schritt 3: Flow starten

1. Öffne Web-UI: `http://localhost:3001`
2. Starte deinen Flow
3. Stelle sicher, dass alle Nodes **grün** sind

### Schritt 4: Audio senden (Terminal 2)

```bash
python3 test-ws-in-audio.py
```

**Spreche in das Mikrofon:** "Hallo, wie geht es dir?"

### Schritt 5: Echtzeit-Ausgabe beobachten

**Debug Events Panel (Web-UI):**
```
┌─────────────────────────────────────────────────────┐
│ Debug Events                    🟢 Verbunden         │
├─────────────────────────────────────────────────────┤
│ TEXT  [PARTIAL] STT             14:30:01.234        │
│ Hallo wie geht                                     │
│                                                     │
│ TEXT  [PARTIAL] STT             14:30:01.445        │
│ Hallo wie geht es                                 │
│                                                     │
│ TEXT  [FINAL] STT                14:30:02.123       │
│ Hallo wie geht es dir                             │
│                                                     │
│ TEXT  [PARTIAL] AI               14:30:02.456      │
│ Sehr gut, danke! Wie                             │
│                                                     │
│ AUDIO TTS                        14:30:03.789      │
│ [16kHz PCM Mono, 245 B]                           │
└─────────────────────────────────────────────────────┘
```

**Terminal 1 (Audio-Empfänger):**
```
[14:30:03.789] 📩 Audio-USO #1 empfangen
  → USO-Typ: Audio
  → Session ID: abc-123...
  → Final: true
  → Audio-Meta:
      - Sample Rate: 16000
      - Channels: 1
      - Encoding: pcm_s16le
🔊 Spiele Audio ab (245 bytes)...
✓ Audio abgespielt
```

**Terminal 2 (Audio-Sender):**
```
⏳ Verbinde zu ws://localhost:8081/ws/external...
✓ Verbunden!

🎙️  Spreche jetzt... (STRG+C zum Beenden)

[Halloween Hallows]
→ Audio gesendet: 8000 bytes
[halten Hallows die]
→ Audio gesendet: 8000 bytes
...
```

---

## 🔍 Verständnis der Pipeline

### Phase 1: Audio → STT (Speech-to-Text)

**Input:** Rohe Audio-Daten vom Mikrofon (16kHz, 16-bit PCM)
**Output:** Transkribierter Text

**Features:**
- **LIVE Partielle Ergebnisse:** Text wird live während des Sprechens gezeigt
- **FINAL Ergebnis:** Kompletter Text nach 500ms Pause
- **Debounce-Mechanismus:** Verhindert mehrfaches Senden derselben Nachricht

### Phase 2: STT → AI (KI-Verarbeitung)

**Input:** Finale Text-Ergebnisse (final: true)
**Output:** AI-Antwort als Text

**Features:**
- **Streaming-Modus:** Token-für-Token Ausgabe (optional)
- **Context-Informationen:** Zeit, Person, Location werden weitergegeben

### Phase 3: AI → TTS (Text-to-Speech)

**Input:** Finale AI-Antwort (final: true)
**Output:** Audio-Daten

**Features:**
- **WebSocket zu Piper:** Direkte Verbindung zu Piper-Server
- **16kHz Audio:** Optimal für Streaming

### Phase 4: TTS → WS-Out (Audio-Ausgabe)

**Input:** Audio-Chunks von TTS
**Output:** Audio über WebSocket

---

## 📊 Konfiguration

### WS-In-Node: Raw Audio Mode

**WICHTIG:** Raw Audio Mode muss aktiviert sein!

```
✅ Daten im Flow empfangen ✅
   ↓ Datentyp: Audio
   ↓ Raw Audio Mode: AN
```

**Was passiert:**
- Client sendet **nur Audio-Daten** (keine JSON-Header)
- WS-In-Node erstellt automatisch USO-Header
- Audio wird direkt an STT-Node weitergegeben

### STT-Node: Debounce-Delay

**Konfiguration:**
```
Finaler Ergebnis Debounce: 500ms
```

**Verhalten:**
- Partielle Ergebnisse: Sofort angezeigt ([LIVE] Badge)
- Finales Ergebnis: Nach 500ms Pause ([FINAL] Badge)

### AI-Node: Streaming (Optional)

**Konfiguration:**
```
Streaming-Modus: ✅ Aktiviert
```

**Verhalten:**
- Token-für-Token Ausgabe
- Live-Anzeige in Debug Events
- Bessere User Experience

### WS-Out-Node: Content Only

**Konfiguration:**
```
Sende-Format: Content Only
Datentyp: Audio
```

**Verhalten:**
- Sendet **nur** Audio-Daten (keine Metadaten)
- Weniger Overhead für Streaming

---

## 🛠️ Troubleshooting

### Problem: Kein Audio empfangen

**Lösung:**
1. Prüfe ob Flow gestartet ist
2. Prüfe WS-In-Node Status (grün?)
3. Prüfe Raw Audio Mode ist aktiviert
4. Überprüfe Backend-Logs: `docker-compose logs backend -f`

### Problem: Keine Transkription

**Lösung:**
1. Prüfe Vosk-Server ist erreichbar
2. Prüfe STT-Node Verbindung
3. Überprüfe Audio-Format (16kHz, mono)

### Problem: TTS gibt nichts aus

**Lösung:**
1. Prüfe Piper-Server ist erreichbar
2. Prüfe AI-Node empfängt finale Ergebnisse
3. Überprüfe TTS-Node Konfiguration

### Problem: Audio stottert bei TTS

**Erklärung:** Das ist normal wenn zu kleine Text-Chunks kommen.

**Lösung:**
- Deaktiviere Streaming in AI-Node für stabileren Flow
- Verwende größere Buffer-Size in TTS-Node (falls später implementiert)

---

## 📋 Zusammenfassung

### Kompletter Test-Ablauf

```bash
# Terminal 1: Audio-Empfänger
./test-ws-out-audio.sh

# Terminal 2: Backend (läuft)
docker-compose up

# Terminal 3: Audio-Client
python3 test-ws-in-audio.py
```

**In der Web-UI:**
1. Flow öffnen
2. Flow starten
3. Debug Events Panel beobachten

**In Terminal 1:**
- Audio wird empfangen und abgespielt

**In Terminal 3:**
- Audio wird aufgenommen und gesendet

---

**Erstellt:** Oktober 2025  
**Aktualisiert:** Oktober 2025  
**Version:** 1.0


