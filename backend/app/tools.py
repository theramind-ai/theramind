import json
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from .db import get_supabase_client
from loguru import logger

def search_patients(query: str, user_id: str) -> str:
    """Busca pacientes pelo nome."""
    logger.info(f"Tool search_patients: query={query}")
    supabase = get_supabase_client()
    try:
        response = (
            supabase.table("patients")
            .select("id, name, email")
            .eq("user_id", user_id)
            .ilike("name", f"%{query}%")
            .execute()
        )
        patients = response.data
        if not patients:
            return "Nenhum paciente encontrado com esse nome."
        
        return json.dumps(patients, ensure_ascii=False)
    except Exception as e:
        return f"Erro ao buscar pacientes: {str(e)}"

def create_patient(name: str, email: str, phone: str, user_id: str) -> str:
    """Cria um novo paciente."""
    logger.info(f"Tool create_patient: name={name}, email={email}")
    supabase = get_supabase_client()
    try:
        # Verifica se já existe
        existing = (
            supabase.table("patients")
            .select("id")
            .eq("user_id", user_id)
            .eq("email", email)
            .execute()
        )
        if existing.data:
            return f"Erro: Já existe um paciente com o email {email}."

        data = {
            "user_id": user_id,
            "name": name,
            "email": email,
            "phone": phone
        }
        res = supabase.table("patients").insert(data).execute()
        return f"Paciente {name} cadastrado com sucesso! ID: {res.data[0]['id']}"
    except Exception as e:
        return f"Erro ao cadastrar paciente: {str(e)}"

def create_appointment(patient_id: str, date_str: str, time_str: str, duration_minutes: int, price: float, user_id: str) -> str:
    """Cria um agendamento. date_str no formato YYYY-MM-DD, time_str no formato HH:MM."""
    logger.info(f"Tool create_appointment: patient_id={patient_id}, date={date_str}, time={time_str}")
    supabase = get_supabase_client()
    try:
        # Validação básica de data/hora
        try:
            # Assumimos que o input da AI (e do usuário) é em Horário de Brasília (UTC-3)
            # Para o Supabase/PSQL converter corretamente, adicionamos o offset
            full_date_str = f"{date_str}T{time_str}:00-03:00"
            # Tenta parsear para validar
            dt = datetime.fromisoformat(full_date_str)
            iso_date = dt.isoformat()
            logger.info(f"Generated ISO Date with offset: {iso_date}")
        except ValueError:
            return "Erro: Formato de data (YYYY-MM-DD) ou hora (HH:MM) inválido."

        data = {
            "user_id": user_id,
            "patient_id": patient_id,
            "appointment_date": iso_date,
            "duration_minutes": duration_minutes,
            "price": price,
            "status": "scheduled",
            "payment_status": "pending"
        }
        
        res = supabase.table("appointments").insert(data).execute()
        return f"Agendamento criado com sucesso para {date_str} às {time_str}."
    except Exception as e:
        logger.error(f"Tool create_appointment ERROR: {e}")
        return f"Erro ao criar agendamento: {str(e)}"

def create_session_note(patient_id: str, note: str, user_id: str) -> str:
    """Cria uma nota de sessão (usada para registrar Queixa Principal e outros registros rápidos)."""
    supabase = get_supabase_client()
    try:
        # Usaremos a estrutura de sessions para isso.
        # Transcription será a nota, insights/summary podem ser gerados depois ou deixados como placeholder.
        # Vamos marcar 'Queixa Principal' nos temas para facilitar identificação
        
        data = {
            "patient_id": patient_id,
            "transcription": note,
            "summary": "Registro via Chat (Queixa Principal/Nota Rápida)",
            "insights": "Registro manual via chat.",
            "themes": ["Chat", "Queixa Principal"]
        }
        
        res = supabase.table("sessions").insert(data).execute()
        return "Registro (Queixa Principal) salvo com sucesso nas sessões do paciente."
    except Exception as e:
        return f"Erro ao salvar registro: {str(e)}"
