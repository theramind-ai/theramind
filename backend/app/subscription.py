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
    """Busca o plano e uso atual do usuário."""
    supabase = get_supabase_client()
    try:
        # Busca profile
        resp = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
        profile = resp.data
        if not profile:
            # Se não existir profile, cria um default 'free' (fallback)
            # Mas o trigger deveria ter criado.
            return {
                "plan": "free",
                "daily_count": 0,
                "last_date": date.today().isoformat()
            }
        
        return {
            "plan": profile.get("subscription_plan", "free").lower(),
            "daily_count": profile.get("daily_requests_count", 0),
            "last_date": profile.get("last_request_date", date.today().isoformat())
        }
    except Exception as e:
        logger.error(f"Erro ao buscar subscrição: {e}")
        # Fail safe -> Free tier
        return {"plan": "free", "daily_count": 0, "last_date": date.today().isoformat()}

async def check_subscription_feature(user_id: str, feature_name: str):
    """Verifica se o usuário tem acesso a uma feature específica. (DESABILITADO PARA TESTES)"""
    logger.info(f"TEST MODE: Feature '{feature_name}' explicitly allowed for user '{user_id}'")
    return True

async def check_charts_usage_limit(user_id: str):
    """Verifica se o usuário já atingiu o limite diário. (DESABILITADO PARA TESTES)"""
    return True

async def check_and_increment_charts_usage(user_id: str):
    """Verifica limite diário e incrementa. (DESABILITADO PARA TESTES)"""
    return True
