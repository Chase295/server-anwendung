# 🚀 Schnellstart-Anleitung

Diese Anleitung führt Sie durch die ersten Schritte mit dem IoT & Voice Orchestrator.

## ⚡ Installation in 5 Minuten

### 1. Voraussetzungen prüfen

```bash
# Node.js Version (>= 18)
node --version

# npm Version
npm --version

# MongoDB installiert und gestartet?
mongod --version
```

Falls MongoDB nicht installiert ist:

**macOS:**
```bash
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu/Debian:**
```bash
sudo apt install mongodb
sudo systemctl start mongodb
```

**Windows:**
Download von https://www.mongodb.com/try/download/community

### 2. Backend starten

```bash
# In das Backend-Verzeichnis wechseln
cd backend

# Dependencies installieren
npm install

# .env-Datei erstellen
cat > .env << EOL
PORT=3000
NODE_ENV=development
WS_PORT=8080
WS_SSL_ENABLED=false
MONGODB_URI=mongodb://localhost:27017/iot-orchestrator
JWT_SECRET=dev-secret-change-in-production
ADMIN_PASSWORD=admin
ENCRYPTION_KEY=this-is-a-32-char-dev-key-only
TRUST_PROXY=false
EOL

# Backend starten
npm run start:dev
```

✅ Backend läuft auf **http://localhost:3000**
✅ WebSocket läuft auf **ws://localhost:8080**

### 3. Frontend starten (in neuem Terminal)

```bash
# In das Frontend-Verzeichnis wechseln
cd frontend

# Dependencies installieren
npm install

# .env.local erstellen
cat > .env.local << EOL
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_DEBUG_EVENTS_URL=ws://localhost:8082
EOL

# Frontend starten
npm run dev
```

✅ Frontend läuft auf **http://localhost:3001**

### 4. Ersten Login durchführen

1. Browser öffnen: http://localhost:3001
2. Anmelden mit:
   - **Benutzername:** `admin`
   - **Passwort:** `admin`

🎉 **Fertig!** Sie sind jetzt im System angemeldet.

## 📱 Ersten Flow erstellen

### Schritt 1: Flow-Seite öffnen

Nach dem Login werden Sie automatisch zur **Flows**-Seite weitergeleitet.

### Schritt 2: Neuen Flow erstellen

1. Klicken Sie auf **"Neuer Flow"**
2. Der Flow-Editor öffnet sich

### Schritt 3: Debug-Node hinzufügen

1. In der linken Toolbar auf **"Debug"** klicken
2. Die Node erscheint auf der Canvas
3. Node anklicken um das Konfigurations-Panel rechts zu öffnen

### Schritt 4: Node konfigurieren

Im rechten Panel können Sie:
- Label ändern (z.B. "Mein erster Debug-Node")
- Aktiviert: ☑️ (angehakt)
- Payload anzeigen: ☑️ (angehakt)
- Max. Payload-Größe: 1024 Bytes

### Schritt 5: Flow speichern

1. Oben links einen Namen eingeben (z.B. "Test Flow")
2. Optional: Beschreibung hinzufügen
3. Auf **"Speichern"** klicken
4. Zurück zur Flows-Übersicht

### Schritt 6: Flow starten

**Option 1: Direkt im Editor (NEU in v2.3.0!)**
1. Klicken Sie auf den **grünen "Start"** Button oben rechts im Editor
2. Status ändert sich zu "Läuft" mit pulsierendem grünen Punkt
3. Button wird rot und zeigt "Stop"

**Option 2: In der Flow-Übersicht**
1. Zurück zur Flows-Übersicht
2. In der Flow-Karte auf **"Starten"** klicken
3. Status ändert sich zu "Läuft" mit grünem Punkt

✅ Ihr erster Flow ist aktiv!

**💡 Tipp:** Der Flow-Status wird automatisch zwischen Editor und Übersicht synchronisiert!

## 🔌 ESP32-Client verbinden (optional)

### Client-Secret erstellen

1. Navigieren Sie zu **Einstellungen** (Sidebar)
2. Klicken Sie auf **"Secret hinzufügen"**
3. Eingeben:
   - **Key:** `client_secret_esp32_001`
   - **Value:** `mein-geheimes-secret-123`
   - **Typ:** Client Secret
   - **Beschreibung:** Mein erstes ESP32-Gerät
4. Auf **"Speichern"** klicken

### ESP32-Code (Arduino)

```cpp
#include <WiFi.h>
#include <WebSocketsClient.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";
const char* ws_host = "192.168.1.100"; // IP des Servers
const int ws_port = 8080;

WebSocketsClient webSocket;

void setup() {
  Serial.begin(115200);
  
  // WiFi verbinden
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi connected!");
  
  // WebSocket verbinden mit Authentifizierung
  String url = "/ws?clientId=esp32_001&secret=mein-geheimes-secret-123";
  webSocket.begin(ws_host, ws_port, url);
  webSocket.onEvent(webSocketEvent);
}

void loop() {
  webSocket.loop();
}

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
  switch(type) {
    case WStype_CONNECTED:
      Serial.println("WebSocket Connected!");
      break;
    case WStype_DISCONNECTED:
      Serial.println("WebSocket Disconnected!");
      break;
    case WStype_TEXT:
      Serial.printf("Message received: %s\n", payload);
      break;
  }
}
```

### Gerät registrieren (über API)

```bash
curl -X POST http://localhost:3000/api/devices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "clientId": "esp32_001",
    "name": "Mein ESP32",
    "capabilities": ["mic", "speaker"],
    "metadata": {
      "location": "Wohnzimmer"
    }
  }'
```

## 🔍 Logs überprüfen

1. Navigieren Sie zu **Logs** (Sidebar)
2. Sie sehen alle System-Events:
   - WebSocket-Verbindungen
   - Flow-Starts
   - USO-Datenströme
   - Fehler und Warnungen

### Log-Dateien

Logs werden in `backend/logs/` gespeichert:
```bash
# Logs direkt anzeigen (wenn Docker läuft)
tail -f backend/logs/app-$(date +%Y-%m-%d).log

# Oder Docker-Logs (Console-Output)
docker logs -f iot-orchestrator-backend
```

**Log-Format:**
```
YYYY-MM-DD HH:mm:ss LEVEL [CONTEXT] Message {"meta":"data"}
```

**Wichtig für Docker:**
- Das Volume `./backend/logs:/app/logs` muss in `docker-compose.yml` gemappt sein
- Setzen Sie `FILE_LOGGING=true` in den Environment-Variablen
- Logs werden täglich rotiert (app-YYYY-MM-DD.log)
- Alte Logs werden nach 14 Tagen automatisch gelöscht

## ⚙️ Nächste Schritte

### Weitere Nodes hinzufügen

Das System ist vorbereitet für:
- **STT (Speech-to-Text)** mit Vosk
- **TTS (Text-to-Speech)** mit Piper
- **KI-Integration** mit n8n
- **Custom Nodes** nach Bedarf

Siehe `backend/src/modules/nodes/` für Beispiele.

### Production-Deployment

Für den Produktiveinsatz:

1. **Sichere Passwörter setzen:**
   ```env
   ADMIN_PASSWORD=sicheres-passwort-hier
   ENCRYPTION_KEY=32-zeichen-langer-encryption-key
   JWT_SECRET=sicherer-jwt-secret-key
   ```

2. **MongoDB mit Authentifizierung:**
   ```env
   MONGODB_URI=mongodb://user:pass@localhost:27017/iot-orchestrator
   ```

3. **SSL/TLS aktivieren:**
   ```env
   WS_SSL_ENABLED=true
   WS_SSL_CERT_PATH=/path/to/cert.pem
   WS_SSL_KEY_PATH=/path/to/key.pem
   ```

4. **Nginx-Proxy einrichten:**
   Siehe `nginx.conf.example`

## 🆘 Problembehebung

### Backend startet nicht

```bash
# MongoDB läuft?
mongosh

# Port 3000 belegt?
lsof -i :3000

# Logs prüfen (Docker)
docker logs iot-orchestrator-backend

# Logs prüfen (Lokal)
cd backend
npm run start:dev

# Log-Dateien direkt prüfen
tail -f backend/logs/app-$(date +%Y-%m-%d).log
```

### Frontend startet nicht

```bash
# Port 3001 belegt?
lsof -i :3001

# Dependencies neu installieren
rm -rf node_modules package-lock.json
npm install
```

### WebSocket-Verbindung schlägt fehl

1. Firewall prüfen (Port 8080 offen?)
2. Client-Secret korrekt?
3. Backend-Logs prüfen: `backend/logs/`

### Datenbank-Verbindung schlägt fehl

```bash
# MongoDB läuft?
sudo systemctl status mongodb

# MongoDB starten
sudo systemctl start mongodb

# Oder (macOS)
brew services start mongodb-community
```

## 📚 Weitere Ressourcen

- **Vollständige Dokumentation:** Siehe `README.md`
- **Backend-API:** Siehe `backend/README.md`
- **Frontend-Dokumentation:** Siehe `frontend/README.md`
- **Nginx-Konfiguration:** Siehe `nginx.conf.example`

## 📚 Nächste Schritte

### Debug Events testen

Nutzen Sie das **Test-Script** zum Testen der WebSocket-Verbindungen und sehen Sie Live-Events im Flow-Editor:

```bash
# Python Test-Script ausführen
python3 test-ws-in.py

# Context-Informationen eingeben (Person, Standort, Client)
# Nachrichten senden und im Debug Events Panel sehen!
```

**Siehe:**
- [TEST_SCRIPTS_README.md](TEST_SCRIPTS_README.md) - Ausführliche Anleitung zum Test-Script
- [DEBUG_EVENTS_GUIDE.md](DEBUG_EVENTS_GUIDE.md) ⭐ **NEU!** - Vollständige Debug Events Dokumentation

### Context-Informationen nutzen

Das System unterstützt jetzt **Context-Informationen** für personalisierte KI-Interaktionen:

- **Person**: Name (z.B. "Moritz Haslbeck")
- **Standort**: Raum/Location (z.B. "Schlafzimmer")
- **Client-Name**: Gerät (z.B. "Laptop xyz")

Diese werden automatisch im USO-Header mitgesendet und sind in der **Debug Node** sichtbar!

### Externe Services integrieren

Für vollständige Voice-Workflows:

1. **Vosk (STT)** installieren - [SERVICES.md](SERVICES.md#vosk-stt)
2. **Piper (TTS)** installieren - [SERVICES.md](SERVICES.md#piper-tts)
3. **Flowise (AI)** einrichten - [SERVICES.md](SERVICES.md#flowise-ai)

Server direkt in den Node-Panels hinzufügen ("Neu" Button) oder in den Einstellungen verwalten!

## 💡 Tipps

1. **Development:** Verwenden Sie `npm run start:dev` für Auto-Reload
2. **Production:** Verwenden Sie `npm run build` und `npm run start:prod`
3. **Logs:** Überprüfen Sie regelmäßig `backend/logs/` für Debugging
4. **Secrets:** Ändern Sie alle Default-Secrets in Production!
5. **Debug Events:** Öffnen Sie das Event-Panel im Flow-Editor für Live-Monitoring! 🔍
6. **Flow-Steuerung:** Nutzen Sie die Start/Stop Buttons direkt im Editor (v2.3.0) 🎮
7. **Status-Sync:** Der Flow-Status wird automatisch zwischen allen Ansichten synchronisiert ✅

---

**Viel Erfolg mit Ihrem IoT & Voice Orchestrator! 🚀**

Bei Fragen oder Problemen öffnen Sie bitte ein Issue auf GitHub.

