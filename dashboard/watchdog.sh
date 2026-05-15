#!/usr/bin/env bash
# watchdog.sh - Mantiene el dashboard y el túnel público corriendo
# Se ejecuta cada 30 segundos via systemd timer o cron

DASHBOARD_DIR="/home/mdzac/.openclaw/workspace/dashboard"
TUNNEL_URL_FILE="/tmp/trazabilidad_url.txt"
CHECK_URL="http://127.0.0.1:8000/"

# 1. Verificar que el servidor FastAPI esté vivo
if ! curl -sf "$CHECK_URL" > /dev/null 2>&1; then
    echo "[$(date)] Dashboard caído. Reiniciando..."
    cd "$DASHBOARD_DIR" && python3 server.py &
    sleep 3
    # Notificar a Polo por Telegram ya lo haremos después
fi

# 2. Verificar que el túnel público esté vivo
if ! pgrep -f "localhost.run" > /dev/null; then
    echo "[$(date)] Túnel caído. Reconectando..."
    ssh -o StrictHostKeyChecking=accept-new \
        -o ServerAliveInterval=30 \
        -o ExitOnForwardFailure=yes \
        -R 80:localhost:8000 nokey@localhost.run > /dev/null 2>&1 &
    sleep 5
fi

# 3. Extraer URL del túnel de los logs (si cambiara)
CURRENT_URL=$(journalctl -u trazabilidad-tunnel.service --since "5 min ago" -o cat 2>/dev/null | grep -oP 'https://[a-z0-9]+\.lhr\.life' | tail -1)
if [ -n "$CURRENT_URL" ]; then
    echo "$CURRENT_URL" > "$TUNNEL_URL_FILE"
fi
