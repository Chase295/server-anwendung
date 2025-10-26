#!/usr/bin/env python3
"""
Vosk WebSocket Client - Live Mikrofon Streaming (Fließtext-Modus)
===================================================================
Zeigt Sprache als kontinuierlichen Fließtext an.
"""

import websocket
import json
import sys
import time
from datetime import datetime
import sounddevice as sd
import numpy as np
import threading
import queue

# ======================================
# KONFIGURATION
# ======================================
VOSK_HOST = "100.64.0.102"
VOSK_PORT = 2700
VOSK_URI = f"ws://{VOSK_HOST}:{VOSK_PORT}"

SAMPLE_RATE = 16000
CHANNELS = 1
DTYPE = 'int16'
CHUNK_SIZE = 8000

DEVICE = None  # None = default, oder z.B. 0 für iPhone-Mikrofon
SHOW_PARTIAL = True  # Zeige auch Teil-Ergebnisse (während du sprichst)
SHOW_CONFIDENCE = False  # Zeige Konfidenz-Scores
# ======================================

class Colors:
    HEADER = '\033[95m'
    OKBLUE = '\033[94m'
    OKCYAN = '\033[96m'
    OKGREEN = '\033[92m'
    WARNING = '\033[93m'
    FAIL = '\033[91m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'

audio_queue = queue.Queue()
ws = None
transcript_buffer = []  # Puffer für den Fließtext

def print_header():
    print(f"\n{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}  Vosk Live-Transkription (Fließtext-Modus){Colors.ENDC}")
    print(f"{Colors.HEADER}{Colors.BOLD}{'='*70}{Colors.ENDC}\n")
    print(f"{Colors.OKCYAN}📡 Server:{Colors.ENDC} {VOSK_URI}")
    print(f"{Colors.OKCYAN}🎵 Format:{Colors.ENDC} {SAMPLE_RATE}Hz, 16-bit PCM LE, Mono\n")

def audio_callback(indata, frames, time, status):
    """Audio-Callback - NON-BLOCKING"""
    if status:
        print(f"{Colors.WARNING}⚠️  {status}{Colors.ENDC}", file=sys.stderr)
    
    audio_data = np.frombuffer(indata, dtype=np.int16)
    
    if len(audio_data.shape) > 1 and audio_data.shape[1] > 1:
        audio_data = audio_data[:, 0]
    
    if audio_data.dtype.byteorder == '>':
        audio_data = audio_data.byteswap().newbyteorder('<')
    
    audio_queue.put(audio_data.tobytes())

def send_thread_func(ws_app):
    """Sender-Thread"""
    while True:
        try:
            data = audio_queue.get()
            if data is None:
                break
            ws_app.send(data, opcode=websocket.ABNF.OPCODE_BINARY)
        except Exception:
            break

def format_text_with_confidence(result):
    """Formatiert Text mit optionalen Konfidenz-Farben"""
    if not SHOW_CONFIDENCE or "result" not in result:
        return result.get("text", "")
    
    words = result["result"]
    formatted = []
    
    for word_info in words:
        word = word_info["word"]
        conf = word_info.get("conf", 1.0)
        
        # Farbe basierend auf Konfidenz
        if conf > 0.9:
            color = Colors.OKGREEN
        elif conf > 0.7:
            color = Colors.OKCYAN
        else:
            color = Colors.WARNING
        
        formatted.append(f"{color}{word}{Colors.ENDC}")
    
    return " ".join(formatted)

def stream_microphone():
    """Hauptfunktion"""
    print_header()
    global ws

    frames_per_buffer = CHUNK_SIZE // 2

    try:
        print(f"{Colors.OKCYAN}⏳ Verbinde zu {VOSK_URI}...{Colors.ENDC}")
        ws = websocket.create_connection(VOSK_URI, timeout=10)
        print(f"{Colors.OKGREEN}✓ Verbunden!{Colors.ENDC}\n")

        # Config senden
        config = {"config": {"sample_rate": SAMPLE_RATE, "words": True}}
        ws.send(json.dumps(config))

        # Sende-Thread starten
        sender_thread = threading.Thread(target=send_thread_func, args=(ws,), daemon=True)
        sender_thread.start()

        print(f"{Colors.BOLD}{'─'*70}{Colors.ENDC}")
        print(f"{Colors.HEADER}🎙️  Spreche jetzt... (STRG+C zum Beenden){Colors.ENDC}")
        print(f"{Colors.BOLD}{'─'*70}{Colors.ENDC}\n")

        # Mikrofon-Stream starten
        with sd.InputStream(samplerate=SAMPLE_RATE,
                           channels=CHANNELS,
                           dtype=DTYPE,
                           device=DEVICE,
                           blocksize=frames_per_buffer,
                           callback=audio_callback):

            current_line = ""
            line_length = 0
            MAX_LINE_LENGTH = 80  # Zeichen pro Zeile

            while True:
                response = ws.recv()
                result = json.loads(response)

                # Teil-Ergebnis (während du sprichst)
                if SHOW_PARTIAL and "partial" in result:
                    partial_text = result["partial"].strip()
                    if partial_text:
                        # Zeige Partial in hellerer Farbe, ohne neue Zeile
                        preview = f"{Colors.DIM}{partial_text}...{Colors.ENDC}"
                        print(f"\r{current_line}{preview}", end="", flush=True)

                # Finales Ergebnis (Satz abgeschlossen)
                elif "text" in result and result["text"]:
                    final_text = result["text"].strip()
                    
                    if final_text:
                        # Lösche Partial-Preview
                        print(f"\r{' ' * (line_length + 50)}\r", end="")
                        
                        # Formatiere Text (mit oder ohne Konfidenz)
                        if SHOW_CONFIDENCE:
                            formatted_text = format_text_with_confidence(result)
                        else:
                            formatted_text = final_text
                        
                        # Füge zum aktuellen Satz hinzu
                        if current_line:
                            current_line += " " + formatted_text
                        else:
                            current_line = formatted_text
                        
                        line_length = len(current_line)
                        
                        # Automatischer Zeilenumbruch bei langen Sätzen
                        if line_length > MAX_LINE_LENGTH:
                            print(current_line)
                            current_line = ""
                            line_length = 0
                        else:
                            # Zeige aktuellen Satz
                            print(f"\r{current_line}", end="", flush=True)

    except KeyboardInterrupt:
        # Zeige letzten Satz komplett
        if current_line:
            print(f"\n{current_line}")
        print(f"\n{Colors.WARNING}✓ Transkription beendet.{Colors.ENDC}")

    except Exception as e:
        print(f"\n{Colors.FAIL}✗ Fehler: {e}{Colors.ENDC}")
        import traceback
        traceback.print_exc()

    finally:
        audio_queue.put(None)
        
        if ws and ws.connected:
            try:
                ws.send('{"eof" : 1}')
                time.sleep(0.3)
                response = ws.recv()
                result = json.loads(response)
                if "text" in result and result["text"]:
                    final = result["text"].strip()
                    if final:
                        print(f"\n{Colors.OKGREEN}[Final] {final}{Colors.ENDC}")
            except:
                pass
            ws.close()
        
        print()

if __name__ == "__main__":
    if sys.version_info < (3, 7):
        print(f"{Colors.FAIL}✗ Python 3.7+ erforderlich!{Colors.ENDC}")
        sys.exit(1)

    try:
        import websocket
        import sounddevice
        import numpy
    except ImportError as e:
        print(f"{Colors.FAIL}✗ Fehlende Abhängigkeit: {e.name}{Colors.ENDC}")
        sys.exit(1)

    stream_microphone()