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
    """Verifica se o usuário tem acesso a uma feature específica."""
    sub_data = await get_user_subscription(user_id)
    plan = sub_data["plan"]
    logger.info(f"Checking feature '{feature_name}' for user '{user_id}' with plan '{plan}'")
    
    # Se o plano não for conhecido, assume free
    config = PLAN_CONFIG.get(plan.lower(), PLAN_CONFIG["free"])
    
    if feature_name not in config["features"]:
        logger.warning(f"Feature '{feature_name}' NOT allowed for plan '{plan}'. Allowed features: {config['features']}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Seu plano atual ({plan.capitalize()}) não permite acesso a: {feature_name}. Atualize para Plus ou Premium."
        )
    logger.info(f"Feature '{feature_name}' allowed for plan '{plan}'")
    return True

async def check_charts_usage_limit(user_id: str):
    """Verifica se o usuário já atingiu o limite diário, sem incrementar."""
    supabase = get_supabase_client()
    resp = supabase.table("profiles").select("subscription_plan, daily_requests_count, last_request_date").eq("id", user_id).single().execute()
    if not resp.data:
         raise HTTPException(status_code=500, detail="Perfil de usuário não encontrado.")
    
    profile = resp.data
    plan = profile.get("subscription_plan", "free").lower()
    current_count = profile.get("daily_requests_count", 0)
    last_date_str = profile.get("last_request_date")
    
    today_str = date.today().isoformat()
    
    if last_date_str != today_str:
        return True # Novo dia, limite resetado
    
    config = PLAN_CONFIG.get(plan, PLAN_CONFIG["free"])
    limit = config["daily_charts_limit"]
    
    if current_count >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Limite diário de atendimentos (gravações/análises) atingido ({limit}). Atualize seu plano para continuar."
        )
    return True

async def check_and_increment_charts_usage(user_id: str):
    """Verifica limite diário e incrementa."""
    # Primeiro verifica sem incrementar para reusar lógica
    await check_charts_usage_limit(user_id)
    
    supabase = get_supabase_client()
    resp = supabase.table("profiles").select("daily_requests_count, last_request_date").eq("id", user_id).single().execute()
    profile = resp.data
    
    current_count = profile.get("daily_requests_count", 0)
    last_date_str = profile.get("last_request_date")
    today_str = date.today().isoformat()
    
    if last_date_str != today_str:
        current_count = 0
    
    new_count = current_count + 1
    update_data = {
        "daily_requests_count": new_count,
        "last_request_date": today_str
    }
    
    supabase.table("profiles").update(update_data).eq("id", user_id).execute()
    return True
