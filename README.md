# IoT & Voice Orchestrator Server

Eine zentrale, visuelle Anwendung (ähnlich Node-RED) zur Orchestrierung von IoT-Clients (ESP32) und externen KI-Diensten (STT, TTS, Workflow) über WebSockets.

## 🎯 Features

### Core-Funktionalität
- ✅ **WebSocket-Server** mit binärem Streaming-Protokoll für ESP32-Clients
- ✅ **Universal Stream Object (USO)** für einheitliche Datenströme
- ✅ **Flow-Engine** mit Event-basierter Architektur
- ✅ **Visueller Flow-Editor** mit React Flow
  - Drag & Drop für Nodes von Toolbar auf Canvas
  - Intelligente Verbindungsvalidierung nach Datentypen (Audio/Text)
  - Node-spezifische Input/Output-Handles
  - Edge-Management (Auswahl, Löschen mit Delete-Taste)
  - Icons auf Canvas-Nodes für bessere Übersicht
  - Verbesserte Handle-Sichtbarkeit mit Glow-Effekten
- ✅ **Node-System** mit modularen, erweiterbaren Nodes
- ✅ **Authentifizierung** für Admin-UI und ESP32-Clients
- ✅ **Secret-Management** mit AES-256 Verschlüsselung
- ✅ **MongoDB** für Persistenz von Flows, Geräten und Secrets
- ✅ **Winston-Logging** mit strukturiertem JSON-Format und Live-Log-Viewer
- ✅ **Dark Mode** mit automatischer System-Erkennung im gesamten Frontend
- ✅ **Nginx-Ready** für Production-Deployment
- ✅ **Web-UI Konfiguration** für alle externen Services (keine .env-Variablen nötig)
- ✅ **Server-Verwaltung** - Zentrale Verwaltung von Vosk, Piper und Flowise-Servern in Einstellungen
- ✅ **Direkte Node-Konfiguration** - Server direkt in Node-Panels hinzufügen, bearbeiten und testen
- ✅ **Toast-Benachrichtigungen** - Moderne Benachrichtigungen statt Browser-Popups
- ✅ **Confirm-Dialoge** - Elegante Bestätigungsdialoge für kritische Aktionen
- ✅ **Debug Events System** - Live-Monitoring aller Debug-Node-Ausgaben im Flow-Editor
  - HTTP-Polling basiert (keine Nginx-Konfiguration nötig!)
  - 3 Ansichtsmodi: Kompakt, Detailliert, JSON
  - Filterung nach Datentyp, Flow-spezifisch
  - Vollständige Text-Preview und Context-Anzeige
  - Automatische Event-Caching im Backend
- ✅ **Context-Informationen** - Metadaten-System für personalisierte KI-Interaktionen
  - Zeit (automatisch), Person, Location, Client-Name in jedem USO
  - Konfigurierbare Weitergabe pro WS_In Node (aktiviert/deaktiviert)
  - Automatische Weitergabe durch die gesamte Pipeline
  - Sichtbar in Debug Events und Logs
  - Opt-out Modell: Kann bei Bedarf deaktiviert werden (z.B. für Privacy oder Token-Optimierung)
- ✅ **Flow-Status-Management** - Start/Stop Buttons und Live-Status im Flow-Editor
  - Start/Stop Button direkt im Editor (oben rechts)
  - Live Status-Anzeige mit pulsierendem Badge
  - Automatische Status-Synchronisation zwischen Editor und Flow-Liste
  - Tab-Fokus-Erkennung für Status-Updates

### Verfügbare Nodes

**Datenquellen (nur Output):**
- ✅ **Mikrofon Node:** Empfängt Audio von ESP32-Client → Output: Audio
- ✅ **WebSocket In Node:** Empfängt Daten von externen WebSocket-Clients → Output: Audio/Text/Raw (konfigurierbar)

**Datenverarbeitung (Input + Output):**
- ✅ **STT Node:** Speech-to-Text mit Vosk → Input: Audio, Output: Text
- ✅ **AI Node:** KI-Verarbeitung mit Flowise AI-Engine **mit Echtzeit-Streaming** ⚡ → Input: Text, Output: Text
  - Token-für-Token Ausgabe wie ChatGPT
  - Start-to-First-Token: < 1 Sekunde
  - Unterstützt Flowise Server-Sent Events (SSE)
- ✅ **TTS Node:** Text-to-Speech mit Piper → Input: Text, Output: Audio

**Datenziele (nur Input):**
- ✅ **Speaker Node:** Sendet Audio an ESP32-Client ← Input: Audio
- ✅ **Debug Node:** Zeigt USO-Datenströme im Log an ← Input: Any (akzeptiert alle Typen)
- ✅ **WebSocket Out Node:** Sendet Daten an externe WebSocket-Server ← Input: Audio/Text/Raw (konfigurierbar)
  - **Content-Only Modus** für minimalen Overhead (perfekt für Streaming!)
  - Health-Status mit Reconnect-Anzeige
  - Automatisches Cleanup (keine "Zombie-Connections" mehr)

> **Hinweis:** Detaillierte Informationen zur API und Funktionsweise der externen Services (Vosk, Piper, Flowise) finden Sie in der [SERVICES.md](./SERVICES.md).

## 🏗️ Architektur

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx Reverse Proxy                   │
│              (SSL/TLS, WebSocket-Tunneling)              │
└──────────────┬─────────────────────┬────────────────────┘
               │                     │
         ┌─────▼─────┐         ┌─────▼─────┐
         │  Frontend │◄────────│  Backend  │
         │ (Next.js) │  8082   │ (NestJS)  │
         │  Port 3001│ Debug   │  Port 3000│
         └───────────┘ Events  └─────┬─────┘
                                     │
                ┌────────────────────┼────────────────────┐
                │                    │                    │
          ┌─────▼─────┐      ┌──────▼──────┐     ┌──────▼──────┐
          │ WebSocket │      │  MongoDB    │     │  External   │
          │  Devices  │      │  Database   │     │  Services   │
          │ Port 8080 │      │             │     │ (STT/TTS/AI)│
          └─────┬─────┘      └─────────────┘     └─────────────┘
                │
         ┌──────▼──────┐
         │ ESP32 Clients│
         │ (IoT Devices)│
         └─────────────┘
                                ┌──────────────┐
                                │  WS_In Nodes │
                                │  Port 8081+  │
                                │ (External WS)│
                                └──────────────┘
```

### 🔌 Ports & Verbindungen

| Port | Service | Zweck | Protokoll |
|------|---------|-------|-----------|
| **3000** | Backend HTTP/API | REST API für Flows, Devices, Settings | HTTP |
| **3001** | Frontend | Next.js Web-UI | HTTP |
| **8080** | WebSocket (Devices) | ESP32-Clients, Bidirektionale Kommunikation | WebSocket |
| **8081+** | WS_In Nodes | Externe WebSocket-Eingänge (konfigurierbar pro Node) | WebSocket |
| **8082** | Debug Events | Live Debug-Events für Frontend (intern) | HTTP |
| **27017** | MongoDB | Datenbank (nur intern in Docker) | MongoDB Protocol |

## 🚀 Quick Start

### Voraussetzungen

- Node.js >= 18
- MongoDB >= 6.0
- npm oder yarn

**ODER** verwenden Sie Docker Compose (empfohlen):

- Docker >= 20.10
- Docker Compose >= 2.0

### 🐳 Option A: Docker Compose (Empfohlen)

**Schnellster Weg** - Alles mit einem Befehl starten:

```bash
# Repository klonen
git clone https://github.com/Chase295/server-anwendung.git
cd server-anwendung

# .env erstellen (optional, nur für Secrets nötig)
cat > .env << EOF
JWT_SECRET=dev-jwt-secret-change-in-production
ENCRYPTION_KEY=dev-encryption-key-must-be-32-chars-long
EOF

# HINWEIS: Externe Services (Vosk, Piper, Flowise) werden NICHT über .env
# konfiguriert, sondern über die Web-UI (Einstellungen & Node-Konfiguration)!

# Alles starten (MongoDB, Backend, Frontend)
docker-compose up --build

# Oder im Hintergrund:
docker-compose up -d --build
```

**Das war's!** 🎉
- Frontend: http://localhost:3001
- Backend API: http://localhost:3000/api
- WebSocket: ws://localhost:8080

**Hinweis:** Vosk, Piper und Flowise müssen separat gestartet werden (optional). Server werden zentral unter **Einstellungen** verwaltet oder direkt in Node-Konfigurationen hinzugefügt!

📖 **Vollständige Docker-Anleitung:** [DOCKER.md](./DOCKER.md)

## 📚 Dokumentation

### Haupt-Dokumentation
- **[README.md](README.md)** - Dieses Dokument (Überblick, Installation, Features)
- **[QUICKSTART.md](QUICKSTART.md)** - Schnellstart-Anleitung für Einsteiger
- **[SCHNELLTEST.md](SCHNELLTEST.md)** - Schneller Test mit Python-Script

### Technische Dokumentation
- **[STREAMING_GUIDE.md](STREAMING_GUIDE.md)** ⭐ - Komplette Anleitung für Echtzeit AI-Streaming
- **[DEBUG_EVENTS_GUIDE.md](DEBUG_EVENTS_GUIDE.md)** ⭐ - Vollständige Erklärung des Debug Events Systems
- **[FLOW_STATUS_MANAGEMENT.md](FLOW_STATUS_MANAGEMENT.md)** ⭐ - Flow-Status-Synchronisation im Detail
- **[CONTEXT_MANAGEMENT.md](CONTEXT_MANAGEMENT.md)** ⭐ - Context-Informationen & Weitergabe-Option
- **[test-scripts/README.md](test-scripts/README.md)** - Komplette Test-Scripts Übersicht
- **[test-scripts/TEST_SCRIPTS_README_AUDIO.md](test-scripts/TEST_SCRIPTS_README_AUDIO.md)** ⭐ - Audio-Test-Scripts
- **[test-scripts/VOSK_TEST_README.md](test-scripts/VOSK_TEST_README.md)** - Vosk-Server Test-Anleitung
- **[test-scripts/TROUBLESHOOTING.md](test-scripts/TROUBLESHOOTING.md)** - Fehlerbehebungsanleitung
- **[NODES.md](NODES.md)** - Alle verfügbaren Nodes (Basis-Dokumentation)
- **[SERVICES.md](SERVICES.md)** - Externe Services (Vosk, Piper, Flowise)

### Setup & Deployment
- **[SETUP.md](SETUP.md)** ⭐ **NEU!** - Komplette Setup-Anleitung (lokal + Reverse Proxy)
- **[DOCKER.md](DOCKER.md)** - Docker Compose Setup & Production
- **[nginx.conf.example](nginx.conf.example)** - Nginx Reverse Proxy Konfiguration

### Backend & Frontend
- **[backend/README.md](backend/README.md)** - NestJS Backend Dokumentation
- **[frontend/README.md](frontend/README.md)** - Next.js Frontend Dokumentation

## 🤝 Contributing

Beiträge sind willkommen! Bitte öffnen Sie ein Issue oder Pull Request.

## 📄 Lizenz

MIT

## 📧 Kontakt

Bei Fragen oder Problemen öffnen Sie bitte ein Issue auf [GitHub](https://github.com/Chase295/server-anwendung).

---

**Hinweis:** Dies ist eine Entwicklungsversion. Für Production-Einsatz bitte zusätzliche Sicherheitsmaßnahmen treffen und gründlich testen.
