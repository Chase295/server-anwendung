# Flow Status Management - Detaillierte Dokumentation

Diese Dokumentation erklärt im Detail, wie das Flow-Status-Management (Start/Stop Buttons und Status-Synchronisation) im IoT Voice Orchestrator funktioniert.

## 📋 Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Architektur](#architektur)
3. [Backend-Implementierung](#backend-implementierung)
4. [Frontend-Implementierung](#frontend-implementierung)
5. [Status-Synchronisation](#status-synchronisation)
6. [Technische Details](#technische-details)
7. [Fehlerbehebung](#fehlerbehebung)

---

## Übersicht

### Was ist Flow Status Management?

Das Flow Status Management ermöglicht es Benutzern, Flows direkt aus dem Flow-Editor heraus zu starten und zu stoppen, ohne zur Flow-Übersichtsseite zurückkehren zu müssen. Der Status eines Flows (läuft/gestoppt) wird in Echtzeit synchronisiert und konsistent über alle UI-Komponenten hinweg angezeigt.

### Features

- ✅ **Start/Stop Button** im Flow-Editor (oben rechts)
- ✅ **Live Status-Anzeige** im Flow-Info-Panel (oben rechts)
- ✅ **Automatische Status-Aktualisierung** beim Öffnen eines Flows
- ✅ **Status-Refresh** bei Tab-Fokus-Wechsel (wenn du zurück zum Browser-Tab wechselst)
- ✅ **Konsistenz** zwischen Flow-Liste und Flow-Editor
- ✅ **Visuelle Feedback** (grün = läuft, rot = gestoppt, pulsierender Punkt)

---

## Architektur

### Datenfluss

```
┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐        ┌──────────────────┐              │
│  │ FlowCoreController│───────▶│ FlowCoreService  │              │
│  │                   │        │                   │              │
│  │ • POST /:id/start │        │ • startFlow()     │              │
│  │ • POST /:id/stop  │        │ • stopFlow()      │              │
│  │ • GET /:id        │        │ • getFlow()       │              │
│  │ • GET /           │        │ • getAllFlows()   │              │
│  └──────────────────┘        └──────────────────┘              │
│           │                           │                          │
│           │                           ▼                          │
│           │                  ┌──────────────────┐               │
│           │                  │   FlowEngine     │               │
│           │                  │                   │               │
│           │                  │ • activeFlows    │               │
│           │                  │   Map<flowId,    │               │
│           │                  │   FlowInstance>  │               │
│           │                  └──────────────────┘               │
│           │                                                      │
│           ▼                                                      │
│  ┌────────────────────────────────────────────┐                │
│  │  API Response mit isRunning Flag           │                │
│  │  {                                          │                │
│  │    _id: "abc123",                           │                │
│  │    name: "My Flow",                         │                │
│  │    isRunning: true,  ◄─── BERECHNET!       │                │
│  │    definition: {...}                        │                │
│  │  }                                          │                │
│  └────────────────────────────────────────────┘                │
│                                                                  │
└──────────────────────┬───────────────────────────────────────────┘
                       │
                       │ HTTP API
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐                                           │
│  │   flowsApi.ts    │                                           │
│  │                   │                                           │
│  │ • getOne(id)      │                                           │
│  │ • start(id)       │                                           │
│  │ • stop(id)        │                                           │
│  └──────────────────┘                                           │
│           │                                                      │
│           ▼                                                      │
│  ┌──────────────────────────────────────────┐                  │
│  │      FlowEditor.tsx                       │                  │
│  │                                            │                  │
│  │  STATE:                                    │                  │
│  │  • isRunning: boolean                      │                  │
│  │  • isToggling: boolean                     │                  │
│  │                                            │                  │
│  │  FUNCTIONS:                                │                  │
│  │  • loadFlow()         - Lädt Flow + Status │                  │
│  │  • refreshFlowStatus() - Nur Status laden  │                  │
│  │  • handleToggleFlow() - Start/Stop         │                  │
│  │                                            │                  │
│  │  UI COMPONENTS:                            │                  │
│  │  • Start/Stop Button (Header)              │                  │
│  │  • Status Badge (Flow Info Panel)          │                  │
│  └──────────────────────────────────────────┘                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Backend-Implementierung

### 1. Flow-Status-Tracking im FlowEngine

Der `FlowEngine` verwaltet alle aktiven Flows in einer `Map`:

```typescript
// backend/src/modules/flow-core/flow-engine.ts
export class FlowEngine {
  private activeFlows: Map<string, FlowInstance> = new Map();
  
  async startFlow(flowId: string, definition: any): Promise<void> {
    // Flow-Instanz erstellen und zur Map hinzufügen
    this.activeFlows.set(flowId, flowInstance);
  }
  
  async stopFlow(flowId: string): Promise<void> {
    // Flow aus Map entfernen
    this.activeFlows.delete(flowId);
  }
  
  getActiveFlows(): Array<{ id: string; nodeCount: number }> {
    return Array.from(this.activeFlows.values()).map(flow => ({
      id: flow.id,
      nodeCount: flow.nodes.size,
    }));
  }
}
```

**Wichtig:** Die `activeFlows` Map ist die **Single Source of Truth** für den Flow-Status!

### 2. Status-Berechnung im Controller

Der `FlowCoreController` berechnet `isRunning` für jeden Flow:

```typescript
// backend/src/modules/flow-core/flow-core.controller.ts

@Get()
async getAllFlows() {
  const flows = await this.flowService.getAllFlows();
  const activeFlows = this.flowService.getActiveFlows(); // ← Holt aktive Flows
  
  return flows.map(flow => ({
    ...(flow as any).toObject(),
    isRunning: activeFlows.some(af => af.id === (flow as any)._id.toString()), // ← BERECHNET!
  }));
}

@Get(':id')
async getFlow(@Param('id') id: string) {
  const flow = await this.flowService.getFlow(id);
  const activeFlows = this.flowService.getActiveFlows(); // ← WICHTIG: Auch hier!
  
  return {
    ...(flow as any).toObject(),
    isRunning: activeFlows.some(af => af.id === (flow as any)._id.toString()), // ← BERECHNET!
  };
}
```

**🎯 Kritischer Fix (v2.3.0):**  
Ursprünglich wurde `isRunning` NUR bei `getAllFlows()` berechnet, aber NICHT bei `getFlow(:id)`. Das führte dazu, dass der Flow-Editor immer `isRunning: undefined` erhielt.

**Lösung:** `isRunning` wird jetzt in BEIDEN Endpunkten berechnet!

### 3. Start/Stop Endpoints

```typescript
@Post(':id/start')
async startFlow(@Param('id') id: string) {
  await this.flowService.startFlow(id); // ← Startet Flow und fügt zu activeFlows hinzu
  return { success: true, message: 'Flow started' };
}

@Post(':id/stop')
async stopFlow(@Param('id') id: string) {
  await this.flowService.stopFlow(id); // ← Stoppt Flow und entfernt aus activeFlows
  return { success: true, message: 'Flow stopped' };
}
```

### 4. Datenbank-Update

Der `FlowCoreService` aktualisiert auch das `active` Feld in der Datenbank:

```typescript
// backend/src/modules/flow-core/flow-core.service.ts

async startFlow(flowId: string): Promise<void> {
  // 1. Datenbank updaten
  await this.flowModel.findByIdAndUpdate(flowId, {
    active: true,
    lastExecuted: new Date(),
  });
  
  // 2. FlowEngine informieren (fügt zu activeFlows hinzu)
  await this.flowEngine.startFlow(flowId, flow.definition);
}

async stopFlow(flowId: string): Promise<void> {
  // 1. FlowEngine informieren (entfernt aus activeFlows)
  await this.flowEngine.stopFlow(flowId);
  
  // 2. Datenbank updaten
  await this.flowModel.findByIdAndUpdate(flowId, {
    active: false,
  });
}
```

**Hinweis:** Das `active` Feld in der DB ist für Persistenz. Der **tatsächliche** Status kommt aus `FlowEngine.activeFlows`.

---

## Frontend-Implementierung

### 1. State Management

```typescript
// frontend/src/components/flow-editor/FlowEditor.tsx

export default function FlowEditor() {
  const [isRunning, setIsRunning] = useState(false);    // ← Flow-Status
  const [isToggling, setIsToggling] = useState(false);  // ← Loading-State für Button
  
  // ...
}
```

### 2. Flow Laden (Initial)

```typescript
const loadFlow = async (id: string) => {
  const response = await flowsApi.getOne(id);
  const flow = response.data;
  
  setFlowName(flow.name);
  setFlowDescription(flow.description || '');
  setIsRunning(flow.isRunning === true);  // ← STRIKTE Prüfung!
  
  // ... Nodes und Edges laden ...
};

useEffect(() => {
  if (flowId) {
    loadFlow(flowId);
  }
}, [flowId]);
```

**Wichtig:** `flow.isRunning === true` statt `flow.isRunning || false` verhindert Probleme mit `undefined`.

### 3. Status-Refresh beim Mount

```typescript
const refreshFlowStatus = async (id: string) => {
  const response = await flowsApi.getOne(id);
  const flow = response.data;
  const running = flow.isRunning === true;
  setIsRunning(running);
  console.log('[FlowEditor] Status refreshed:', { isRunning: flow.isRunning, running });
};

useEffect(() => {
  if (!flowId) return;
  
  // 1. Status beim Mount/Remount aktualisieren
  refreshFlowStatus(flowId);
  
  // 2. Status auch bei Tab-Fokus-Wechsel aktualisieren
  const handleVisibilityChange = () => {
    if (!document.hidden && flowId) {
      refreshFlowStatus(flowId);
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [flowId]);
```

**🎯 Kritischer Fix (v2.3.0):**  
Dieser zweite `useEffect` wurde hinzugefügt, um Status-Updates auch dann zu laden, wenn die `flowId` gleich bleibt (z.B. wenn du aus dem Editor gehst und wieder zurückkommst).

**Warum zwei useEffects?**
- **Erster useEffect** (`loadFlow`): Lädt den kompletten Flow (Nodes, Edges, Name, Beschreibung, Status)
- **Zweiter useEffect** (`refreshFlowStatus`): Lädt NUR den Status (leichter, schneller)

### 4. Start/Stop Toggle

```typescript
const handleToggleFlow = async () => {
  if (!flowId) {
    setToast({ message: 'Bitte speichern Sie den Flow zuerst', type: 'warning' });
    return;
  }
  
  setIsToggling(true);
  
  try {
    if (isRunning) {
      await flowsApi.stop(flowId);  // ← POST /flows/:id/stop
      setIsRunning(false);
      setToast({ message: 'Flow gestoppt', type: 'success' });
    } else {
      await flowsApi.start(flowId); // ← POST /flows/:id/start
      setIsRunning(true);
      setToast({ message: 'Flow gestartet', type: 'success' });
    }
  } catch (error: any) {
    const message = error.response?.data?.message || error.message || 'Fehler beim Ändern des Flow-Status';
    setToast({ message, type: 'error' });
    
    // Status neu laden bei Fehler
    if (flowId) {
      refreshFlowStatus(flowId);
    }
  } finally {
    setIsToggling(false);
  }
};
```

**Features:**
- ✅ Optimistisches UI-Update (sofortige Anzeige)
- ✅ Loading-State (`isToggling`) während API-Call
- ✅ Fehlerbehandlung mit Status-Refresh
- ✅ Toast-Notifications

### 5. UI-Komponenten

#### Start/Stop Button (Header)

```typescript
<button
  onClick={handleToggleFlow}
  disabled={isToggling}
  className={`px-4 py-2 rounded-lg flex items-center space-x-2 font-medium transition-all shadow-lg disabled:opacity-50 ${
    isRunning
      ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white'
      : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
  }`}
>
  {isRunning ? (
    <>
      <Square className="w-5 h-5" />
      <span>{isToggling ? 'Stoppe...' : 'Stop'}</span>
    </>
  ) : (
    <>
      <Play className="w-5 h-5" />
      <span>{isToggling ? 'Starte...' : 'Start'}</span>
    </>
  )}
</button>
```

**Visuelles Design:**
- 🟢 **Läuft:** Roter Button mit "Stop" und Square-Icon
- ⚪ **Gestoppt:** Grüner Button mit "Start" und Play-Icon
- ⏳ **Loading:** Button disabled, Text ändert sich zu "Starte..." / "Stoppe..."

#### Status Badge (Flow Info Panel)

```typescript
<div className="flex items-center gap-2 pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
  <span className="font-medium">Status:</span>
  <span className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold ${
    isRunning 
      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' 
      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
  }`}>
    <span className={`inline-flex h-2 w-2 rounded-full ${
      isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
    }`}></span>
    {isRunning ? 'Läuft' : 'Gestoppt'}
  </span>
</div>
```

**Visuelles Design:**
- 🟢 **Läuft:** Grüner Badge mit pulsierendem Punkt
- ⚪ **Gestoppt:** Grauer Badge mit statischem Punkt

---

## Status-Synchronisation

### Problem: Stale State

**Szenario:**
1. Benutzer öffnet Flow-Editor (flowId = "abc123")
2. Geht zurück zur Flow-Liste
3. Startet Flow dort
4. Kehrt zum Flow-Editor zurück (flowId = "abc123" - gleich!)
5. ❌ `useEffect` läuft NICHT, weil `flowId` sich nicht geändert hat

### Lösung: Separater Refresh-Effect

```typescript
useEffect(() => {
  if (!flowId) return;
  
  // Läuft IMMER wenn Komponente (re-)mounted wird
  refreshFlowStatus(flowId);
  
  // Auch bei Tab-Fokus
  const handleVisibilityChange = () => {
    if (!document.hidden && flowId) {
      refreshFlowStatus(flowId);
    }
  };
  
  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [flowId]);
```

**Warum funktioniert das?**
- React unmounted den `FlowEditor`, wenn du die Seite verlässt
- Beim Zurückkommen wird die Komponente neu gemounted
- Der `useEffect` läuft erneut, auch wenn `flowId` gleich ist

### Zusatz: Visibility API

Der `visibilitychange` Event feuert, wenn der Browser-Tab fokussiert wird. Das ist nützlich, wenn:
- Du Flow in einem anderen Tab startest
- Du zum Editor-Tab zurückwechselst
- Der Status automatisch aktualisiert wird

---

## Technische Details

### API-Endpunkte

| Methode | Endpoint          | Beschreibung                        | Response                          |
|---------|-------------------|-------------------------------------|-----------------------------------|
| GET     | `/flows`          | Alle Flows mit `isRunning` Status  | `Array<Flow & { isRunning }>`     |
| GET     | `/flows/:id`      | Ein Flow mit `isRunning` Status     | `Flow & { isRunning: boolean }`   |
| POST    | `/flows/:id/start`| Flow starten                        | `{ success: true, message }`      |
| POST    | `/flows/:id/stop` | Flow stoppen                        | `{ success: true, message }`      |

### Response-Beispiel

```json
{
  "_id": "68f74421c5a46ae16d7e1e5b",
  "name": "My IoT Flow",
  "description": "Beschreibung...",
  "definition": {
    "nodes": [...],
    "edges": [...]
  },
  "active": true,
  "enabled": true,
  "isRunning": true,  // ← Berechnet vom Backend!
  "createdAt": "2025-01-15T12:00:00Z",
  "updatedAt": "2025-01-15T14:30:00Z"
}
```

**Unterschied zwischen `active` und `isRunning`:**
- **`active`:** Datenbank-Feld (persistiert)
- **`isRunning`:** Berechnet aus `FlowEngine.activeFlows` (tatsächlicher Status)

### State-Flow Diagramm

```
┌─────────────────────────────────────────────────────────────┐
│                    Flow Editor Lifecycle                     │
└─────────────────────────────────────────────────────────────┘

  User navigiert zu /flows/:id
            │
            ▼
  ┌──────────────────┐
  │   Component      │
  │   Mounted        │
  └──────────────────┘
            │
            ├─────────────┬─────────────────────┐
            ▼             ▼                     ▼
    useEffect #1   useEffect #2          useEffect #3
    (flowId)       (flowId)              (debug events)
            │             │                     │
            ▼             ▼                     ▼
    loadFlow()    refreshFlowStatus()    useDebugEvents()
    • Nodes            │                       │
    • Edges            │                       │
    • Name             │                       │
    • Status ✓         │                       │
                       ▼                       ▼
              setIsRunning(true/false)   Health Status
                       │                       │
                       │                       │
                       └───────────┬───────────┘
                                   │
                                   ▼
                          ┌────────────────┐
                          │   UI Updates   │
                          │                │
                          │ • Button Color │
                          │ • Status Badge │
                          │ • Icon         │
                          └────────────────┘

  User klickt Start/Stop Button
            │
            ▼
    handleToggleFlow()
            │
            ├─── if (isRunning) ───▶ flowsApi.stop(flowId)
            │                                 │
            └─── else ─────────────▶ flowsApi.start(flowId)
                                              │
                                              ▼
                                        Backend API
                                              │
                                              ▼
                                    FlowEngine.startFlow()
                                    FlowEngine.stopFlow()
                                              │
                                              ▼
                                    activeFlows Map Update
                                              │
                                              ▼
                                        Success/Error
                                              │
                                              ▼
                                    setIsRunning(!isRunning)
                                              │
                                              ▼
                                         UI Updates

  User verlässt Editor und kehrt zurück
            │
            ▼
  ┌──────────────────┐
  │   Component      │
  │   Unmounted      │
  └──────────────────┘
            │
            ▼
  ┌──────────────────┐
  │   Component      │
  │   Re-Mounted     │
  └──────────────────┘
            │
            ▼
    useEffect #2 läuft erneut!
            │
            ▼
    refreshFlowStatus(flowId)
            │
            ▼
    Aktueller Status vom Backend
            │
            ▼
    setIsRunning(aktuellerStatus)
            │
            ▼
    ✅ UI ist synchron!
```

---

## Fehlerbehebung

### Problem 1: Status zeigt "undefined"

**Symptom:**
```
[FlowEditor] Status refreshed: undefined
```

**Ursache:**  
Backend sendet kein `isRunning` Feld im Response von `GET /flows/:id`.

**Lösung:**  
Überprüfe, ob der Controller `isRunning` berechnet:

```typescript
@Get(':id')
async getFlow(@Param('id') id: string) {
  const flow = await this.flowService.getFlow(id);
  const activeFlows = this.flowService.getActiveFlows(); // ← Muss vorhanden sein!
  
  return {
    ...(flow as any).toObject(),
    isRunning: activeFlows.some(af => af.id === (flow as any)._id.toString()), // ← Muss vorhanden sein!
  };
}
```

### Problem 2: Status nicht synchron nach Seitenwechsel

**Symptom:**  
- Flow in Liste gestartet
- Editor zeigt "Gestoppt"

**Ursache:**  
`useEffect` läuft nicht, wenn `flowId` gleich bleibt.

**Lösung:**  
Separater `useEffect` für Status-Refresh:

```typescript
useEffect(() => {
  if (!flowId) return;
  refreshFlowStatus(flowId); // ← Läuft IMMER beim Mount
}, [flowId]);
```

### Problem 3: Button bleibt im Loading-State hängen

**Symptom:**  
Button zeigt "Starte..." / "Stoppe..." dauerhaft.

**Ursache:**  
`setIsToggling(false)` wird nicht aufgerufen (z.B. wegen Exception).

**Lösung:**  
Immer `finally` Block verwenden:

```typescript
try {
  await flowsApi.start(flowId);
  setIsRunning(true);
} catch (error) {
  console.error(error);
} finally {
  setIsToggling(false); // ← Wird IMMER aufgerufen
}
```

### Problem 4: Flow startet nicht (Backend-Fehler)

**Symptom:**  
Error: "Flow not found" oder "Unknown node type"

**Ursache:**  
Flow-Definition ist beschädigt oder enthält ungültige Nodes.

**Lösung:**  
1. Backend-Logs prüfen:
   ```bash
   docker logs iot-orchestrator-backend -f
   ```
2. Flow-Definition in DB prüfen
3. Alle Nodes haben gültigen `data.type`

### Problem 5: Status flackert zwischen läuft/gestoppt

**Symptom:**  
Status-Badge wechselt schnell zwischen grün und grau.

**Ursache:**  
Mehrere gleichzeitige API-Calls oder Race Conditions.

**Lösung:**  
1. Nur ein `refreshFlowStatus()` Call gleichzeitig
2. Loading-States nutzen
3. API-Calls deduplizieren (z.B. mit `useRef`)

---

## Debugging-Tipps

### 1. Console-Logs aktivieren

Im Frontend (`FlowEditor.tsx`) sind bereits Logs eingebaut:

```typescript
console.log('[FlowEditor] Status refreshed:', { isRunning: flow.isRunning, running });
```

Öffne die Browser-Konsole (F12) und beobachte die Logs.

### 2. Backend-Logs überprüfen

```bash
# Live-Logs anzeigen
docker logs iot-orchestrator-backend -f

# Logs in Datei speichern
docker logs iot-orchestrator-backend > backend.log 2>&1
```

Achte auf:
- `🎉 Flow started successfully`
- `🛑 Flow stopped successfully`
- Fehler-Messages

### 3. Network-Tab prüfen

1. Browser DevTools öffnen (F12)
2. Network-Tab öffnen
3. Filter auf "flows" setzen
4. API-Calls beobachten:
   - `GET /flows/:id` → Response sollte `isRunning: true/false` enthalten
   - `POST /flows/:id/start` → Response sollte `success: true` sein
   - `POST /flows/:id/stop` → Response sollte `success: true` sein

### 4. React DevTools nutzen

1. [React DevTools](https://reactjs.org/link/react-devtools) installieren
2. `FlowEditor` Komponente auswählen
3. State beobachten:
   - `isRunning` sollte boolean sein
   - `isToggling` sollte boolean sein
4. Props/Hooks inspizieren

### 5. FlowEngine-Status prüfen

Im Backend-Code kannst du temporär Logs hinzufügen:

```typescript
// backend/src/modules/flow-core/flow-engine.ts
getActiveFlows(): Array<{ id: string; nodeCount: number }> {
  const flows = Array.from(this.activeFlows.values()).map(flow => ({
    id: flow.id,
    nodeCount: flow.nodes.size,
  }));
  this.logger.debug('Active flows:', flows); // ← Temporär hinzufügen
  return flows;
}
```

Dann Backend neu kompilieren und Logs beobachten.

---

## Best Practices

### ✅ DO

1. **Immer `isRunning === true` prüfen** (nicht `isRunning || false`)
2. **Loading-States verwenden** (`isToggling`)
3. **Fehlerbehandlung implementieren** (try-catch-finally)
4. **Status nach Fehler neu laden** (`refreshFlowStatus()` in catch-Block)
5. **Console-Logs für Debugging** (können später entfernt werden)
6. **Optimistische UI-Updates** (sofort Status ändern, bei Fehler zurückrollen)
7. **Toast-Notifications** für User-Feedback

### ❌ DON'T

1. **Nicht `isRunning || false`** → führt zu Problemen mit `undefined`
2. **Nicht `setIsToggling` vergessen** → Button hängt im Loading-State
3. **Nicht nur Status prüfen ohne Refresh** → stale state
4. **Nicht API-Calls ohne Loading-State** → schlechte UX
5. **Nicht Fehler ignorieren** → User weiß nicht was schief ging
6. **Nicht mehrere Status-Quellen** → `FlowEngine.activeFlows` ist Single Source of Truth

---

## Changelog

### v2.3.0 (21.10.2025)

**🐛 Bug Fix: Flow-Status-Synchronisation**
- **Problem:** Flow-Status im Editor war nicht synchron mit Flow-Liste
- **Ursache:** `GET /flows/:id` berechnete `isRunning` nicht
- **Fix:** `isRunning` wird jetzt in beiden Endpunkten (`GET /flows` und `GET /flows/:id`) berechnet

**✨ Feature: Start/Stop Button im Flow-Editor**
- Start/Stop Button im Editor-Header (oben rechts)
- Live Status-Anzeige im Flow-Info-Panel
- Visuelle Feedback (grün/rot, pulsierend)
- Loading-States während API-Calls
- Toast-Notifications für User-Feedback

**🔧 Technical Improvements**
- Separater `refreshFlowStatus()` useEffect für Status-Updates
- Visibility API Integration (Status-Refresh bei Tab-Fokus)
- Strikte Boolean-Prüfungen (`=== true` statt `|| false`)
- Verbesserte Console-Logs für Debugging
- Fehlerbehandlung mit Status-Refresh

**📚 Documentation**
- Neue README: `FLOW_STATUS_MANAGEMENT.md`
- Aktualisierte Backend-README mit API-Details
- Aktualisierte Frontend-README mit Komponenten-Dokumentation

---

## Weiterführende Dokumentation

- [Backend README](./backend/README.md) - Backend-Architektur und APIs
- [Frontend README](./frontend/README.md) - Frontend-Komponenten und Hooks
- [Debug Events Guide](./DEBUG_EVENTS_GUIDE.md) - Real-time Event-Streaming
- [Quick Start Guide](./QUICKSTART.md) - Setup und Installation

---

## Support

Bei Fragen oder Problemen:
1. Diese Dokumentation durchlesen
2. [Fehlerbehebung](#fehlerbehebung) Abschnitt prüfen
3. Backend-Logs prüfen (`docker logs iot-orchestrator-backend`)
4. Console-Logs im Browser prüfen (F12)
5. Issue auf GitHub erstellen (falls verfügbar)

---

**Zuletzt aktualisiert:** 21.10.2025  
**Version:** 2.3.0

