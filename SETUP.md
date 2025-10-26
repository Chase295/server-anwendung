# 🚀 Komplette Setup-Anleitung

Vollständige Anleitung für die Einrichtung des IoT & Voice Orchestrator Servers - lokal oder über Reverse Proxy.

## 📋 Inhalt

- [Lokales Setup](#lokales-setup)
- [Reverse Proxy Setup](#reverse-proxy-setup)
- [CORS-Konfiguration](#cors-konfiguration)
- [Debug-Events konfigurieren](#debug-events-konfigurieren)
- [Troubleshooting](#troubleshooting)

---

## Lokales Setup

### 1. Container starten

```bash
docker-compose up -d
```

### 2. Zugriff

- Frontend: http://localhost:3001
- Backend: http://localhost:3000/api
- Login: `admin` / `admin`

**Fertig!** Keine weiteren Konfigurationen nötig.

---

## Reverse Proxy Setup

### Übersicht

Wenn Sie die Anwendung über einen Reverse Proxy (z.B. Nginx) betreiben möchten:

```
https://ihre-domain.de → Nginx → Docker Container
```

### Nginx Konfiguration

Kopieren Sie `nginx.conf.example` und passen Sie die Domain an:

```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/iot-orchestrator
sudo nano /etc/nginx/sites-available/iot-orchestrator
```

**Anpassen:**
- `server_name` → Ihre Domain
- SSL-Zertifikate → Pfade anpassen

### Wichtige Routes

```nginx
# Frontend
location / {
    proxy_pass http://localhost:3001;
    ...
}

# Backend API
location /api/ {
    proxy_pass http://localhost:3000/api/;
    ...
}

# WebSocket (ESP32)
location /ws {
    proxy_pass http://localhost:8080;
    ...
}

# Debug-Events sind NICHT nötig (verwendet HTTP-Polling)!
```

### Nginx aktivieren

```bash
sudo ln -s /etc/nginx/sites-available/iot-orchestrator /etc/nginx/sites-enabled/
sudo nginx -t
sudo nginx -s reload
```

---

## CORS-Konfiguration

### Automatisch für Reverse Proxy

Die `docker-compose.yml` enthält bereits die richtige Konfiguration:

```yaml
environment:
  - ALLOWED_ORIGINS=http://localhost:3001,https://ihre-domain.de
```

### Eigene Domains hinzufügen

Bearbeiten Sie `docker-compose.yml` Zeile 69:

```yaml
- ALLOWED_ORIGINS=http://localhost:3001,https://ihre-domain.de,https://weitere-domain.de
```

**Wichtig:** Protokolle (`http://` oder `https://`) angeben!

### Container neu starten

```bash
docker-compose down && docker-compose up -d
```

---

## Debug-Events konfigurieren

### ✅ Funktioniert automatisch!

**Keine Nginx-Config nötig!** Debug-Events verwenden jetzt HTTP-Polling.

- Backend cached Events (max. 200)
- Frontend holt Events via `/api/devices/debug-events` (alle 2 Sekunden)
- Nutzt existierende API-Route (funktioniert mit Reverse Proxy)

### Testen

1. Flow mit Debug-Nodes erstellen
2. Flow starten
3. Daten senden
4. Debug-Events erscheinen automatisch im Event-Panel

---

## Troubleshooting

### Problem: CORS-Fehler beim Login

**Symptom:**
```
Access to XMLHttpRequest blocked by CORS policy
```

**Lösung:**
1. `docker-compose.yml` öffnen
2. Zeile 69: `ALLOWED_ORIGINS` prüfen
3. Ihre Domain hinzufügen (mit Protokoll!)
4. Container neu starten: `docker-compose down && docker-compose up -d`

### Problem: Frontend ruft Backend über falsche URL auf

**Symptom:**
```
Failed to fetch http://localhost:3000/api/...
```

**Lösung:**
Wenn Sie über Reverse Proxy zugreifen:

1. `docker-compose.yml` öffnen
2. Zeile 132-134 die Umgebungsvariablen anpassen:
```yaml
- NEXT_PUBLIC_API_URL=https://ihre-domain.de/api
- NEXT_PUBLIC_WS_URL=wss://ihre-domain.de/ws
```
3. Frontend neu starten: `docker-compose restart frontend`

### Problem: Debug-Events zeigen nichts an

**Lösung:**
1. Flow mit Debug-Nodes erstellen
2. Flow **starten** (Start-Button oben rechts im Editor)
3. Daten durch den Flow senden (z.B. Mikrofon aktivieren)
4. Events sollten im Event-Panel erscheinen

**Prüfen:**
```bash
curl http://localhost:3000/api/devices/debug-events
# Sollte { events: [...] } zurückgeben
```

### Problem: Server-Tests funktionieren nicht über HTTPS

**Symptom:**
```
Failed to construct 'WebSocket': insecure connection blocked
```

**Lösung:**
Wenn die Seite über HTTPS (`https://server.local.chase295.de`) läuft:
- Lokale Server (`ws://localhost:2700`) können **nicht** getestet werden
- **Sie können die URLs trotzdem speichern** ohne Test
- Die Server funktionieren beim Flow-Start

**Workaround:**
Verwenden Sie `wss://` für externe Server, die über HTTPS laufen.

---

## Best Practices

### Für lokale Entwicklung

```yaml
environment:
  - NEXT_PUBLIC_API_URL=http://localhost:3000/api
  - NEXT_PUBLIC_WS_URL=ws://localhost:8080
  - ALLOWED_ORIGINS=http://localhost:3001
```

### Für Production (Reverse Proxy)

```yaml
environment:
  - NEXT_PUBLIC_API_URL=https://ihre-domain.de/api
  - NEXT_PUBLIC_WS_URL=wss://ihre-domain.de/ws
  - ALLOWED_ORIGINS=https://ihre-domain.de,http://localhost:3001
  - TRUST_PROXY=true
```

---

## Zusammenfassung

✅ **Lokales Setup:** Einfach `docker-compose up -d`  
✅ **Reverse Proxy:** Nginx + CORS-Origins konfigurieren  
✅ **Debug-Events:** Funktioniert automatisch (HTTP-Polling)  
✅ **Server-Tests:** Verwenden Sie `wss://` für externe Server  

---

## Nächste Schritte

- Siehe [README.md](README.md) für vollständige Feature-Übersicht
- Siehe [QUICKSTART.md](QUICKSTART.md) für erste Schritte
- Siehe [DOCKER.md](DOCKER.md) für Docker-Details

