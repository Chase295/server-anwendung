# Test Scripts

Sammlung von Test-Scripts für das IoT Orchestrator System.

## Übersicht

Dieses Verzeichnis enthält verschiedene Test-Scripts:

### Device Client
- **`device-client.py`** - Python-Client zum Simulieren eines Gerätes mit Mikrofon und Lautsprecher
  - Verbindet sich mit dem WebSocket-Gateway (Port 8080)
  - Sendet RAW Audio vom Mikrofon an die Mic-Node
  - Empfängt und spielt Audio vom Speaker-Node ab
  - Wird als "python-voice-device" in Mic-/Speaker-Nodes sichtbar
- **`device-client.sh`** - Shell-Script zum Starten des Device-Clients
- **`setup-device-secret.sh`** - Automatische Secret-Konfiguration

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

### Mit dem Flow Editor verwenden

1. Mic-Node hinzufügen und Device "python-voice-device" auswählen
2. Speaker-Node hinzufügen und Device "python-voice-device" auswählen
3. Flow starten
4. Im Client Enter drücken und sprechen
5. Audio wird über den Lautsprecher ausgegeben

## Dokumentation

- **`TROUBLESHOOTING.md`** - Häufige Probleme und Lösungen
- **`TEST_SCRIPTS_README_AUDIO.md`** - Audio-Tests dokumentieren
- **`VOSK_TEST_README.md`** - Vosk STT Tests
- **`WS_IN_RAW_AUDIO_SETUP.md`** - RAW Audio Mode Setup

## Anforderungen

- Python 3.7+
- pip packages: `websockets`, `pyaudio`
- Tools: `ffmpeg`, `ffplay` (für Audio)
- Backend muss laufen (Port 8080, 3000)

## Hinweise

- Der Device-Client sendet **RAW Audio** (ohne Header) - das Gateway erstellt automatisch den USO-Header
- Mikrofon-Stream wird nur bei Enter-Taste gesendet
- Lautsprecher ist immer aktiv und spielt eingehendes Audio ab
- Prüfe die Logs mit: `docker-compose logs -f backend | grep python-voice`