# 🔄 Migration: .env → Web-UI Konfiguration

## Übersicht der Änderungen

Mit dem neuesten Update wurde die Konfiguration externer Services (Vosk, Piper, n8n) von der `.env`-Datei in die **Web-UI** verlagert. Dies macht das System benutzerfreundlicher und moderner.

## ✅ Vorteile der neuen Architektur

| Aspekt | Vorher (.env) | Jetzt (Web-UI) |
|--------|---------------|----------------|
| **Konfiguration** | Manuelle Bearbeitung der .env | Intuitive UI mit Test-Button |
| **Mehrere URLs** | Nur eine URL pro Service | Verschiedene URLs pro Node/Flow |
| **Änderungen** | Server-Neustart erforderlich | Sofort wirksam |
| **Deployment** | .env-Datei synchronisieren | Automatisch in MongoDB |
| **Fehlerprüfung** | Beim Start (alle Services) | Nur konfigurierte Services |
| **Dokumentation** | README lesen | Self-explanatory UI |

## 🔄 Was hat sich geändert?

### Entfernte Umgebungsvariablen

Diese Variablen werden **NICHT MEHR** aus der `.env` gelesen:

```bash
# ❌ ENTFERNT - nicht mehr verwenden
VOSK_URL=ws://localhost:2700
PIPER_URL=http://localhost:5000
N8N_URL=http://localhost:5678
```

### Weiterhin benötigte Umgebungsvariablen

Diese Variablen bleiben in der `.env`:

```bash
# ✅ WEITERHIN ERFORDERLICH
MONGODB_URI=mongodb://localhost:27017/iot-orchestrator
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-32-char-encryption-key
TRUST_PROXY=false
```

## 📝 Migrations-Schritte

### Schritt 1: Alte .env-Einträge identifizieren

Wenn Sie bereits eine `.env`-Datei mit Service-URLs haben:

```bash
# Alte .env anzeigen
cat .env | grep -E "VOSK_URL|PIPER_URL|N8N_URL"
```

Notieren Sie sich diese URLs - Sie werden sie gleich in der Web-UI eingeben.

### Schritt 2: .env bereinigen

Entfernen Sie die optionalen Service-URLs aus Ihrer `.env`:

```bash
# .env vorher
MONGODB_URI=mongodb://localhost:27017/iot-orchestrator
JWT_SECRET=my-secret
ENCRYPTION_KEY=my-encryption-key-32-chars-long
VOSK_URL=ws://localhost:2700          # ← ENTFERNEN
PIPER_URL=http://localhost:5000       # ← ENTFERNEN
N8N_URL=http://localhost:5678         # ← ENTFERNEN

# .env nachher
MONGODB_URI=mongodb://localhost:27017/iot-orchestrator
JWT_SECRET=my-secret
ENCRYPTION_KEY=my-encryption-key-32-chars-long
```

### Schritt 3: Server neu starten

```bash
# Docker Compose
docker-compose restart backend

# Oder: Manuelle Installation
cd backend
npm run start:dev
```

**Erwartetes Verhalten:**
- ✅ Server startet OHNE Warnungen über fehlende Services
- ✅ Log zeigt: "No flows configured yet. Skipping optional service checks."

### Schritt 4: Services über Web-UI konfigurieren

#### 4.1 Frontend öffnen

```
http://localhost:3001
```

#### 4.2 Flow erstellen

1. Navigieren Sie zu **Flows**
2. Klicken Sie auf **"Neuer Flow"**
3. Geben Sie einen Namen ein (z.B. "Voice Pipeline")

#### 4.3 STT Node konfigurieren (Vosk)

1. Ziehen Sie **STT Node** auf die Canvas
2. Klicken Sie auf den Node
3. Im rechten Panel:
   - **Service URL:** `ws://localhost:2700` (oder Ihre alte VOSK_URL)
   - **Sample Rate:** `16000`
   - **Model:** `vosk-model-de`
4. Klicken Sie auf **"Test Connection"**
5. Erwartete Antwort: ✅ "Connection successful"

#### 4.4 TTS Node konfigurieren (Piper)

1. Ziehen Sie **TTS Node** auf die Canvas
2. Klicken Sie auf den Node
3. Im rechten Panel:
   - **Service URL:** `http://localhost:5000` (oder Ihre alte PIPER_URL)
   - **Voice Model:** `de_DE-thorsten-medium`
   - **Sample Rate:** `22050`
4. Klicken Sie auf **"Test Connection"**
5. Erwartete Antwort: ✅ "Connection successful"

#### 4.5 AI Node konfigurieren (n8n)

1. Ziehen Sie **AI Node** auf die Canvas
2. Klicken Sie auf den Node
3. Im rechten Panel:
   - **Webhook URL:** `http://localhost:5678/webhook/your-webhook-id` (oder Ihre alte N8N_URL)
   - **Streaming Mode:** `false`
   - **Model:** `gpt-3.5-turbo`
4. Klicken Sie auf **"Test Connection"**
5. Erwartete Antwort: ✅ "Connection successful"

#### 4.6 Flow speichern

1. Klicken Sie auf **"Speichern"**
2. Die Konfigurationen werden in MongoDB gespeichert

### Schritt 5: Verifizierung

Starten Sie den Server neu und beobachten Sie die Logs:

```bash
docker-compose restart backend
docker-compose logs -f backend
```

**Erwartete Logs:**

```
🔍 Stage 3: Checking external services (from MongoDB)...
✅ MongoDB connection successful

Found configured services:
  - Vosk: 1 URL
  - Piper: 1 URL
  - n8n: 1 URL

✅ Vosk service reachable (ws://localhost:2700)
✅ Piper service reachable (http://localhost:5000)
✅ n8n service reachable (http://localhost:5678/webhook/...)

✅ All configured external services are reachable
```

## 🐳 Docker-spezifische Anpassungen

Wenn Sie Docker Compose verwenden, beachten Sie:

### host.docker.internal verwenden

Wenn externe Services auf dem **Host-System** laufen (außerhalb von Docker):

```
# STATT localhost VERWENDEN:
ws://host.docker.internal:2700    # Vosk
http://host.docker.internal:5000  # Piper
http://host.docker.internal:5678  # n8n
```

### Externe Docker-Container verwenden

Wenn Vosk/Piper/n8n in **separaten Docker-Containern** laufen:

```bash
# Option 1: Gleiche Docker-Netzwerk verwenden
docker run --network iot-orchestrator-network \
  --name vosk -p 2700:2700 alphacep/kaldi-de:latest

# In Web-UI dann:
ws://vosk:2700

# Option 2: host.docker.internal (empfohlen)
docker run -p 2700:2700 alphacep/kaldi-de:latest

# In Web-UI dann:
ws://host.docker.internal:2700
```

## 🔄 Rollback (Falls nötig)

Falls Sie zur alten .env-basierten Konfiguration zurückkehren möchten:

```bash
# 1. Alte Version auschecken
git checkout <commit-hash-vor-migration>

# 2. .env wiederherstellen
cat >> .env << EOF
VOSK_URL=ws://localhost:2700
PIPER_URL=http://localhost:5000
N8N_URL=http://localhost:5678
EOF

# 3. Container neu bauen
docker-compose up --build
```

**Hinweis:** Dies ist **nicht empfohlen**, da die neue Architektur deutlich flexibler ist.

## ❓ FAQ

### F: Muss ich alle Services auf einmal konfigurieren?

**A:** Nein! Sie können Services individuell hinzufügen:
- Ohne Vosk funktioniert nur die STT Node nicht
- Ohne Piper funktioniert nur die TTS Node nicht
- Ohne n8n funktioniert nur die AI Node nicht
- Alle anderen Nodes (Mic, Speaker, Debug, WebSocket) funktionieren immer

### F: Kann ich verschiedene Service-URLs pro Flow verwenden?

**A:** Ja! Jeder Node kann seine eigene Service-URL haben:
- Flow A → Vosk auf localhost:2700
- Flow B → Vosk auf server.example.com:2700
- Flow C → Vosk auf host.docker.internal:2700

### F: Was passiert beim Start ohne konfigurierte Services?

**A:** Der Server startet **ohne Warnungen**:
```
💡 No flows configured yet. Skipping optional service checks.
```

### F: Was passiert beim Start mit nicht erreichbaren Services?

**A:** Der Server startet trotzdem, zeigt aber Warnungen:
```
⚠️  Unreachable services (1):
   - Vosk (ws://localhost:2700): Connection refused

💡 The server will start, but affected nodes will not work.
   You can update service URLs in the Web-UI (Flow Editor).
```

### F: Wie ändere ich eine Service-URL?

**A:** Einfach im Flow-Editor:
1. Flow öffnen
2. Node auswählen
3. Neue URL eingeben
4. "Test Connection" klicken
5. "Speichern" klicken
6. **KEIN Server-Neustart nötig!**

### F: Funktioniert die alte docker-compose.yml noch?

**A:** Ja, aber die Service-URLs in der Datei werden ignoriert. Entfernen Sie sie:

```yaml
# docker-compose.yml
environment:
  # ❌ ENTFERNEN - wird ignoriert
  - VOSK_URL=${VOSK_URL}
  - PIPER_URL=${PIPER_URL}
  
  # ✅ BEHALTEN
  - MONGODB_URI=${MONGODB_URI}
  - JWT_SECRET=${JWT_SECRET}
```

## 📊 Vergleich: Startup-Logs

### Vorher (.env-basiert)

```
🔍 Stage 3: Checking external services...
✅ MongoDB connection successful
⚠️  Vosk service not reachable (ws://localhost:2700)
⚠️  Piper service not reachable (http://localhost:5000)
⚠️  n8n service not reachable (http://localhost:5678)

⚠️  Some optional services are not available:
   - Vosk: Connection refused
   - Piper: Connection refused
   - n8n: Connection refused

💡 The server will start, but nodes using these services will not work.
```

**Problem:** Warnungen IMMER, auch wenn die Services gar nicht gebraucht werden!

### Nachher (Web-UI-basiert)

**Fall 1: Keine Flows konfiguriert**
```
🔍 Stage 3: Checking external services (from MongoDB)...
✅ MongoDB connection successful
💡 No flows configured yet. Skipping optional service checks.
```

**Fall 2: Services konfiguriert und erreichbar**
```
🔍 Stage 3: Checking external services (from MongoDB)...
✅ MongoDB connection successful
Found configured services: Vosk (1), Piper (1), n8n (1)
✅ All configured external services are reachable
```

**Fall 3: Services konfiguriert, aber nicht erreichbar**
```
🔍 Stage 3: Checking external services (from MongoDB)...
✅ MongoDB connection successful
Found configured services: Vosk (1)
⚠️  Vosk service not reachable (ws://localhost:2700)
💡 You can update service URLs in the Web-UI (Flow Editor).
```

## ✅ Zusammenfassung

| Schritt | Aktion | Status |
|---------|--------|--------|
| 1 | Alte Service-URLs aus .env notieren | 📝 |
| 2 | Service-URLs aus .env entfernen | ✂️ |
| 3 | Server neu starten | 🔄 |
| 4 | Flow in Web-UI erstellen | 🎨 |
| 5 | Nodes konfigurieren (URLs eingeben) | ⚙️ |
| 6 | Test Connection klicken | 🔍 |
| 7 | Flow speichern | 💾 |
| 8 | Server neu starten (Verifikation) | ✅ |

**Fertig!** 🎉 Das System ist jetzt moderner und benutzerfreundlicher.

## 🆘 Support

Bei Problemen:

1. **Logs prüfen:**
   ```bash
   docker-compose logs backend | grep -i "stage 3"
   ```

2. **MongoDB-Konfiguration prüfen:**
   ```bash
   docker-compose exec mongodb mongosh
   > use iot-orchestrator
   > db.flows.find({}).pretty()
   ```

3. **Issue erstellen** mit den Logs und Ihrer Konfiguration

## 📚 Weitere Dokumentation

- [README.md](./README.md) - Hauptdokumentation
- [DOCKER.md](./DOCKER.md) - Docker Compose Guide
- [NODES.md](./NODES.md) - Node-Dokumentation
- [QUICKSTART.md](./QUICKSTART.md) - Schnellstart-Anleitung

