# 🧪 Test-Scripts für WebSocket-Nodes

Diese Scripts ermöglichen das Testen der WebSocket-In-Node und WebSocket-Out-Node ohne ESP32 oder andere externe Hardware.

## 📁 Verfügbare Scripts

### WS-In Node (Client → Server)

#### 1. `test-ws-in.py` - Python WebSocket-Client

Ein interaktiver WebSocket-Client zum Testen der **WS-In-Node**.

**Features:**
- ✅ Interaktive Text-Eingabe im Terminal
- ✅ Sendet Nachrichten im USO-Format (Universal Stream Object)
- ✅ **Context-Informationen** (Person, Standort, Client-Name)
- ✅ Farbige Terminal-Ausgabe
- ✅ Konfigurierbare Verbindungsparameter
- ✅ USO-Protokoll (Header → Payload)

#### 2. `test-ws-in.sh` - Start-Script

Shell-Script zum einfachen Starten des Python-Clients.
Prüft automatisch alle Abhängigkeiten und installiert fehlende Module.

**Verwendung:**
```bash
./test-ws-in.sh
```

---

### WS-Out Node (Server empfängt Daten)

#### 3. `test-ws-out.py` - Python WebSocket-Server

Ein WebSocket-Server zum Testen der **WS-Out-Node**.

**Features:**
- ✅ WebSocket-Server der Daten empfängt
- ✅ Zeigt alle empfangenen Daten im Terminal an
- ✅ Unterstützt Text, JSON und Binär-Daten
- ✅ USO-Format Erkennung und Pretty-Print
- ✅ Farbige Terminal-Ausgabe
- ✅ Konfigurierbare Port und Pfad

#### 4. `test-ws-out.sh` - Start-Script

Shell-Script zum einfachen Starten des WebSocket-Servers.
Prüft automatisch alle Abhängigkeiten und installiert fehlende Module.

**Verwendung:**
```bash
./test-ws-out.sh
```

---

## 🚀 Verwendung WS-In Node

### Voraussetzungen

```bash
# Python 3.7+ muss installiert sein
python3 --version

# websockets-Modul installieren
pip3 install websockets
```

### Schritt 1: Konfiguration anpassen

Öffne `test-ws-in.py` und passe die Verbindungsparameter an:

```python
# ======================================
# KONFIGURATION - HIER ANPASSEN
# ======================================
WS_HOST = "localhost"        # IP/Hostname des Servers
WS_PORT = 8081               # Port der WS-In-Node
WS_PATH = "/ws/external"     # Pfad der WS-In-Node

# Context-Informationen - HIER DEINE WERTE EINTRAGEN!
CONTEXT_PERSON = "Moritz Haslbeck"      # Name der Person
CONTEXT_LOCATION = "Schlafzimmer"       # Standort/Raum
CONTEXT_CLIENT = "Laptop xyz"           # Geräte-Name
```

**Neu: Context-Informationen**

Seit Version 2.0 werden Context-Informationen **direkt im Script** konfiguriert:
- **time**: Aktuelle Uhrzeit (wird **automatisch** bei jedem Send hinzugefügt im Format "YYYY-MM-DD HH:MM:SS")
- **CONTEXT_PERSON**: Name der Person (z.B. "Moritz Haslbeck")
- **CONTEXT_LOCATION**: Raum/Location (z.B. "Schlafzimmer")
- **CONTEXT_CLIENT**: Geräte-Name (z.B. "Laptop xyz")

Diese Informationen werden automatisch bei **jeder Nachricht** im USO-Header mitgesendet und sind in der **Debug Node** sichtbar!

**Wichtig:** Die Zeit wird **immer automatisch** hinzugefügt, auch wenn die anderen Context-Felder leer sind.

**Context-Weitergabe:**
- Im Flow-Editor kannst du in der **WS_In Node** die Option "Context weitergeben" aktivieren/deaktivieren
- **Standard:** Aktiviert (Context wird an nachfolgende Nodes weitergegeben)
- **Deaktiviert:** Nur der reine Content wird weitergegeben (nützlich für KI ohne Context)

📖 **Detaillierte Dokumentation:** [CONTEXT_MANAGEMENT.md](../CONTEXT_MANAGEMENT.md)

**Wichtig:** Trage deine Werte **vor** dem Ausführen des Scripts ein. Sie werden nicht mehr interaktiv abgefragt.

**Beispiele:**

```python
# Lokaler Test (Standard)
WS_HOST = "localhost"
WS_PORT = 8081
WS_PATH = "/ws/external"

# Remote-Server
WS_HOST = "192.168.1.100"
WS_PORT = 8081
WS_PATH = "/ws/api"

# Mit Docker (von außen)
WS_HOST = "localhost"
WS_PORT = 8081  # Muss in docker-compose.yml als exposed port definiert sein
WS_PATH = "/ws/external"
```

### Schritt 2: WS-In-Node in einem Flow erstellen

1. Öffne das Web-UI: `http://localhost:3001`
2. Erstelle einen neuen Flow
3. Füge eine **WebSocket In Node** hinzu
4. Konfiguriere die Node:
   - **Port:** `8081` (oder dein gewählter Port)
   - **Pfad:** `/ws/external` (oder dein gewählter Pfad)
   - **Datentyp:** `Text` oder `Raw (Binär)`
5. Verbinde die WS-In-Node mit einer **Debug-Node**
6. **Speichere und starte** den Flow

### Schritt 3: Script ausführen

**Option A: Mit Shell-Script (empfohlen)**

```bash
./test-ws-in.sh
```

**Option B: Direkt mit Python**

```bash
python3 test-ws-in.py
```

### Schritt 4: Script ausführen und Context-Informationen prüfen

Beim Start des Scripts werden deine konfigurierten Context-Informationen angezeigt:

```
============================================================
  WebSocket-In Node Tester
============================================================

📡 Verbindung: ws://localhost:8081/ws/external
📝 Protokoll: USO (Universal Stream Object)
📤 Datentyp: Text

✓ Context-Informationen (aus Script):
  🕐 Zeit: 2025-10-21 14:30:15 (automatisch)
  👤 Person: Moritz Haslbeck
  📍 Standort: Schlafzimmer
  💻 Client: Laptop xyz
```

**Diese Informationen werden automatisch bei jeder Nachricht mitgesendet!**

**Warum Context-Informationen wichtig sind:**
- ✅ Zeitbasierte KI-Antworten ("Guten Morgen!" vs "Guten Abend!")
- ✅ Personalisierte KI-Antworten ("Hallo Moritz!")
- ✅ Raumabhängige Automatisierungen ("Licht im Schlafzimmer einschalten")
- ✅ Debugging und Nachverfolgung (welches Gerät hat wann gesendet?)

**Ändern:** Beende das Script (CTRL+C), ändere die Werte im Script, und starte es neu.

### Schritt 5: Nachrichten senden

Nach der Context-Anzeige siehst du:

```
⏳ Verbinde zu ws://localhost:8081/ws/external...
✓ Verbindung hergestellt!

────────────────────────────────────────────────────────────
Gib Text ein und drücke ENTER zum Senden.
Beende mit CTRL+C oder 'exit'
────────────────────────────────────────────────────────────

Nachricht: 
```

Tippe deine Nachricht ein und drücke **ENTER**:

```
Nachricht: Hallo von Python!
→ Header gesendet
✓ Text gesendet: Hallo von Python!

Nachricht: Dies ist ein Test
→ Header gesendet
✓ Text gesendet: Dies ist ein Test

Nachricht: exit
👋 Beende Verbindung...

✓ Test beendet.
```

---

## 🚀 Verwendung WS-Out Node

### Voraussetzungen

Identisch mit WS-In Node:

```bash
# Python 3.7+ muss installiert sein
python3 --version

# websockets-Modul installieren
pip3 install websockets
```

### Schritt 1: Konfiguration anpassen

Öffne `test-ws-out.py` und passe die Server-Parameter an:

```python
# ======================================
# KONFIGURATION - HIER ANPASSEN
# ======================================
WS_HOST = "0.0.0.0"  # 0.0.0.0 = lauscht auf allen Interfaces
WS_PORT = 8082       # Dein gewünschter Port
WS_PATH = "/endpoint" # Dein gewünschter Pfad
```

**Wichtig:** `WS_HOST = "0.0.0.0"` bedeutet, dass der Server auf allen Netzwerk-Interfaces lauscht.

**Beispiele:**

```python
# Standard-Konfiguration (empfohlen)
WS_HOST = "0.0.0.0"
WS_PORT = 8082
WS_PATH = "/endpoint"

# Nur lokale Verbindungen
WS_HOST = "127.0.0.1"
WS_PORT = 8082
WS_PATH = "/endpoint"

# Anderer Port und Pfad
WS_HOST = "0.0.0.0"
WS_PORT = 9000
WS_PATH = "/data"
```

### Schritt 2: Server starten

**Option A: Mit Shell-Script (empfohlen)**

```bash
./test-ws-out.sh
```

**Option B: Direkt mit Python**

```bash
python3 test-ws-out.py
```

Du solltest folgende Ausgabe sehen:

```
============================================================
  WebSocket-Out Node Tester (Server)
============================================================

🌐 Server: 0.0.0.0:8082/endpoint
📝 Protokoll: USO & Text/JSON
📥 Modus: Empfängt Daten von WS-Out-Node

✓ Lokale IP-Adressen (für WS-Out-Node Konfiguration):
  ws://192.168.1.100:8082/endpoint

⏳ Starte WebSocket-Server...
✓ Server läuft!

────────────────────────────────────────────────────────────
Warte auf Verbindungen von WS-Out-Node...
Beende mit CTRL+C
────────────────────────────────────────────────────────────
```

### Schritt 3: WS-Out-Node in einem Flow erstellen

1. Öffne das Web-UI: `http://localhost:3001`
2. Erstelle einen neuen Flow oder öffne einen bestehenden
3. Füge eine **WebSocket Out Node** hinzu
4. Konfiguriere die Node:
   - **Ziel-URL:** `ws://localhost:8084/endpoint` (oder deine IP wenn auf anderem PC)
   - **Datentyp:** Text / JSON, Audio oder Raw
   - **Sende-Format:** Wähle ein Format:
     - **Nur Content:** Sendet NUR den reinen Text/Daten (keine Metadaten, kein Context) ⭐ Empfohlen für einfache Übertragung
     - **Nur Payload:** Sendet den Payload (kann noch Strukturen enthalten)
     - **Komplettes USO (JSON):** Sendet alles inkl. Header, Metadaten und Context
     - **Header → Payload:** USO-Protokoll kompatibel mit ESP32
   - **Fehler emittieren:** Optional aktivieren
5. Verbinde eine andere Node (z.B. Debug oder Voice-to-Text) mit der WS-Out-Node
6. **Speichere und starte** den Flow

### Schritt 4: Verbindungsstatus prüfen

Im Flow-Editor siehst du jetzt den **Verbindungsstatus** der WS-Out-Node:

- 🟢 **Grün (Connected):** Verbindung erfolgreich hergestellt
- 🟡 **Gelb (Degraded):** Reconnecting... 
- 🔴 **Rot (Error):** Nicht verbunden oder Fehler

Der Status wird automatisch aktualisiert wenn:
- Die Verbindung hergestellt wird
- Die Verbindung unterbrochen wird
- Ein Reconnect-Versuch läuft

### Schritt 5: Daten empfangen und anzeigen

Wenn der Flow Daten durch die WS-Out-Node sendet, siehst du im Terminal:

```
[14:23:45.123] 📩 Nachricht #1 empfangen
  → Client ID: 140234567890123
  → Typ: Text/String
  → Länge: 245 Zeichen
  → Format: JSON
  → Inhalt:
    {
      "header": {
        "id": "550e8400-...",
        "type": "text",
        "sourceId": "ws_in_node",
        "timestamp": 1697123456789,
        "final": true
      },
      "payload": "Hallo Welt!"
    }

  → USO-Format erkannt!
    • USO-Typ: text
    • Source: ws_in_node
    • Final: True
    • Context:
      - person: Moritz Haslbeck
      - location: Schlafzimmer
      - clientName: Laptop xyz
────────────────────────────────────────────────────────────
```

**Features der Anzeige:**
- ✅ Zeitstempel für jede Nachricht
- ✅ Automatische JSON-Formatierung
- ✅ USO-Format Erkennung
- ✅ Context-Informationen werden hervorgehoben
- ✅ Binär-Daten werden als Hex angezeigt
- ✅ Verschiedene Farben für bessere Lesbarkeit

### Schritt 6: Server beenden

Drücke **CTRL+C** um den Server zu beenden:

```
^C
👋 Server gestoppt.

✓ Test beendet.
```

---

## 📊 Überprüfung im Web-UI

### Option 1: Debug Events Panel (Empfohlen! ⭐)

**Das beste Tool zum Debuggen:**

1. Öffne den **Flow-Editor**: `http://localhost:3001/flows/editor?id={flowId}`
2. Am unteren Bildschirmrand siehst du das **Debug Events Panel**
3. Hier erscheinen **alle Events in Echtzeit**!

**Was du siehst:**

```
┌─────────────────────────────────────────────────────┐
│ Debug Events                    🟢 Verbunden  1 Event│
│ [Alle Typen ▼] [Detailliert ▼]                  [🗑]│
├─────────────────────────────────────────────────────┤
│ TEXT  Debug                           10:23:45.123  │
│                                                     │
│ Payload: 23 B (string)  Source: ws_in_node         │
│                                                     │
│ ┌─ Context ────────────────────────────────────┐   │
│ │ 👤 Person: Moritz Haslbeck                   │   │
│ │ 📍 Standort: Schlafzimmer                    │   │
│ │ 💻 Client: Laptop xyz                        │   │
│ └──────────────────────────────────────────────┘   │
│                                                     │
│ ┌─ Content ────────────────────────────────────┐   │
│ │ Hallo von Python!                            │   │
│ └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

**Features:**
- ✅ **Live-Updates** in Echtzeit
- ✅ **Context-Informationen** direkt sichtbar
- ✅ **Vollständiger Text-Inhalt** lesbar
- ✅ **3 Ansichtsmodi**: Kompakt, Detailliert, JSON
- ✅ **Filterung** nach Datentyp
- ✅ **Keine Verzögerung** - Events erscheinen sofort!

**Siehe auch:** [DEBUG_EVENTS_GUIDE.md](DEBUG_EVENTS_GUIDE.md) für eine vollständige Erklärung!

### Option 2: Logs-Seite

1. Öffne die **Logs-Seite** im Web-UI: `http://localhost:3001/logs`
2. Du solltest die gesendeten Nachrichten in den Logs sehen
3. Context-Informationen erscheinen in den Log-Einträgen

---

## 🔍 USO-Format (Universal Stream Object)

Das Script sendet Nachrichten im **USO-Format**, das aus zwei Phasen besteht:

### Phase 1: Header (JSON)

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "type": "text",
  "sourceId": "python_test_client",
  "timestamp": 1697123456789,
  "final": true,
  "textMeta": {
    "encoding": "utf-8",
    "length": 20
  }
}
```

### Phase 2: Payload (Text)

```
Hallo von Python!
```

Dieses Format ist identisch mit dem, was ESP32-Clients und andere WebSocket-Nodes verwenden.

---

## 🛠️ Troubleshooting

### WS-In Node Probleme

#### Problem: `Connection refused`

**Lösung:**
- Stelle sicher, dass der Server läuft: `docker-compose up`
- Überprüfe, ob der Flow gestartet ist
- Prüfe, ob der Port in `docker-compose.yml` freigegeben ist:
  ```yaml
  backend:
    ports:
      - "8080:8080"
      - "8081:8081"  # Für WS-In-Node
  ```

#### Problem: `Invalid URI`

**Lösung:**
- Überprüfe die Konfiguration in `test-ws-in.py`
- Stelle sicher, dass Host, Port und Pfad korrekt sind
- WebSocket-URLs beginnen mit `ws://` (nicht `http://`)

#### Problem: Keine Nachrichten in den Logs

**Lösung:**
1. Prüfe, ob die WS-In-Node mit einer Debug-Node verbunden ist
2. Stelle sicher, dass der Flow gespeichert und gestartet wurde
3. Überprüfe die Backend-Logs: `docker-compose logs -f backend`

---

### WS-Out Node Probleme

#### Problem: `Address already in use` / Port belegt

**Lösung:**
```bash
# Finde den Prozess der den Port belegt
lsof -i :8082

# Ändere WS_PORT in test-ws-out.py zu einem anderen Port
WS_PORT = 9000  # oder ein anderer freier Port
```

#### Problem: WS-Out-Node zeigt "Not connected" (Rot)

**Lösung:**
1. Stelle sicher, dass `test-ws-out.py` läuft
2. Überprüfe die Ziel-URL in der WS-Out-Node Konfiguration
3. Prüfe ob Port und Pfad übereinstimmen
4. Bei Remote-Server: Verwende die richtige IP-Adresse (nicht localhost)

#### Problem: WS-Out-Node bleibt auf "Reconnecting" (Gelb)

**Lösung:**
1. Überprüfe ob der Test-Server läuft
2. Prüfe Firewall-Einstellungen
3. Bei Remote-Server: Stelle sicher, dass der Port offen ist
4. Überprüfe die Backend-Logs für Fehler-Details

#### Problem: Keine Daten im Test-Server sichtbar

**Lösung:**
1. Stelle sicher, dass die WS-Out-Node Daten von anderen Nodes empfängt
2. Überprüfe ob die Verbindung hergestellt ist (grüner Status)
3. Prüfe das Sende-Format in der WS-Out-Node Konfiguration
4. Überprüfe die Debug-Events im Flow-Editor

---

### Allgemeine Probleme

#### Problem: `Module 'websockets' not found`

**Lösung:**
```bash
pip3 install websockets
```

#### Problem: Python-Version zu alt

**Lösung:**
```bash
# Überprüfe Python-Version
python3 --version

# Sollte mindestens 3.7 sein
# Bei macOS: brew install python3
# Bei Linux: sudo apt install python3
```

---

## 🔥 AI-Streaming mit WS-Out Node (NEU!)

### Was ist Streaming?

**Streaming** bedeutet, dass AI-Antworten **token-für-token** gesendet werden, während sie generiert werden - genau wie bei ChatGPT!

**Vorteile:**
- ⚡ Erste Antwort in < 1 Sekunde (statt 5-30 Sekunden)
- ✅ Live-Anzeige des Textes im Terminal
- ✅ Bessere User-Experience

### Schritt-für-Schritt: AI-Streaming Test

#### 1. Test-Server starten (Terminal 1)

```bash
cd "Server_anwendung"
export WS_PORT=8084
export WS_PATH=/endpoint
./test-ws-out.sh
```

Der Server zeigt an:
```
🚀 WebSocket-Server läuft!
📍 Lokale URL: ws://localhost:8084/endpoint
📍 Netzwerk URL: ws://192.168.1.100:8084/endpoint

Warte auf Verbindungen von WS-Out-Node...
```

#### 2. Flow erstellen im Web-UI

1. Erstelle einen neuen Flow
2. Füge folgende Nodes hinzu und verbinde sie:

```
┌───────────┐    ┌───────────┐    ┌───────────┐
│  WS-In    │───▶│ AI-Node   │───▶│ WS-Out    │
│  Node     │    │ (Flowise) │    │  Node     │
└───────────┘    └───────────┘    └───────────┘
```

3. **WS-In Node** konfigurieren:
   - Port: `8081`
   - Pfad: `/endpoint`

4. **AI Node** konfigurieren: ⚡
   - Flowise-Server auswählen
   - **Streaming aktivieren:** ✅ **AN** (WICHTIG!)

5. **WS-Out Node** konfigurieren: ⚡
   - Ziel-URL: `ws://localhost:8084/endpoint`
   - Sende-Format: **Nur Content** (WICHTIG!)
   - Datentyp: Text / JSON

6. **Speichern und Flow starten!**

#### 3. Frage senden (Terminal 2)

```bash
cd "Server_anwendung"
export WS_PORT=8081
export WS_PATH=/endpoint
./test-ws-in.sh

# Im interaktiven Modus:
> Erzähl mir eine kurze Geschichte
```

#### 4. Live-Streaming beobachten (Terminal 1)

Du siehst jetzt die AI-Antwort **live token-für-token** erscheinen:

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

  AI Antwort: Once upon a time, in a small village nestled 
  between rolling hills, there lived a curious young fox 
  named Finn. Finn loved exploring the forest...

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
- ✅ Context-Info nur **einmal** am Anfang (nicht bei jedem Token!)

### Wichtige Einstellungen für Streaming

#### AI Node:
```
✅ Streaming aktivieren: AN
```
Ohne diese Einstellung wartest du auf die komplette Antwort!

#### WS-Out Node:
```
Sende-Format: Nur Content (content_only)
```
Diese Einstellung sendet **nur** den reinen Text ohne JSON-Overhead!

**Vergleich der Formate:**

| Format | Gesendet pro Token | Overhead | Empfohlen für |
|--------|-------------------|----------|---------------|
| **Nur Content** ⭐ | `"Hello"` | Minimal | Streaming, Terminal |
| Nur Payload | `"Hello"` | Mittel | - |
| Komplettes USO | `{"header":{...},"payload":"Hello"}` | Hoch | Debug |
| Header → Payload | 2 Nachrichten | Sehr hoch | ESP32 |

### Streaming-Erkennung in test-ws-out.py

Das Script erkennt automatisch Streaming-Chunks:

```python
# Im USO-Header:
"final": false  → Streaming-Chunk (weitere kommen)
"final": true   → Letzter Chunk oder normales Paket
```

**Verhalten:**
1. **Erster Chunk** (`final: false`):
   - Zeigt Header mit USO-Info, Context, etc.
   - Startet Live-Text-Ausgabe
   
2. **Weitere Chunks** (`final: false`):
   - Nur Text wird live hinzugefügt
   - Kein JSON, keine Metadaten
   
3. **Finales Paket** (`final: true`):
   - Zeigt Zusammenfassung
   - Chunk-Count, Gesamtlänge
   - Session-Cleanup

### Erwartete Performance

| Metrik | Wert |
|--------|------|
| Start-to-First-Token | 0.5-1.5 Sekunden |
| Token-to-Token | 0.1-0.3 Sekunden |
| Tokens pro Sekunde | 10-30 |

**11x schnellere Wahrnehmung!** 🚀

Statt 10 Sekunden auf die komplette Antwort zu warten, siehst du die ersten Worte in unter 1 Sekunde!

### Troubleshooting Streaming

#### Problem: Keine Tokens ankommen (totalChunks: 0)

**Symptome:**
```
✓ STREAMING abgeschlossen!
  • Chunks: 0
  • Gesamtlänge: 0 Zeichen
```

**Lösung:**
1. Prüfe AI Node Konfiguration: **Streaming aktivieren** muss ✅ AN sein
2. Backend neu starten: `docker-compose restart backend`
3. Prüfe Backend-Logs: `docker-compose logs -f backend | grep Flowise`
4. Prüfe Flowise-Server ist erreichbar

#### Problem: Text erscheint nicht live

**Symptome:** Alle Chunks auf einmal statt einzeln

**Lösung:**
- `test-ws-out.py` muss neueste Version verwenden (mit `flush=True`)
- Python-Version prüfen: `python3 --version` (mindestens 3.7)

#### Problem: Doppelte Antworten

**Symptome:** Text erscheint zweimal

**Erklärung:** Das ist normal! 
- Streaming-Chunks: `final: false` → Live-Anzeige
- Finales Paket: `final: true` → Zusammenfassung

Du kannst das finale Paket ignorieren oder in der Zusammenfassung nutzen.

### Siehe auch

- **[STREAMING_GUIDE.md](STREAMING_GUIDE.md)** ⭐ - Komplette technische Dokumentation
- **[NODES.md](NODES.md)** - AI Node & WS-Out Node Details
- **[SERVICES.md](SERVICES.md)** - Flowise API Dokumentation

---

## 📝 Erweiterte Verwendung

### Automatisierte Tests

Du kannst das Script auch für automatisierte Tests verwenden:

```python
# Erstelle test-automated.py
import asyncio
import websockets

async def send_test_messages():
    async with websockets.connect("ws://localhost:8081/ws/external") as ws:
        messages = ["Test 1", "Test 2", "Test 3"]
        
        for msg in messages:
            header = {...}  # USO-Header
            await ws.send(json.dumps(header))
            await ws.send(msg)
            await asyncio.sleep(1)

asyncio.run(send_test_messages())
```

### Integration in CI/CD

```bash
# test-ci.sh
#!/bin/bash
python3 test-ws-in.py < test-messages.txt
```

---

## 🔗 Siehe auch

- [SERVICES.md](./SERVICES.md) - Dokumentation externer Service-APIs
- [NODES.md](./NODES.md) - Dokumentation aller verfügbaren Nodes
- [README.md](./README.md) - Haupt-Dokumentation

---

## 📋 Zusammenfassung

### WS-In Node Test (Client sendet an Server)

```bash
# 1. Server starten (Backend mit Flow)
docker-compose up

# 2. Flow erstellen mit WS-In-Node (Port 8081, Pfad /ws/external)

# 3. Test-Client starten
./test-ws-in.sh

# 4. Nachrichten eingeben und senden
```

### WS-Out Node Test (Server empfängt von Node)

```bash
# 1. Test-Server starten
./test-ws-out.sh

# 2. Server zeigt seine lokale IP an (z.B. ws://192.168.1.100:8082/endpoint)

# 3. Backend mit Flow starten
docker-compose up

# 4. Flow erstellen mit WS-Out-Node (Ziel-URL aus Schritt 2)

# 5. Daten fließen lassen und im Test-Server Terminal beobachten
```

### AI-Streaming Test (EMPFOHLEN! ⚡)

```bash
# 1. Test-Server starten (Terminal 1)
export WS_PORT=8084
./test-ws-out.sh

# 2. Backend mit Flow starten (Terminal 2)
docker-compose up

# 3. Flow erstellen: WS-In → AI-Node → WS-Out
#    - AI Node: Streaming aktivieren ✅ AN
#    - WS-Out: Format "Nur Content", URL ws://localhost:8084/endpoint

# 4. Test-Client starten (Terminal 3)
export WS_PORT=8081
./test-ws-in.sh

# 5. Frage eingeben: "Erzähl mir eine Geschichte"

# 6. Live-Streaming in Terminal 1 beobachten! 🔥
```

---

**Erstellt:** Oktober 2025  
**Aktualisiert:** Oktober 2025  
**Version:** 2.0

