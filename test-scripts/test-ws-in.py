#!/usr/bin/env python3
"""
WebSocket-In Node Tester
========================
Test-Script für die WebSocket-In-Node des IoT & Voice Orchestrators.
Sendet Text-Nachrichten im USO-Format an die WS-In-Node.

Verwendung:
    1. Trage deine Context-Informationen im Script ein:
       CONTEXT_PERSON = "Dein Name"
       CONTEXT_LOCATION = "Dein Standort"
       CONTEXT_CLIENT = "Dein Gerät"
    
    2. Führe das Script aus:
       python3 test-ws-in.py
    
    3. Gib Nachrichten ein und sende sie mit ENTER
"""

import asyncio
import websockets
import json
import uuid
import sys
from datetime import datetime

# ======================================
# KONFIGURATION - HIER ANPASSEN
# ======================================
WS_HOST = "localhost"
WS_PORT = 8081
WS_PATH = "/ws/external"

# Context-Informationen - HIER DEINE WERTE EINTRAGEN!
CONTEXT_PERSON = "Moritz Haslbeck"      # Name der Person
CONTEXT_LOCATION = "Schlafzimmer 1.OG"       # Standort/Raum
CONTEXT_CLIENT = "Laptop xyz"           # Geräte-Name

# ======================================
# ENDE KONFIGURATION
# ======================================

# Vollständige WebSocket-URL
WS_URL = f"ws://{WS_HOST}:{WS_PORT}{WS_PATH}"

# Farben für Terminal-Output
class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_header():
    """Zeigt den Header mit Konfiguration an"""
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}  WebSocket-In Node Tester{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")
    print(f"{Colors.OKCYAN}📡 Verbindung:{Colors.ENDC} {WS_URL}")
    print(f"{Colors.OKCYAN}📝 Protokoll:{Colors.ENDC} USO (Universal Stream Object)")
    print(f"{Colors.OKCYAN}📤 Datentyp:{Colors.ENDC} Text\n")

def create_uso_text_message(text: str, context_person: str = "", context_location: str = "", context_client: str = "") -> tuple:
    """
    Erstellt ein USO-Text-Nachricht (Header + Payload)
    
    Args:
        text: Der zu sendende Text
        context_person: Name der Person (optional)
        context_location: Standort (optional)
        context_client: Client-Name (optional)
        
    Returns:
        tuple: (header_json, payload_text)
    """
    # USO Header erstellen
    header = {
        "id": str(uuid.uuid4()),
        "type": "text",
        "sourceId": "python_test_client",
        "timestamp": int(datetime.now().timestamp() * 1000),
        "final": True,
        "textMeta": {
            "encoding": "utf-8",
            "length": len(text)
        }
    }
    
    # Context-Informationen hinzufügen
    context = {}
    
    # Aktuelle Uhrzeit automatisch hinzufügen
    current_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    context["time"] = current_time
    
    # Weitere Context-Informationen (nur wenn vorhanden)
    if context_person:
        context["person"] = context_person
    if context_location:
        context["location"] = context_location
    if context_client:
        context["clientName"] = context_client
    
    if context:
        header["context"] = context
    
    return (json.dumps(header), text)

async def send_message(websocket, text: str, context_person: str = "", context_location: str = "", context_client: str = ""):
    """
    Sendet eine Text-Nachricht im USO-Format
    
    Args:
        websocket: Die WebSocket-Verbindung
        text: Der zu sendende Text
        context_person: Name der Person (optional)
        context_location: Standort (optional)
        context_client: Client-Name (optional)
    """
    try:
        # USO erstellen
        header_json, payload = create_uso_text_message(text, context_person, context_location, context_client)
        
        # Phase 1: Header senden
        await websocket.send(header_json)
        print(f"{Colors.OKBLUE}→ Header gesendet{Colors.ENDC}")
        
        # Phase 2: Payload senden
        await websocket.send(payload)
        print(f"{Colors.OKGREEN}✓ Text gesendet: {Colors.BOLD}{payload}{Colors.ENDC}\n")
        
    except Exception as e:
        print(f"{Colors.FAIL}✗ Fehler beim Senden: {e}{Colors.ENDC}\n")

async def receive_messages(websocket):
    """
    Empfängt Nachrichten vom WebSocket-Server (falls welche kommen)
    """
    try:
        async for message in websocket:
            print(f"{Colors.WARNING}← Nachricht empfangen: {message}{Colors.ENDC}")
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        print(f"{Colors.FAIL}✗ Fehler beim Empfangen: {e}{Colors.ENDC}")

async def interactive_client():
    """
    Hauptfunktion: Verbindet zum WebSocket-Server und ermöglicht interaktive Texteingabe
    """
    print_header()
    
    # Context-Informationen aus den Konfigurationsvariablen verwenden
    context_person = CONTEXT_PERSON
    context_location = CONTEXT_LOCATION
    context_client = CONTEXT_CLIENT
    
    # Anzeige der konfigurierten Context-Informationen
    print(f"{Colors.OKGREEN}✓ Context-Informationen (aus Script):{Colors.ENDC}")
    # Uhrzeit wird immer automatisch hinzugefügt
    print(f"  🕐 Zeit: {Colors.BOLD}(automatisch hinzugefügt bei jedem Send){Colors.ENDC}")
    if context_person:
        print(f"  👤 Person: {Colors.BOLD}{context_person}{Colors.ENDC}")
    if context_location:
        print(f"  📍 Standort: {Colors.BOLD}{context_location}{Colors.ENDC}")
    if context_client:
        print(f"  💻 Client: {Colors.BOLD}{context_client}{Colors.ENDC}")
    print()
    
    if not context_person and not context_location and not context_client:
        print(f"{Colors.WARNING}⚠️  Nur Zeit wird als Context gesendet{Colors.ENDC}")
        print(f"{Colors.WARNING}   Trage weitere Werte im Script ein (CONTEXT_PERSON, CONTEXT_LOCATION, CONTEXT_CLIENT){Colors.ENDC}\n")
    
    try:
        print(f"{Colors.OKCYAN}⏳ Verbinde zu {WS_URL}...{Colors.ENDC}")
        
        async with websockets.connect(WS_URL) as websocket:
            print(f"{Colors.OKGREEN}✓ Verbindung hergestellt!{Colors.ENDC}\n")
            print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}")
            print(f"{Colors.HEADER}Gib Text ein und drücke ENTER zum Senden.{Colors.ENDC}")
            print(f"{Colors.HEADER}Beende mit CTRL+C oder 'exit'{Colors.ENDC}")
            print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}\n")
            
            # Starte Empfangs-Task im Hintergrund
            receive_task = asyncio.create_task(receive_messages(websocket))
            
            # Interaktive Eingabe-Schleife
            loop = asyncio.get_event_loop()
            
            while True:
                try:
                    # Eingabe vom Benutzer (non-blocking)
                    text = await loop.run_in_executor(None, input, f"{Colors.OKBLUE}Nachricht:{Colors.ENDC} ")
                    
                    # Beenden bei 'exit'
                    if text.lower() in ['exit', 'quit', 'q']:
                        print(f"\n{Colors.WARNING}👋 Beende Verbindung...{Colors.ENDC}")
                        break
                    
                    # Leere Eingaben ignorieren
                    if not text.strip():
                        continue
                    
                    # Nachricht mit Context-Infos senden
                    await send_message(websocket, text, context_person, context_location, context_client)
                    
                except KeyboardInterrupt:
                    print(f"\n\n{Colors.WARNING}👋 Beende Verbindung...{Colors.ENDC}")
                    break
            
            # Empfangs-Task beenden
            receive_task.cancel()
            try:
                await receive_task
            except asyncio.CancelledError:
                pass
                
    except websockets.exceptions.InvalidURI:
        print(f"{Colors.FAIL}✗ Ungültige WebSocket-URL: {WS_URL}{Colors.ENDC}")
        print(f"{Colors.WARNING}💡 Überprüfe die Konfiguration (HOST, PORT, PATH){Colors.ENDC}\n")
        
    except websockets.exceptions.WebSocketException as e:
        print(f"{Colors.FAIL}✗ WebSocket-Fehler: {e}{Colors.ENDC}\n")
        
    except ConnectionRefusedError:
        print(f"{Colors.FAIL}✗ Verbindung abgelehnt!{Colors.ENDC}")
        print(f"{Colors.WARNING}💡 Ist der Server gestartet? (docker-compose up){Colors.ENDC}")
        print(f"{Colors.WARNING}💡 Ist die WS-In-Node im Flow aktiv?{Colors.ENDC}\n")
        
    except Exception as e:
        print(f"{Colors.FAIL}✗ Fehler: {e}{Colors.ENDC}\n")
        import traceback
        traceback.print_exc()

def main():
    """Entry Point"""
    try:
        asyncio.run(interactive_client())
    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}Abgebrochen.{Colors.ENDC}\n")
    finally:
        print(f"\n{Colors.OKGREEN}✓ Test beendet.{Colors.ENDC}\n")

if __name__ == "__main__":
    # Überprüfe Python-Version
    if sys.version_info < (3, 7):
        print(f"{Colors.FAIL}✗ Python 3.7 oder höher erforderlich!{Colors.ENDC}")
        print(f"{Colors.WARNING}Aktuelle Version: {sys.version}{Colors.ENDC}\n")
        sys.exit(1)
    
    # Starte Programm
    main()

