#!/usr/bin/env python3
"""
WebSocket-In Audio Node Tester
===============================
Test-Script für die WebSocket-In-Node des IoT & Voice Orchestrators.
Streamt Audio vom Mikrofon zur WS-In-Node für STT-Verarbeitung.

Verwendung:
    1. Trage deine Context-Informationen im Script ein:
       CONTEXT_PERSON = "Dein Name"
       CONTEXT_LOCATION = "Dein Standort"
       CONTEXT_CLIENT = "Dein Gerät"

    2. Passe Audio-Einstellungen an:
       SAMPLE_RATE = 16000  # Für Vosk STT optimal
       CHANNELS = 1         # Mono für STT
       CHUNK_SIZE = 1024    # Audio-Frame-Größe

    3. Führe das Script aus:
       python3 test-ws-in-audio.py

    4. Sprich ins Mikrofon - Audio wird an WS-In-Node gestreamt

Voraussetzungen:
    - PyAudio: pip install pyaudio
    - WebSocket-Client: pip install websockets
    - Aktive WS-In-Node auf Port 8081 mit Audio-Modus
"""

import asyncio
import websockets
import json
import uuid
import sys
import threading
import queue
import time
from datetime import datetime

# Audio-Bibliotheken
try:
    import pyaudio
except ImportError:
    print("❌ PyAudio nicht installiert!")
    print("   Installiere mit: pip install pyaudio")
    print("   Auf macOS: brew install portaudio && pip install pyaudio")
    sys.exit(1)

# ======================================
# KONFIGURATION - HIER ANPASSEN
# ======================================
WS_HOST = "localhost"
WS_PORT = 8081  # WebSocket Gateway Port (nicht WS-In-Node Port)
WS_PATH = "/ws/external"     # Leerer Path für Gateway

# Authentifizierung - HIER DEINE WERTE EINTRAGEN!
CLIENT_ID = "python_audio_client"        # Client ID für Authentifizierung
CLIENT_SECRET = "test_secret_123"        # Client Secret für Authentifizierung

# Context-Informationen - HIER DEINE WERTE EINTRAGEN!
CONTEXT_PERSON = "Moritz Haslbeck"      # Name der Person
CONTEXT_LOCATION = "Schlafzimmer 1.OG"       # Standort/Raum
CONTEXT_CLIENT = "Laptop xyz"           # Geräte-Name

# Audio-Konfiguration
SAMPLE_RATE = 16000    # 16kHz für Vosk STT optimal
CHANNELS = 1          # Mono
CHUNK_SIZE = 8000     # Frames pro Buffer (wie vosk-mic-test.py)
FORMAT = pyaudio.paInt16  # 16-bit PCM

# ======================================
# ENDE KONFIGURATION
# ======================================

# Vollständige WebSocket-URL mit Authentifizierung
WS_URL = f"ws://{WS_HOST}:{WS_PORT}{WS_PATH}?clientId={CLIENT_ID}&secret={CLIENT_SECRET}"

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
    print(f"{Colors.HEADER}{Colors.BOLD}  WebSocket-In Audio Node Tester{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}\n")
    print(f"{Colors.OKCYAN}🎤 Audio-Modus:{Colors.ENDC} Mikrofon → WebSocket-Gateway → Flow → STT")
    print(f"{Colors.OKCYAN}📡 Verbindung:{Colors.ENDC} ws://{WS_HOST}:{WS_PORT}{WS_PATH}")
    print(f"{Colors.OKCYAN}🔑 Client ID:{Colors.ENDC} {CLIENT_ID}")
    print(f"{Colors.OKCYAN}🎵 Audio-Format:{Colors.ENDC} {SAMPLE_RATE}Hz, {CHANNELS}ch, 16-bit PCM")
    print(f"{Colors.OKCYAN}📦 Chunk-Größe:{Colors.ENDC} {CHUNK_SIZE} samples\n")

def create_uso_audio_header(context_person: str = "", context_location: str = "", context_client: str = "") -> str:
    """
    Erstellt einen USO-Header für Audio-Daten

    Args:
        context_person: Name der Person (optional)
        context_location: Standort (optional)
        context_client: Client-Name (optional)

    Returns:
        JSON-String des Headers
    """
    # USO Header erstellen
    header = {
        "id": str(uuid.uuid4()),
        "type": "audio",
        "sourceId": CLIENT_ID,
        "timestamp": int(datetime.now().timestamp() * 1000),
        "final": False,  # Wird nur beim Beenden auf True gesetzt
        "audioMeta": {
            "sampleRate": SAMPLE_RATE,
            "channels": CHANNELS,
            "encoding": "pcm_s16le",
            "bitDepth": 16,
            "format": "int16",  # Format spezifizieren
            "endianness": "little"  # Little-endian spezifizieren
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

    return json.dumps(header)

class AudioStreamer:
    """Audio-Streaming Klasse mit PyAudio"""

    def __init__(self):
        self.audio = None
        self.stream = None
        self.audio_queue = queue.Queue()
        self.is_recording = False
        self.sample_silence_threshold = 100  # Schwellwert für Stille

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
            print(f"  {Colors.OKCYAN}→ Chunk Size:{Colors.ENDC} {CHUNK_SIZE} samples (8KB chunks like vosk-mic-test.py)")
            print(f"  {Colors.OKCYAN}→ Format:{Colors.ENDC} 16-bit PCM\n")

            return True
        except Exception as e:
            print(f"{Colors.FAIL}✗ Fehler bei Mikrofon-Initialisierung: {e}{Colors.ENDC}")
            return False

    def start_recording(self):
        """Startet die Audio-Aufnahme in einem separaten Thread"""
        if not self.stream:
            if not self.initialize_audio():
                return False

        self.is_recording = True

        def record_thread():
            """Aufnahme-Thread"""
            print(f"{Colors.OKGREEN}🎤 Starte Audio-Aufnahme...{Colors.ENDC}")
            print(f"{Colors.WARNING}💡 Sprich ins Mikrofon (STRG+C zum Beenden){Colors.ENDC}\n")

            session_id = None
            chunk_count = 0

            while self.is_recording:
                try:
                    # Audio-Daten lesen
                    data = self.stream.read(CHUNK_SIZE, exception_on_overflow=False)
                    chunk_count += 1

                    # Prüfe auf Stille (optional - kann auskommentiert werden)
                    if self._is_silent(data):
                        continue

                    # Ersten Chunk senden (Header + Audio)
                    if chunk_count == 1:
                        # Header erstellen
                        header_json = create_uso_audio_header(
                            CONTEXT_PERSON,
                            CONTEXT_LOCATION,
                            CONTEXT_CLIENT
                        )
                        session_id = json.loads(header_json)["id"]
                        self.audio_queue.put(("header", header_json))

                    # Audio-Chunk senden
                    self.audio_queue.put(("audio", data))

                except Exception as e:
                    print(f"{Colors.FAIL}✗ Fehler bei Audio-Aufnahme: {e}{Colors.ENDC}")
                    break

            # Signal zum Beenden senden
            if session_id:
                self.audio_queue.put(("stop", None))

            print(f"\n{Colors.WARNING}⏹️  Audio-Aufnahme beendet{Colors.ENDC}")

        # Thread starten
        thread = threading.Thread(target=record_thread, daemon=True)
        thread.start()
        return True

    def _is_silent(self, data):
        """Prüft ob Audio-Daten Stille enthalten"""
        # Konvertiere zu Int16 und prüfe Amplitude
        import array
        samples = array.array('h', data)
        amplitude = max(abs(sample) for sample in samples)
        return amplitude < self.sample_silence_threshold

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

async def send_audio_data(websocket, audio_streamer: AudioStreamer):
    """
    Sendet Audio-Daten an WebSocket-Server
    WICHTIG: Sendet nur rohe Audio-Binärdaten (keine JSON-Header!)
    Die WS_In-Node erwartet das USO-Protokoll, aber wir senden direkt Audio.

    Args:
        websocket: Die WebSocket-Verbindung
        audio_streamer: AudioStreamer-Instanz
    """
    session_id = None
    chunk_count = 0

    try:
        while True:
            # Hole Daten aus der Queue
            data = audio_streamer.get_audio_data()
            if data is None:
                await asyncio.sleep(0.01)  # Kurze Pause
                continue

            data_type, payload = data

            if data_type == "header":
                # IGNORIERE Header - senden nur Audio-Daten!
                session_id = json.loads(payload)["id"]
                print(f"{Colors.OKBLUE}→ Session gestartet (ID: {session_id[:8]}...){Colors.ENDC}")
                print(f"{Colors.WARNING}⚠️  Header wird NICHT gesendet - nur Audio-Daten!{Colors.ENDC}")

            elif data_type == "audio":
                # Audio-Chunk direkt senden (rohe Binärdaten)
                await websocket.send(payload)
                chunk_count += 1
                print(f"{Colors.OKGREEN}✓ Audio-Chunk #{chunk_count} gesendet ({len(payload)} bytes){Colors.ENDC}")

            elif data_type == "stop":
                # Beenden-Signal empfangen - keine weiteren Daten senden
                print(f"{Colors.OKCYAN}→ Audio-Stream beendet (insgesamt {chunk_count} Chunks){Colors.ENDC}")
                break

    except websockets.exceptions.ConnectionClosed:
        print(f"{Colors.FAIL}✗ Verbindung geschlossen{Colors.ENDC}")
    except Exception as e:
        print(f"{Colors.FAIL}✗ Fehler beim Senden: {e}{Colors.ENDC}")

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

async def interactive_audio_client():
    """
    Hauptfunktion: Verbindet zum WebSocket-Server und streamt Audio
    """
    print_header()

    # Context-Informationen aus den Konfigurationsvariablen verwenden
    context_person = CONTEXT_PERSON
    context_location = CONTEXT_LOCATION
    context_client = CONTEXT_CLIENT

    # Anzeige der konfigurierten Context-Informationen
    print(f"{Colors.OKGREEN}✓ Authentifizierung & Context:{Colors.ENDC}")
    print(f"  🔑 Client ID: {Colors.BOLD}{CLIENT_ID}{Colors.ENDC}")
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

    # Audio-Streamer initialisieren
    audio_streamer = AudioStreamer()

    try:
        print(f"{Colors.OKCYAN}⏳ Verbinde zu {WS_URL}...{Colors.ENDC}")

        async with websockets.connect(WS_URL) as websocket:
            print(f"{Colors.OKGREEN}✓ Verbindung hergestellt!{Colors.ENDC}\n")

            # Starte Audio-Aufnahme
            if not audio_streamer.start_recording():
                print(f"{Colors.FAIL}✗ Audio-Aufnahme konnte nicht gestartet werden{Colors.ENDC}")
                return

            print(f"{Colors.BOLD}{'─'*70}{Colors.ENDC}")
            print(f"{Colors.HEADER}🎤 Audio-Streaming läuft...{Colors.ENDC}")
            print(f"{Colors.HEADER}STRG+C zum Beenden{Colors.ENDC}")
            print(f"{Colors.BOLD}{'─'*70}{Colors.ENDC}\n")

            # Starte Empfangs-Task im Hintergrund
            receive_task = asyncio.create_task(receive_messages(websocket))

            # Sende Audio-Daten
            await send_audio_data(websocket, audio_streamer)

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
        print(f"{Colors.WARNING}💡 Ist die WS-In-Node im Flow aktiv und auf Audio gestellt?{Colors.ENDC}\n")

    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}👋 Beende Audio-Streaming...{Colors.ENDC}")

    except Exception as e:
        print(f"{Colors.FAIL}✗ Fehler: {e}{Colors.ENDC}\n")
        import traceback
        traceback.print_exc()

    finally:
        # Audio-Streaming stoppen
        audio_streamer.stop_recording()
        print(f"\n{Colors.OKGREEN}✓ Audio-Test beendet.{Colors.ENDC}\n")

def main():
    """Entry Point"""
    try:
        # Überprüfe Python-Version
        if sys.version_info < (3, 7):
            print(f"{Colors.FAIL}✗ Python 3.7 oder höher erforderlich!{Colors.ENDC}")
            print(f"{Colors.WARNING}Aktuelle Version: {sys.version}{Colors.ENDC}\n")
            sys.exit(1)

        # Starte Programm
        asyncio.run(interactive_audio_client())

    except KeyboardInterrupt:
        print(f"\n{Colors.WARNING}Abgebrochen.{Colors.ENDC}\n")
    finally:
        print(f"\n{Colors.OKGREEN}✓ Test beendet.{Colors.ENDC}\n")

if __name__ == "__main__":
    main()
