# IoT & Voice Orchestrator - Frontend

React/Next.js Frontend für den IoT & Voice Orchestrator.

## Features

- ✅ **Flow-Editor** mit React Flow für visuelle Workflow-Erstellung
  - Drag & Drop von Nodes von Toolbar auf Canvas
  - Intelligente Verbindungsvalidierung nach Datentypen
  - Node-spezifische Input/Output-Handles
  - Edge-Management (Auswahl, Löschen)
  - Icons auf Canvas-Nodes
  - Verbesserte Handle-Sichtbarkeit mit Glow-Effekten
- ✅ **Server-Verwaltung** - Zentrale Verwaltung von Vosk, Piper und Flowise-Servern
- ✅ **Direkte Node-Konfiguration** - Server direkt in Node-Panels hinzufügen/bearbeiten
- ✅ **Toast-Benachrichtigungen** - Moderne Erfolgs-/Fehlermeldungen
- ✅ **Confirm-Dialoge** - Elegante Bestätigungsdialoge für kritische Aktionen
- ✅ **Geräte-Verwaltung** für ESP32-Clients
- ✅ **Live-Logs** mit Auto-Refresh und Filter-Optionen
- ✅ **Settings** für API-Keys, Server-Verwaltung und System-Konfiguration
- ✅ **Responsive Design** mit Tailwind CSS
- ✅ **Dark Mode** mit automatischer System-Erkennung und Persistenz
- ✅ **Admin-Authentifizierung**
- ✅ **Debug Events Panel** - Live-Monitoring aller Debug-Node-Ausgaben
  - WebSocket-basierte Echtzeit-Events
  - 3 Ansichtsmodi (Kompakt, Detailliert, JSON)
  - Context-Informationen Anzeige
  - Text-Preview für alle Payloads
  - Auto-Reconnect bei Verbindungsabbruch

> **Hinweis:** Details zur Integration externer Services (Vosk, Piper, Flowise) finden Sie in der [SERVICES.md](../SERVICES.md).

## Technologie-Stack

- **Framework:** Next.js 14 (App Router)
- **UI-Library:** React 18
- **Flow-Editor:** React Flow
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **API-Client:** Axios
- **Icons:** Lucide React

## Installation

```bash
# Dependencies installieren
npm install

# .env.local erstellen
cp .env.local.example .env.local

# Anpassen der Backend-URLs in .env.local
```

## Environment Variables

```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_DEBUG_EVENTS_URL=ws://localhost:8082
```

Für Production mit Nginx:
```env
NEXT_PUBLIC_API_URL=https://your-domain.com/api
NEXT_PUBLIC_WS_URL=wss://your-domain.com/ws
NEXT_PUBLIC_DEBUG_EVENTS_URL=wss://your-domain.com/debug-events
```

**Ports:**
- `3000`: Backend HTTP/API
- `8080`: WebSocket für ESP32-Clients
- `8082`: Debug Events WebSocket

## Development

```bash
npm run dev
```

Frontend läuft auf: http://localhost:3001

## Seiten-Struktur

```
/                    -> Redirect zu /flows oder /login
/login               -> Admin-Login
/flows               -> Flow-Übersicht
/flows/editor        -> Flow-Editor (React Flow)
/devices             -> Geräte-Verwaltung
/logs                -> System-Logs
/settings            -> Einstellungen & Secrets
```

## Flow-Editor

Der Flow-Editor basiert auf React Flow und bietet eine intuitive, visuelle Oberfläche zur Erstellung von Workflows.

### Grundlegende Bedienung

- **Drag & Drop:** Ziehen Sie Nodes direkt von der linken Toolbar auf die Canvas
- **Verbinden:** Ziehen Sie von einem grünen Output-Handle (rechts) zu einem blauen Input-Handle (links)
- **Auswählen:** Klicken Sie auf Nodes oder Edges zum Auswählen
- **Löschen:** Drücken Sie `Delete` zum Löschen ausgewählter Elemente
- **Konfigurieren:** Klicken Sie auf eine Node, um das rechte Konfigurations-Panel zu öffnen

### Intelligente Verbindungsvalidierung

Der Flow-Editor validiert automatisch die Kompatibilität von Verbindungen:

- **Audio-Verbindungen:** Mikrofon → STT, TTS → Lautsprecher
- **Text-Verbindungen:** STT → KI, KI → TTS
- **Automatische Blockierung:** Ungültige Verbindungen (z.B. Mikrofon → KI) werden verhindert
- **Datentyp-System:** Audio, Text, und Raw/JSON werden unterschieden

### Node-Handles

Jede Node hat nur die Handles, die sie tatsächlich benötigt:

**Datenquellen (nur Output - grün, rechts):**
- **Mikrofon:** Output: Audio
- **WebSocket Input:** Output: Audio/Text/Raw (konfigurierbar)

**Datenverarbeitung (Input + Output):**
- **STT:** Input: Audio → Output: Text
- **KI:** Input: Text → Output: Text
- **TTS:** Input: Text → Output: Audio

**Datenziele (nur Input - blau, links):**
- **Lautsprecher:** Input: Audio
- **Debug:** Input: Any (akzeptiert alle Typen)
- **WebSocket Output:** Input: Audio/Text/Raw (konfigurierbar)

### WebSocket-Nodes

WebSocket-Nodes bieten flexible Konfigurationsmöglichkeiten:

- **Datentyp-Auswahl:** Audio, Text, oder Raw/JSON
- **Intelligente Validierung:** WS Input (text) kann direkt an KI verbunden werden
- **Bidirektionale Kommunikation:** WS Input für eingehende, WS Output für ausgehende Daten

### Visuelle Features

- **Icons:** Jede Node zeigt ihr charakteristisches Icon (Mikrofon, Lautsprecher, etc.)
- **Farbkodierung:** Blaue Input-Handles (links), grüne Output-Handles (rechts)
- **Glow-Effekte:** Handles leuchten beim Hover für bessere Sichtbarkeit
- **Edge-Highlighting:** Ausgewählte Verbindungen werden blau hervorgehoben
- **Dark Mode:** Vollständige Unterstützung mit optimaler Lesbarkeit

### Tastenkürzel

- **Delete/Backspace:** Löscht ausgewählte Nodes oder Edges
- **Klick:** Auswahl von Nodes oder Edges
- **Drag:** Verschieben von Nodes oder Pan der Canvas

### Verfügbare Node-Typen

- **Debug:** Zeigt USO-Datenströme im Log (Input: Any)
- **Mikrofon:** Empfängt Audio von ESP32 (Output: Audio)
- **STT:** Speech-to-Text (Vosk) (Input: Audio → Output: Text)
- **KI:** KI-Verarbeitung (Flowise AI) (Input: Text → Output: Text)
- **TTS:** Text-to-Speech (Piper) (Input: Text → Output: Audio)
- **Lautsprecher:** Sendet Audio an ESP32 (Input: Audio)
- **WebSocket In:** Empfängt Daten von externen Clients (Output: Audio/Text/Raw)
  - Konfigurierbare Context-Weitergabe (aktiviert/deaktiviert)
- **WebSocket Out:** Sendet Daten an externe Server (Input: Audio/Text/Raw)

### WebSocket In Node - Context-Weitergabe

Die WS_In Node hat eine neue Option, um zu steuern, ob Context-Informationen weitergegeben werden.

#### UI-Konfiguration

**Im Node-Panel:**
```
📋 Context-Informationen weitergeben
☑ Aktiviert (Standard)

Wenn aktiviert: Zeit, Person, Standort und Client-Name 
                werden an nachfolgende Nodes weitergegeben.

Wenn deaktiviert: Nur der reine Content wird weitergegeben 
                  (nützlich für KI-Nodes).
```

**Checkbox-Komponente:**
- Position: Zwischen "Datentyp" und "Audio-Einstellungen"
- Design: Blaues Panel mit ausführlicher Beschreibung
- Default: Aktiviert (✅)
- Standard-Badge: "💡 Standard: Aktiviert"

#### Anwendungsfälle

**✅ Context AKTIVIERT (Standard):**
- Personalisierte KI-Antworten
- Debugging und Logging
- Raumabhängige Automatisierungen

**❌ Context DEAKTIVIERT:**
- Privacy-Schutz (keine persönlichen Daten)
- Token-Optimierung (ca. 60% weniger Daten)
- Anonyme API-Calls

📖 **Detaillierte Dokumentation:** [CONTEXT_MANAGEMENT.md](../CONTEXT_MANAGEMENT.md)

### Flow-Status-Management

Der Flow-Editor bietet vollständige Flow-Kontrolle direkt im Editor:

#### Start/Stop Button
- **Position:** Oben rechts im Editor-Header (neben "Speichern")
- **Visuelles Design:**
  - 🟢 **Gestoppt:** Grüner Button mit "Start" und Play-Icon
  - 🔴 **Läuft:** Roter Button mit "Stop" und Square-Icon
  - ⏳ **Loading:** Button disabled, Text "Starte..." / "Stoppe..."
- **Funktion:**
  - Startet/Stoppt den Flow ohne zur Flow-Liste zurückkehren zu müssen
  - Direkte API-Calls zu `POST /flows/:id/start` und `POST /flows/:id/stop`
  - Toast-Notifications für Erfolg/Fehler

#### Status-Badge
- **Position:** Flow-Info-Panel (oben rechts, unter Flow-Name)
- **Visuelles Design:**
  - 🟢 **Läuft:** Grüner Badge mit pulsierendem Punkt
  - ⚪ **Gestoppt:** Grauer Badge mit statischem Punkt
- **Live-Update:** Status wird automatisch aktualisiert

#### Status-Synchronisation

Der Flow-Status wird automatisch synchronisiert:

**1. Beim Öffnen des Editors:**
```typescript
useEffect(() => {
  if (flowId) {
    loadFlow(flowId);  // Lädt Flow + Status
  }
}, [flowId]);
```

**2. Bei jedem Mount/Remount (z.B. nach Seitenwechsel):**
```typescript
useEffect(() => {
  if (!flowId) return;
  refreshFlowStatus(flowId);  // Lädt nur Status (leichter)
}, [flowId]);
```

**3. Bei Tab-Fokus-Wechsel:**
```typescript
const handleVisibilityChange = () => {
  if (!document.hidden && flowId) {
    refreshFlowStatus(flowId);
  }
};
document.addEventListener('visibilitychange', handleVisibilityChange);
```

**Vorteile:**
- ✅ Konsistenz zwischen Editor und Flow-Liste
- ✅ Automatische Updates bei Tab-Wechsel
- ✅ Keine stale States
- ✅ Optimistische UI-Updates (sofortige Anzeige)

📖 **Detaillierte Dokumentation:** [FLOW_STATUS_MANAGEMENT.md](../FLOW_STATUS_MANAGEMENT.md)

### Geplante Features

- **Undo/Redo** - Rückgängig/Wiederherstellen von Aktionen
- **Auto-Layout** - Automatische Anordnung von Nodes
- **Mehrfachauswahl** - Mehrere Nodes gleichzeitig verschieben

## Debug Events Panel

Das Debug Events Panel ist das zentrale Tool zum Live-Monitoring aller Debug-Node-Ausgaben im Flow-Editor.

### Übersicht

Das Panel erscheint am **unteren Bildschirmrand** des Flow-Editors und zeigt in Echtzeit alle Events, die durch Debug-Nodes fließen.

**Was wird angezeigt:**
- ✅ **Text-Inhalte** (vollständiger Preview)
- ✅ **Context-Informationen** (Person, Standort, Client)
- ✅ **Timestamps** und Node-Labels
- ✅ **Payload-Größe** und Datentyp
- ✅ **Audio-Metadaten** (Sample-Rate, Channels, Encoding)
- ✅ **Flow- und Node-Informationen**

### 3 Ansichtsmodi

**1. Kompakt-Modus**
```
10:23:45  TEXT  Debug  23 B  from: ws_in_node
👤 Moritz Haslbeck 📍 Schlafzimmer 💻 Laptop xyz
Hallo von Python!
```
- Schneller Überblick
- Text-Preview (max 100 Zeichen)
- Context-Badges

**2. Detailliert-Modus** (Standard)
```
┌─────────────────────────────────────────┐
│ TEXT  Debug              10:23:45.123   │
│ Payload: 23 B (string)  Source: ws_in   │
│                                         │
│ ┌─ Context ───────────────────────┐    │
│ │ 👤 Person: Moritz Haslbeck      │    │
│ │ 📍 Standort: Schlafzimmer       │    │
│ │ 💻 Client: Laptop xyz           │    │
│ └─────────────────────────────────┘    │
│                                         │
│ ┌─ Content ───────────────────────┐    │
│ │ Hallo von Python!               │    │
│ └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```
- Voller Text-Inhalt
- Strukturierte Context-Anzeige
- Alle Metadaten sichtbar

**3. JSON-Modus**
```json
{
  "flowId": "68f745...",
  "flowName": "Mein Flow",
  "nodeId": "node_123",
  "nodeLabel": "Debug",
  "timestamp": 1234567890,
  "uso": {
    "header": {
      "context": {
        "person": "Moritz Haslbeck",
        "location": "Schlafzimmer",
        "clientName": "Laptop xyz"
      }
    },
    "payloadPreview": "Hallo von Python!"
  }
}
```
- Raw JSON für Debugging
- Vollständige Event-Daten
- Copy & Paste freundlich

### Features

**Filter:**
- Alle Typen / Audio / Text / Control
- Filter wird in Echtzeit angewendet

**Steuerung:**
- 🔗 **Connection Status** (🟢 Verbunden / 🔴 Getrennt)
- 🗑️ **Clear Events** - Alle Events löschen
- ⬇️ **Auto-Scroll** - Automatisch zum neuesten Event scrollen

**Technische Details:**
- **WebSocket-Verbindung** zu `ws://localhost:8082`
- **Auto-Reconnect** bei Verbindungsabbruch
- **Event-Limit** 50 Events (älteste werden automatisch entfernt)
- **Flow-spezifisch** - Zeigt nur Events des aktuellen Flows

### Verwendung

**1. Flow öffnen:**
```
http://localhost:3001/flows/editor?id={flowId}
```

**2. Debug Node im Flow platzieren:**
- Ziehe "Debug" von der Toolbar auf die Canvas
- Verbinde sie mit beliebigen Nodes (akzeptiert alle Datentypen)

**3. Flow starten:**
- Klicke auf "Start Flow" in der Toolbar

**4. Daten senden:**
- Verwende `test-ws-in.py` oder andere Clients
- Events erscheinen sofort im Panel!

**5. Events analysieren:**
- Wechsle zwischen den Ansichtsmodi
- Filtere nach Datentyp
- Kopiere JSON für detaillierte Analyse

### React Komponenten

**useDebugEvents Hook** (`src/hooks/useDebugEvents.ts`):
```typescript
const { events, isConnected, clearEvents } = useDebugEvents(flowId);
```

**EventPanel Component** (`src/components/flow-editor/EventPanel.tsx`):
```typescript
<EventPanel flowId={flowId} />
```

**Technische Implementierung:**
- WebSocket-Management mit Auto-Reconnect
- React `useState` für Events-Liste
- `useRef` für Flow-ID (verhindert Re-Connections)
- `useCallback` für Memoization
- Cleanup bei Unmount

### Troubleshooting

**Problem: Keine Verbindung**
```
Status: 🔴 Getrennt
```
→ Prüfe ob Backend läuft: `docker logs iot-orchestrator-backend | grep 8082`
→ Sollte zeigen: "Debug Events WebSocket server listening on port 8082"

**Problem: Events kommen doppelt**
→ Bereits gefixt! Hook verhindert mehrfache Verbindungen

**Problem: Events fehlen**
→ Prüfe ob Flow läuft (Status in Flow-Liste)
→ Prüfe ob Debug Node im Flow ist
→ Prüfe Browser Console für Fehler

**Siehe auch:** [DEBUG_EVENTS_GUIDE.md](../DEBUG_EVENTS_GUIDE.md) für vollständige Dokumentation!

## Komponenten-Struktur

```
src/
├── app/                    # Next.js App Router Pages
│   ├── login/
│   ├── flows/
│   │   └── editor/
│   ├── devices/
│   ├── logs/
│   ├── settings/
│   ├── layout.tsx         # Root Layout mit ThemeProvider
│   └── globals.css        # Global Styles (inkl. React Flow Dark Mode)
├── components/
│   ├── Layout.tsx         # Haupt-Layout mit Sidebar & Theme Toggle
│   ├── Toast.tsx          # Toast-Benachrichtigungen
│   ├── ConfirmDialog.tsx  # Bestätigungs-Dialoge
│   ├── flow-editor/       # Flow-Editor Komponenten
│   │   ├── FlowEditor.tsx      # Hauptkomponente mit Verbindungsvalidierung
│   │   ├── Toolbar.tsx         # Draggable Node-Toolbar
│   │   ├── NodePanel.tsx       # Node-Konfiguration
│   │   ├── CustomNode.tsx      # Custom React Flow Node mit Handles
│   │   └── EventPanel.tsx      # Debug Events Panel (Live-Monitoring)
│   ├── node-ui/           # Node-spezifische Konfigurationskomponenten
│   │   ├── MicNodeConfig.tsx
│   │   ├── STTNodeConfig.tsx
│   │   ├── AINodeConfig.tsx
│   │   ├── TTSNodeConfig.tsx
│   │   ├── SpeakerNodeConfig.tsx
│   │   ├── WSInNodeConfig.tsx
│   │   └── WSOutNodeConfig.tsx
│   ├── vosk/              # Vosk-Server Verwaltung
│   │   ├── AddVoskServerModal.tsx
│   │   └── EditVoskServerModal.tsx
│   ├── piper/             # Piper-Server Verwaltung
│   │   ├── AddPiperServerModal.tsx
│   │   └── EditPiperServerModal.tsx
│   └── flowise/           # Flowise-Server Verwaltung
│       ├── AddFlowiseServerModal.tsx
│       └── EditFlowiseServerModal.tsx
├── contexts/
│   └── ThemeContext.tsx   # Dark Mode State Management
├── hooks/
│   └── useDebugEvents.ts  # Debug Events WebSocket Hook
└── lib/
    ├── api.ts             # API-Client
    └── websocket.ts       # WebSocket-Client
```

## API-Integration

Alle API-Calls laufen über den zentralen API-Client (`src/lib/api.ts`):

```typescript
import { flowsApi, devicesApi, authApi } from '@/lib/api';

// Flows
const flows = await flowsApi.getAll();
await flowsApi.start(flowId);

// Devices
const devices = await devicesApi.getAll();

// Auth
await authApi.login(username, password);
await authApi.saveSecret(key, value, type);
```

## WebSocket-Integration

Für Live-Updates (Logs, Status-Änderungen):

```typescript
import { getWebSocketClient } from '@/lib/websocket';

const ws = getWebSocketClient();
await ws.connect();

ws.on('log', (data) => {
  console.log('New log:', data);
});
```

## Build & Deploy

```bash
# Production Build
npm run build

# Start Production Server
npm start
```

### Docker (geplant)

```bash
docker build -t iot-orchestrator-frontend .
docker run -p 3001:3001 iot-orchestrator-frontend
```

### Mit Nginx Reverse Proxy

Siehe `nginx.conf.example` im Root-Verzeichnis für die Konfiguration.

## UI-Features

### Dark Mode

Das Frontend unterstützt einen vollständigen Dark Mode:

- **Automatische Erkennung** der System-Präferenz (prefers-color-scheme)
- **Persistenz** der Benutzer-Wahl in localStorage
- **Toggle-Button** in der Sidebar (Moon/Sun Icon)
- **Alle Komponenten** unterstützen Dark Mode:
  - Layout & Navigation
  - Login-Seite
  - Flow-Editor (inkl. Toolbar, Canvas, Node-Panel)
  - Flows-Übersicht
  - Geräte-Verwaltung
  - Log-Viewer
  - Settings & Modals
- **Kein Flash** - Verhindert "Flash of Wrong Theme" beim Laden

Der Dark Mode wird über Tailwind CSS's `dark:` Varianten implementiert und nutzt ein `class`-basiertes System mit React Context für die State-Verwaltung.

## Changelog

### v2.4.0 - Context-Weitergabe-Option & Automatische Zeit

**Context-Management:**
- ✅ Neue Option "Context weitergeben" in WS_In Node Config
- ✅ Checkbox mit ausführlicher Beschreibung
- ✅ Standard: Aktiviert (Opt-out Modell)
- ✅ Automatische Zeit-Hinzufügung im Context (angezeigt als "🕐 Zeit")
- ✅ Zeit wird als erstes Feld im Context angezeigt
- ✅ UI-Anzeige in kompaktem und detailliertem Modus

**Anwendungsfälle:**
- ✅ Privacy-Schutz durch Context-Deaktivierung
- ✅ Token-Optimierung (~60% weniger Daten)
- ✅ Zeitbasierte KI-Antworten durch automatische Zeit

**Technical Improvements:**
- ✅ Neue Config-Option `includeContext` (boolean, default: true)
- ✅ UI-Komponente mit Hover-Effekten und Badges
- ✅ EventPanel zeigt Zeit als erstes Context-Feld

📖 **Detaillierte Dokumentation:** [CONTEXT_MANAGEMENT.md](../CONTEXT_MANAGEMENT.md)

### v2.3.0 - Flow-Status-Management & Live-Synchronisation

**Flow-Status-Management:**
- ✅ Start/Stop Button direkt im Flow-Editor (oben rechts)
- ✅ Live Status-Badge im Flow-Info-Panel
- ✅ Automatische Status-Synchronisation zwischen Editor und Flow-Liste
- ✅ Tab-Fokus-Erkennung mit `visibilitychange` API
- ✅ Optimistische UI-Updates für bessere UX
- ✅ Loading-States während API-Calls
- ✅ Toast-Notifications für Erfolgs-/Fehlermeldungen

**Node Health Status:**
- ✅ Live WebSocket-Verbindungsstatus für WS_In Nodes
- ✅ Visuelle Badges auf Canvas-Nodes (grün = connected, rot = disconnected)
- ✅ Detaillierte Status-Anzeige im Node-Panel
- ✅ Pulsierender Punkt-Animation für aktive Verbindungen
- ✅ Client-Anzahl-Anzeige

**Bug Fixes:**
- 🐛 Flow-Status wurde nicht aktualisiert bei Seitenwechsel (useEffect Fix)
- 🐛 `isRunning: undefined` Problem (Backend berechnet jetzt Status in GET /flows/:id)
- 🐛 Stale State nach Tab-Wechsel (Visibility API Integration)

**Technical Improvements:**
- ✅ Separater `refreshFlowStatus()` useEffect für Status-Updates
- ✅ Strikte Boolean-Prüfungen (`=== true` statt `|| false`)
- ✅ Verbesserte Console-Logs für Debugging
- ✅ Health Status Events über Debug Events Gateway

📖 **Detaillierte Dokumentation:** [FLOW_STATUS_MANAGEMENT.md](../FLOW_STATUS_MANAGEMENT.md)

### v2.2.0 - Debug Events & Context-Informationen

**Debug Events System:**
- ✅ Live-Monitoring aller Debug-Node-Ausgaben im Flow-Editor
- ✅ 3 Ansichtsmodi (Kompakt, Detailliert, JSON)
- ✅ WebSocket-basierte Echtzeit-Events (Port 8082)
- ✅ Auto-Reconnect bei Verbindungsabbruch
- ✅ Event-Filterung nach Datentyp
- ✅ Flow-spezifische Event-Anzeige

**Context-Informationen:**
- ✅ Anzeige von Person, Standort und Client-Name
- ✅ Strukturierte Context-Darstellung in allen Modi
- ✅ Context-Badges im Kompakt-Modus
- ✅ Vollständige Context-Anzeige im Detailliert-Modus

**Text-Preview:**
- ✅ Vollständiger Text-Inhalt sichtbar
- ✅ Preview im Kompakt-Modus (max 100 Zeichen)
- ✅ Vollständiger Inhalt im Detailliert-Modus
- ✅ Copy & Paste freundlicher JSON-Modus

**React Hooks:**
- ✅ `useDebugEvents` Hook für WebSocket-Management
- ✅ Verhindert mehrfache Verbindungen (Fix für doppelte Events)
- ✅ Cleanup bei Unmount
- ✅ FlowID-Filter mit `useRef`

### v2.1.0 - Flowise Integration & Server-Verwaltung

**Flowise-Integration:**
- ✅ Flowise statt N8N für AI-Nodes
- ✅ Script-basiertes Setup (Python-Script aus Flowise einfügen)
- ✅ Server-Sent Events (SSE) Support
- ✅ Verbindungstests mit detailliertem Feedback

**Server-Verwaltung:**
- ✅ Zentrale Verwaltung in Einstellungen (Vosk, Piper, Flowise)
- ✅ Direkte Server-Verwaltung in Node-Konfigurationen
- ✅ "Neu" und "Bearbeiten" Buttons in STT, TTS und AI Nodes
- ✅ Add/Edit/Delete Modals für alle Server-Typen
- ✅ Inline-Tests für Server-Verbindungen

**Moderne UI/UX:**
- ✅ Toast-Benachrichtigungen (oben rechts, automatisch ausblendend)
- ✅ Confirm-Dialoge statt Browser-Popups
- ✅ Keine `alert()` oder `confirm()` mehr
- ✅ Smooth Animationen (Slide-In, Scale-In)
- ✅ Verbesserte Fehlermeldungen mit Icons

### v2.0.0 - Flow Editor Verbesserungen & Dark Mode

**Flow-Editor:**
- ✅ Drag & Drop für Nodes von Toolbar auf Canvas
- ✅ Intelligente Verbindungsvalidierung nach Datentypen (Audio/Text/Raw)
- ✅ Node-spezifische Input/Output-Handles (nur benötigte Handles sichtbar)
- ✅ Edge-Management: Auswahl und Löschen von Verbindungen
- ✅ Icons auf Canvas-Nodes für bessere Übersicht
- ✅ Verbesserte Handle-Sichtbarkeit mit Glow-Effekten
- ✅ WebSocket-Nodes mit konfigurierbaren Datentypen

**UI/UX:**
- ✅ Vollständiger Dark Mode mit System-Erkennung
- ✅ Theme Toggle in Sidebar
- ✅ Persistente Theme-Auswahl (localStorage)
- ✅ Dark Mode Support für alle Seiten und Komponenten
- ✅ React Flow Dark Mode Styles (Nodes, Edges, Controls, MiniMap)

**Weitere Verbesserungen:**
- ✅ Live-Log-Viewer mit Filter und Auto-Refresh
- ✅ Tastenkürzel für schnelleres Arbeiten (Delete, etc.)
- ✅ Verbesserte Fehlermeldungen und Validierung

## TODO

- [ ] Undo/Redo im Flow-Editor
- [ ] Auto-Layout für Flows
- [ ] Health-Status-Anzeige auf Nodes
- [ ] Verbindungstest für externe Services
- [ ] Internationalisierung (i18n)
- [ ] Mehrfachauswahl von Nodes (Box-Selection)

## Lizenz

MIT

