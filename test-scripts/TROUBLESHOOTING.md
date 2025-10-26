# Troubleshooting - Device Client

## Problem: Device wird als "Offline" angezeigt

### Ursache
Das Device kann sich nicht mit dem WebSocket-Gateway verbinden. Mögliche Gründe:

1. **Secret nicht gespeichert**
2. **Authentifizierung schlägt fehl**
3. **Backend läuft nicht**
4. **Falsche URL**

### Lösung

#### Schritt 1: Secret speichern

**Option A: Mit Setup-Script (empfohlen)**
```bash
cd test-scripts
./setup-device-secret.sh
```

**Option B: Manuell über Web-UI**
1. Öffne: http://localhost:3000/settings
2. Klicke auf "Secret hinzufügen"
3. Trage ein:
   - Key: `client_secret_python-voice-device`
   - Value: `test_secret_123`
   - Type: `device_secret`
4. Klicke auf "Speichern"

**Option C: Über REST API**
```bash
curl -X POST http://localhost:3000/api/auth/secrets \
  -H "Content-Type: application/json" \
  -d '{
    "key": "client_secret_python-voice-device",
    "value": "test_secret_123",
    "type": "device_secret"
  }'
```

#### Schritt 2: Backend prüfen

```bash
# Überprüfe ob Backend läuft
curl http://localhost:3000/api/devices

# Sollte eine JSON-Response mit Devices zurückgeben
```

#### Schritt 3: Device-Client starten

```bash
cd test-scripts
./device-client.sh
```

### Erwartete Ausgabe

Wenn alles funktioniert, sollte folgende Ausgabe erscheinen:

```
IoT Orchestrator Device Client
======================================================================

📱 Gerät: python-voice-device
🔗 Verbindung: ws://localhost:8080/ws/external?clientId=python-voice-device&secret=test_secret_123
🎵 Audio-Format: 16000Hz, 1ch, 16-bit PCM

✓ Device registriert
⏳ Verbinde zu WebSocket-Gateway...
   URL: ws://localhost:8080/ws/external?clientId=python-voice-device&secret=test_secret_123
✓ Verbindung hergestellt!

⏳ Warte auf Willkommensnachricht...
✓ Willkommensnachricht empfangen!
   Connection ID: conn_xxxxx

✅ Device verbunden und bereit
💡 Device 'python-voice-device' erscheint in Mic- und Speaker-Nodes
```

### Fehler-Diagnose

#### Fehler: "Connection refused"

**Ursache:** Backend läuft nicht

**Lösung:**
```bash
docker-compose up
```

#### Fehler: "Authentication failed" / Status Code: 1008

**Ursache:** Secret ist nicht gespeichert oder falsch

**Lösung:**
1. Führe `./setup-device-secret.sh` aus
2. Oder speichere das Secret manuell über die Web-UI

#### Fehler: "Device nicht in Liste"

**Ursache:** Device ist registriert aber nicht verbunden

**Lösung:**
1. Starte den Device-Client
2. Warte ein paar Sekunden
3. Aktualisiere die Geräte-Seite im Browser

### Debug-Tipps

#### Logs prüfen

```bash
# Backend-Logs
docker-compose logs -f backend

# Device-Client-Debug
# Aktiviere im Python-Script mehr Ausgaben
```

#### Verbindung testen

```bash
# Teste WebSocket-Gateway
wscat -c "ws://localhost:8080/ws/external?clientId=python-voice-device&secret=test_secret_123"
```

#### Secret prüfen

```bash
# Listet alle Secrets (ohne Werte)
curl http://localhost:3000/api/auth/secrets

# Sollte "client_secret_python-voice-device" enthalten
```

### Weitere Probleme

#### Mikrofon funktioniert nicht

**Problem:** PyAudio nicht installiert

**Lösung:**
```bash
# macOS
brew install portaudio
pip install pyaudio

# Linux
sudo apt-get install portaudio19-dev
pip install pyaudio
```

#### Audio wird nicht abgespielt

**Problem:** ffmpeg oder afplay nicht verfügbar

**Lösung:**
```bash
# macOS
brew install ffmpeg

# Linux
sudo apt-get install ffmpeg
```

### Hilfe bekommen

Wenn das Problem weiterhin besteht:

1. Überprüfe die Backend-Logs: `docker-compose logs -f backend`
2. Überprüfe die Python-Ausgabe für Fehlermeldungen
3. Teste die Verbindung manuell mit wscat
4. Prüfe ob das Secret korrekt gespeichert ist

