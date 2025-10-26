#!/usr/bin/env python3
"""
Piper TTS Client
Verbindet sich mit externem Piper Server und spielt Audio ab
"""

import asyncio
import websockets
import subprocess
import sys
import json

# Konfiguration
PIPER_WS_URL = "ws://100.64.0.103:5002"

async def text_to_speech(text):
    """
    Sendet Text an Piper Server und empfängt Audio-Stream
    
    Args:
        text: Der zu sprechende Text
    
    Returns:
        Audio-Daten als bytes
    """
    print(f"Verbinde mit Piper Server: {PIPER_WS_URL}")
    
    try:
        async with websockets.connect(PIPER_WS_URL) as websocket:
            print(f"✓ Verbindung hergestellt")
            print(f"Sende Text: '{text}'")
            
            # Sende Text (Server akzeptiert Plain Text)
            await websocket.send(text)
            
            # Empfange Audio-Daten
            print("Warte auf Audio-Daten...")
            audio_data = await websocket.recv()
            
            if isinstance(audio_data, bytes):
                print(f"✓ Audio empfangen: {len(audio_data)} bytes")
                return audio_data
            else:
                print(f"✗ Unerwartete Antwort: {audio_data}")
                return None
                
    except websockets.exceptions.WebSocketException as e:
        print(f"✗ WebSocket-Fehler: {e}")
        return None
    except Exception as e:
        print(f"✗ Fehler: {e}")
        return None

def play_audio(audio_data):
    """
    Spielt rohe PCM Audio-Daten über die Lautsprecher ab
    
    Args:
        audio_data: Rohe PCM Audio-Daten (16kHz, 16-bit, mono)
    """
    if not audio_data or len(audio_data) == 0:
        print("✗ Keine Audio-Daten zum Abspielen")
        return
    
    print(f"\nSpiele Audio ab ({len(audio_data)} bytes)...")
    
    # macOS: Konvertiere zu WAV und spiele mit afplay ab
    if sys.platform == "darwin":
        try:
            import tempfile
            import os
            
            with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
                tmp_path = tmp.name
            
            # Konvertiere raw PCM zu WAV mit ffmpeg
            process = subprocess.Popen(
                [
                    'ffmpeg',
                    '-f', 's16le',
                    '-ar', '16000',
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
            print("✓ Audio abgespielt")
            return
        except FileNotFoundError as e:
            print(f"⚠ ffmpeg/afplay nicht gefunden: {e}")
        except Exception as e:
            print(f"afplay/ffmpeg Fehler: {e}")
    
    # Versuche ffplay (plattformübergreifend) - mit sichtbarem Output für Debugging
    try:
        # Piper gibt raw PCM aus: 16kHz, 16-bit signed, mono
        process = subprocess.Popen(
            [
                'ffplay',
                '-f', 's16le',          # Format: signed 16-bit little endian
                '-ar', '16000',         # Sample Rate: 16kHz
                '-ac', '1',             # Channels: mono
                '-nodisp',              # Kein Video-Fenster
                '-autoexit',            # Automatisch beenden
                '-'                     # Lese von stdin
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE
        )
        stdout, stderr = process.communicate(input=audio_data)
        if stderr:
            print(f"ffplay stderr: {stderr.decode()[:200]}")
        print("✓ Audio abgespielt (ffplay)")
        return
    except FileNotFoundError:
        print("⚠ ffplay nicht gefunden")
    except Exception as e:
        print(f"ffplay Fehler: {e}")
    
    # Versuche aplay (Linux)
    try:
        process = subprocess.Popen(
            [
                'aplay',
                '-f', 'S16_LE',     # Format: signed 16-bit little endian
                '-r', '16000',       # Sample Rate: 16kHz
                '-c', '1',           # Channels: mono
                '-'                  # Lese von stdin
            ],
            stdin=subprocess.PIPE,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
        process.communicate(input=audio_data)
        print("✓ Audio abgespielt")
        return
    except FileNotFoundError:
        pass
    except Exception as e:
        print(f"aplay Fehler: {e}")
    
    # Versuche afplay (macOS) - benötigt WAV-Konvertierung
    try:
        # Konvertiere raw PCM zu WAV mit ffmpeg
        import tempfile
        import os
        
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
            tmp_path = tmp.name
        
        # Konvertiere mit ffmpeg zu WAV
        process = subprocess.Popen(
            [
                'ffmpeg',
                '-f', 's16le',
                '-ar', '16000',
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
        print("✓ Audio abgespielt")
        return
    except FileNotFoundError:
        pass
    except Exception as e:
        print(f"afplay/ffmpeg Fehler: {e}")
    
    # Fallback: Speichere als raw PCM Datei
    print("\n⚠ Kein Audio-Player gefunden!")
    print("Speichere als output.raw...")
    with open('output.raw', 'wb') as f:
        f.write(audio_data)
    print("✓ Audio gespeichert als output.raw")
    print("\nAbspielen mit:")
    print("  ffplay -f s16le -ar 16000 -ac 1 output.raw")
    print("  aplay -f S16_LE -r 16000 -c 1 output.raw")
    print("\nInstalliere einen Player:")
    print("  - Linux: sudo apt-get install ffmpeg")
    print("  - macOS: brew install ffmpeg")
    print("  - Windows: winget install ffmpeg")

async def main_async():
    """Hauptfunktion (async)"""
    
    # Prüfe Argumente
    if len(sys.argv) < 2:
        print("=" * 60)
        print("Piper TTS Client")
        print("=" * 60)
        print("\nVerwendung:")
        print("  python piper_test.py 'Dein Text hier'")
        print("\nBeispiele:")
        print("  python piper_test.py 'Hallo Welt'")
        print("  python piper_test.py 'Guten Tag, wie geht es dir?'")
        print(f"\nServer: {PIPER_WS_URL}")
        print("=" * 60)
        sys.exit(1)
    
    # Text aus Argumenten
    text = sys.argv[1]
    
    print("=" * 60)
    print("Piper TTS Client")
    print("=" * 60)
    print()
    
    # Text zu Audio konvertieren
    audio_data = await text_to_speech(text)
    
    if audio_data and len(audio_data) > 0:
        play_audio(audio_data)
        print("\n" + "=" * 60)
        print("✓ Fertig!")
        print("=" * 60)
    else:
        print("\n" + "=" * 60)
        print("✗ Fehler: Keine Audio-Daten erhalten")
        print("=" * 60)
        print("\nPrüfe:")
        print(f"  - Ist der Server erreichbar? {PIPER_WS_URL}")
        print("  - Läuft der Server? sudo systemctl status piper-tts.service")
        print("  - Server-Logs: sudo journalctl -u piper-tts.service -f")
        sys.exit(1)

def main():
    """Entry Point"""
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        print("\n\n✗ Abgebrochen")
        sys.exit(0)
    except Exception as e:
        print(f"\n✗ Unerwarteter Fehler: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()