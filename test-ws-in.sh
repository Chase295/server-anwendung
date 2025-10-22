#!/bin/bash

# WebSocket-In Node Tester - Start Script
# ========================================
# Dieses Script startet den Python WebSocket-Client zum Testen der WS-In-Node

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  WebSocket-In Node Tester${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Prüfe ob Python 3 installiert ist
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}✗ Python 3 ist nicht installiert!${NC}"
    echo -e "${YELLOW}💡 Installiere Python 3: brew install python3${NC}\n"
    exit 1
fi

# Prüfe ob websockets-Modul installiert ist
python3 -c "import websockets" 2>/dev/null

if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Python 'websockets' Modul nicht gefunden${NC}"
    echo -e "${BLUE}📦 Installiere websockets...${NC}\n"
    pip3 install websockets
    echo ""
fi

# Starte Python-Script
echo -e "${GREEN}🚀 Starte WebSocket-Client...${NC}\n"
python3 test-ws-in.py

echo -e "\n${GREEN}✓ Fertig!${NC}\n"

