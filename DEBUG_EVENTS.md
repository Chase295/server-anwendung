# 🔍 Debug Events - Live Event-Monitoring

Das Debug Events System ermöglicht Live-Monitoring aller Debug-Node-Ausgaben direkt im Flow-Editor.

## 📋 Features

- ✅ **Live WebSocket-Verbindung** - Events werden in Echtzeit angezeigt
- ✅ **Unten andockbares Panel** - Togglebar, resizable Event-Panel
- ✅ **Auto-Reconnect** - Automatische Wiederverbindung bei Verbindungsabbruch
- ✅ **Filterung** - Nach Datentyp filtern (Audio, Text, Control)
- ✅ **Drei Anzeigemodi** - Kompakt, Detailliert, JSON
- ✅ **Event-Limit** - Maximal 50 Events (neueste zuerst)
- ✅ **Flow-spezifisch** - Nur Events des aktuellen Flows
- ✅ **Node-Informationen** - Zeigt Node-Label, Flow-Name, Timestamps

## 🏗️ Architektur

### Backend

```
┌─────────────────────┐
│   Debug Node        │
│  (process USO)      │
└──────────┬──────────┘
           │ emits 'debug:log'
           ▼
┌─────────────────────┐
│   Flow Engine       │
│  (handleDebugEvent) │
└──────────┬──────────┘
           │ broadcastDebugEvent
           ▼
┌─────────────────────┐
│ DebugEventsGateway  │
│  WebSocket (8082)   │
└──────────┬──────────┘
           │ WS Message
           ▼
┌─────────────────────┐
│   Frontend          │
│  (EventPanel)       │
└─────────────────────┘
```

### WebSocket-Port

- **Port 8082:** Debug Events WebSocket für Frontend-Clients
- **Automatisch gestartet** beim Backend-Start
- **Keine Authentifizierung** (nur für Frontend, nicht für externe Clients)

### Event-Format

```typescript
interface DebugEvent {
  flowId: string;           // Flow-ID
  flowName?: string;        // Flow-Name (aus Definition)
  nodeId: string;           // Node-ID
  nodeLabel?: string;       // Node-Label (aus Definition)
  timestamp: number;        // Unix-Timestamp
  uso: {
    header: any;           // USO-Header (komplett)
    payloadType: string;   // 'string' | 'Buffer'
    payloadSize: number;   // Größe in Bytes
    payloadPreview?: string; // Optionaler Preview
  };
}
```

## 🚀 Verwendung

### Flow-Editor

1. Öffnen Sie einen Flow im Editor
2. Das Event-Panel erscheint unten (standardmäßig geöffnet)
3. Fügen Sie Debug-Nodes zu Ihrem Flow hinzu
4. Starten Sie den Flow
5. Events erscheinen live im Panel

### Panel-Bedienung

**Header:**
- **Pfeil-Button:** Panel öffnen/schließen
- **Status-Indikator:** Zeigt WebSocket-Verbindung (grün = verbunden)
- **Event-Counter:** Anzahl der gefilterten Events
- **Filter-Dropdown:** Nach Datentyp filtern (Alle, Audio, Text, Control)
- **Ansicht-Dropdown:** Anzeigemodus wählen (Kompakt, Detailliert, JSON)
- **Mülleimer-Button:** Alle Events löschen

**Resizing:**
- Ziehen Sie die obere Kante des Panels zum Vergrößern/Verkleinern
- Mindesthöhe: 100px
- Maximalhöhe: Bildschirmhöhe - 200px

### Anzeigemodi

#### 1. Kompakt
```
17:38:42.123 AUDIO Debug Node 1.2 KB from: esp32_001
17:38:42.089 TEXT AI Response 245 B from: flowise
17:38:42.056 CONTROL Start Session
```

**Zeigt:** Timestamp, Typ, Node-Label, Größe, Source

#### 2. Detailliert
```
AUDIO Debug Node                    17:38:42.123

Payload: 1.2 KB (Buffer)   Source: esp32_001
Session: session-uuid-123
Audio: 16000Hz, 1ch, pcm_s16le
```

**Zeigt:** Alle Metadaten, Audio-Info, Session-ID

#### 3. JSON
```json
{
  "flowId": "flow-abc123",
  "flowName": "Voice Assistant",
  "nodeId": "node-xyz789",
  "nodeLabel": "Debug Node",
  "timestamp": 1697123456789,
  "uso": {
    "header": { ... },
    "payloadType": "Buffer",
    "payloadSize": 1234
  }
}
```

**Zeigt:** Vollständiger Event als JSON

## 🔌 WebSocket-Verbindung

### Frontend

```typescript
// Hook verwenden
const { events, isConnected, clearEvents } = useDebugEvents(flowId);

// Verbindung erfolgt automatisch
// WebSocket-URL: ws://localhost:8082 (aus env)
```

### Reconnect-Logik

- **Auto-Connect:** Beim Component-Mount
- **Auto-Reconnect:** Nach 3 Sekunden bei Verbindungsabbruch
- **Disconnect:** Beim Component-Unmount

### Event-Handling

```typescript
// Empfangene Messages
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  if (message.type === 'welcome') {
    // Verbindung hergestellt
  }
  
  if (message.type === 'debug:event') {
    // Neues Debug-Event
    const debugEvent = message.event;
    // ... zur Event-Liste hinzufügen
  }
};
```

## ⚙️ Konfiguration

### Backend

**Environment-Variable (optional):**
```bash
DEBUG_EVENTS_PORT=8082  # Standard: 8082
```

**Docker Compose:**
```yaml
backend:
  ports:
    - "8082:8082"  # Debug Events WebSocket
```

### Frontend

**Environment-Variable:**
```bash
NEXT_PUBLIC_DEBUG_WS_URL=ws://localhost:8082
```

**Automatischer Fallback:** Wenn nicht gesetzt, wird `ws://localhost:8082` verwendet

## 🧪 Testen

### Backend-WebSocket testen

```bash
# Mit wscat (npm install -g wscat)
wscat -c ws://localhost:8082

# Erwartete Ausgabe:
< {"type":"welcome","timestamp":1697123456789,"message":"Connected to Debug Events stream"}
```

### Frontend-Integration testen

1. Flow-Editor öffnen: `http://localhost:3001/flows/editor`
2. Debug-Node hinzufügen
3. Node mit einem Datenfluss verbinden
4. Flow speichern und starten
5. Event-Panel öffnen (falls geschlossen)
6. Events sollten erscheinen wenn Daten durch Debug-Node fließen

### Test-Flow erstellen

**Einfacher Test-Flow:**
```
[WS Input] → [Debug Node]
```

1. WS Input Node hinzufügen (dataType: text)
2. Debug Node hinzufügen
3. Nodes verbinden
4. Flow speichern und starten
5. Mit `test-ws-in.py` Daten senden
6. Events im Panel beobachten

## 🐛 Troubleshooting

### Events werden nicht angezeigt

**Prüfen:**
```bash
# 1. Backend läuft?
docker logs iot-orchestrator-backend | grep "Debug Events"
# Sollte zeigen: "Debug Events WebSocket server listening on port 8082"

# 2. Port erreichbar?
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: test" \
  http://localhost:8082

# 3. Frontend-Verbindung?
# Öffne Browser-DevTools → Network → WS
# Sollte WebSocket-Verbindung zu ws://localhost:8082 zeigen

# 4. Flow läuft?
# Events werden nur bei laufenden Flows generiert
```

### WebSocket verbindet nicht

**Lösung:**
```bash
# Port in docker-compose.yml prüfen
grep 8082 docker-compose.yml

# Container neu starten
docker-compose restart backend frontend

# Browser-Cache leeren
# Hard-Reload: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Win)
```

### Events kommen verzögert

**Normal:** Kleine Verzögerung (< 100ms) ist normal
**Problem:** Wenn > 1 Sekunde:
- Backend-CPU-Last prüfen: `docker stats`
- WebSocket-Verbindung prüfen: Browser DevTools → Network → WS

### Panel wird nicht angezeigt

**Prüfen:**
```bash
# Sind alle Komponenten geladen?
grep -r "EventPanel" frontend/src/components/flow-editor/

# TypeScript-Fehler?
docker logs iot-orchestrator-frontend | grep -i error
```

## 📊 Performance

### Event-Limits

- **Max. Events:** 50 (konfigurierbar in `useDebugEvents.ts`)
- **Neueste zuerst:** FIFO (First-In-First-Out)
- **Auto-Cleanup:** Älteste Events werden entfernt

### WebSocket-Performance

- **Broadcast:** O(n) - alle verbundenen Clients
- **Typical Clients:** 1-5 (meist nur 1 Flow-Editor offen)
- **Message-Größe:** ~500 Bytes pro Event
- **Bandbreite:** Vernachlässigbar bei < 100 Events/Sekunde

### Speicher

- **Frontend:** ~5-10 MB für 50 Events (mit JSON-Daten)
- **Backend:** Vernachlässigbar (keine Persistenz)

## 🔒 Sicherheit

### Authentifizierung

**Aktuell:** Keine Authentifizierung für Debug-Events-WebSocket
**Grund:** Nur für lokale Entwicklung gedacht

**Für Production:**
```typescript
// TODO: JWT-Token-basierte Authentifizierung
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'jwt-token-hier'
  }));
};
```

### CORS & Same-Origin

**Entwicklung:** Keine Einschränkungen
**Production:** WebSocket über Nginx-Proxy routen

## 🚀 Nächste Schritte

### Geplante Features

- [ ] **Persistenz:** Events in MongoDB speichern (optional)
- [ ] **Export:** Events als JSON/CSV exportieren
- [ ] **Filter erweitern:** Nach Node, Zeitraum, Source
- [ ] **Suche:** Volltextsuche in Events
- [ ] **Statistiken:** Events pro Sekunde, Payload-Größen
- [ ] **Notifications:** Browser-Benachrichtigungen bei Errors

### Erweiterungen

- [ ] **Event-Recording:** Record/Replay für Tests
- [ ] **Multiple Flows:** Alle Flows gleichzeitig monitoren
- [ ] **Performance-Metrics:** Latenz, Throughput anzeigen
- [ ] **Alerts:** Automatische Alerts bei ungewöhnlichen Events

## 📚 API-Referenz

### useDebugEvents Hook

```typescript
const {
  events,        // DebugEvent[] - Array der Events
  isConnected,   // boolean - WebSocket-Verbindungsstatus
  error,         // string | null - Letzter Fehler
  clearEvents,   // () => void - Alle Events löschen
  reconnect,     // () => void - Manuell reconnecten
} = useDebugEvents(flowId?: string);
```

### EventPanel Component

```typescript
<EventPanel
  events={events}           // DebugEvent[] - Events anzeigen
  isConnected={isConnected} // boolean - Verbindungsstatus
  onClearEvents={handler}   // () => void - Clear-Handler
  flowId={flowId}          // string - Aktuelle Flow-ID
/>
```

## 📝 Changelog

### v1.0.0 (2025-10-20)

**Initial Release:**
- ✅ Backend: DebugEventsGateway (WebSocket auf Port 8082)
- ✅ Backend: Flow-Engine Integration
- ✅ Frontend: useDebugEvents Hook
- ✅ Frontend: EventPanel Komponente
- ✅ Frontend: FlowEditor Integration
- ✅ Drei Anzeigemodi (Kompakt, Detailliert, JSON)
- ✅ Filterung nach Datentyp
- ✅ Resizable Panel
- ✅ Auto-Reconnect

## 🤝 Contributing

Bei Fragen oder Problemen:
1. Backend-Logs prüfen: `docker logs iot-orchestrator-backend`
2. Frontend-Logs prüfen: Browser DevTools → Console
3. WebSocket-Verbindung prüfen: Browser DevTools → Network → WS

---

**Entwickelt für:** IoT & Voice Orchestrator Server
**Autor:** AI Assistant
**Datum:** 2025-10-20

