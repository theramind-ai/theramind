FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=10000

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    libffi-dev \
    libssl-dev \
    libfreetype6-dev \
    libjpeg-dev && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copia o código da aplicação
COPY app ./app

# Porta que o Render geralmente usa (10000 é o padrão do Render, mas ele fornece a variável PORT)
EXPOSE 10000

# Comando para rodar a aplicação usando uvicorn
# Usamos a porta definida pelo Render ou fallback para 10000
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000}