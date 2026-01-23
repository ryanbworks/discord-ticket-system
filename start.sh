#!/bin/sh
set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           Discord Ticket Bot - Starting...                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"

# Verificar variáveis de ambiente obrigatórias
if [ -z "$DISCORD_TOKEN" ]; then
    echo "❌ ERRO: DISCORD_TOKEN não configurado!"
    exit 1
fi

if [ -z "$DB_HOST" ]; then
    echo "❌ ERRO: DB_HOST não configurado!"
    exit 1
fi

echo "✅ Variáveis de ambiente validadas"
echo "🚀 Iniciando bot..."
echo ""

# Iniciar o bot
exec node src/index.js
