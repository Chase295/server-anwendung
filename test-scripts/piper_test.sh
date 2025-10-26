#!/bin/bash
# Piper TTS Test Script - Shell Wrapper
# Führt das Python-Script zum Testen des Piper Servers aus

# Fehlerbehandlung
set -e

# Farben für bessere Lesbarkeit
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Piper TTS Test Script ===${NC}"
echo ""

# Prüfe ob Python verfügbar ist
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}Fehler: python3 nicht gefunden!${NC}"
    exit 1
fi

# Prüfe ob pip verfügbar ist
if ! command -v pip3 &> /dev/null; then
    echo -e "${RED}Fehler: pip3 nicht gefunden!${NC}"
    exit 1
fi

# Prüfe ob requests installiert ist
if ! python3 -c "import requests" &> /dev/null; then
    echo -e "${YELLOW}requests nicht gefunden. Installiere es...${NC}"
    pip3 install requests
fi

# Prüfe ob das Python-Script existiert
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="${SCRIPT_DIR}/piper_test.py"

if [ ! -f "$PYTHON_SCRIPT" ]; then
    echo -e "${RED}Fehler: piper_test.py nicht gefunden!${NC}"
    echo "Erwartet in: $PYTHON_SCRIPT"
    exit 1
fi

# Prüfe ob ffplay oder afplay verfügbar ist (für Audio-Playback)
if ! command -v ffplay &> /dev/null && ! command -v afplay &> /dev/null; then
    echo -e "${YELLOW}Warnung: Kein Audio-Player gefunden (ffplay oder afplay empfohlen)${NC}"
    echo "Das Script wird versuchen, das Audio trotzdem abzuspielen oder als WAV-Datei zu speichern."
    echo ""
fi

# Führe das Python-Script aus
if [ $# -eq 0 ]; then
    echo -e "${BLUE}Verwendung:${NC}"
    echo "  ./piper_test.sh \"Dein Text hier\""
    echo ""
    echo -e "${BLUE}Beispiel:${NC}"
    echo "  ./piper_test.sh \"Hallo, das ist ein Test\""
    echo ""
    echo -e "${BLUE}Mit eigener Stimme:${NC}"
    echo "  ./piper_test.sh \"Hallo Welt\" de_DE-thorsten-medium"
    echo ""
    echo -e "${YELLOW}Info:${NC}"
    echo "Der Piper Server läuft auf: http://100.64.0.103:5002"
    echo ""
    exit 1
fi

echo -e "${GREEN}Starte Python-Script...${NC}"
echo ""

# Übergib alle Argumente an das Python-Script
python3 "$PYTHON_SCRIPT" "$@"
