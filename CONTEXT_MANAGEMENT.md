# Context Management System - Detaillierte Dokumentation

Diese Dokumentation erklärt im Detail, wie das Context-Management-System im IoT Voice Orchestrator funktioniert und implementiert ist.

## 📋 Inhaltsverzeichnis

1. [Übersicht](#übersicht)
2. [Was sind Context-Informationen?](#was-sind-context-informationen)
3. [Architektur](#architektur)
4. [Technische Implementierung](#technische-implementierung)
5. [Context-Weitergabe-Option](#context-weitergabe-option)
6. [Anwendungsfälle](#anwendungsfälle)
7. [Best Practices](#best-practices)
8. [Fehlerbehebung](#fehlerbehebung)

---

## Übersicht

### Was ist das Context-Management-System?

Das Context-Management-System ermöglicht es, strukturierte Metadaten durch die gesamte Flow-Pipeline zu transportieren. Diese Metadaten ("Context") beinhalten Informationen über:
- **Zeit:** Wann wurde die Nachricht gesendet?
- **Person:** Wer hat die Nachricht gesendet?
- **Standort:** Von wo aus wurde gesendet?
- **Client:** Welches Gerät hat gesendet?

Diese Informationen werden automatisch im USO-Header mitgeführt und können von jeder Node im Flow genutzt werden.

### Warum ist das wichtig?

**Für KI-Systeme:**
- Zeitbasierte Antworten ("Guten Morgen!" vs "Guten Abend!")
- Personalisierte Antworten ("Hallo Moritz!")
- Raumabhängige Automatisierungen ("Licht im Schlafzimmer einschalten")

**Für Debugging:**
- Nachverfolgung: Wer hat was wann wo gesendet?
- Fehleranalyse: Welches Gerät hatte ein Problem?
- Audit-Logs: Vollständige Historie aller Interaktionen

---

## Was sind Context-Informationen?

### Context-Struktur

```typescript
interface Context {
  time?: string;        // Format: "YYYY-MM-DD HH:MM:SS"
  person?: string;      // Name der Person
  location?: string;    // Standort/Raum
  clientName?: string;  // Geräte-Name
}
```

### Beispiel

```json
{
  "context": {
    "time": "2025-10-21 14:35:22",
    "person": "Moritz Haslbeck",
    "location": "Schlafzimmer 1.OG",
    "clientName": "Laptop xyz"
  }
}
```

### Felder im Detail

#### 1. `time` (Automatisch)
- **Format:** `"YYYY-MM-DD HH:MM:SS"`
- **Quelle:** Automatisch hinzugefügt im Backend oder Client
- **Zweck:** Zeitstempel für zeitbasierte Logik
- **Beispiel:** `"2025-10-21 14:35:22"`

**Automatische Hinzufügung:**
- Im Python Test-Script bei jedem `send_message()`
- Im Backend `WSInNode`, falls nicht vorhanden

#### 2. `person` (Optional)
- **Format:** Freitext (String)
- **Quelle:** Konfiguration im Client (z.B. `CONTEXT_PERSON`)
- **Zweck:** Personalisierte Antworten, Nutzer-Tracking
- **Beispiel:** `"Moritz Haslbeck"`

#### 3. `location` (Optional)
- **Format:** Freitext (String)
- **Quelle:** Konfiguration im Client (z.B. `CONTEXT_LOCATION`)
- **Zweck:** Raumabhängige Automatisierungen
- **Beispiel:** `"Schlafzimmer 1.OG"`, `"Wohnzimmer"`, `"Büro"`

#### 4. `clientName` (Optional)
- **Format:** Freitext (String)
- **Quelle:** Konfiguration im Client (z.B. `CONTEXT_CLIENT`)
- **Zweck:** Geräte-Identifikation, Debugging
- **Beispiel:** `"Laptop xyz"`, `"ESP32-001"`, `"iPhone 13"`

---

## Architektur

### Datenfluss

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT (Python, ESP32, etc.)               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 1. Sendet USO mit Context
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       WS_IN NODE (Backend)                       │
│  ┌────────────────────────────────────────────────────────┐     │
│  │  enrichContextWithTime(context)                         │     │
│  │  • Prüft ob 'time' vorhanden                            │     │
│  │  • Fügt aktuelle Zeit hinzu, falls fehlend             │     │
│  │                                                          │     │
│  │  if (includeContext === true)  // ← NEU: Option!       │     │
│  │    → Context wird weitergegeben                         │     │
│  │  else                                                    │     │
│  │    → Context wird entfernt (undefined)                  │     │
│  └────────────────────────────────────────────────────────┘     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 2. USO mit/ohne Context
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NACHFOLGENDE NODES                            │
│  • STT Node      → Context wird durchgereicht                   │
│  • AI Node       → Context verfügbar (oder nicht)               │
│  • TTS Node      → Context wird durchgereicht                   │
│  • Debug Node    → Zeigt Context an (falls vorhanden)           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ 3. USO mit/ohne Context
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AUSGABE (Speaker, WS Out, etc.)             │
└─────────────────────────────────────────────────────────────────┘
```

### USO-Header mit Context

```json
{
  "id": "uuid-v4",
  "type": "text",
  "sourceId": "node_123456",
  "timestamp": 1697123456789,
  "final": true,
  "context": {
    "time": "2025-10-21 14:35:22",
    "person": "Moritz Haslbeck",
    "location": "Schlafzimmer",
    "clientName": "Laptop xyz"
  },
  "websocketInfo": {
    "connectionId": "wsin_1234567890_abc",
    "clientIp": "external",
    "connectedAt": 1697123456789
  }
}
```

---

## Technische Implementierung

### 1. Backend: WS_In Node

#### A. Schema-Definition (node-factory.ts)

```typescript
// backend/src/modules/flow-core/node-factory.ts
{
  type: 'ws_in',
  displayName: 'WebSocket In',
  config: {
    // ... andere Configs ...
    includeContext: {
      type: 'boolean',
      label: 'Context weitergeben',
      default: true,  // ← Standard: Context wird weitergegeben
      description: 'Context-Informationen (Zeit, Person, Standort, Client) an nachfolgende Nodes weitergeben',
    },
  },
}
```

**Wichtig:** `default: true` bedeutet:
- Bestehende Flows behalten ihr Verhalten (Context wird weitergegeben)
- Neue Flows haben Context standardmäßig aktiviert
- Opt-out Modell: Muss explizit deaktiviert werden

#### B. Context-Anreicherung (wsIn.node.ts)

```typescript
// backend/src/modules/nodes/wsIn.node.ts

/**
 * Erweitert Context um aktuelle Uhrzeit, falls nicht vorhanden
 */
private enrichContextWithTime(context: any): any {
  if (!context) {
    context = {};
  }
  
  // Füge aktuelle Uhrzeit hinzu, falls nicht vorhanden
  if (!context.time) {
    const now = new Date();
    context.time = now.toISOString().replace('T', ' ').substring(0, 19);
    // Beispiel: "2025-10-21 14:35:22"
  }
  
  return context;
}
```

**Logik:**
1. Wenn kein Context-Objekt existiert → leeres Objekt erstellen
2. Wenn `time` fehlt → aktuelle Zeit hinzufügen
3. Wenn `time` bereits vorhanden → nicht überschreiben (Client-Zeit hat Vorrang)

#### C. Context-Weitergabe-Logik

```typescript
// backend/src/modules/nodes/wsIn.node.ts

// Text-Payload Beispiel
if (dataType === 'text' || header.type === 'text') {
  const text = data.toString();
  
  // Prüfe Config-Option (default: true)
  const includeContext = this.config.includeContext !== false;
  
  // Context nur hinzufügen wenn Option aktiviert
  const contextData = includeContext 
    ? this.enrichContextWithTime(header.context)  // Mit Context
    : undefined;                                    // Ohne Context
  
  uso = USOUtils.create('text', this.id, text, header.final, {
    id: header.id,
    websocketInfo: { ... },
    context: contextData,  // ← Wird undefined wenn deaktiviert
  });
}
```

**Wichtig:** `this.config.includeContext !== false` bedeutet:
- `undefined` → `true` (Standard-Verhalten)
- `true` → `true` (explizit aktiviert)
- `false` → `false` (explizit deaktiviert)

### 2. Frontend: Node-Konfiguration

#### A. UI-Komponente (WSInNodeConfig.tsx)

```typescript
// frontend/src/components/node-ui/WSInNodeConfig.tsx

{/* Context-Weitergabe Option */}
<div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
  <label className="flex items-start cursor-pointer group">
    <input
      type="checkbox"
      checked={config.includeContext !== false}  // ← Default: true
      onChange={(e) => onChange('includeContext', e.target.checked)}
      className="..."
    />
    <div className="ml-3">
      <span className="text-sm font-medium">
        📋 Context-Informationen weitergeben
      </span>
      <p className="text-xs text-gray-600 mt-1">
        Wenn aktiviert: Zeit, Person, Standort und Client-Name werden an nachfolgende Nodes weitergegeben.
        <br />
        Wenn deaktiviert: Nur der reine Content wird weitergegeben (nützlich für KI-Nodes).
      </p>
    </div>
  </label>
</div>
```

**UI-Features:**
- ✅ Checkbox mit Beschreibung
- ✅ Visual Feedback (blaues Panel)
- ✅ Hover-Effekt
- ✅ Standard-Badge ("💡 Standard: Aktiviert")

### 3. Client: Python Test-Script

#### A. Automatische Zeit-Hinzufügung

```python
# test-ws-in.py

def create_uso_text_message(text: str, context_person="", context_location="", context_client=""):
    # ... Header erstellen ...
    
    # Context-Informationen hinzufügen
    context = {}
    
    # Aktuelle Uhrzeit AUTOMATISCH hinzufügen
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    context["time"] = current_time
    
    # Weitere Context-Infos (optional)
    if context_person:
        context["person"] = context_person
    if context_location:
        context["location"] = context_location
    if context_client:
        context["clientName"] = context_client
    
    if context:
        header["context"] = context
    
    return (json.dumps(header), text)
```

**Wichtig:**
- Zeit wird **immer** automatisch hinzugefügt
- Zeit wird bei **jedem** `send_message()` neu berechnet
- Format: `"YYYY-MM-DD HH:MM:SS"` (lesbar und sortierbar)

---

## Context-Weitergabe-Option

### Wann aktivieren, wann deaktivieren?

#### ✅ Context AKTIVIERT (Standard)

**Anwendungsfälle:**
- **Debug Nodes:** Alle Informationen sehen
- **Logging:** Vollständige Historie mit Kontext
- **Audit-Trail:** Wer hat was wann wo gemacht?
- **Personalisierte KI:** KI nutzt Person/Standort für bessere Antworten
- **Raumabhängige Automatisierungen:** "Licht im Schlafzimmer einschalten"

**Beispiel-Flow:**
```
WS_In (Context AN) → Debug → AI (personalisiert) → TTS → Speaker
```

**Was die KI sieht:**
```
Nachricht: "Wie spät ist es?"
Context: {
  "time": "14:35:22",
  "person": "Moritz Haslbeck",
  "location": "Schlafzimmer"
}
```

**KI-Antwort:**
> "Guten Nachmittag Moritz! Es ist 14:35 Uhr. Du bist im Schlafzimmer."

#### ❌ Context DEAKTIVIERT

**Anwendungsfälle:**
- **KI-Nodes:** Nur der reine Text, keine Ablenkung durch Metadaten
- **API-Calls:** Sauberer Payload ohne Extra-Daten
- **Token-Optimierung:** Weniger Daten = weniger Kosten
- **Anonyme Verarbeitung:** Privacy-Schutz, keine personenbezogenen Daten
- **Einfache Flows:** Wenn Context nicht benötigt wird

**Beispiel-Flow:**
```
WS_In (Context AUS) → AI (anonym) → TTS → Speaker
```

**Was die KI sieht:**
```
Nachricht: "Wie spät ist es?"
Context: undefined
```

**KI-Antwort:**
> "Es tut mir leid, ich habe keine Zeitinformation."

### Performance & Token-Kosten

#### Mit Context (aktiviert):
```json
{
  "type": "text",
  "payload": "Wie spät ist es?",
  "context": {
    "time": "2025-10-21 14:35:22",
    "person": "Moritz Haslbeck",
    "location": "Schlafzimmer 1.OG",
    "clientName": "Laptop xyz"
  }
}
```
**Größe:** ~200 Bytes  
**Tokens (GPT-4):** ~50 Tokens

#### Ohne Context (deaktiviert):
```json
{
  "type": "text",
  "payload": "Wie spät ist es?",
  "context": undefined
}
```
**Größe:** ~80 Bytes  
**Tokens (GPT-4):** ~20 Tokens

**Einsparung:** ~60% weniger Daten/Tokens!

---

## Anwendungsfälle

### Use Case 1: Personalisierte KI-Assistenz

**Szenario:** Ein Smart-Home-Assistent, der personalisierte Antworten gibt.

**Flow:**
```
WS_In (Context AN) → STT → AI → TTS → Speaker
```

**Config:**
```python
# test-ws-in.py
CONTEXT_PERSON = "Moritz Haslbeck"
CONTEXT_LOCATION = "Schlafzimmer"
CONTEXT_CLIENT = "iPhone 13"
```

**WS_In Node:**
- ✅ **Context weitergeben:** AKTIVIERT

**Beispiel-Interaktion:**
```
User: "Guten Morgen"
Zeit: 07:15 Uhr

KI (sieht Context):
- time: "2025-10-21 07:15:00"
- person: "Moritz Haslbeck"
- location: "Schlafzimmer"

KI-Antwort: "Guten Morgen Moritz! Hast du gut geschlafen? 
Die Temperatur im Schlafzimmer beträgt 18°C."
```

### Use Case 2: Anonyme API-Integration

**Szenario:** Externe API soll nur den reinen Text erhalten, keine persönlichen Daten.

**Flow:**
```
WS_In (Context AUS) → AI → API-Call → Response
```

**WS_In Node:**
- ❌ **Context weitergeben:** DEAKTIVIERT

**Beispiel:**
```
User: "Übersetze: Hallo Welt"

API erhält NUR:
{
  "text": "Übersetze: Hallo Welt"
}

KEIN Context, KEINE persönlichen Daten!
```

### Use Case 3: Multi-Room Audio-System

**Szenario:** Verschiedene Räume mit separaten Assistenten.

**Flows:**
```
WS_In_Schlafzimmer (Port 8081, Context AN) → STT → AI → TTS → Speaker_Schlafzimmer
WS_In_Wohnzimmer   (Port 8082, Context AN) → STT → AI → TTS → Speaker_Wohnzimmer
WS_In_Küche        (Port 8083, Context AN) → STT → AI → TTS → Speaker_Küche
```

**Clients:**
```python
# Client 1: Schlafzimmer
CONTEXT_LOCATION = "Schlafzimmer"
# Verbindet zu: ws://localhost:8081/ws/external

# Client 2: Wohnzimmer
CONTEXT_LOCATION = "Wohnzimmer"
# Verbindet zu: ws://localhost:8082/ws/external

# Client 3: Küche
CONTEXT_LOCATION = "Küche"
# Verbindet zu: ws://localhost:8083/ws/external
```

**KI-Logik:**
```
User (Schlafzimmer): "Licht einschalten"
→ KI erkennt location: "Schlafzimmer"
→ Schaltet Licht im Schlafzimmer ein

User (Wohnzimmer): "Licht einschalten"
→ KI erkennt location: "Wohnzimmer"
→ Schaltet Licht im Wohnzimmer ein
```

### Use Case 4: Debugging & Monitoring

**Szenario:** Alle Events mit vollständigem Kontext loggen.

**Flow:**
```
WS_In (Context AN) → Debug → Log-File
```

**WS_In Node:**
- ✅ **Context weitergeben:** AKTIVIERT

**Log-Ausgabe:**
```
[2025-10-21 14:35:22] TEXT from Laptop xyz
  Person: Moritz Haslbeck
  Location: Schlafzimmer 1.OG
  Message: "Hallo, wie geht es dir?"
  Size: 24 bytes
```

**Vorteile:**
- ✅ Vollständige Nachverfolgung
- ✅ Fehleranalyse: Welches Gerät hatte Probleme?
- ✅ Audit-Trail: Compliance, Sicherheit

---

## Best Practices

### 1. Standard-Einstellung: Context aktiviert

**Empfehlung:** Lasse Context standardmäßig aktiviert, außer es gibt einen guten Grund.

**Vorteile:**
- ✅ Maximale Transparenz
- ✅ Bessere Debugging-Möglichkeiten
- ✅ Flexibilität für zukünftige Features

### 2. Deaktiviere Context nur bei Bedarf

**Deaktiviere Context nur wenn:**
- Privacy/Datenschutz wichtig ist
- Token-Kosten reduziert werden müssen
- API-Kompatibilität es erfordert
- Anonymität gewünscht ist

### 3. Konsistente Context-Daten

**Client-Konfiguration:**
```python
# Gut: Konsistente, beschreibende Werte
CONTEXT_PERSON = "Moritz Haslbeck"
CONTEXT_LOCATION = "Schlafzimmer 1.OG"
CONTEXT_CLIENT = "Laptop xyz"

# Schlecht: Leere oder inkonsistente Werte
CONTEXT_PERSON = ""
CONTEXT_LOCATION = "SchlafZiMmer"  # Inkonsistente Schreibweise
CONTEXT_CLIENT = "123"              # Nicht beschreibend
```

### 4. Zeit-Format beibehalten

**Empfehlung:** Nutze immer das Format `"YYYY-MM-DD HH:MM:SS"`

**Vorteile:**
- ✅ Sortierbar (alphabetisch = chronologisch)
- ✅ Menschenlesbar
- ✅ ISO-8601-kompatibel (mit Leerzeichen statt T)
- ✅ Konsistent über alle Systeme

### 5. Dokumentiere Context-Verwendung

**Im Flow-Namen oder Beschreibung:**
```
Flow: "Smart Home Assistent (mit Context)"
Beschreibung: "Personalisierte Antworten basierend auf Person und Standort"

Flow: "API Integration (ohne Context)"
Beschreibung: "Anonyme API-Calls, kein Context für Privacy"
```

---

## Fehlerbehebung

### Problem 1: Context wird nicht angezeigt

**Symptom:** Im Debug Events Panel erscheinen keine Context-Informationen.

**Mögliche Ursachen:**

1. **WS_In Node: Context deaktiviert**
   ```
   Lösung: Öffne WS_In Node → Aktiviere "Context weitergeben"
   ```

2. **Client sendet keinen Context**
   ```python
   # Prüfe test-ws-in.py:
   CONTEXT_PERSON = ""       # ← Leer?
   CONTEXT_LOCATION = ""     # ← Leer?
   CONTEXT_CLIENT = ""       # ← Leer?
   ```

3. **Backend-Version alt**
   ```bash
   # Backend neu kompilieren und starten:
   cd backend
   npm run build
   docker-compose restart backend
   ```

4. **Frontend zeigt Context nicht**
   ```bash
   # Frontend neu starten:
   docker-compose restart frontend
   ```

### Problem 2: Zeit ist falsch

**Symptom:** `time` zeigt falsche Uhrzeit.

**Mögliche Ursachen:**

1. **Server-Zeitzone falsch**
   ```bash
   # Prüfe Server-Zeit:
   docker exec iot-orchestrator-backend date
   
   # Zeitzone setzen (falls nötig):
   export TZ="Europe/Berlin"
   ```

2. **Client sendet eigene Zeit**
   ```python
   # Im Script wird aktuelle Zeit verwendet:
   current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
   ```

**Lösung:** Zeit wird immer lokal berechnet (Client oder Server).

### Problem 3: Context zu groß (Token-Kosten)

**Symptom:** KI-Kosten zu hoch, Context verbraucht viele Tokens.

**Lösungen:**

1. **Context deaktivieren:**
   ```
   WS_In Node → Deaktiviere "Context weitergeben"
   ```

2. **Selektiv Context filtern (AI Node):**
   ```typescript
   // In der AI Node: Context nur für bestimmte Felder nutzen
   const prompt = `
     User: ${text}
     ${context?.person ? `Person: ${context.person}` : ''}
     ${context?.location ? `Location: ${context.location}` : ''}
   `;
   // Zeit und Client weglassen → weniger Tokens
   ```

3. **Context in Prompt-Engineering nutzen:**
   ```
   System Prompt: "Du antwortest immer kurz und präzise. 
                   Nutze Context-Infos nur wenn relevant."
   ```

### Problem 4: Context wird nicht weitergegeben

**Symptom:** Debug Node zeigt Context, aber AI Node erhält ihn nicht.

**Mögliche Ursachen:**

1. **WS_In Node: Context deaktiviert**
   ```
   Lösung: Aktiviere "Context weitergeben" in WS_In Config
   ```

2. **USO-Weitergabe unterbrochen**
   ```
   Prüfe: Sind alle Nodes korrekt verbunden?
   Prüfe: Gibt es Fehler in den Logs?
   ```

3. **Node überschreibt Context**
   ```typescript
   // Einige Nodes könnten Context entfernen:
   // Prüfe Node-Implementierung
   ```

**Debugging:**
```bash
# Backend-Logs prüfen:
docker logs iot-orchestrator-backend -f | grep "context"

# Sollte zeigen:
# "hasContext": true
# "context": { "time": "...", ... }
```

---

## Zusammenfassung

### Key Points

1. **Context-Informationen** werden im USO-Header transportiert
2. **Zeit** wird automatisch hinzugefügt (Client oder Backend)
3. **WS_In Node** hat Option "Context weitergeben" (Standard: AN)
4. **Deaktivierung** entfernt Context komplett aus USO
5. **Anwendungsfälle:** Personalisierung, Debugging, Privacy, Token-Optimierung

### Technologie-Stack

- **Backend:** NestJS, TypeScript
- **Frontend:** React, Next.js
- **Client:** Python (test-ws-in.py), ESP32, etc.
- **Protokoll:** USO (Universal Stream Object)
- **Transport:** WebSocket

### Version History

| Version | Datum | Änderung |
|---------|-------|----------|
| v2.2.0 | 2025-10-20 | Context-System eingeführt |
| v2.3.0 | 2025-10-21 | Automatische Zeit-Hinzufügung |
| v2.4.0 | 2025-10-21 | Option "Context weitergeben" |

---

## Weiterführende Dokumentation

- **[DEBUG_EVENTS_GUIDE.md](./DEBUG_EVENTS_GUIDE.md)** - Wie Context im Debug Panel angezeigt wird
- **[TEST_SCRIPTS_README.md](./TEST_SCRIPTS_README.md)** - Python-Script mit Context-Konfiguration
- **[backend/README.md](./backend/README.md)** - USO-Protokoll und Context-Struktur
- **[frontend/README.md](./frontend/README.md)** - UI-Komponenten für Context-Anzeige

---

**Zuletzt aktualisiert:** 21.10.2025  
**Version:** 2.4.0

