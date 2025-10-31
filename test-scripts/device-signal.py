#!/usr/bin/env python3
"""
Device Client mit Signal-Integration
=====================================
Python-Client für das IoT Orchestrator System mit Signal-Messaging

Dieses Script erstellt ein gerät, das:
- Als IoT Device mit txt_input und txt_output registriert wird
- Signal-Nachrichten über WebSocket empfängt
- Signal-Nachrichten an IoT Orchestrator weiterleitet (txt_input)
- TXT Output vom IoT Orchestrator über Signal REST API versendet (txt_output)

Verwendung:
    1. Passe Konfiguration an (DEVICE_NAME, Signal-Nummern, etc.)
    2. Installiere Abhängigkeiten: pip install websockets httpx
    3. Stelle sicher, dass client_secret_signal-device in der DB gespeichert ist
    4. Führe aus: python3 device-signal.py
"""

import asyncio
import websockets
import json
import sys
import os
import ssl
from datetime import datetime
from typing import Optional

# HTTP-Client für Signal REST API
try:
    import httpx
except ImportError:
    print("❌ httpx nicht installiert!")
    print("   Installiere mit: pip install httpx")
    sys.exit(1)

# ======================================
# KONFIGURATION - HIER ANPASSEN
# ======================================

# IoT Orchestrator WebSocket-Gateway
WS_HOST = "10.0.3.17"
WS_PORT = 8080  # WebSocket Gateway Port
WS_PATH = "/ws/external"

# Geräte-Informationen  
DEVICE_NAME = "signal-device"  # Name des Gerätes

# Globaler API Key (aus .env oder hier festlegen)
# Setze in docker-compose.yml: SIMPLE_API_KEY=dein-api-key
# Oder hier:
API_KEY = os.getenv("SIMPLE_API_KEY", "default-api-key-123")

# Signal-Konfiguration
SIGNAL_SERVER_URL = "signal.local.chase295.de"  # Signal-Server (ohne https://)
SIGNAL_RECEIVE_NUMBER = "+4915122215051"  # Eigene Signal-Nummer (für Empfang)
SIGNAL_SEND_NUMBER = "+4915122215051"     # Eigene Signal-Nummer (für Senden)
SIGNAL_RECIPIENT_NUMBER = "+4917681328005"  # Standard-Zielnummer (für Senden)

# SSL-Konfiguration (für selbst-signierte Zertifikate)
SIGNAL_VERIFY_SSL = False  # Setze auf True, wenn Zertifikat gültig ist

# Signal-URLs
SIGNAL_WS_URL = f"wss://{SIGNAL_SERVER_URL}/v1/receive/{SIGNAL_RECEIVE_NUMBER}"
SIGNAL_API_URL = f"https://{SIGNAL_SERVER_URL}/v2/send"

# ======================================
# GERÄTE-FÄHIGKEITEN (CAPABILITIES)
# ======================================
DEVICE_CAPABILITIES = [
    'txt_output',    # Text-Ausgabe verfügbar (Signal senden)
    'txt_input',     # Text-Eingabe verfügbar (Signal empfangen)
]

# ======================================
# ENDE KONFIGURATION
# ======================================

# Vollständige IoT Orchestrator WebSocket-URL mit Authentifizierung
IOT_WS_URL = f"ws://{WS_HOST}:{WS_PORT}{WS_PATH}?clientId={DEVICE_NAME}&secret={API_KEY}"

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
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}  IoT Orchestrator Signal Device Client{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}\n")
    print(f"{Colors.OKCYAN}📱 Gerät:{Colors.ENDC} {DEVICE_NAME}")
    print(f"{Colors.OKCYAN}🔗 IoT Orchestrator:{Colors.ENDC} {IOT_WS_URL}")
    print(f"{Colors.OKCYAN}📲 Signal-Empfang:{Colors.ENDC} {SIGNAL_WS_URL}")
    print(f"{Colors.OKCYAN}📤 Signal-Senden:{Colors.ENDC} {SIGNAL_API_URL}")
    print(f"{Colors.OKCYAN}📞 Signal-Nummer (Empfang):{Colors.ENDC} {SIGNAL_RECEIVE_NUMBER}")
    print(f"{Colors.OKCYAN}📞 Signal-Nummer (Senden):{Colors.ENDC} {SIGNAL_SEND_NUMBER}")
    print(f"{Colors.OKCYAN}👤 Standard-Empfänger:{Colors.ENDC} {SIGNAL_RECIPIENT_NUMBER}\n")
    print(f"{Colors.WARNING}💡 WICHTIG:{Colors.ENDC}")
    print(f"   {Colors.OKCYAN}• Empfängt Signal-Nachrichten über WebSocket{Colors.ENDC}")
    print(f"   {Colors.OKCYAN}• Leitet Signal-Nachrichten an IoT Orchestrator weiter{Colors.ENDC}")
    print(f"   {Colors.OKCYAN}• Sendet TXT Output vom IoT Orchestrator über Signal{Colors.ENDC}")
    print(f"   {Colors.OKCYAN}• Device '{DEVICE_NAME}' in TXT Input/Output Nodes auswählbar{Colors.ENDC}\n")

async def send_signal_message(message: str, recipient: Optional[str] = None):
    """
    Sendet eine Nachricht über die Signal REST API
    
    Args:
        message: Die zu sendende Nachricht
        recipient: Empfänger-Nummer (optional, falls nicht angegeben wird SIGNAL_RECIPIENT_NUMBER verwendet)
    """
    recipient_number = recipient or SIGNAL_RECIPIENT_NUMBER
    
    payload = {
        "message": message,
        "number": SIGNAL_SEND_NUMBER,
        "recipients": [recipient_number]
    }
    
    try:
        # SSL-Verifizierung optional deaktivieren
        verify_ssl = SIGNAL_VERIFY_SSL if SIGNAL_VERIFY_SSL else False
        async with httpx.AsyncClient(timeout=10.0, verify=verify_ssl) as client:
            response = await client.post(
                SIGNAL_API_URL,
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            response.raise_for_status()
            print(f"{Colors.OKGREEN}✓ Signal-Nachricht gesendet an {recipient_number}{Colors.ENDC}")
            print(f"  {Colors.OKCYAN}→ Nachricht: {message[:100]}{Colors.ENDC}")
            return True
    except httpx.HTTPError as e:
        print(f"{Colors.FAIL}✗ Fehler beim Senden über Signal API: {e}{Colors.ENDC}")
        return False
    except Exception as e:
        print(f"{Colors.FAIL}✗ Unerwarteter Fehler beim Signal-Senden: {e}{Colors.ENDC}")
        return False

async def receive_signal_messages(iot_websocket):
    """
    Empfängt Signal-Nachrichten über WebSocket und leitet sie an IoT Orchestrator weiter
    
    Args:
        iot_websocket: Die IoT Orchestrator WebSocket-Verbindung
    """
    try:
        print(f"{Colors.OKCYAN}⏳ Verbinde zu Signal WebSocket...{Colors.ENDC}")
        print(f"{Colors.OKCYAN}   URL: {SIGNAL_WS_URL}{Colors.ENDC}")
        
        # SSL-Kontext erstellen (SSL-Verifizierung optional deaktivieren)
        ssl_context = None
        if not SIGNAL_VERIFY_SSL:
            ssl_context = ssl.SSLContext()
            ssl_context.check_hostname = False
            ssl_context.verify_mode = ssl.CERT_NONE
            print(f"{Colors.WARNING}⚠ SSL-Zertifikat-Verifizierung deaktiviert{Colors.ENDC}")
        
        async with websockets.connect(
            SIGNAL_WS_URL,
            ping_interval=None,
            close_timeout=10,
            ssl=ssl_context
        ) as signal_websocket:
            print(f"{Colors.OKGREEN}✓ Signal WebSocket verbunden!{Colors.ENDC}\n")
            
            async for message in signal_websocket:
                try:
                    data = json.loads(message)
                    
                    # Ignoriere typingMessage-Events
                    envelope = data.get('envelope', {})
                    if 'typingMessage' in envelope:
                        continue
                    
                    # Prüfe ob es eine dataMessage ist
                    if 'dataMessage' in envelope:
                        signal_message = envelope['dataMessage'].get('message', '')
                        source_number = envelope.get('sourceNumber', 'unknown')
                        source_name = envelope.get('sourceName', 'unknown')
                        
                        if signal_message:
                            print(f"{Colors.OKCYAN}📩 Signal-Nachricht empfangen{Colors.ENDC}")
                            print(f"  {Colors.OKCYAN}→ Von: {source_name} ({source_number}){Colors.ENDC}")
                            print(f"  {Colors.OKCYAN}→ Nachricht: {signal_message}{Colors.ENDC}")
                            
                            # Erstelle USO-Header für IoT Orchestrator
                            session_id = f"signal_{DEVICE_NAME}_{int(datetime.now().timestamp() * 1000)}"
                            header = {
                                "id": session_id,
                                "type": "text",
                                "sourceId": DEVICE_NAME,
                                "timestamp": int(datetime.now().timestamp() * 1000),
                                "final": True,
                                "metadata": {
                                    "signalSource": source_number,
                                    "signalSourceName": source_name,
                                    "signalAccount": SIGNAL_RECEIVE_NUMBER
                                }
                            }
                            
                            # Header als JSON senden
                            header_json = json.dumps(header)
                            await iot_websocket.send(header_json)
                            
                            # Payload senden (als String!)
                            await iot_websocket.send(signal_message)
                            
                            print(f"{Colors.OKGREEN}✓ Signal-Nachricht an IoT Orchestrator weitergeleitet{Colors.ENDC}\n")
                    
                except json.JSONDecodeError:
                    print(f"{Colors.WARNING}⚠ Unbekannte Signal-Nachricht (kein JSON): {message[:100]}{Colors.ENDC}")
                except Exception as e:
                    print(f"{Colors.FAIL}✗ Fehler beim Verarbeiten von Signal-Nachricht: {e}{Colors.ENDC}")
                    
    except websockets.exceptions.ConnectionClosed:
        print(f"{Colors.FAIL}✗ Signal WebSocket-Verbindung geschlossen{Colors.ENDC}")
    except websockets.exceptions.InvalidURI:
        print(f"{Colors.FAIL}✗ Ungültige Signal WebSocket-URL: {SIGNAL_WS_URL}{Colors.ENDC}")
    except Exception as e:
        print(f"{Colors.FAIL}✗ Fehler bei Signal WebSocket: {e}{Colors.ENDC}")
        import traceback
        traceback.print_exc()

async def receive_iot_messages(iot_websocket):
    """
    Empfängt TXT Output-Nachrichten vom IoT Orchestrator und sendet sie über Signal
    
    Args:
        iot_websocket: Die IoT Orchestrator WebSocket-Verbindung
    """
    last_uso_header = None  # Speichert letzten Header (für zwei-Phasen Protokoll)
    session_buffer = {}  # Session-Buffer für Streaming (sessionId -> text)
    
    try:
        async for message in iot_websocket:
            if isinstance(message, (bytes, bytearray)):
                # Binary-Daten = Payload (Text-Payload)
                if last_uso_header and last_uso_header.get('type') == 'text':
                    payload = message.decode('utf-8')
                    is_final = last_uso_header.get('final', True)
                    session_id = last_uso_header.get('id', 'unknown')
                    
                    # Streaming-Behandlung
                    if not is_final:
                        # Streaming-Chunk (Token-für-Token)
                        if session_id not in session_buffer:
                            session_buffer[session_id] = {'chunks': [], 'chunk_count': 0}
                            print(f"\n{Colors.OKGREEN}📝 TXT Output gestartet{Colors.ENDC}")
                        
                        session = session_buffer[session_id]
                        session['chunks'].append(payload)
                        session['chunk_count'] += 1
                    else:
                        # Finales Paket
                        if session_id in session_buffer:
                            # Streaming abgeschlossen
                            session = session_buffer[session_id]
                            full_text = ''.join(session['chunks']) + payload
                            
                            print(f"\n{Colors.OKGREEN}✓ TXT Output abgeschlossen!{Colors.ENDC}")
                            print(f"  {Colors.OKCYAN}• Chunks:{Colors.ENDC} {session['chunk_count']}")
                            print(f"  {Colors.OKCYAN}• Gesamtlänge:{Colors.ENDC} {len(full_text)} Zeichen")
                            
                            # Sende vollständige Nachricht über Signal
                            await send_signal_message(full_text)
                            
                            del session_buffer[session_id]
                        else:
                            # Normales finales Paket (nicht gestreamt)
                            print(f"\n{Colors.OKGREEN}📝 TXT Output:{Colors.ENDC} {payload}")
                            await send_signal_message(payload)
                    
                    # Header zurücksetzen nach final
                    if is_final:
                        last_uso_header = None
                        
            elif isinstance(message, str):
                # Text-Nachricht (Header oder Willkommensnachricht)
                try:
                    data = json.loads(message)
                    
                    # Willkommensnachricht ignorieren
                    if data.get('type') == 'welcome' or 'connectionId' in data:
                        pass
                    # USO Header (wird im nächsten Frame gefolgt vom Payload)
                    elif 'id' in data and 'type' in data:
                        last_uso_header = data  # Speichere Header für nächste Payload
                    else:
                        # Normale Text-Nachricht
                        print(f"{Colors.OKCYAN}← Nachricht: {message[:100]}{Colors.ENDC}")
                        
                except json.JSONDecodeError:
                    # Kein JSON - könnte Text-Payload sein!
                    if last_uso_header and last_uso_header.get('type') == 'text':
                        payload = message
                        is_final = last_uso_header.get('final', True)
                        session_id = last_uso_header.get('id', 'unknown')
                        
                        # Streaming-Behandlung
                        if not is_final:
                            # Streaming-Chunk
                            if session_id not in session_buffer:
                                session_buffer[session_id] = {'chunks': [], 'chunk_count': 0}
                                print(f"\n{Colors.OKGREEN}📝 TXT Output gestartet{Colors.ENDC}")
                            
                            session = session_buffer[session_id]
                            session['chunks'].append(payload)
                            session['chunk_count'] += 1
                        else:
                            # Finales Paket
                            if session_id in session_buffer:
                                # Streaming abgeschlossen
                                session = session_buffer[session_id]
                                full_text = ''.join(session['chunks']) + payload
                                
                                print(f"\n{Colors.OKGREEN}✓ TXT Output abgeschlossen!{Colors.ENDC}")
                                print(f"  {Colors.OKCYAN}• Chunks:{Colors.ENDC} {session['chunk_count']}")
                                print(f"  {Colors.OKCYAN}• Gesamtlänge:{Colors.ENDC} {len(full_text)} Zeichen")
                                
                                # Sende vollständige Nachricht über Signal
                                await send_signal_message(full_text)
                                
                                del session_buffer[session_id]
                            else:
                                # Normales finales Paket (nicht gestreamt)
                                print(f"\n{Colors.OKGREEN}📝 TXT Output:{Colors.ENDC} {payload}")
                                await send_signal_message(payload)
                        
                        # Header zurücksetzen nach final
                        if is_final:
                            last_uso_header = None
                    else:
                        print(f"{Colors.WARNING}← Nachricht: {message[:100]}{Colors.ENDC}")
                        
    except websockets.exceptions.ConnectionClosed:
        print(f"{Colors.FAIL}✗ IoT Orchestrator WebSocket-Verbindung geschlossen{Colors.ENDC}")
    except Exception as e:
        print(f"{Colors.FAIL}✗ Fehler beim Empfangen vom IoT Orchestrator: {e}{Colors.ENDC}")

def register_device_sync():
    """
    Registriert das Device über die REST API (synchron)
    """
    import urllib.request
    import urllib.error
    
    try:
        url = f'http://{WS_HOST}:3000/api/devices'
        data = json.dumps({
            'clientId': DEVICE_NAME,
            'name': DEVICE_NAME,
            'capabilities': DEVICE_CAPABILITIES,
            'metadata': {
                'type': 'signal-client',
                'platform': sys.platform,
                'signalReceiveNumber': SIGNAL_RECEIVE_NUMBER,
                'signalSendNumber': SIGNAL_SEND_NUMBER
            }
        }).encode('utf-8')
        
        req = urllib.request.Request(
            url,
            data=data,
            headers={'Content-Type': 'application/json'}
        )
        
        with urllib.request.urlopen(req, timeout=5) as response:
            if response.status in (200, 201):
                print(f"{Colors.OKGREEN}✓ Device registriert{Colors.ENDC}")
            return True
    except urllib.error.HTTPError as e:
        print(f"{Colors.WARNING}⚠ Device-Registrierung: HTTP {e.code}{Colors.ENDC}")
        return True
    except Exception as e:
        print(f"{Colors.WARNING}⚠ Device-Registrierung fehlgeschlagen: {e}{Colors.ENDC}")
        print(f"{Colors.WARNING}   Fortsetzen...{Colors.ENDC}")
        return True

async def register_device():
    """
    Wrapper für synchrone Registrierung
    """
    import concurrent.futures
    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor() as executor:
        await loop.run_in_executor(executor, register_device_sync)

async def signal_device_client():
    """
    Hauptfunktion: Verbindet Signal und IoT Orchestrator
    """
    print_header()

    # Device registrieren
    await register_device()

    try:
        print(f"{Colors.OKCYAN}⏳ Verbinde zu IoT Orchestrator WebSocket-Gateway...{Colors.ENDC}")
        print(f"{Colors.OKCYAN}   URL: {IOT_WS_URL}{Colors.ENDC}")

        async with websockets.connect(
            IOT_WS_URL,
            ping_interval=None,  # Heartbeat vom Server
            close_timeout=10
        ) as iot_websocket:
            print(f"{Colors.OKGREEN}✓ IoT Orchestrator Verbindung hergestellt!{Colors.ENDC}\n")
            
            # Warte auf Willkommensnachricht
            print(f"{Colors.OKCYAN}⏳ Warte auf Willkommensnachricht...{Colors.ENDC}")
            try:
                welcome_msg = await asyncio.wait_for(iot_websocket.recv(), timeout=5)
                if isinstance(welcome_msg, str):
                    welcome_data = json.loads(welcome_msg)
                    connection_id = welcome_data.get('connectionId', 'unknown')
                    print(f"{Colors.OKGREEN}✓ Willkommensnachricht empfangen!{Colors.ENDC}")
                    print(f"{Colors.OKCYAN}   Connection ID: {connection_id}{Colors.ENDC}\n")
            except asyncio.TimeoutError:
                print(f"{Colors.WARNING}⚠ Keine Willkommensnachricht erhalten, aber fortfahren...{Colors.ENDC}\n")

            print(f"{Colors.BOLD}{'─'*70}{Colors.ENDC}")
            print(f"{Colors.HEADER}✅ Device verbunden und bereit{Colors.ENDC}")
            print(f"{Colors.HEADER}💡 Device '{DEVICE_NAME}' verfügbar in TXT Input/Output Nodes{Colors.ENDC}")
            print(f"{Colors.BOLD}{'─'*70}{Colors.ENDC}\n")

            # Starte Signal-Empfangs-Task im Hintergrund
            signal_receive_task = asyncio.create_task(receive_signal_messages(iot_websocket))
            
            # Starte IoT-Empfangs-Task im Hintergrund (für TXT Output)
            iot_receive_task = asyncio.create_task(receive_iot_messages(iot_websocket))

            # Warte auf beide Tasks
            try:
                await asyncio.gather(signal_receive_task, iot_receive_task)
            except asyncio.CancelledError:
                pass

    except websockets.exceptions.InvalidURI:
        print(f"{Colors.FAIL}✗ Ungültige IoT Orchestrator WebSocket-URL: {IOT_WS_URL}{Colors.ENDC}")
        print(f"{Colors.WARNING}💡 Überprüfe die Konfiguration (HOST, PORT, PATH){Colors.ENDC}\n")

    except websockets.exceptions.InvalidStatusCode as e:
        print(f"{Colors.FAIL}✗ IoT Orchestrator WebSocket-Verbindung fehlgeschlagen!{Colors.ENDC}")
        print(f"{Colors.FAIL}   Status Code: {e.status_code}{Colors.ENDC}")
        print(f"{Colors.WARNING}💡 Mögliche Ursachen:{Colors.ENDC}")
        print(f"   1. Secret nicht im Backend gespeichert")
        print(f"   2. Falscher clientId oder secret")
        print(f"   3. Backend läuft nicht")
        print(f"")
        print(f"{Colors.OKCYAN}💡 Lösung:{Colors.ENDC}")
        print(f"   Setze SIMPLE_API_KEY in docker-compose.yml:")
        print(f"     SIMPLE_API_KEY={API_KEY}")
        print(f"   Dann: docker-compose restart backend")

    except websockets.exceptions.WebSocketException as e:
        print(f"{Colors.FAIL}✗ WebSocket-Fehler: {e}{Colors.ENDC}\n")

    except ConnectionRefusedError:
        print(f"{Colors.FAIL}✗ Verbindung abgelehnt!{Colors.ENDC}")
        print(f"{Colors.WARNING}💡 Ist der Server gestartet? (docker-compose up){Colors.ENDC}\n")

    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}👋 Beende Signal Device-Client...{Colors.ENDC}")

    except Exception as e:
        print(f"{Colors.FAIL}✗ Fehler: {e}{Colors.ENDC}\n")
        import traceback
        traceback.print_exc()

    finally:
        print(f"\n{Colors.OKGREEN}✓ Signal Device-Client beendet.{Colors.ENDC}\n")

def main():
    """Entry Point"""
    try:
        # Überprüfe Python-Version
        if sys.version_info < (3, 7):
            print(f"{Colors.FAIL}✗ Python 3.7 oder höher erforderlich!{Colors.ENDC}")
            print(f"{Colors.WARNING}Aktuelle Version: {sys.version}{Colors.ENDC}\n")
            sys.exit(1)

        # Starte Programm
        asyncio.run(signal_device_client())

    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}Abgebrochen.{Colors.ENDC}\n")
    finally:
        print(f"\n{Colors.OKGREEN}✓ Test beendet.{Colors.ENDC}\n")

if __name__ == "__main__":
    main()
