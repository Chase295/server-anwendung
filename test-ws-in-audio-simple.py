#!/usr/bin/env python3
"""
Einfacher Audio-Test für WS-IN Node
====================================
Sendet nur einen Header und dann Audio-Daten zur WS-IN Node
"""

import asyncio
import websockets
import json
import uuid
import sys
from datetime import datetime
import pyaudio
import time

# Konfiguration
WS_HOST = "localhost"
WS_PORT = 8081
WS_PATH = "/ws/external"
SAMPLE_RATE = 16000
CHANNELS = 1
CHUNK_SIZE = 1024

WS_URL = f"ws://{WS_HOST}:{WS_PORT}{WS_PATH}"

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def create_audio_header():
    """Erstellt einen einfachen USO-Header für Audio"""
    header = {
        "id": str(uuid.uuid4()),
        "type": "audio",
        "sourceId": "test_client",
        "timestamp": int(datetime.now().timestamp() * 1000),
        "final": False,
        "audioMeta": {
            "sampleRate": SAMPLE_RATE,
            "channels": CHANNELS,
            "encoding": "pcm_s16le",
            "bitDepth": 16
        }
    }
    return json.dumps(header), header["id"]

async def simple_audio_test():
    """Einfacher Audio-Test"""
    print(f"{Colors.OKCYAN}🎤 Einfacher Audio-Test{Colors.ENDC}")
    print(f"Verbindung: {WS_URL}")

    # Audio initialisieren
    audio = pyaudio.PyAudio()
    stream = audio.open(
        format=pyaudio.paInt16,
        channels=CHANNELS,
        rate=SAMPLE_RATE,
        input=True,
        frames_per_buffer=CHUNK_SIZE
    )

    try:
        async with websockets.connect(WS_URL) as websocket:
            print(f"{Colors.OKGREEN}✓ Verbunden!{Colors.ENDC}")

            # Header erstellen und senden
            header_json, session_id = create_audio_header()
            print(f"Header: {header_json}")
            await websocket.send(header_json)
            print(f"{Colors.OKBLUE}→ Header gesendet{Colors.ENDC}")

            # Kurz warten
            await asyncio.sleep(0.1)

            # Audio-Daten senden
            print(f"{Colors.OKGREEN}🎤 Sende Audio-Daten...{Colors.ENDC}")
            for i in range(10):  # 10 Chunks senden
                data = stream.read(CHUNK_SIZE, exception_on_overflow=False)
                await websocket.send(data)
                print(f"{Colors.OKGREEN}✓ Audio-Chunk {i+1} gesendet ({len(data)} bytes){Colors.ENDC}")
                await asyncio.sleep(0.1)

            # Finalen Header senden
            final_header = json.dumps({
                "id": session_id,
                "type": "audio",
                "sourceId": "test_client",
                "timestamp": int(datetime.now().timestamp() * 1000),
                "final": True,
                "audioMeta": {
                    "sampleRate": SAMPLE_RATE,
                    "channels": CHANNELS,
                    "encoding": "pcm_s16le",
                    "bitDepth": 16
                }
            })
            await websocket.send(final_header)
            print(f"{Colors.OKCYAN}→ Final-Header gesendet{Colors.ENDC}")

            # Kurz warten
            await asyncio.sleep(1)

    except Exception as e:
        print(f"{Colors.FAIL}✗ Fehler: {e}{Colors.ENDC}")

    finally:
        stream.stop_stream()
        stream.close()
        audio.terminate()
        print(f"{Colors.OKGREEN}✓ Test beendet{Colors.ENDC}")

if __name__ == "__main__":
    asyncio.run(simple_audio_test())
