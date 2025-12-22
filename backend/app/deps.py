from typing import Optional

from fastapi import Header, HTTPException, status
from jose import jwt, JWTError
import os


class AuthUser:
    def __init__(self, user_id: str, email: Optional[str] = None):
        self.user_id = user_id
        self.email = email


async def get_current_user(
    authorization: str = Header(..., alias="Authorization"),
) -> AuthUser:
    """
    Espera header: Authorization: Bearer <supabase_jwt>
    Decodifica usando SUPABASE_JWT_SECRET e extrai sub (user id).
    """
    from loguru import logger
    
    logger.info(f"Authorization header received: {authorization[:50]}...")
    
    if not authorization.startswith("Bearer "):
        logger.error("Authorization header does not start with 'Bearer '")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization header",
        )

    token = authorization.split(" ", 1)[1]
    logger.info(f"Token extracted, length: {len(token)}")
    
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        logger.error("SUPABASE_JWT_SECRET not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="JWT secret not configured",
        )

    try:
        payload = jwt.decode(
            token, 
            secret, 
            algorithms=["HS256"],
            options={"verify_aud": False}  # Supabase tokens have 'aud' claim, disable verification
        )
        logger.info(f"Token decoded successfully. Payload keys: {list(payload.keys())}")
    except JWTError as e:
        logger.error(f"JWT decode error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
        )

    sub = payload.get("sub")
    email = payload.get("email")
    if not sub:
        logger.error("Missing 'sub' claim in token payload")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing sub claim",
        )

    logger.info(f"User authenticated: {sub}")
    return AuthUser(user_id=sub, email=email)