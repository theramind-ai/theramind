import os
import uuid
from datetime import datetime
from jose import jwt
import httpx
from dotenv import load_dotenv

# Load env variables (assumes .env in same dir or parent)
load_dotenv()

SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
# If running against local backend
API_URL = "http://localhost:8000" 

def generate_test_token(user_id):
    if not SUPABASE_JWT_SECRET:
        print("Error: SUPABASE_JWT_SECRET not found in environment.")
        return None
    
    payload = {
        "sub": user_id,
        "email": "test@example.com",
        "aud": "authenticated",
        "role": "authenticated",
        "exp": 9999999999 
    }
    return jwt.encode(payload, SUPABASE_JWT_SECRET, algorithm="HS256")

def test_chat_flow():
    user_id = str(uuid.uuid4())
    token = generate_test_token(user_id)
    if not token:
        return

    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"Testing with User ID: {user_id}")

    # 1. Register Patient via Chat
    print("\n[1] Testing Patient Registration...")
    msg1 = "Cadastre o paciente Teste Chat Atualizado, email auto_updated@chat.com, telefone 11999998888"
    try:
        resp = httpx.post(
            f"{API_URL}/copilot/chat",
            json={"message": msg1},
            headers=headers,
            timeout=90.0
        )
        resp.raise_for_status()
        data = resp.json()
        print("Response:", data["reply"])
        conversation_id = data.get("conversation_id")
    except Exception as e:
        print(f"FAILED: {e}")
        return

    # 2. Search AND Schedule (Chain Test)
    # This tests the new multi-turn loop. We ask to schedule for the patient we just created, but without giving ID.
    # The AI must: Search -> (Find ID) -> Schedule
    print("\n[2] Testing Multi-Turn Search & Schedule...")
    msg2 = "Marque uma consulta para o paciente Teste Chat Atualizado para amanhã às 15:00"
    try:
         resp = httpx.post(
            f"{API_URL}/copilot/chat",
            json={"conversation_id": conversation_id, "message": msg2},
            headers=headers,
            timeout=90.0
        )
         data = resp.json()
         print("Response:", data["reply"])
         if "agendado" in data["reply"].lower() or "sucesso" in data["reply"].lower():
             print(">> SUCCESS: Multi-turn chain executed.")
         else:
             print(">> WARNING: Check logs if 2 tools were called.")

    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_chat_flow()
