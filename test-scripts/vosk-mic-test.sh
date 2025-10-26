#!/bin/bash

# Vosk WebSocket Client Launcher - Mikrofon-Streaming Version
# =========================================================
# Startet den Python-Client für die Verbindung zu einem externen Vosk-Server
# Streamt Audio live vom Mikrofon

echo "🎙️  Vosk WebSocket Client - Live Mikrofon Test"
echo "=============================================="
echo ""
echo "Dieser Client verbindet sich zu einem externen Vosk-Server"
echo "und streamt Audio live von deinem Mikrofon für Speech-to-Text."
echo ""
echo "📡 Ziel-Server: ws://100.64.0.102:2700/"
echo "🎵 Audio-Format: 16kHz, 16-bit, Mono PCM (wird von Python angefordert)"
echo ""

# Prüfe ob Python verfügbar ist
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 ist nicht verfügbar!"
    echo "   Installiere Python 3 und versuche es erneut."
    exit 1
fi

# Passe diesen Pfad an, falls dein Python-Skript anders heißt
PYTHON_SCRIPT_NAME="vosk-mic-test.py"
SCRIPT_PATH="$(dirname "$0")/$PYTHON_SCRIPT_NAME"

if [ ! -f "$SCRIPT_PATH" ]; then
    echo "❌ Python-Script nicht gefunden: $SCRIPT_PATH"
    echo "   Stelle sicher, dass das Skript '$PYTHON_SCRIPT_NAME' im selben Verzeichnis liegt."
    exit 1
fi

echo "📋 Voraussetzungen:"
echo "   • websocket-client: pip install websocket-client"
echo "   • sounddevice:      pip install sounddevice"
echo "   • numpy:            pip install numpy"
echo "   • Vosk-Server auf ws://100.64.0.102:2700/ muss laufen"
echo "   • Ein funktionierendes Mikrofon"
echo ""

# Installiere fehlende Pakete automatisch
echo "🔍 Prüfe und installiere Abhängigkeiten..."

python3 -c "import websocket" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "   → Installiere websocket-client..."
    pip install websocket-client
fi

python3 -c "import sounddevice" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "   → Installiere sounddevice..."
    pip install sounddevice
fi

python3 -c "import numpy" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "   → Installiere numpy..."
    pip install numpy
fi

echo "   ✓ Alle Abhängigkeiten bereit!"
echo ""

echo ""
echo "🚀 Starte Vosk Mikrofon Client..."
echo "   Verbindung: ws://100.64.0.102:2700/"
echo "   Audio-Quelle: Standard-Mikrofon"
echo "   Format: 16kHz, 16-bit, Mono PCM"
echo ""
echo "💡 Tipp: Spreche jetzt in dein Mikrofon."
echo "   Transkriptionsergebnisse werden in Echtzeit angezeigt."
echo "   STRG+C zum Beenden"
echo ""

# Script ausführen
python3 "$SCRIPT_PATH"

echo ""
echo "✅ Vosk Mikrofon Test beendet."
echo ""
echo "📖 Mehr Informationen:"
echo "   • Siehe $PYTHON_SCRIPT_NAME für Konfiguration"
echo "   • Stelle sicher, dass der Vosk-Server läuft"
echo "   • Teilergebnisse (partial) überschreiben sich live"
echo "   • Finale Ergebnisse (text) erscheinen mit Zeitstempel"

# Dieses Skript ausführbar machen (falls du es 'vosk-mic-test.sh' nennst)
# chmod +x vosk-mic-test.sh
