#!/bin/bash

# IoT Orchestrator Device Client Launcher
# =======================================
# Startet das Python-Script für ein Device mit Mikrofon und Lautsprecher

echo "📱 IoT Orchestrator Device Client"
echo "=================================="
echo ""
echo "Dieses Script startet ein Device mit:"
echo "  • Mikrofon (sendet Audio bei Enter-Taste)"
echo "  • Lautsprecher (empfängt Audio automatisch)"
echo ""

# Prüfe ob Python verfügbar ist
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 ist nicht verfügbar!"
    echo "   Installiere Python 3 und versuche es erneut."
    exit 1
fi

# Prüfe ob das Python-Script existiert
SCRIPT_PATH="$(dirname "$0")/device-client.py"
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "❌ Python-Script nicht gefunden: $SCRIPT_PATH"
    echo "   Stelle sicher, dass du im richtigen Verzeichnis bist."
    exit 1
fi

echo "📋 Voraussetzungen:"
echo "   • PyAudio: pip install pyaudio"
echo "   • WebSocket-Client: pip install websockets"
echo "   • ffmpeg (für Audio-Wiedergabe)"
echo "   • Aktiver WebSocket-Server auf Port 8080"
echo ""

# Prüfe ob erforderliche Pakete installiert sind
echo "🔍 Prüfe Abhängigkeiten..."

python3 -c "import pyaudio" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  PyAudio ist nicht installiert!"
    echo "   Installiere mit einem der folgenden Befehle:"
    echo "   • pip install pyaudio"
    echo "   • Auf macOS: brew install portaudio && pip install pyaudio"
    echo ""
    read -p "Fortfahren trotzdem? (j/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Jj]$ ]]; then
        exit 1
    fi
fi

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

echo ""
echo "🚀 Starte Device-Client..."
echo "   Gateway: ws://localhost:8080/ws/external"
echo "   Format: 16kHz, Mono, 16-bit PCM"
echo ""
echo "💡 Bedienung:"
echo "   • Enter-Taste: Mikrofon-Audio senden"
echo "   • Enter erneut: Aufnahme stoppen"
echo "   • q + Enter: Programm beenden"
echo "   • Lautsprecher: Empfängt automatisch Audio"
echo ""
echo "⚠️  WICHTIG:"
echo "   • Device wird als 'python-voice-device' in Mic- und Speaker-Nodes sichtbar"
echo "   • Stelle sicher, dass client_secret_python-voice-device in der DB gespeichert ist"
echo "   • Stelle sicher, dass der Backend-Server läuft"
echo ""

# Script ausführen
python3 "$SCRIPT_PATH"

echo ""
echo "✅ Device-Client beendet."
echo ""
echo "📖 Mehr Informationen:"
echo "   • Siehe device-client.py für Konfiguration"
echo "   • Device-Name und Secret in der Python-Datei anpassen"

