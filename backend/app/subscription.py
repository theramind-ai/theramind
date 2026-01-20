from datetime import date
from fastapi import HTTPException, status
from .db import get_supabase_client
from loguru import logger

# --- CONFIGURAÇÃO DOS PLANOS ---
PLAN_CONFIG = {
    "free": {
        "daily_charts_limit": 3,
        "features": ["ai_analysis", "transcription", "audio_analysis"] # Permite análise básica e transcrição
    },
    "plus": {
        "daily_charts_limit": 10,
        "features": ["ai_analysis", "scheduling"]
    },
    "premium": {
        "daily_charts_limit": 1000, # Praticamente ilimitado
        "features": ["ai_analysis", "scheduling", "copilot"]
    }
}

async def get_user_subscription(user_id: str):
    """Busca o plano e uso atual do usuário. (Sempre retorna Premium no Modo Teste)"""
    return {
        "plan": "premium",
        "daily_count": 0,
        "last_date": date.today().isoformat()
    }

async def check_subscription_feature(user_id: str, feature_name: str):
    """Sempre permitido."""
    return True

async def check_charts_usage_limit(user_id: str):
    """Sempre permitido."""
    return True

async def check_and_increment_charts_usage(user_id: str):
    """Sempre permitido."""
    return True
