import os
import stripe
from fastapi import Request, HTTPException, status
from .db import get_supabase_client
from loguru import logger
from dotenv import load_dotenv

load_dotenv()

# Configuração Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

# IDs dos Preços (Devem estar no .env)
PRICE_ID_PLUS = os.getenv("STRIPE_PRICE_ID_PLUS")
PRICE_ID_PREMIUM = os.getenv("STRIPE_PRICE_ID_PREMIUM")

async def create_checkout_session(user_id: str, email: str, plan_type: str):
    """Cria uma sessão de checkout do Stripe."""
    if not stripe.api_key:
        raise HTTPException(status_code=500, detail="Stripe não configurado no servidor.")

    price_id = None
    if plan_type == "plus":
        price_id = PRICE_ID_PLUS
    elif plan_type == "premium":
        price_id = PRICE_ID_PREMIUM
    
    if not price_id:
        raise HTTPException(status_code=400, detail="Plano inválido ou preço não configurado.")

    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            customer_email=email,
            client_reference_id=user_id,
            line_items=[
                {
                    'price': price_id,
                    'quantity': 1,
                },
            ],
            mode='subscription',
            success_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/pricing?success=true",
            cancel_url=f"{os.getenv('FRONTEND_URL', 'http://localhost:3000')}/pricing?canceled=true",
            metadata={
                "user_id": user_id,
                "plan": plan_type
            }
        )
        return checkout_session.url
    except Exception as e:
        logger.error(f"Erro ao criar checkout Stripe: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def handle_stripe_webhook(request: Request):
    """Processa webhooks do Stripe para atualizar o plano do usuário."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, WEBHOOK_SECRET
        )
    except ValueError as e:
        # Invalid payload
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        raise HTTPException(status_code=400, detail="Invalid signature")

    logger.info(f"Stripe Webhook Recebido: {event['type']}")

    # Handle the event
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        await _fulfill_checkout(session)
    elif event['type'] == 'customer.subscription.updated':
        # Pode ser usado para tratar cancelamentos ou mudanças de status
        pass
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        # Buscar usuário pelo customer_id e reverter para free
        pass

    return {"status": "success"}

async def _fulfill_checkout(session):
    """Atualiza o banco de dados após pagamento com sucesso."""
    user_id = session.get("client_reference_id")
    customer_id = session.get("customer")
    # Tenta pegar do metadata, se não existe, inferir (mas metadata é mais seguro se passamos)
    plan_type = session.get("metadata", {}).get("plan") 

    if not user_id or not plan_type:
        logger.warning("Webhook Checkout sem user_id ou plan no metadata.")
        return

    supabase = get_supabase_client()
    try:
        supabase.table("profiles").update({
            "subscription_plan": plan_type,
            "stripe_customer_id": customer_id,
            "subscription_status": "active",
            "daily_requests_count": 0 # Resetamos contagem ao dar upgrade? Opcional. Melhor não, ou sim.
        }).eq("id", user_id).execute()
        logger.info(f"Usuário {user_id} atualizado para plano {plan_type}")
    except Exception as e:
        logger.error(f"Erro ao atualizar profile no webhook: {e}")
