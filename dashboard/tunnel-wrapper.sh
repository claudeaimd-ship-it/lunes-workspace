#!/usr/bin/env bash
# tunnel-wrapper.sh - Mantiene el túnel público, reintenta siempre
# Nunca debe salir con exit code 0 para que systemd lo reinicie

set -e

cleanup() {
    pkill -f "localhost.run" 2>/dev/null || true
    exit 1  # Siempre salir con error para forzar restart
}
trap cleanup SIGTERM SIGINT SIGHUP

while true; do
    echo "[$(date)] Conectando túnel localhost.run..."
    ssh -o StrictHostKeyChecking=accept-new \
        -o ServerAliveInterval=30 \
        -o ServerAliveCountMax=3 \
        -o ExitOnForwardFailure=yes \
        -o ConnectTimeout=10 \
        -o TCPKeepAlive=yes \
        -R 80:localhost:8000 nokey@localhost.run 2>&1 || true
    EXIT_CODE=$?
    echo "[$(date)] Túnel caído (exit $EXIT_CODE). Reintentando en 10s..."
    sleep 10
done
