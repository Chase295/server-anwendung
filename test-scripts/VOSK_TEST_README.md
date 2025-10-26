# Vosk WebSocket Client - Live Mikrofon Test (Fließtext-Modus)

Dieser Client dient zum Testen der Verbindung zu einem externen Vosk-WebSocket-Server für Speech-to-Text Verarbeitung in Echtzeit. Im **Fließtext-Modus** zeigt er kontinuierlichen Text an, während du sprichst.

## 🚀 Schnellstart

### 1. Voraussetzungen

Installiere die erforderlichen Python-Pakete:

```bash
pip install websocket-client sounddevice numpy
```

### 2. Vosk-Server starten

Stelle sicher, dass ein Vosk-Server auf `ws://100.64.0.102:2700/` läuft.

### 3. Client starten

#### Option A: Shell-Script verwenden (empfohlen)
```bash
./vosk-mic-test.sh
```

#### Option B: Python-Script direkt ausführen
```bash
python3 vosk-mic-test.py
```

## 📋 Features

### ✅ Live-Mikrofon-Streaming
- Echtzeit-Audio-Erfassung vom Standard-Mikrofon
- 16-bit PCM, Mono, 16000 Hz Format
- Automatische Audio-Device-Auswahl

### ✅ Fließtext-Modus
- **Kontinuierlicher Textfluss** - zeigt Sprache als laufenden Text an
- **Teilergebnisse** (partial) werden live als Vorschau angezeigt
- **Automatischer Zeilenumbruch** bei langen Sätzen
- **Intelligente Formatierung** mit Konfidenz-basierten Farben

### ✅ Advanced Audio Processing
- **Multi-Threading** für optimale Performance
- **Queue-basierte** Audio-Verarbeitung
- **Non-blocking** Audio-Callbacks
- **Little-Endian** Byte-Order-Korrektur

### ✅ Flexible Konfiguration
```python
# Audio-Einstellungen
SAMPLE_RATE = 16000      # 16kHz (optimal für Vosk)
CHANNELS = 1            # Mono
CHUNK_SIZE = 8000       # Bytes pro Chunk

# Display-Optionen
SHOW_PARTIAL = True     # Zeige Teilergebnisse während des Sprechens
SHOW_CONFIDENCE = False # Zeige Wort-Konfidenz-Scores

# Audio-Device (optional)
DEVICE = None          # None = Standard-Device, oder z.B. 0 für externes Mikrofon
```

## 📡 WebSocket-Protokoll

### 1. Verbindung aufbauen
```json
ws://100.64.0.102:2700/
```

### 2. Konfiguration senden
```json
{
  "config": {
    "sample_rate": 16000,
    "words": true
  }
}
```

### 3. Audio-Daten streamen
- Rohe 16-bit PCM Bytes als Binärdaten
- Little-Endian Format
- Kontinuierliche Übertragung in Chunks

### 4. Ergebnisse empfangen

**Teilergebnisse (partial) - während des Sprechens:**
```json
{
  "partial": "Das ist ein"
}
```

**Finale Ergebnisse (text) - bei Satzendenerkennung:**
```json
{
  "text": "Das ist ein Test.",
  "result": [
    {"word": "Das", "conf": 0.95},
    {"word": "ist", "conf": 0.89},
    {"word": "ein", "conf": 0.92},
    {"word": "Test", "conf": 0.87}
  ]
}
```

## 🎯 Verwendung

### 1. Script starten
```bash
./vosk-mic-test.sh
```

### 2. Erwartete Ausgabe
```
  Vosk Live-Transkription (Fließtext-Modus)
=================================================================

📡 Server: ws://100.64.0.102:2700/
🎵 Format: 16000Hz, 16-bit PCM LE, Mono

⏳ Verbinde zu ws://100.64.0.102:2700/...
✓ Verbunden!

──────────────────────────────────────────────────────────────────────
🎙️  Spreche jetzt... (STRG+C zum Beenden)
──────────────────────────────────────────────────────────────────────

Das ist ein Test für die kontinuierliche Spracherkennung...
```

### 3. Sprechen und Transkription
- **Während des Sprechens:** Teilergebnisse werden in gedimmter Farbe angezeigt
- **Bei Satzende:** Finaler Text wird in normaler Farbe hinzugefügt
- **Lange Sätze:** Automatischer Zeilenumbruch bei 80 Zeichen
- **Konfidenz-Farben:** Grün (>90%), Cyan (70-90%), Gelb (<70%)

## ⚙️ Konfiguration

### Audio-Device ändern
```python
# In vosk-mic-test.py:
DEVICE = 0  # Erstes Mikrofon
# DEVICE = 1  # Zweites Mikrofon
# DEVICE = None  # Standard-Mikrofon
```

### Display-Optionen
```python
SHOW_PARTIAL = True    # Zeige Teilergebnisse (empfohlen)
SHOW_PARTIAL = False   # Nur finale Ergebnisse

SHOW_CONFIDENCE = True  # Zeige Wort-Konfidenz-Farben
SHOW_CONFIDENCE = False # Einfacher Text
```

### Performance-Optimierung
```python
CHUNK_SIZE = 8000      # Standard: 8000 Bytes
CHUNK_SIZE = 16000     # Höhere Latenz, stabiler
CHUNK_SIZE = 4000      # Niedrigere Latenz, CPU-intensiver
```

## 🔧 Troubleshooting

### ❌ "Kein Mikrofon gefunden"
- Prüfe verfügbare Audio-Devices:
  ```bash
  python3 -c "import sounddevice as sd; print(sd.query_devices())"
  ```
- Setze DEVICE auf die korrekte Device-ID
- Prüfe Mikrofon-Berechtigungen (macOS/Linux)

### ❌ "Verbindung abgelehnt"
- Prüfe Vosk-Server: `telnet 100.64.0.102 2700`
- Überprüfe Firewall-Einstellungen
- Stelle sicher, dass der Vosk-Server läuft

### ❌ "Audio-Format Fehler"
- Prüfe Audio-Device Format-Kompatibilität
- Stelle sicher, dass Sample-Rate 16000Hz ist
- Prüfe, dass das Device Mono-Audio liefert

### ❌ "Performance-Probleme"
- Reduziere CHUNK_SIZE für niedrigere Latenz
- Deaktiviere SHOW_CONFIDENCE für einfachere Anzeige
- Prüfe CPU-Auslastung des Vosk-Servers

## 📖 Technische Details

### Multi-Threading Architektur
```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ Mikrofon    │───▶│ Audio-Queue  │───▶│ Sender-     │
│ (Callback)  │    │ (threading)  │    │ Thread      │
└─────────────┘    └──────────────┘    └─────────────┘
                                                │
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│ WebSocket   │◀───│ Receiver-    │◀───│ Vosk-Server │
│ Receiver    │    │ Loop         │    │ (ws://...)  │
│ (main)      │    │ (main thread)│    └─────────────┘
└─────────────┘    └──────────────┘
```

### Audio-Verarbeitung
1. **Mikrofon-Capture:** sounddevice → numpy array
2. **Format-Konvertierung:** Little-Endian, 16-bit PCM
3. **Queue-basierte Übertragung:** Thread-sichere Audio-Daten
4. **Binary WebSocket:** Optimale Performance ohne Encoding-Overhead

### Fließtext-Algorithmus
1. **Partial-Erkennung:** Live-Vorschau während des Sprechens
2. **Satz-Ende-Erkennung:** Automatische Erkennung von Pausen
3. **Text-Konkatenation:** Nahtloser Übergang zwischen Sätzen
4. **Zeilenumbruch:** Intelligente Formatierung langer Texte

## 🎨 Farb-Codierung

| Farbe | Bedeutung | Verwendung |
|-------|-----------|------------|
| 🟢 Grün | Hohe Konfidenz (>90%) | Korrekte Worterkennung |
| 🔵 Cyan | Mittlere Konfidenz (70-90%) | Gute Erkennung |
| 🟡 Gelb | Niedrige Konfidenz (<70%) | Unsichere Erkennung |
| 🔘 Gedimmt | Teilergebnisse | Live-Vorschau |

## 📊 Performance-Optimierung

### Für niedrige Latenz:
```python
CHUNK_SIZE = 4000      # Schnellere Reaktion
SHOW_PARTIAL = False   # Weniger CPU-Last
SHOW_CONFIDENCE = False # Einfachere Anzeige
```

### Für hohe Genauigkeit:
```python
CHUNK_SIZE = 16000     # Stabile Übertragung
SHOW_CONFIDENCE = True  # Detaillierte Analyse
SAMPLE_RATE = 16000    # Maximale Vosk-Kompatibilität
```

## 🔗 Integration

Das Script ist speziell für externe Vosk-Server konzipiert und bietet:

- **Zero-Configuration** Setup
- **Auto-Discovery** von Audio-Devices
- **Real-time** Performance-Monitoring
- **Graceful Shutdown** mit EOF-Signal

Perfekt für Testing, Debugging und Integration in andere Anwendungen! 🎙️✨
