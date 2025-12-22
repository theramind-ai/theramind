from functools import lru_cache
import os
from supabase import create_client, Client


@lru_cache
def get_supabase_client() -> Client:
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        # Não loga dados sensíveis, só mensagem genérica
        raise RuntimeError("Supabase environment variables are not configured")

    return create_client(url, key)