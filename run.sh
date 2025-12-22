#!/bin/bash

# Script para executar a aplicação TheraMind com Docker

echo "🚀 Iniciando a aplicação TheraMind..."

# Verifica se o Docker está instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Docker não está instalado. Por favor, instale o Docker primeiro."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose não está instalado. Por favor, instale o Docker Compose primeiro."
    exit 1
fi

# Verifica se o arquivo .env existe
if [ ! -f .env ]; then
    echo "⚠️  Arquivo .env não encontrado. Copiando .env.example para .env"
    cp .env.example .env
    echo "📝 Por favor, edite o arquivo .env com suas credenciais antes de continuar."
    exit 1
fi

# Constrói e inicia os contêineres
echo "🔨 Construindo as imagens Docker..."
docker-compose build

echo "🚀 Iniciando os serviços..."
docker-compose up -d

echo ""
echo "✅ Aplicação iniciada com sucesso!"
echo "📍 Frontend: http://localhost:3000"
echo "📍 Backend API: http://localhost:8000"
echo "📍 API Docs: http://localhost:8000/docs"
echo ""
echo "📊 Para ver os logs: docker-compose logs -f"
echo "🛑 Para parar: docker-compose down"
