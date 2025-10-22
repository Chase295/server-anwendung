# 🚀 Schnelltest-Anleitung

## ✅ System-Status (gerade getestet)

```
✅ Backend:   http://localhost:3000/api  (Status: 200)
✅ Frontend:  http://localhost:3001       (Status: 200)
✅ MongoDB:   Verbunden und healthy
✅ Ports:     3000, 8080, 8081 freigegeben
```

---

## 📝 Test-Flow erstellen (5 Minuten)

### Schritt 1: Web-UI öffnen
```
http://localhost:3001
```

### Schritt 2: Neuen Flow erstellen
1. Gehe zu **"Flows"** in der Navigation
2. Klicke auf **"Neuer Flow"**
3. Gib einen Namen ein: `WS-Test-Flow`
4. Klicke **"Erstellen"**

### Schritt 3: Nodes hinzufügen

**Node 1: WebSocket In**
1. Ziehe **"WebSocket In"** von der Toolbar auf den Canvas
2. Klicke die Node an
3. Konfiguriere im rechten Panel:
   - **Label:** `WS_Test`
   - **Port:** `8081`
   - **Pfad:** `/ws/external`
   - **Datentyp:** `Text`
4. ✅ Diese Node hat KEINE AI-Abhängigkeiten!

**Node 2: Debug**
1. Ziehe **"Debug"** von der Toolbar auf den Canvas
2. Konfiguriere:
   - **Label:** `Debug_Output`

**Verbindung erstellen:**
- Verbinde den **Output-Handle** (rechts) von `WS_Test`
- Mit dem **Input-Handle** (links) von `Debug_Output`

### Schritt 4: Flow speichern und starten
1. Klicke oben auf **"Speichern"**
2. Klicke auf **"Flow starten"** (Play-Button)
3. ✅ Status sollte auf "Running" wechseln

---

## 🧪 WebSocket-Test durchführen

### Terminal öffnen und Script starten:
```bash
./test-ws-in.sh
```

### Erwartete Ausgabe:
```
============================================================
  WebSocket-In Node Tester
============================================================

📡 Verbindung: ws://localhost:8081/ws/external
📝 Protokoll: USO (Universal Stream Object)
📤 Datentyp: Text

✓ Context-Informationen (aus Script):
  👤 Person: Moritz Haslbeck
  📍 Standort: Schlafzimmer
  💻 Client: Laptop xyz

⏳ Verbinde zu ws://localhost:8081/ws/external...
✓ Verbindung hergestellt!

────────────────────────────────────────────────────────────
Gib Text ein und drücke ENTER zum Senden.
Beende mit CTRL+C oder 'exit'
────────────────────────────────────────────────────────────

Nachricht: 
```

**Neu:** Das Script verwendet **Context-Informationen** aus dem Script selbst!
Diese werden automatisch bei allen Nachrichten mitgesendet und sind im **Debug Events Panel** sichtbar.

**Anpassen:** Öffne `test-ws-in.py` und ändere die Werte:
```python
CONTEXT_PERSON = "Dein Name"
CONTEXT_LOCATION = "Dein Raum"
CONTEXT_CLIENT = "Dein Gerät"
```

### Nachrichten senden:
```
Nachricht: Hallo von Python!
→ Header gesendet
✓ Text gesendet: Hallo von Python!

Nachricht: Dies ist ein Test
→ Header gesendet
✓ Text gesendet: Dies ist ein Test

Nachricht: exit
👋 Beende Verbindung...
```

---

## 🔍 Ergebnisse überprüfen

### Option 1: Debug Events Panel (Empfohlen! ⭐)

Das **beste Tool** zum Sehen der Live-Events:

1. Öffne den Flow-Editor: `http://localhost:3001/flows/editor?id={flowId}`
2. Am **unteren Bildschirmrand** siehst du das **Debug Events Panel**
3. Hier erscheinen **alle Events in Echtzeit**!

**Was du siehst:**
```
┌─────────────────────────────────────────────────────┐
│ TEXT  Debug                           10:23:45.123  │
│ Payload: 21 B (string)  Source: WS_Test            │
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
- ✅ **Live-Updates** - Events erscheinen sofort!
- ✅ **Context sichtbar** - Person, Standort, Client
- ✅ **Vollständiger Text** - Ganzer Nachrichteninhalt lesbar
- ✅ **3 Ansichtsmodi** - Kompakt, Detailliert, JSON
- ✅ **Keine Verzögerung** - Schneller als Logs!

**Siehe:** [DEBUG_EVENTS_GUIDE.md](DEBUG_EVENTS_GUIDE.md) für vollständige Dokumentation!

### Option 2: Logs im Web-UI anschauen
```
http://localhost:3001/logs
```

Du solltest sehen:
- `[WSInNode] Message received` mit deinen gesendeten Texten
- `[DebugNode] USO received` mit den vollständigen USO-Objekten
- Context-Informationen in den Log-Einträgen

### Option 3: Backend-Logs live verfolgen
```bash
docker-compose logs -f backend
```

---

## ❌ Falls Flow nicht startet

### Problem: "Keine Flowise-Server-ID konfiguriert"
**Ursache:** Du hast eine AI-Node im Flow, die nicht konfiguriert ist.

**Lösung 1 (empfohlen für ersten Test):**
- Lösche die AI-Node aus dem Flow
- Nutze nur: `WS-In → Debug`

**Lösung 2:**
- Konfiguriere die AI-Node mit einem Flowise-Server
- Siehe: [SERVICES.md](./SERVICES.md#flowise-ai-flow-engine)

### Problem: "Port 8081 already in use"
**Lösung:**
```bash
docker-compose restart backend
```

---

## 📊 Test-Checkliste

- [ ] Frontend erreichbar (http://localhost:3001)
- [ ] Backend erreichbar (http://localhost:3000/api/flows → 200 OK)
- [ ] Flow erstellt mit WS-In + Debug
- [ ] Flow gestartet (Status: Running)
- [ ] Context-Informationen im Script angepasst (test-ws-in.py)
- [ ] `./test-ws-in.sh` verbindet erfolgreich
- [ ] Nachrichten werden gesendet
- [ ] **Events erscheinen im Debug Events Panel** ⭐ (Live!)
- [ ] Context-Informationen sichtbar (👤 📍 💻)
- [ ] Text-Inhalt vollständig lesbar
- [ ] Nachrichten erscheinen in Logs (alternativ)

---

## 🎯 Nächste Schritte

Nach erfolgreichem Test kannst du erweitern:

1. **STT hinzufügen:** `WS-In → STT → Debug`
2. **TTS hinzufügen:** `WS-In → TTS → WS-Out`
3. **AI hinzufügen:** `WS-In → AI → Debug` (mit Flowise konfiguriert)
4. **Voller Flow:** `WS-In → STT → AI → TTS → WS-Out`

---

**Stand:** Oktober 2025  
**Getestet:** ✅ Alle Services laufen

