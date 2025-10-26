#!/usr/bin/env python3
"""
WebSocket-Out Audio Tester
===========================
Test-Script für die WebSocket-Out-Node mit Audio-Daten (Ähnlich wie test-ws-out.py).

Dieses Script:
- Stellt einen WebSocket-Server bereit auf Port 8091
- Empfängt Audio-USOs von der WS-Out-Node
- Spielt Audio direkt ab (wenn verfügbar)

Verwendung:
    1. Passe Port im Script an: WS_PORT = 8091
    2. Führe das Script aus: python3 test-ws-out-audio.py
    3. Verbinde deine WS-Out-Node mit: ws://[DEINE_IP]:8091/endpoint
"""

import asyncio
import websockets
import json
import sys
from datetime import datetime
import subprocess
import tempfile
import os

# ======================================
# KONFIGURATION - HIER ANPASSEN
# ======================================
WS_HOST = "0.0.0.0"  # 0.0.0.0 = lauscht auf allen Interfaces
WS_PORT = 8091
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
    print(f"{Colors.HEADER}{Colors.BOLD}  WebSocket-Out Audio Tester (Server){Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*60}{Colors.ENDC}\n")
    print(f"{Colors.OKCYAN}🌐 Server:{Colors.ENDC} {WS_HOST}:{WS_PORT}{WS_PATH}")
    print(f"{Colors.OKCYAN}📝 Protokoll:{Colors.ENDC} USO mit Audio-Daten")
    print(f"{Colors.OKCYAN}📥 Modus:{Colors.ENDC} Empfängt Audio von WS-Out-Node\n")

def get_local_ips():
    """Ermittelt lokale IP-Adressen"""
    import socket
    ips = []
    try:
        hostname = socket.gethostname()
        local_ips = socket.gethostbyname_ex(hostname)[2]
        ips = [ip for ip in local_ips if not ip.startswith("127.")]
    except:
        pass
    return ips

def format_timestamp():
    """Formatiert Zeitstempel für Ausgabe"""
    return datetime.now().strftime("%H:%M:%S.%f")[:-3]

def play_audio(audio_data: bytes, sample_rate: int = 16000):
    """
    Spielt rohe PCM Audio-Daten über die Lautsprecher ab
    (wie piper_test.py)
    """
    if not audio_data or len(audio_data) == 0:
        return
    
    print(f"{Colors.OKGREEN}🔊 Spiele Audio ab ({len(audio_data)} bytes)...{Colors.ENDC}")
    
    # macOS: Konvertiere zu WAV und spiele mit afplay ab
    if sys.platform == "darwin":
        try:
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                tmp_path = tmp.name
            
            # Konvertiere raw PCM zu WAV mit ffmpeg
            process = subprocess.Popen(
                [
                    'ffmpeg',
                    '-f', 's16le',
                    '-ar', str(sample_rate),
                    '-ac', '1',
                    '-i', '-',
                    '-y',
                    tmp_path
                ],
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
            process.communicate(input=audio_data)
            
            # Spiele mit afplay ab
            subprocess.run(['afplay', tmp_path], check=True)
            os.unlink(tmp_path)
            print(f"{Colors.OKGREEN}✓ Audio abgespielt{Colors.ENDC}")
            return
        except Exception as e:
            print(f"{Colors.FAIL}afplay/ffmpeg Fehler: {e}{Colors.ENDC}")
    
    # Versuche ffplay (plattformübergreifend)
    try:
        process = subprocess.Popen(
            [
                'ffplay',
                '-f', 's16le',
                '-ar', str(sample_rate),
                '-ac', '1',
                '-nodisp',
                '-autoexit',
                '-'
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        process.communicate(input=audio_data, timeout=10)
        print(f"{Colors.OKGREEN}✓ Audio abgespielt (ffplay){Colors.ENDC}")
        return
    except Exception as e:
        pass
    
    print(f"{Colors.WARNING}⚠ Kein Audio-Player gefunden!{Colors.ENDC}")

async def handle_client(websocket):
    """
    Behandelt eine eingehende WebSocket-Verbindung
    """
    client_id = id(websocket)
    remote_address = websocket.remote_address
    
    request_path = websocket.request.path if hasattr(websocket, 'request') else "/"
    
    print(f"\n{Colors.OKGREEN}[{format_timestamp()}] ✓ Client verbunden{Colors.ENDC}")
    print(f"  {Colors.OKCYAN}→ Address:{Colors.ENDC} {remote_address[0]}:{remote_address[1]}")
    print(f"  {Colors.OKCYAN}→ Path:{Colors.ENDC} {request_path}")
    print(f"  {Colors.OKCYAN}→ Client ID:{Colors.ENDC} {client_id}")
    
    if WS_PATH and request_path != WS_PATH:
        print(f"  {Colors.WARNING}⚠️  Erwarteter Pfad: {WS_PATH}, Erhalten: {request_path}{Colors.ENDC}")
    
    print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}\n")

    message_count = 0
    audio_session_buffer = {}  # session_id -> {'chunks': [], 'metadata': {}}

    try:
        async for message in websocket:
            message_count += 1
            timestamp = format_timestamp()
            
            try:
                if isinstance(message, bytes):
                    # Binärdaten - könnten direkt Audio sein
                    print(f"{Colors.OKBLUE}[{timestamp}] 📩 Nachricht #{message_count} empfangen{Colors.ENDC}")
                    print(f"  {Colors.OKCYAN}→ Client ID:{Colors.ENDC} {client_id}")
                    print(f"  {Colors.WARNING}→ Typ:{Colors.ENDC} Binärdaten (bytes)")
                    print(f"  {Colors.WARNING}→ Größe:{Colors.ENDC} {len(message)} bytes")
                    
                    # Als Audio behandeln (16kHz, 16-bit PCM mono)
                    print(f"\n  {Colors.OKGREEN}🔊 Als Audio behandeln{Colors.ENDC}")
                    play_audio(message, sample_rate=16000)
                    
                    print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}\n")
                    
                else:
                    # Text/String - versuche als JSON zu parsen
                    try:
                        data = json.loads(message)
                        
                        # USO-Format erkannt
                        if 'header' in data and 'payload' in data:
                            header = data.get('header', {})
                            payload = data.get('payload', '')
                            
                            session_id = header.get('id', 'unknown')
                            uso_type = header.get('type', 'unknown')
                            is_final = header.get('final', True)
                            audio_meta = header.get('audioMeta', {})
                            
                            # Audio-USO?
                            if uso_type == 'audio':
                                print(f"{Colors.OKBLUE}[{timestamp}] 📩 Audio-USO #{message_count} empfangen{Colors.ENDC}")
                                print(f"  {Colors.OKCYAN}→ USO-Typ:{Colors.ENDC} Audio")
                                print(f"  {Colors.OKCYAN}→ Session ID:{Colors.ENDC} {session_id[:20]}...")
                                print(f"  {Colors.OKCYAN}→ Final:{Colors.ENDC} {is_final}")
                                
                                if audio_meta:
                                    print(f"  {Colors.OKCYAN}→ Audio-Meta:{Colors.ENDC}")
                                    print(f"      - Sample Rate: {audio_meta.get('sampleRate', 'N/A')}")
                                    print(f"      - Channels: {audio_meta.get('channels', 'N/A')}")
                                    print(f"      - Encoding: {audio_meta.get('encoding', 'N/A')}")
                                
                                # Dekodiere base64-Payload
                                audio_data = None
                                if isinstance(payload, str):
                                    try:
                                        audio_data = base64.b64decode(payload)
                                    except:
                                        pass
                                elif isinstance(payload, bytes):
                                    audio_data = payload
                                
                                if audio_data and len(audio_data) > 0:
                                    print(f"\n  {Colors.OKGREEN}🔊 Spiele Audio ab{Colors.ENDC}")
                                    play_audio(audio_data, sample_rate=audio_meta.get('sampleRate', 16000))
                                
                                print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}\n")
                            else:
                                # Anderes USO-Format
                                print(f"{Colors.OKBLUE}[{timestamp}] 📩 Nachricht #{message_count} empfangen{Colors.ENDC}")
                                print(f"  {Colors.OKCYAN}→ Client ID:{Colors.ENDC} {client_id}")
                                print(f"\n  {Colors.HEADER}→ USO-Format erkannt!{Colors.ENDC}")
                                print(f"    {Colors.OKCYAN}• USO-Typ:{Colors.ENDC} {uso_type}")
                                print(f"    {Colors.OKCYAN}• Final:{Colors.ENDC} {is_final}")
                                print(f"    {Colors.OKCYAN}• Payload:{Colors.ENDC} {str(payload)[:200]}")
                                print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}\n")
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
    
    local_ips = get_local_ips()
    if local_ips:
        print(f"{Colors.OKGREEN}✓ Lokale IP-Adressen:{Colors.ENDC}")
        for ip in local_ips:
            print(f"  {Colors.BOLD}ws://{ip}:{WS_PORT}{WS_PATH}{Colors.ENDC}")
        print()
    else:
        print(f"{Colors.WARNING}⚠️  Lokale IP konnte nicht ermittelt werden{Colors.ENDC}")
        print(f"  {Colors.WARNING}Verwende: ws://[DEINE_IP]:{WS_PORT}{WS_PATH}{Colors.ENDC}\n")
    
    print(f"{Colors.OKCYAN}⏳ Starte WebSocket-Server...{Colors.ENDC}")
    
    try:
        async with websockets.serve(handle_client, WS_HOST, WS_PORT):
            print(f"{Colors.OKGREEN}✓ Server läuft!{Colors.ENDC}\n")
            print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}")
            print(f"{Colors.HEADER}Warte auf Verbindungen von WS-Out-Node...{Colors.ENDC}")
            print(f"{Colors.HEADER}Beende mit CTRL+C{Colors.ENDC}")
            print(f"{Colors.BOLD}{'─'*60}{Colors.ENDC}\n")
            
            await asyncio.Future()
    
    except OSError as e:
        if e.errno == 48 or 'Address already in use' in str(e):
            print(f"\n{Colors.FAIL}✗ Port {WS_PORT} ist bereits belegt!{Colors.ENDC}")
            print(f"{Colors.WARNING}💡 Ändere WS_PORT im Script oder beende den anderen Prozess{Colors.ENDC}\n")
        else:
            print(f"\n{Colors.FAIL}✗ Fehler beim Starten: {e}{Colors.ENDC}\n")
    
    except Exception as e:
        print(f"\n{Colors.FAIL}✗ Unerwarteter Fehler: {e}{Colors.ENDC}\n")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    import base64  # Import für base64-Dekodierung
    
    if sys.version_info < (3, 7):
        print(f"{Colors.FAIL}✗ Python 3.7 oder höher erforderlich!{Colors.ENDC}")
        sys.exit(1)
    
    try:
        print(f"\n{Colors.OKGREEN}🚀 Starte WebSocket-Out Audio Tester...{Colors.ENDC}")
        asyncio.run(main())
    except KeyboardInterrupt:
        print(f"\n\n{Colors.WARNING}👋 Server gestoppt.{Colors.ENDC}")
    finally:
        print(f"\n{Colors.OKGREEN}✓ Test beendet.{Colors.ENDC}\n")

