#!/bin/bash

# Setup Device Secret
# ===================
# Speichert das Device-Secret im Backend

echo "🔑 Device Secret Setup"
echo "======================"
echo ""

DEVICE_NAME="python-voice-device"
SECRET_VALUE="test_secret_123"
SECRET_KEY="client_secret_${DEVICE_NAME}"

echo "Device Name: ${DEVICE_NAME}"
echo "Secret Key: ${SECRET_KEY}"
echo ""

# Prüfe ob Backend läuft
echo "⏳ Prüfe Backend-Verbindung..."
if ! curl -s http://localhost:3000/api/devices > /dev/null; then
    echo "❌ Backend läuft nicht!"
    echo "   Starte den Backend mit: docker-compose up"
    exit 1
fi

echo "✓ Backend erreichbar"
echo ""

# Speichere Secret
echo "⏳ Speichere Secret..."
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/auth/secrets \
  -H "Content-Type: application/json" \
  -d "{
    \"key\": \"${SECRET_KEY}\",
    \"value\": \"${SECRET_VALUE}\",
    \"type\": \"device_secret\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo "✓ Secret gespeichert!"
elif [ "$HTTP_CODE" -eq 409 ]; then
    echo "⚠ Secret existiert bereits"
    echo "   Möchtest du es löschen und neu erstellen? (j/N)"
    read -n 1 -r
    echo
    if [[ $REPLY =~ ^[Jj]$ ]]; then
        echo "⏳ Lösche altes Secret..."
        curl -s -X DELETE http://localhost:3000/api/auth/secrets/${SECRET_KEY}
        
        echo "⏳ Erstelle neues Secret..."
        NEW_RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3000/api/auth/secrets \
          -H "Content-Type: application/json" \
          -d "{
            \"key\": \"${SECRET_KEY}\",
            \"value\": \"${SECRET_VALUE}\",
            \"type\": \"device_secret\"
          }")
        
        NEW_HTTP_CODE=$(echo "$NEW_RESPONSE" | tail -n1)
        if [ "$NEW_HTTP_CODE" -eq 200 ] || [ "$NEW_HTTP_CODE" -eq 201 ]; then
            echo "✓ Secret aktualisiert!"
        else
            echo "❌ Fehler beim Aktualisieren"
            exit 1
        fi
    fi
else
    echo "❌ Fehler beim Speichern des Secrets"
    echo "   HTTP Code: ${HTTP_CODE}"
    echo "   Response: ${BODY}"
    exit 1
fi

echo ""
echo "✅ Setup abgeschlossen!"
echo ""
echo "💡 Tipp: Starte jetzt den Device-Client mit:"
echo "   ./device-client.sh"

