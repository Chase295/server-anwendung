#!/usr/bin/env python3
"""
Device Client mit Mikrofon und Lautsprecher
===========================================
Python-Client für das IoT Orchestrator System

Dieses Script erstellt ein gerät, das:
- Als IoT Device mit Mikrofon und Lautsprecher registriert wird
- Mit WebSocket-Gateway (Port 8080) verbunden ist
- Audio über WebSocket-Gateway sendet und empfängt
- In Mic- und Speaker-Nodes auswählbar ist

Verwendung:
    1. Passe Konfiguration an (DEVICE_NAME, WS_HOST, etc.)
    2. Installiere Abhängigkeiten: pip install pyaudio websockets
    3. Stelle sicher, dass client_secret_python-voice-device in der DB gespeichert ist
    4. Führe aus: python3 device-client.py
"""

import asyncio
import websockets
import json
import sys
import threading
import queue
import time
from datetime import datetime
from typing import Optional

# Audio-Bibliotheken
try:
    import pyaudio
except ImportError:
    print("❌ PyAudio nicht installiert!")
    print("   Installiere mit: pip install pyaudio")
    print("   Auf macOS: brew install portaudio && pip install pyaudio")
    sys.exit(1)

import subprocess
import tempfile
import os

# ======================================
# KONFIGURATION - HIER ANPASSEN
# ======================================
WS_HOST = "esp32.local.chase295.de"
WS_PORT = 443  # WebSocket Gateway Port
WS_PATH = "/ws/external"

# Geräte-Informationen  
DEVICE_NAME = "python-voice-device"  # Name des Gerätes

# Globaler API Key (aus .env oder hier festlegen)
# Setze in docker-compose.yml: SIMPLE_API_KEY=dein-api-key
# Oder hier:
API_KEY = os.getenv("SIMPLE_API_KEY", "default-api-key-123")

# ======================================
# GERÄTE-FÄHIGKEITEN (CAPABILITIES)
# ======================================
# Definiere hier die Fähigkeiten dieses Gerätes
# Verfügbare Capabilities:
#   - 'mic': Mikrofon-Eingabe (Audio senden)
#   - 'speaker': Lautsprecher-Ausgabe (Audio empfangen)
#   - 'txt_input': Text-Eingabe (Text senden)
#   - 'txt_output': Text-Ausgabe (Text empfangen)
DEVICE_CAPABILITIES = [
    'mic',           # Mikrofon vorhanden
    'speaker',       # Lautsprecher vorhanden
    'txt_output',    # Text-Ausgabe verfügbar
    'txt_input',     # Text-Eingabe verfügbar
]

# Audio-Konfiguration (nur relevant wenn 'mic' oder 'speaker' aktiv ist)
SAMPLE_RATE = 16000    # 16kHz für Vosk STT optimal
CHANNELS = 1          # Mono
CHUNK_SIZE = 8000     # Frames pro Buffer
FORMAT = pyaudio.paInt16  # 16-bit PCM

# ======================================
# ENDE KONFIGURATION
# ======================================

# Vollständige WebSocket-URL mit Authentifizierung
WS_URL = f"ws://{WS_HOST}:{WS_PORT}{WS_PATH}?clientId={DEVICE_NAME}&secret={API_KEY}"

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
    print(f"{Colors.HEADER}{Colors.BOLD}  IoT Orchestrator Device Client{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}\n")
    print(f"{Colors.OKCYAN}📱 Gerät:{Colors.ENDC} {DEVICE_NAME}")
    print(f"{Colors.OKCYAN}🔗 Verbindung:{Colors.ENDC} {WS_URL}")
    print(f"{Colors.OKCYAN}🎵 Audio-Format:{Colors.ENDC} {SAMPLE_RATE}Hz, {CHANNELS}ch, 16-bit PCM")
    print(f"{Colors.OKCYAN}📦 Chunk-Größe:{Colors.ENDC} {CHUNK_SIZE} samples\n")
    print(f"{Colors.WARNING}💡 WICHTIG:{Colors.ENDC}")
    print(f"   {Colors.OKCYAN}• Verbindet zu WebSocket-Gateway (Port {WS_PORT}){Colors.ENDC}")
    
    # Zeige aktive Capabilities
    cap_icons = {
        'mic': '🎤',
        'speaker': '🔊',
        'txt_input': '📝 Input',
        'txt_output': '📤 Output'
    }
    active_caps = [f"{cap_icons.get(cap, '•')} {cap}" for cap in DEVICE_CAPABILITIES]
    print(f"   {Colors.OKCYAN}• Verfügbare Fähigkeiten: {', '.join(active_caps)}{Colors.ENDC}")
    print(f"   {Colors.OKCYAN}• Device '{DEVICE_NAME}' in entsprechenden Nodes auswählbar{Colors.ENDC}\n")
    print(f"{Colors.WARNING}💡 Bedienung:{Colors.ENDC}")
    print(f"   {Colors.OKGREEN}• Enter-Taste:{Colors.ENDC} Mikrofon-Audio senden")
    print(f"   {Colors.OKGREEN}• 't' + Enter:{Colors.ENDC} Text-Eingabe-Modus")
    print(f"   {Colors.OKGREEN}• q + Enter:{Colors.ENDC} Programm beenden")
    print(f"   {Colors.OKGREEN}• Lautsprecher:{Colors.ENDC} Empfängt automatisch Audio")
    print(f"   {Colors.OKGREEN}• TXT Output:{Colors.ENDC} Zeigt Text-Ausgaben in der Console\n")

def create_uso_audio_header(final: bool = False) -> dict:
    """
    Erstellt einen USO-Header für Audio-Daten
    WICHTIG: sourceId muss mit der deviceId in der Mic-Node übereinstimmen!
    """
    header = {
        "id": f"audio_{DEVICE_NAME}_{int(datetime.now().timestamp() * 1000)}",
        "type": "audio",
        "sourceId": DEVICE_NAME,  # WICHTIG: Muss mit Mic-Node deviceId übereinstimmen!
        "timestamp": int(datetime.now().timestamp() * 1000),
        "final": final,
        "audioMeta": {
            "sampleRate": SAMPLE_RATE,
            "channels": CHANNELS,
            "encoding": "pcm_s16le",
            "bitDepth": 16,
            "format": "int16",
            "endianness": "little"
        }
    }
    return header

def play_audio(audio_data: bytes, sample_rate: int = 16000):
    """
    Spielt rohe PCM Audio-Daten über die Lautsprecher ab
    """
    if not audio_data or len(audio_data) == 0:
        return
    
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
            return
        except Exception as e:
            pass
    
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
        return
    except Exception as e:
        pass

def play_audio_data(audio_data: bytes, sample_rate: int = 16000):
    """
    Wrapper für play_audio - spielt Audio in Background-Thread
    """
    import threading
    
    def play_in_background():
        play_audio(audio_data, sample_rate)
    
    # Spielt in Background-Thread ab (nicht blockierend)
    thread = threading.Thread(target=play_in_background, daemon=True)
    thread.start()

class AudioStreamer:
    """Audio-Streaming Klasse mit PyAudio"""

    def __init__(self):
        self.audio = None
        self.stream = None
        self.audio_queue = queue.Queue()
        self.is_recording = False
        self.recording_active = False  # Wird von Enter-Taste gesteuert
        self.header_sent = False  # Flag: Header wurde gesendet
        self.sample_silence_threshold = 100

    def initialize_audio(self):
        """Initialisiert PyAudio und den Audio-Stream"""
        try:
            self.audio = pyaudio.PyAudio()

            # Audio-Stream öffnen
            self.stream = self.audio.open(
                format=FORMAT,
                channels=CHANNELS,
                rate=SAMPLE_RATE,
                input=True,
                frames_per_buffer=CHUNK_SIZE
            )

            print(f"{Colors.OKGREEN}✓ Mikrofon initialisiert{Colors.ENDC}")
            print(f"  {Colors.OKCYAN}→ Sample Rate:{Colors.ENDC} {SAMPLE_RATE} Hz")
            print(f"  {Colors.OKCYAN}→ Channels:{Colors.ENDC} {CHANNELS}")
            print(f"  {Colors.OKCYAN}→ Format:{Colors.ENDC} 16-bit PCM\n")

            return True
        except Exception as e:
            print(f"{Colors.FAIL}✗ Fehler bei Mikrofon-Initialisierung: {e}{Colors.ENDC}")
            return False

    def start_recording_session(self):
        """Startet eine Aufnahme-Session"""
        self.recording_active = True
        print(f"\n{Colors.OKGREEN}🎤 Aufnahme gestartet...{Colors.ENDC}")
        print(f"{Colors.WARNING}Drücke Enter erneut zum Stoppen der Aufnahme{Colors.ENDC}\n")

    def stop_recording_session(self):
        """Stoppt die aktuelle Aufnahme-Session"""
        self.recording_active = False
        print(f"\n{Colors.WARNING}⏹️  Aufnahme beendet{Colors.ENDC}\n")

    def start_recording(self):
        """Startet die Audio-Aufnahme in einem separaten Thread"""
        if not self.stream:
            if not self.initialize_audio():
                return False

        self.is_recording = True

        def record_thread():
            """Aufnahme-Thread"""
            last_session_active = False

            while self.is_recording:
                try:
                    # Audio-Daten lesen (immer, um Buffer nicht zu überlaufen)
                    data = self.stream.read(CHUNK_SIZE, exception_on_overflow=False)

                    # Prüfe ob Aufnahme aktiv ist
                    if not self.recording_active:
                        # Session beenden wenn aktiv
                        if last_session_active:
                            self.header_sent = False
                        last_session_active = False
                        time.sleep(0.1)
                        continue
                    
                    # WICHTIG: Nur Chunks in Queue werfen, wenn:
                    # 1. Aufnahme ist aktiv UND
                    # 2. Header wurde bereits gesendet
                    if self.header_sent:
                        # Audio-Chunk in Queue speichern
                        self.audio_queue.put(("audio", data))
                    
                    last_session_active = True

                except Exception as e:
                    print(f"{Colors.FAIL}✗ Fehler bei Audio-Aufnahme: {e}{Colors.ENDC}")
                    break

            print(f"\n{Colors.WARNING}⏹️  Audio-Aufnahme beendet{Colors.ENDC}")

        # Thread starten
        thread = threading.Thread(target=record_thread, daemon=True)
        thread.start()
        return True

    def stop_recording(self):
        """Stoppt die Audio-Aufnahme"""
        self.is_recording = False
        if self.stream:
            self.stream.stop_stream()
            self.stream.close()
        if self.audio:
            self.audio.terminate()

    def get_audio_data(self):
        """Holt Audio-Daten aus der Queue"""
        try:
            return self.audio_queue.get_nowait()
        except queue.Empty:
            return None

class KeyboardInput:
    """Keyboard-Input Handler"""

    def __init__(self):
        self.input_queue = queue.Queue()
        self.text_input_active = False  # Flag für Text-Eingabe-Modus

    def start(self):
        """Startet Keyboard-Input in separatem Thread"""
        def input_thread():
            while True:
                try:
                    line = input().strip()
                    self.input_queue.put(line)
                except EOFError:
                    break
                except:
                    break

        thread = threading.Thread(target=input_thread, daemon=True)
        thread.start()

    def get_input(self):
        """Holt Keyboard-Input aus der Queue"""
        try:
            return self.input_queue.get_nowait()
        except queue.Empty:
            return None

async def send_text_data(websocket, keyboard_input: KeyboardInput):
    """
    Sendet Text als USO an WebSocket-Gateway
    Wird aufgerufen wenn 't' eingegeben wird
    """
    try:
        while True:
            await asyncio.sleep(0.1)
            
            # Prüfe ob Text-Eingabe aktiv ist
            if not keyboard_input.text_input_active:
                continue
            
            # Hole Input aus der Queue
            text = keyboard_input.get_input()
            if text is None:
                await asyncio.sleep(0.05)
                continue
            
            print(f"{Colors.OKCYAN}→ Text-Modus: Input erhalten '{text}'{Colors.ENDC}")
            
            # Wechsel zu Audio-Modus wenn 'a'
            if text.lower() == 'a':
                keyboard_input.text_input_active = False
                print(f"{Colors.OKCYAN}→ Wechsel zu Audio-Modus{Colors.ENDC}")
                print(f"{Colors.OKCYAN}   (Drücke Enter zum Starten/Stoppen){Colors.ENDC}")
                continue
            
            # Text senden als USO
            if text:
                session_id = f"txt_{DEVICE_NAME}_{int(datetime.now().timestamp() * 1000)}"
                
                # USO Header erstellen
                header = {
                    "id": session_id,
                    "type": "text",
                    "sourceId": DEVICE_NAME,
                    "timestamp": int(datetime.now().timestamp() * 1000),
                    "final": True
                }
                
                # Header als JSON senden
                header_json = json.dumps(header)
                print(f"{Colors.OKCYAN}→ Sende Header: {header_json[:100]}{Colors.ENDC}")
                await websocket.send(header_json)
                
                # Payload senden (als String!)
                print(f"{Colors.OKCYAN}→ Sende Payload: {text[:100]}{Colors.ENDC}")
                await websocket.send(text)
                
                print(f"{Colors.OKGREEN}✓ Text gesendet:{Colors.ENDC} {text[:100]}")
    
    except websockets.exceptions.ConnectionClosed:
        print(f"{Colors.FAIL}✗ Verbindung geschlossen{Colors.ENDC}")
    except Exception as e:
        print(f"{Colors.FAIL}✗ Fehler beim Senden: {e}{Colors.ENDC}")

async def send_audio_data(websocket, audio_streamer: AudioStreamer):
    """
    Sendet RAW Audio-Daten an WebSocket-Gateway (ohne Header!)
    Der Gateway erstellt automatisch den USO-Header (wie WS In Node)
    """
    chunk_count = 0
    last_recording_state = False

    try:
        while True:
            await asyncio.sleep(0.05)
            
            # Prüfe ob recording_active sich geändert hat
            current_recording = audio_streamer.recording_active
            
            if current_recording and not last_recording_state:
                # Aufnahme gestartet
                print(f"{Colors.OKCYAN}→ Starte RAW Audio Streaming...{Colors.ENDC}")
                print(f"{Colors.OKCYAN}   (Gateway erstellt automatisch USO-Header){Colors.ENDC}")
                
                # Leere alle alten Chunks
                while True:
                    data = audio_streamer.get_audio_data()
                    if data is None:
                        break
                
                # Erlaube Audio-Thread Chunks in die Queue zu werfen
                audio_streamer.header_sent = True
                
                # Warte auf erste Chunks
                await asyncio.sleep(0.05)
                
                chunk_count = 0
                last_recording_state = True
            
            elif not current_recording and last_recording_state:
                # Aufnahme gestoppt
                print(f"{Colors.OKCYAN}→ Audio-Stream beendet (insgesamt {chunk_count} RAW Chunks){Colors.ENDC}")
                audio_streamer.header_sent = False
                chunk_count = 0
                last_recording_state = False
                continue
            
            # Wenn Aufnahme aktiv, sende RAW Audio-Chunks
            if current_recording:
                data = audio_streamer.get_audio_data()
                if data:
                    data_type, payload = data
                    
                    if data_type == "audio":
                        # Sende NUR RAW AUDIO (kein Header!)
                        await websocket.send(payload)
                        chunk_count += 1
                        
                        if chunk_count % 100 == 0:
                            print(f"{Colors.OKGREEN}✓ {chunk_count} RAW Audio-Chunks gesendet{Colors.ENDC}")

    except websockets.exceptions.ConnectionClosed:
        print(f"{Colors.FAIL}✗ Verbindung geschlossen{Colors.ENDC}")
    except Exception as e:
        print(f"{Colors.FAIL}✗ Fehler beim Senden: {e}{Colors.ENDC}")

async def receive_messages(websocket, audio_streamer: AudioStreamer):
    """
    Empfängt Nachrichten vom WebSocket-Server (Speaker Audio & TXT Output)
    Behandelt USO-Protokoll: Header (JSON) + Payload (separate Frames)
    Ähnlich wie WebSocket Gateway in backend
    """
    last_uso_header = None  # Speichert letzten Header (für zwei-Phasen Protokoll)
    session_buffer = {}  # Session-Buffer für Streaming (sessionId -> text)
    
    try:
        async for message in websocket:
            if isinstance(message, (bytes, bytearray)):
                # Binary-Daten = Payload (Audio oder Binary-Daten)
                if last_uso_header and last_uso_header.get('type') == 'audio':
                    # Audio-Daten direkt abspielen
                    print(f"{Colors.OKGREEN}🔊 Spiele {len(message)} Bytes Audio ab...{Colors.ENDC}")
                    play_audio_data(message, sample_rate=16000)
                elif last_uso_header and last_uso_header.get('type') == 'text':
                    # Text-Payload für TXT Output
                    payload = message.decode('utf-8')
                    is_final = last_uso_header.get('final', True)
                    session_id = last_uso_header.get('id', 'unknown')
                    
                    # Streaming-Behandlung
                    if not is_final:
                        # Streaming-Chunk (Token-für-Token wie ChatGPT!)
                        if session_id not in session_buffer:
                            session_buffer[session_id] = {'chunks': [], 'chunk_count': 0}
                            print(f"\n{Colors.OKGREEN}📝 TXT Output gestartet{Colors.ENDC}")
                            print(f"{Colors.OKCYAN}→ Text:{Colors.ENDC} ", end='', flush=True)
                        
                        session = session_buffer[session_id]
                        session['chunks'].append(payload)
                        session['chunk_count'] += 1
                        
                        # Live-Anzeige: Nur der Text, kein JSON! (wie test-ws-out.py)
                        print(f"{Colors.OKGREEN}{payload}{Colors.ENDC}", end='', flush=True)
                    else:
                        # Finales Paket
                        if session_id in session_buffer:
                            # Streaming abgeschlossen
                            session = session_buffer[session_id]
                            full_text = ''.join(session['chunks']) + payload
                            
                            print(f"\n\n{Colors.OKGREEN}✓ TXT Output abgeschlossen!{Colors.ENDC}")
                            print(f"  {Colors.OKCYAN}• Chunks:{Colors.ENDC} {session['chunk_count']}")
                            print(f"  {Colors.OKCYAN}• Gesamtlänge:{Colors.ENDC} {len(full_text)} Zeichen")
                            
                            del session_buffer[session_id]
                        else:
                            # Normales finales Paket (nicht gestreamt)
                            print(f"\n{Colors.OKGREEN}📝 TXT Output:{Colors.ENDC} {payload}")
                    
                    # Header zurücksetzen nach final
                    if is_final:
                        last_uso_header = None
                else:
                    # Unbekannte Binary-Daten
                    print(f"{Colors.WARNING}← Binary-Daten (ohne Header){Colors.ENDC}")
                    
            elif isinstance(message, str):
                # Text-Nachricht (Header, Payload oder Willkommensnachricht)
                try:
                    data = json.loads(message)
                    
                    # Willkommensnachricht ignorieren
                    if data.get('type') == 'welcome' or 'connectionId' in data:
                        pass
                    # USO Header (wird im nächsten Frame gefolgt vom Payload)
                    elif 'id' in data and 'type' in data:
                        last_uso_header = data  # Speichere Header für nächste Payload
                        # Warte auf Payload (kommt im nächsten Frame)
                    else:
                        # Normale Text-Nachricht
                        print(f"{Colors.OKCYAN}← Nachricht: {message[:100]}{Colors.ENDC}")
                except json.JSONDecodeError:
                    # Kein JSON - könnte Text-Payload sein!
                    if last_uso_header and last_uso_header.get('type') == 'text':
                        # Text-Payload (als String!)
                        payload = message
                        is_final = last_uso_header.get('final', True)
                        session_id = last_uso_header.get('id', 'unknown')
                        
                        # Streaming-Behandlung
                        if not is_final:
                            # Streaming-Chunk (Token-für-Token wie ChatGPT!)
                            if session_id not in session_buffer:
                                session_buffer[session_id] = {'chunks': [], 'chunk_count': 0}
                                print(f"\n{Colors.OKGREEN}📝 TXT Output gestartet{Colors.ENDC}")
                                print(f"{Colors.OKCYAN}→ Text:{Colors.ENDC} ", end='', flush=True)
                            
                            session = session_buffer[session_id]
                            session['chunks'].append(payload)
                            session['chunk_count'] += 1
                            
                            # Live-Anzeige: Nur der Text, kein JSON! (wie test-ws-out.py)
                            print(f"{Colors.OKGREEN}{payload}{Colors.ENDC}", end='', flush=True)
                        else:
                            # Finales Paket
                            if session_id in session_buffer:
                                # Streaming abgeschlossen
                                session = session_buffer[session_id]
                                full_text = ''.join(session['chunks']) + payload
                                
                                print(f"\n\n{Colors.OKGREEN}✓ TXT Output abgeschlossen!{Colors.ENDC}")
                                print(f"  {Colors.OKCYAN}• Chunks:{Colors.ENDC} {session['chunk_count']}")
                                print(f"  {Colors.OKCYAN}• Gesamtlänge:{Colors.ENDC} {len(full_text)} Zeichen")
                                
                                del session_buffer[session_id]
                            else:
                                # Normales finales Paket (nicht gestreamt)
                                print(f"\n{Colors.OKGREEN}📝 TXT Output:{Colors.ENDC} {payload}")
                        
                        # Header zurücksetzen nach final
                        if is_final:
                            last_uso_header = None
                    else:
                        print(f"{Colors.WARNING}← Nachricht: {message[:100]}{Colors.ENDC}")
                    
    except websockets.exceptions.ConnectionClosed:
        pass
    except Exception as e:
        print(f"{Colors.FAIL}✗ Fehler beim Empfangen: {e}{Colors.ENDC}")

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
                'type': 'python-client',
                'platform': sys.platform
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

async def device_client():
    """
    Hauptfunktion: Verbindet zum WebSocket-Gateway als Device
    """
    print_header()

    # Device registrieren
    await register_device()

    # Audio-Streamer initialisieren
    audio_streamer = AudioStreamer()

    try:
        print(f"{Colors.OKCYAN}⏳ Verbinde zu WebSocket-Gateway...{Colors.ENDC}")
        print(f"{Colors.OKCYAN}   URL: {WS_URL}{Colors.ENDC}")

        async with websockets.connect(
            WS_URL,
            ping_interval=None,  # Heartbeat vom Server
            close_timeout=10
        ) as websocket:
            print(f"{Colors.OKGREEN}✓ Verbindung hergestellt!{Colors.ENDC}\n")
            
            # Warte auf Willkommensnachricht
            print(f"{Colors.OKCYAN}⏳ Warte auf Willkommensnachricht...{Colors.ENDC}")
            try:
                welcome_msg = await asyncio.wait_for(websocket.recv(), timeout=5)
                if isinstance(welcome_msg, str):
                    welcome_data = json.loads(welcome_msg)
                    connection_id = welcome_data.get('connectionId', 'unknown')
                    print(f"{Colors.OKGREEN}✓ Willkommensnachricht empfangen!{Colors.ENDC}")
                    print(f"{Colors.OKCYAN}   Connection ID: {connection_id}{Colors.ENDC}\n")
            except asyncio.TimeoutError:
                print(f"{Colors.WARNING}⚠ Keine Willkommensnachricht erhalten, aber fortfahren...{Colors.ENDC}\n")

            # Starte Audio-Aufnahme
            if not audio_streamer.start_recording():
                print(f"{Colors.FAIL}✗ Audio-Aufnahme konnte nicht gestartet werden{Colors.ENDC}")
                return

            print(f"{Colors.BOLD}{'─'*70}{Colors.ENDC}")
            print(f"{Colors.HEADER}✅ Device verbunden und bereit{Colors.ENDC}")
            
            # Zeige aktive Capabilities
            cap_icons = {
                'mic': 'Mic',
                'speaker': 'Speaker',
                'txt_input': 'Device TXT Input',
                'txt_output': 'Device TXT Output'
            }
            active_caps = [cap_icons.get(cap, cap) for cap in DEVICE_CAPABILITIES]
            print(f"{Colors.HEADER}💡 Device '{DEVICE_NAME}' verfügbar in: {', '.join(active_caps)} Nodes{Colors.ENDC}")
            
            # Zeige Bedienung basierend auf aktiven Capabilities
            if 'mic' in DEVICE_CAPABILITIES:
                print(f"{Colors.HEADER}💡 Drücke Enter zum Starten/Stoppen der Audio-Aufnahme{Colors.ENDC}")
            if 'txt_input' in DEVICE_CAPABILITIES:
                print(f"{Colors.HEADER}💡 Drücke 't' + Enter für Text-Eingabe{Colors.ENDC}")
            print(f"{Colors.HEADER}💡 Drücke 'q' + Enter zum Beenden{Colors.ENDC}")
            print(f"{Colors.BOLD}{'─'*70}{Colors.ENDC}\n")

            # Keyboard-Input starten
            keyboard_input = KeyboardInput()
            keyboard_input.start()

            # Starte Empfangs-Task im Hintergrund
            receive_task = asyncio.create_task(receive_messages(websocket, audio_streamer))

            # Starte Send-Task im Hintergrund (Audio)
            send_task = asyncio.create_task(send_audio_data(websocket, audio_streamer))
            
            # Starte Text-Send-Task im Hintergrund
            send_text_task = asyncio.create_task(send_text_data(websocket, keyboard_input))

            # Hauptschleife für Keyboard-Input
            running = True
            while running:
                await asyncio.sleep(0.1)
                
                # Hole Input aus der Queue
                user_input = keyboard_input.get_input()
                if user_input is None:
                    continue
                
                # 'q' beendet IMMER das Programm (egal in welchem Modus)
                if user_input.lower() == 'q':
                    print(f"{Colors.WARNING}👋 Beende Verbindung...{Colors.ENDC}")
                    running = False
                    continue
                
                # Text-Modus aktiv - Input zurück in Queue legen damit send_text_data ihn bekommt
                if keyboard_input.text_input_active:
                    print(f"{Colors.OKCYAN}→ Lege Input zurück in Queue für Text-Modus: '{user_input}'{Colors.ENDC}")
                    keyboard_input.input_queue.put(user_input)
                    continue
                
                # Audio-Modus: Verarbeite Inputs
                if user_input.lower() == 't':
                    # Text-Modus aktivieren
                    keyboard_input.text_input_active = True
                    print(f"\n{Colors.OKCYAN}📝 Text-Modus aktiviert{Colors.ENDC}")
                    print(f"{Colors.OKCYAN}   Gib Text ein und drücke Enter zum Senden{Colors.ENDC}")
                    print(f"{Colors.OKCYAN}   'q' + Enter zum Beenden, 'a' + Enter für Audio-Modus{Colors.ENDC}\n")
                else:
                    # Enter-Taste gedrückt - Toggle Audio-Aufnahme
                    if not audio_streamer.recording_active:
                        audio_streamer.start_recording_session()
                    else:
                        audio_streamer.stop_recording_session()

            # Tasks beenden
            send_task.cancel()
            send_text_task.cancel()
            receive_task.cancel()
            
            try:
                await send_task
            except asyncio.CancelledError:
                pass
                
            try:
                await send_text_task
            except asyncio.CancelledError:
                pass
                
            try:
                await receive_task
            except asyncio.CancelledError:
                pass

    except websockets.exceptions.InvalidURI:
        print(f"{Colors.FAIL}✗ Ungültige WebSocket-URL: {WS_URL}{Colors.ENDC}")
        print(f"{Colors.WARNING}💡 Überprüfe die Konfiguration (HOST, PORT, PATH){Colors.ENDC}\n")

    except websockets.exceptions.InvalidStatusCode as e:
        print(f"{Colors.FAIL}✗ WebSocket-Verbindung fehlgeschlagen!{Colors.ENDC}")
        print(f"{Colors.FAIL}   Status Code: {e.status_code}{Colors.ENDC}")
        print(f"{Colors.WARNING}💡 Mögliche Ursachen:{Colors.ENDC}")
        print(f"   1. Secret nicht im Backend gespeichert")
        print(f"   2. Falscher clientId oder secret")
        print(f"   3. Backend läuft nicht")
        print(f"")
        print(f"{Colors.OKCYAN}💡 Lösung (EINFACH - nur EINEN API Key!):{Colors.ENDC}")
        print(f"   Setze SIMPLE_API_KEY in docker-compose.yml:")
        print(f"     SIMPLE_API_KEY={API_KEY}")
        print(f"   Dann: docker-compose restart backend")
        print(f"")
        print(f"   ODER setze den Key hier in device-client.py direkt.")

    except websockets.exceptions.WebSocketException as e:
        print(f"{Colors.FAIL}✗ WebSocket-Fehler: {e}{Colors.ENDC}\n")

    except ConnectionRefusedError:
        print(f"{Colors.FAIL}✗ Verbindung abgelehnt!{Colors.ENDC}")
        print(f"{Colors.WARNING}💡 Ist der Server gestartet? (docker-compose up){Colors.ENDC}\n")

    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}👋 Beende Device-Client...{Colors.ENDC}")

    except Exception as e:
        print(f"{Colors.FAIL}✗ Fehler: {e}{Colors.ENDC}\n")
        import traceback
        traceback.print_exc()

    finally:
        # Audio-Streaming stoppen
        audio_streamer.stop_recording()
        print(f"\n{Colors.OKGREEN}✓ Device-Client beendet.{Colors.ENDC}\n")

def main():
    """Entry Point"""
    try:
        # Überprüfe Python-Version
        if sys.version_info < (3, 7):
            print(f"{Colors.FAIL}✗ Python 3.7 oder höher erforderlich!{Colors.ENDC}")
            print(f"{Colors.WARNING}Aktuelle Version: {sys.version}{Colors.ENDC}\n")
            sys.exit(1)

        # Starte Programm
        asyncio.run(device_client())

    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}Abgebrochen.{Colors.ENDC}\n")
    finally:
        print(f"\n{Colors.OKGREEN}✓ Test beendet.{Colors.ENDC}\n")

if __name__ == "__main__":
    main()
