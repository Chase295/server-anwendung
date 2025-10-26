#!/bin/bash
# test-ws-out-audio.sh
# Startet den WebSocket Audio Tester für die WS-Out-Node

echo "=================================="
echo "  WebSocket-Out Audio Tester"
echo "=================================="
echo ""

# Prüfe ob Python 3 installiert ist
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 ist nicht installiert!"
    echo "Installiere Python 3 und versuche es erneut."
    exit 1
fi

# Prüfe Python-Version
PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
echo "✓ Python Version: $PYTHON_VERSION"
echo ""

# Prüfe ob websockets library installiert ist
if ! python3 -c "import websockets" &> /dev/null; then
    echo "⚠️  websockets library nicht gefunden"
    echo "Installiere mit: pip3 install websockets"
    echo ""
    read -p "Soll ich websockets installieren? (j/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Jj]$ ]]; then
        pip3 install websockets
    else
        echo "Abgebrochen"
        exit 1
    fi
fi

echo "✓ websockets library gefunden"
echo ""

# Starte den WebSocket-Server
echo "🚀 Starte WebSocket-Server..."
echo ""
python3 test-ws-out-audio.py

