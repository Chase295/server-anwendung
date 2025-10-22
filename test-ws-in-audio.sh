#!/bin/bash

# WebSocket-In Audio Node Tester Launcher
# ========================================
# Startet das Python-Script für Audio-Streaming zur WS-In-Node

echo "🎤 WebSocket-In Audio Node Tester"
echo "=================================="
echo ""
echo "Dieses Script startet das Audio-Streaming zur WS-In-Node."
echo "Das Script streamt Audio vom Mikrofon zur WS-In-Node für STT-Verarbeitung."
echo ""

# Prüfe ob Python verfügbar ist
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 ist nicht verfügbar!"
    echo "   Installiere Python 3 und versuche es erneut."
    exit 1
fi

# Prüfe ob das Python-Script existiert
SCRIPT_PATH="$(dirname "$0")/test-ws-in-audio.py"
if [ ! -f "$SCRIPT_PATH" ]; then
    echo "❌ Python-Script nicht gefunden: $SCRIPT_PATH"
    echo "   Stelle sicher, dass du im richtigen Verzeichnis bist."
    exit 1
fi

echo "📋 Voraussetzungen:"
echo "   • PyAudio: pip install pyaudio"
echo "   • WebSocket-Client: pip install websockets"
echo "   • Aktive WS-In-Node auf Port 8081 mit Audio-Modus"
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
echo "🚀 Starte Audio-Streaming..."
echo "   Verbindung: ws://localhost:8081/ws/external"
echo "   Format: 16kHz, Mono, 16-bit PCM"
echo ""
echo "💡 Tipp: Sprich ins Mikrofon nach dem Start"
echo "   STRG+C zum Beenden"
echo ""

# Script ausführen
python3 "$SCRIPT_PATH"

echo ""
echo "✅ Audio-Test beendet."
echo ""
echo "📖 Mehr Informationen:"
echo "   • Siehe test-ws-in-audio.py für Konfiguration"
echo "   • Stelle sicher, dass die WS-In-Node auf Audio gestellt ist"
echo "   • Prüfe Logs für STT-Ergebnisse"
