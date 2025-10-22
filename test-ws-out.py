#!/usr/bin/env python3
"""
WebSocket-Out Node Tester
==========================
Test-Script für die WebSocket-Out-Node des IoT & Voice Orchestrators.
Stellt einen WebSocket-Server bereit und zeigt alle empfangenen Daten an.

Verwendung:
    1. Passe Port und Pfad im Script an:
       WS_HOST = "0.0.0.0"  # Lauscht auf allen Interfaces
       WS_PORT = 8082       # Dein gewünschter Port
       WS_PATH = "/endpoint" # Dein gewünschter Pfad
    
    2. Führe das Script aus:
       python3 test-ws-out.py
    
    3. Verbinde deine WS-Out-Node mit: ws://[DEINE_IP]:8082/endpoint
"""

import asyncio
import websockets
import json
import sys
from datetime import datetime

# ======================================
# KONFIGURATION - HIER ANPASSEN
# ======================================
WS_HOST = "0.0.0.0"  # 0.0.0.0 = lauscht auf allen Interfaces
WS_PORT = 8084
WS_PATH = "/endpoint"

# ======================================
# ENDE KONFIGURATION
# ======================================

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
    print(f"{Colors.HEADER}{Colors.BOLD}  WebSocket-Out Node Tester (Server){Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")
    print(f"{Colors.OKCYAN}🌐 Server:{Colors.ENDC} {WS_HOST}:{WS_PORT}{WS_PATH}")
    print(f"{Colors.OKCYAN}📝 Protokoll:{Colors.ENDC} USO & Text/JSON")
    print(f"{Colors.OKCYAN}📥 Modus:{Colors.ENDC} Empfängt Daten von WS-Out-Node\n")

def get_local_ips():
    """Ermittelt lokale IP-Adressen"""
    import socket
    ips = []
    try:
        # Hostname und IP-Adressen ermitteln
        hostname = socket.gethostname()
        local_ips = socket.gethostbyname_ex(hostname)[2]
        ips = [ip for ip in local_ips if not ip.startswith("127.")]
    except:
        pass
    return ips

def format_timestamp():
    """Formatiert Zeitstempel für Ausgabe"""
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]

async def handle_client(websocket):
    """
    Behandelt eine eingehende WebSocket-Verbindung
    """
    client_id = id(websocket)
    remote_address = websocket.remote_address
    
    # Pfad aus dem Request-Pfad extrahieren (websockets library speichert dies)
    request_path = websocket.request.path if hasattr(websocket, 'request') else "/"
    
    print(f"\n{Colors.OKGREEN}[{format_timestamp()}] ✓ Client verbunden{Colors.ENDC}")
    print(f"  {Colors.OKCYAN}→ Address:{Colors.ENDC} {remote_address[0]}:{remote_address[1]}")
    print(f"  {Colors.OKCYAN}→ Path:{Colors.ENDC} {request_path}")
    print(f"  {Colors.OKCYAN}→ Client ID:{Colors.ENDC} {client_id}")
    
    # Prüfe ob der Pfad korrekt ist (optional - nur Warnung ausgeben)
    if WS_PATH and request_path != WS_PATH:
        print(f"  {Colors.WARNING}⚠️  Erwarteter Pfad: {WS_PATH}, Erhalten: {request_path}{Colors.ENDC}")
    
    print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}\n")

    message_count = 0
    
    # Streaming-Buffer für zusammenhängende Chunks (final=false)
    streaming_sessions = {}  # session_id -> {'chunks': [], 'start_time': timestamp}

    try:
        async for message in websocket:
            message_count += 1
            timestamp = format_timestamp()
            
            # Versuche als JSON zu parsen
            is_streaming_chunk = False  # Flag für Streaming-Chunks
            show_message_header = True  # Flag ob Message-Header angezeigt werden soll
            
            try:
                if isinstance(message, bytes):
                    # Binärdaten - Zeige Message-Header
                    print(f"{Colors.OKBLUE}[{timestamp}] 📩 Nachricht #{message_count} empfangen{Colors.ENDC}")
                    print(f"  {Colors.OKCYAN}→ Client ID:{Colors.ENDC} {client_id}")
                    print(f"  {Colors.WARNING}→ Typ:{Colors.ENDC} Binärdaten (bytes)")
                    print(f"  {Colors.WARNING}→ Größe:{Colors.ENDC} {len(message)} bytes")
                    
                    # Erste 100 bytes als hex anzeigen
                    hex_preview = message[:100].hex()
                    if len(message) > 100:
                        hex_preview += "..."
                    print(f"  {Colors.WARNING}→ Hex-Preview:{Colors.ENDC} {hex_preview}")
                    
                    # Versuche als UTF-8 Text zu dekodieren
                    try:
                        text = message.decode('utf-8')
                        print(f"  {Colors.OKGREEN}→ Als Text:{Colors.ENDC} {text[:200]}")
                        if len(text) > 200:
                            print(f"    {Colors.WARNING}(weitere {len(text) - 200} Zeichen...){Colors.ENDC}")
                    except:
                        pass
                else:
                    # Text/String
                    # Versuche JSON zu parsen
                    try:
                        data = json.loads(message)
                        
                        # Spezielle Behandlung für USO-Format
                        if 'header' in data and 'payload' in data:
                            is_streaming_chunk = True  # USO erkannt
                            header = data.get('header', {})
                            payload = data.get('payload', '')
                            
                            session_id = header.get('id', 'unknown')
                            is_final = header.get('final', True)
                            
                            # Streaming-Erkennung
                            if not is_final:
                                # Dies ist ein Streaming-Chunk!
                                if session_id not in streaming_sessions:
                                    # ERSTER CHUNK - Zeige Message-Header und USO-Infos
                                    print(f"{Colors.OKBLUE}[{timestamp}] 📩 Nachricht #{message_count} empfangen{Colors.ENDC}")
                                    print(f"  {Colors.OKCYAN}→ Client ID:{Colors.ENDC} {client_id}")
                                    
                                    streaming_sessions[session_id] = {
                                        'chunks': [],
                                        'start_time': timestamp,
                                        'chunk_count': 0,
                                        'header_shown': False
                                    }
                                    
                                    print(f"\n  {Colors.HEADER}→ USO-Format erkannt!{Colors.ENDC}")
                                    print(f"    {Colors.OKCYAN}• USO-Typ:{Colors.ENDC} {header.get('type')}")
                                    print(f"    {Colors.OKCYAN}• Source:{Colors.ENDC} {header.get('sourceId')}")
                                    print(f"    {Colors.OKCYAN}• Session ID:{Colors.ENDC} {session_id[:20]}...")
                                    
                                    # Context anzeigen (nur beim ersten Mal)
                                    if 'context' in header:
                                        print(f"    {Colors.OKCYAN}• Context:{Colors.ENDC}")
                                        for key, value in header['context'].items():
                                            print(f"      - {key}: {value}")
                                    
                                    print(f"\n  {Colors.OKGREEN}🔥 STREAMING gestartet!{Colors.ENDC}")
                                    print(f"\n  {Colors.BOLD}AI Antwort:{Colors.ENDC} ", end='', flush=True)
                                
                                session = streaming_sessions[session_id]
                                session['chunks'].append(payload)
                                session['chunk_count'] += 1
                                
                                # Live-Anzeige: Nur der Text, kein JSON!
                                print(f"{Colors.OKGREEN}{payload}{Colors.ENDC}", end='', flush=True)
                                
                            else:
                                # Finales Paket
                                if session_id in streaming_sessions:
                                    # Streaming abgeschlossen - zeige Zusammenfassung
                                    session = streaming_sessions[session_id]
                                    full_text = ''.join(session['chunks']) + payload
                                    
                                    print(f"\n\n{Colors.OKBLUE}[{timestamp}] 📩 Final-Nachricht #{message_count} empfangen{Colors.ENDC}")
                                    print(f"  {Colors.OKGREEN}✓ STREAMING abgeschlossen!{Colors.ENDC}")
                                    print(f"    {Colors.OKCYAN}• Chunks:{Colors.ENDC} {session['chunk_count']}")
                                    print(f"    {Colors.OKCYAN}• Gesamtlänge:{Colors.ENDC} {len(full_text)} Zeichen")
                                    
                                    # Control-Daten anzeigen (z.B. AI Metadaten)
                                    if 'control' in header:
                                        control = header['control']
                                        if 'data' in control:
                                            control_data = control['data']
                                            if 'totalChunks' in control_data:
                                                print(f"    {Colors.OKCYAN}• Server-Chunks:{Colors.ENDC} {control_data['totalChunks']}")
                                            if 'totalLength' in control_data:
                                                print(f"    {Colors.OKCYAN}• Server-Länge:{Colors.ENDC} {control_data['totalLength']} Zeichen")
                                    
                                    # Session cleanup
                                    del streaming_sessions[session_id]
                                else:
                                    # Normales finales Paket (kein Streaming)
                                    print(f"{Colors.OKBLUE}[{timestamp}] 📩 Nachricht #{message_count} empfangen{Colors.ENDC}")
                                    print(f"  {Colors.OKCYAN}→ Client ID:{Colors.ENDC} {client_id}")
                                    print(f"\n  {Colors.HEADER}→ USO-Format erkannt!{Colors.ENDC}")
                                    print(f"    {Colors.OKCYAN}• USO-Typ:{Colors.ENDC} {header.get('type')}")
                                    print(f"    {Colors.OKCYAN}• Source:{Colors.ENDC} {header.get('sourceId')}")
                                    print(f"    {Colors.OKCYAN}• Final:{Colors.ENDC} {is_final}")
                                    print(f"    {Colors.OKCYAN}• Session ID:{Colors.ENDC} {session_id[:20]}...")
                                    
                                    print(f"\n  {Colors.OKGREEN}→ Payload:{Colors.ENDC}")
                                    print(f"    {payload}")
                                    
                                    # Context anzeigen
                                    if 'context' in header:
                                        print(f"\n    {Colors.OKCYAN}• Context:{Colors.ENDC}")
                                        for key, value in header['context'].items():
                                            print(f"      - {key}: {value}")
                                    
                                    # Control-Daten anzeigen
                                    if 'control' in header:
                                        control = header['control']
                                        print(f"\n    {Colors.OKCYAN}• Control-Info:{Colors.ENDC}")
                                        print(f"      - Action: {control.get('action', 'N/A')}")
                                        if 'data' in control:
                                            for key, value in control['data'].items():
                                                if key not in ['sourceDocuments', 'usedTools']:
                                                    print(f"      - {key}: {value}")
                    except json.JSONDecodeError:
                        # Kein JSON, als reinen Text anzeigen
                        print(f"{Colors.OKBLUE}[{timestamp}] 📩 Nachricht #{message_count} empfangen{Colors.ENDC}")
                        print(f"  {Colors.OKCYAN}→ Client ID:{Colors.ENDC} {client_id}")
                        print(f"  {Colors.OKGREEN}→ Format:{Colors.ENDC} Plain Text")
                        print(f"  {Colors.OKGREEN}→ Inhalt:{Colors.ENDC}")
                        preview = message[:300]
                        print(f"    {preview}")
                        if len(message) > 300:
                            print(f"    {Colors.WARNING}... (weitere {len(message) - 300} Zeichen){Colors.ENDC}")
            
            except Exception as e:
                print(f"  {Colors.FAIL}✗ Fehler beim Verarbeiten: {e}{Colors.ENDC}")
            
            # Trennlinie nur wenn es KEIN Streaming-Chunk ist
            if not is_streaming_chunk or (is_streaming_chunk and message_count == 1):
                print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}\n")
            # Bei Streaming-Chunks: keine Trennlinie zwischen den Chunks!
    
    except websockets.exceptions.ConnectionClosed:
        print(f"\n{Colors.WARNING}[{format_timestamp()}] 👋 Client getrennt{Colors.ENDC}")
        print(f"  {Colors.OKCYAN}→ Client ID:{Colors.ENDC} {client_id}")
        print(f"  {Colors.OKCYAN}→ Empfangene Nachrichten:{Colors.ENDC} {message_count}")
        print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}\n")
    
    except Exception as e:
        print(f"\n{Colors.FAIL}[{format_timestamp()}] ✗ Fehler bei Client-Verbindung{Colors.ENDC}")
        print(f"  {Colors.FAIL}→ Error:{Colors.ENDC} {e}")
        print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}\n")

async def main():
    """
    Hauptfunktion: Startet den WebSocket-Server
    """
    print_header()
    
    # Zeige lokale IP-Adressen an
    local_ips = get_local_ips()
    if local_ips:
        print(f"{Colors.OKGREEN}✓ Lokale IP-Adressen (für WS-Out-Node Konfiguration):{Colors.ENDC}")
        for ip in local_ips:
            print(f"  {Colors.BOLD}ws://{ip}:{WS_PORT}{WS_PATH}{Colors.ENDC}")
        print()
    else:
        print(f"{Colors.WARNING}⚠️  Lokale IP konnte nicht ermittelt werden{Colors.ENDC}")
        print(f"  {Colors.WARNING}Verwende: ws://[DEINE_IP]:{WS_PORT}{WS_PATH}{Colors.ENDC}\n")
    
    print(f"{Colors.OKCYAN}⏳ Starte WebSocket-Server...{Colors.ENDC}")
    
    try:
        # Starte WebSocket-Server (akzeptiert alle Pfade, Pfad-Validierung erfolgt in handle_client)
        async with websockets.serve(handle_client, WS_HOST, WS_PORT):
            print(f"{Colors.OKGREEN}✓ Server läuft!{Colors.ENDC}\n")
            print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}")
            print(f"{Colors.HEADER}Warte auf Verbindungen von WS-Out-Node...{Colors.ENDC}")
            print(f"{Colors.HEADER}Beende mit CTRL+C{Colors.ENDC}")
            print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}\n")
            
            # Server läuft für immer
            await asyncio.Future()
    
    except OSError as e:
        if e.errno == 48 or 'Address already in use' in str(e):
            print(f"\n{Colors.FAIL}✗ Port {WS_PORT} ist bereits belegt!{Colors.ENDC}")
            print(f"{Colors.WARNING}💡 Ändere WS_PORT im Script oder beende den anderen Prozess{Colors.ENDC}")
            print(f"{Colors.WARNING}💡 Finde den Prozess mit: lsof -i :{WS_PORT}{Colors.ENDC}\n")
        else:
            print(f"\n{Colors.FAIL}✗ Fehler beim Starten: {e}{Colors.ENDC}\n")
    
    except Exception as e:
        print(f"\n{Colors.FAIL}✗ Unerwarteter Fehler: {e}{Colors.ENDC}\n")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Überprüfe Python-Version
    if sys.version_info < (3, 7):
        print(f"{Colors.FAIL}✗ Python 3.7 oder höher erforderlich!{Colors.ENDC}")
        print(f"{Colors.WARNING}Aktuelle Version: {sys.version}{Colors.ENDC}\n")
        sys.exit(1)
    
    try:
        print(f"\n{Colors.OKGREEN}🚀 Starte WebSocket-Out Tester...{Colors.ENDC}")
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n\n{Colors.WARNING}👋 Server gestoppt.{Colors.ENDC}")
    finally:
        print(f"\n{Colors.OKGREEN}✓ Test beendet.{Colors.ENDC}\n")

