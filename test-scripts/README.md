# Test Scripts

Sammlung von Test-Scripts für das IoT Orchestrator System.

## Übersicht

Dieses Verzeichnis enthält verschiedene Test-Scripts:

### Device Client
- **`device-client.py`** - Python-Client zum Simulieren eines IoT-Gerätes
  - Verbindet sich mit dem WebSocket-Gateway (Port 8080)
  - Unterstützt multiple Capabilities: `mic`, `speaker`, `txt_input`, `txt_output`
  - Audio: Sendet RAW Audio vom Mikrofon und empfängt Audio vom Lautsprecher
  - Text: Sendet und empfängt Text-Nachrichten
  - Capability-basierte Struktur: Einfach Capabilities in `DEVICE_CAPABILITIES` Liste hinzufügen/entfernen
  - Wird als "python-voice-device" in allen entsprechenden Nodes sichtbar
- **`device-client.sh`** - Shell-Script zum Starten des Device-Clients
- **`setup-device-secret.sh`** - Automatische Secret-Konfiguration

### Signal Device Client
- **`device-signal.py`** - Python-Client mit Signal-Messaging-Integration
  - Verbindet sich mit dem WebSocket-Gateway (Port 8080) für IoT Orchestrator
  - Verbindet sich mit Signal WebSocket (`wss://signal.local.chase295.de/v1/receive/{number}`)
  - Unterstützt Capabilities: `txt_input`, `txt_output`
  - **Signal → IoT Orchestrator**: Empfängt Signal-Nachrichten und leitet sie als USO Text-Nachrichten weiter
    - Signal-Metadaten (sourceNumber, sourceName) werden in USO-Metadaten mitgesendet
    - Ignoriert `typingMessage`-Events automatisch
  - **IoT Orchestrator → Signal**: Empfängt TXT Output vom IoT Orchestrator und sendet über Signal REST API
    - Unterstützt Streaming (Token-für-Token)
    - Sendet vollständige Nachrichten über Signal REST API (`https://signal.local.chase295.de/v2/send`)
  - SSL-Verifizierung für selbst-signierte Zertifikate optional deaktivierbar
  - Wird als "signal-device" in TXT Input/Output Nodes sichtbar
- **`device-signal.sh`** - Shell-Script zum Starten des Signal-Device-Clients

### Piper TTS
- **`piper_test.py`** - Test-Script für Piper TTS-Server
- **`piper_test.sh`** - Shell-Script zum Starten

### Vosk STT
- **`vosk-mic-test.py`** - Test-Script für Vosk STT mit Mikrofon
- **`vosk-mic-test.sh`** - Shell-Script zum Starten

### WebSocket Nodes
- **`test-ws-in.py`** / **`test-ws-in.sh`** - Text-Eingabe via WebSocket
- **`test-ws-in-audio.py`** / **`test-ws-in-audio.sh`** - Audio-Eingabe via WebSocket (RAW Audio Mode)
- **`test-ws-out.py`** / **`test-ws-out.sh`** - Text-Ausgabe via WebSocket
- **`test-ws-out-audio.py`** / **`test-ws-out-audio.sh`** - Audio-Ausgabe via WebSocket

## Quick Start

### Device Client verwenden

```bash
# 1. Client starten (verwendet Standard API Key)
./device-client.sh

# Oder manuell:
python3 device-client.py
```

**Einfache Konfiguration:**
- Ändere den API Key in `device-client.py` (Zeile 56): `API_KEY = "dein-api-key"`
- Oder setze als Umgebungsvariable: `SIMPLE_API_KEY=dein-api-key` in `docker-compose.yml`

Der Device wird als **"python-voice-device"** in Mic- und Speaker-Nodes sichtbar.

### Signal Device Client verwenden

```bash
# 1. Abhängigkeiten installieren
pip install websockets httpx

# 2. Signal-Device starten
./device-signal.sh

# Oder manuell:
python3 device-signal.py
```

**Konfiguration:**
- Signal-Nummern in `device-signal.py` anpassen:
  - `SIGNAL_RECEIVE_NUMBER = "+4915122215051"` - Eigene Nummer (für Empfang)
  - `SIGNAL_SEND_NUMBER = "+4915122215051"` - Eigene Nummer (für Senden)
  - `SIGNAL_RECIPIENT_NUMBER = "+4917681328005"` - Standard-Empfänger
- Signal-Server URL anpassen: `SIGNAL_SERVER_URL = "signal.local.chase295.de"`
- SSL-Verifizierung: `SIGNAL_VERIFY_SSL = False` (für selbst-signierte Zertifikate)

Der Device wird als **"signal-device"** in TXT Input/Output Nodes sichtbar.

**Signal → IoT Orchestrator:**
1. Signal-Nachricht wird empfangen
2. Text wird extrahiert
3. Wird als USO Text-Nachricht an IoT Orchestrator gesendet
4. Signal-Metadaten (Absender-Nummer, Name) in USO-Metadaten enthalten

**IoT Orchestrator → Signal:**
1. TXT Output Node sendet Text
2. Signal Device empfängt TXT Output
3. Text wird über Signal REST API versendet
4. Unterstützt Streaming (Token-für-Token, wie ChatGPT)

### Mit dem Flow Editor verwenden

**Audio-Flow:**
1. Mic-Node hinzufügen und Device "python-voice-device" auswählen
2. Speaker-Node hinzufügen und Device "python-voice-device" auswählen
3. Flow starten
4. Im Client Enter drücken und sprechen
5. Audio wird über den Lautsprecher ausgegeben

**Text-Flow:**
1. Device TXT Input Node hinzufügen und Device "python-voice-device" auswählen
2. AI-Node hinzufügen (optional)
3. Device TXT Output Node hinzufügen und Device "python-voice-device" auswählen
4. Flow starten
5. Im Client `'t'` + Enter drücken (Text-Modus)
6. Text eingeben und mit Enter absenden
7. Text erscheint im Event-Panel und wird an die KI weitergeleitet

**Signal-Flow:**
1. Device TXT Input Node hinzufügen und Device "signal-device" auswählen
2. AI-Node hinzufügen (optional)
3. Device TXT Output Node hinzufügen und Device "signal-device" auswählen
4. Flow starten
5. Signal-Nachricht an konfigurierte Nummer senden → wird automatisch an IoT Orchestrator weitergeleitet
6. TXT Output vom IoT Orchestrator wird automatisch über Signal versendet

**Capability-Konfiguration:**

Die Capabilities können in `device-client.py` konfiguriert werden:

```python
DEVICE_CAPABILITIES = [
    'mic',           # Mikrofon vorhanden
    'speaker',       # Lautsprecher vorhanden
    'txt_output',    # Text-Ausgabe verfügbar
    'txt_input',     # Text-Eingabe verfügbar
]
```

Nur die konfigurierten Capabilities werden beim Backend registriert und erscheinen in den entsprechenden Nodes.

## Dokumentation

- **`TROUBLESHOOTING.md`** - Häufige Probleme und Lösungen
- **`TEST_SCRIPTS_README_AUDIO.md`** - Audio-Tests dokumentieren
- **`VOSK_TEST_README.md`** - Vosk STT Tests
- **`WS_IN_RAW_AUDIO_SETUP.md`** - RAW Audio Mode Setup

## Anforderungen

**Device Client:**
- Python 3.7+
- pip packages: `websockets`, `pyaudio`
- Tools: `ffmpeg`, `ffplay` (für Audio)
- Backend muss laufen (Port 8080, 3000)

**Signal Device Client:**
- Python 3.7+
- pip packages: `websockets`, `httpx`
- Backend muss laufen (Port 8080, 3000)
- Signal-Server muss erreichbar sein
- Signal-WebSocket-Endpoint (`wss://signal.local.chase295.de/v1/receive/{number}`)
- Signal-REST-API-Endpoint (`https://signal.local.chase295.de/v2/send`)

## Hinweise

**Device Client:**
- Der Device-Client sendet **RAW Audio** (ohne Header) - das Gateway erstellt automatisch den USO-Header
- Mikrofon-Stream wird nur bei Enter-Taste gesendet
- Lautsprecher ist immer aktiv und spielt eingehendes Audio ab
- Prüfe die Logs mit: `docker-compose logs -f backend | grep python-voice`

**Signal Device Client:**
- Signal WebSocket-Verbindung läuft kontinuierlich im Hintergrund
- Nur `dataMessage`-Nachrichten werden verarbeitet (`typingMessage` wird ignoriert)
- Signal-Metadaten (Absender-Nummer, Name) werden in USO-Metadaten mitgesendet
- TXT Output unterstützt Streaming (Token-für-Token, wie ChatGPT)
- SSL-Verifizierung ist standardmäßig deaktiviert (`SIGNAL_VERIFY_SSL = False`) für selbst-signierte Zertifikate
- Prüfe die Logs mit: `docker-compose logs -f backend | grep signal-device`