# WS_In-Node Raw Audio Mode Setup

## Problem gelöst! 🎉

Das Problem war, dass dein Client-Skript (`test-ws-in-audio.py`) JSON-Header an die WS_In-Node sendete, aber die WS_In-Node das USO-Protokoll erwartete.

## Lösung: Raw Audio Mode

Ich habe die WS_In-Node erweitert um einen **Raw Audio Mode**, der direkt rohe Audio-Daten akzeptiert.

## Konfiguration der WS_In-Node

### 1. WS_In-Node konfigurieren

In der Flow-Editor-Konfiguration der WS_In-Node:

```json
{
  "port": 8081,
  "path": "/ws/external",
  "dataType": "audio",
  "rawAudioMode": true,  // ← NEU! Aktiviert Raw Audio Mode
  "sampleRate": 16000,
  "channels": 1,
  "encoding": "pcm_s16le",
  "includeContext": true
}
```

### 2. Client-Skript ist bereits angepasst

Das `test-ws-in-audio.py` Skript wurde bereits angepasst und sendet jetzt:
- ✅ **Nur rohe Audio-Binärdaten** (keine JSON-Header)
- ✅ **Direkt an die WS_In-Node**

## Wie es jetzt funktioniert

```
Client (test-ws-in-audio.py)
    ↓ (rohe Audio-Binärdaten)
WS_In-Node (Raw Audio Mode)
    ↓ (erstellt automatisch USO-Header)
STT-Node (Vosk-Verbindung)
    ↓ (transkribierter Text)
Debug-Node
    ↓ (Debug Events)
Frontend (Debug Events Viewer)
```

## Testen

1. **WS_In-Node konfigurieren**: `rawAudioMode: true` setzen
2. **Flow starten**: WS_In → STT → Debug
3. **Client starten**: `python3 test-ws-in-audio.py`
4. **Sprechen**: Audio wird direkt an WS_In gesendet
5. **Debug Events prüfen**: Transkribierter Text sollte erscheinen

## Debugging

Falls es immer noch nicht funktioniert:

1. **Backend-Logs prüfen**: `docker-compose logs backend`
2. **WS_In-Node Logs**: Sollte "WSIn received raw audio" zeigen
3. **STT-Node Logs**: Sollte "Audio received for STT processing" zeigen
4. **Vosk-Verbindung**: Sollte "Vosk connection established" zeigen

## Wichtige Hinweise

- **Raw Audio Mode**: Nur für direkte Audio-Daten ohne USO-Protokoll
- **USO-Mode**: Für Clients die das vollständige USO-Protokoll verwenden
- **Session-IDs**: Werden automatisch generiert (`raw_audio_${clientId}_${timestamp}`)
- **Context**: Wird automatisch mit aktueller Uhrzeit angereichert
