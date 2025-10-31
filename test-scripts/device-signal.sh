#!/bin/bash

# IoT Orchestrator Signal Device Client Launcher
# ==============================================
# Startet das Python-Script für ein Device mit Signal-Integration

echo "📱 IoT Orchestrator Signal Device Client"
echo "========================================"
echo ""
echo "Dieses Script startet ein Device mit:"
echo "  • Signal-Empfang (empfängt Signal-Nachrichten)"
echo "  • Signal-Senden (sendet TXT Output über Signal)"
echo "  • TXT Input/Output für IoT Orchestrator"
echo ""

# Prüfe ob Python verfügbar ist
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 ist nicht verfügbar!"
    echo "   Installiere Python 3 und versuche es erneut."
    exit 1
fi

# Prüfe ob das Python-Script existiert
SCRIPT_PATH="$(dirname "$0")/device-signal.py"
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "❌ Python-Script nicht gefunden: $SCRIPT_PATH"
    echo "   Stelle sicher, dass du im richtigen Verzeichnis bist."
    exit 1
fi

echo "📋 Voraussetzungen:"
echo "   • WebSocket-Client: pip install websockets"
echo "   • HTTP-Client: pip install httpx"
echo "   • Aktiver IoT Orchestrator WebSocket-Server auf Port 8080"
echo "   • Signal-Server erreichbar (signal.local.chase295.de)"
echo ""

# Prüfe ob erforderliche Pakete installiert sind
echo "🔍 Prüfe Abhängigkeiten..."

python3 -c "import websockets" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  websockets ist nicht installiert!"
    echo "   Installiere mit: pip install websockets"
    echo ""
    read -p "Fortfahren trotzdem? (j/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Jj]$ ]]; then
        exit 1
    fi
fi

python3 -c "import httpx" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  httpx ist nicht installiert!"
    echo "   Installiere mit: pip install httpx"
    echo ""
    read -p "Fortfahren trotzdem? (j/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Jj]$ ]]; then
        exit 1
    fi
fi

echo ""
echo "🔗 Konfiguration (aus device-signal.py):"
echo "   • IoT Orchestrator: ws://10.0.3.17:8080/ws/external"
echo "   • Signal-Empfang: wss://signal.local.chase295.de/v1/receive/+4915122215051"
echo "   • Signal-Senden: https://signal.local.chase295.de/v2/send"
echo "   • Signal-Nummer (Empfang): +4915122215051"
echo "   • Signal-Nummer (Senden): +4915122215051"
echo "   • Standard-Empfänger: +4917681328005"
echo ""
echo "💡 Funktionsweise:"
echo "   • Signal-Nachrichten → IoT Orchestrator (txt_input)"
echo "   • IoT Orchestrator TXT Output → Signal (txt_output)"
echo ""
echo "⚠️  WICHTIG:"
echo "   • Device wird als 'signal-device' in TXT Input/Output Nodes sichtbar"
echo "   • Stelle sicher, dass client_secret_signal-device in der DB gespeichert ist"
echo "   • Stelle sicher, dass der Backend-Server läuft"
echo "   • Stelle sicher, dass der Signal-Server erreichbar ist"
echo "   • Signal-Nummern in device-signal.py konfigurieren falls nötig"
echo ""

# Prüfe ob Signal-Server erreichbar ist (optional)
echo "🌐 Prüfe Signal-Server-Verbindung..."
if command -v curl &> /dev/null; then
    # Prüfe Signal API (ohne Fehlerbehandlung, da es nur eine Info ist)
    curl -s --head --max-time 3 "https://signal.local.chase295.de/v2/send" > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "   ✓ Signal-Server erreichbar"
    else
        echo "   ⚠️  Signal-Server möglicherweise nicht erreichbar"
        echo "      Überprüfe die Verbindung oder die URL"
    fi
else
    echo "   ℹ️  curl nicht verfügbar - kann Signal-Server-Verbindung nicht prüfen"
fi

echo ""
echo "🚀 Starte Signal Device-Client..."
echo ""

# Script ausführen
python3 "$SCRIPT_PATH"

echo ""
echo "✅ Signal Device-Client beendet."
echo ""
echo "📖 Mehr Informationen:"
echo "   • Siehe device-signal.py für Konfiguration"
echo "   • Device-Name, Signal-Nummern und API-Key in der Python-Datei anpassen"
echo ""

