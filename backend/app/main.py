import os
from typing import List, Optional
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Depends, status, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import google.generativeai as genai
import json

from .db import get_supabase_client
from .deps import get_current_user, AuthUser
from . import schemas
from . import tools

from .services.cfp_service import CFPService

from .report_generator import (
    calculate_sentiment_trends,
    extract_common_topics,
    calculate_session_frequency,
    generate_clinical_record_content,
    generate_clinical_record_pdf
)

load_dotenv()

app = FastAPI(title="TheraMind API")

# CORS
origins_env = os.getenv("BACKEND_CORS_ORIGINS", "")
origins: List[str] = [
    origin.strip() for origin in origins_env.split(",") if origin.strip()
]

# Configuração robusta para CORS
cors_params = {
    "allow_credentials": True,
    "allow_methods": ["*"],
    "allow_headers": ["*"],
}

if not origins or "*" in origins:
    # Se não houver origens definidas ou houver wildcard, 
    # usamos regex para permitir qualquer origem de forma compatível com credentials
    cors_params["allow_origin_regex"] = "https?://.*"
    cors_params["allow_origins"] = [] # Regex tem precedência ou substitui
else:
    cors_params["allow_origins"] = origins

app.add_middleware(
    CORSMiddleware,
    **cors_params
)

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))
BUCKET = os.getenv("SUPABASE_BUCKET", "theramind")
MAX_ITERATIONS = 10

# NUNCA logar conteúdo sensível: só metadados
logger.add(
    "theramind.log",
    rotation="10 MB",
    level="INFO",
    backtrace=False,
    diagnose=False,
)

@app.get("/")
async def health_check():
    return {"status": "ok", "message": "TheraMind API is running"}

# --- Tool Definitions ---
TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "search_patients",
            "description": "Busca pacientes pelo nome para obter o patient_id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Nome ou parte do nome do paciente"}
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_patient",
            "description": "Cadastra um novo paciente no sistema.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nome completo do paciente"},
                    "email": {"type": "string", "description": "Email do paciente"},
                    "phone": {"type": "string", "description": "Telefone do paciente (ex: 11999999999)"}
                },
                "required": ["name", "email", "phone"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_appointment",
            "description": "Agenda uma consulta para um paciente existente. Requer patient_id (use search_patients se não souber).",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string", "description": "UUID do paciente"},
                    "date": {"type": "string", "description": "Data no formato YYYY-MM-DD"},
                    "time": {"type": "string", "description": "Hora no formato HH:MM"},
                    "duration_minutes": {"type": "integer", "description": "Duração em minutos (default 50)", "default": 50},
                    "price": {"type": "number", "description": "Valor da consulta (default 150.0)", "default": 150.0}
                },
                "required": ["patient_id", "date", "time"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "create_session_note",
            "description": "Registra uma queixa principal ou nota rápida para o paciente. Requer patient_id.",
            "parameters": {
                "type": "object",
                "properties": {
                    "patient_id": {"type": "string", "description": "UUID do paciente"},
                    "note": {"type": "string", "description": "Texto da queixa ou nota"}
                },
                "required": ["patient_id", "note"]
            }
        }
    }
]

@app.post("/analyze", response_model=schemas.AnalyzeResponse)
async def analyze_transcription(
    body: schemas.AnalyzeRequest,
    user: AuthUser = Depends(get_current_user),
):
    # Enforce AI Analysis permission and Daily Limit
    # Enforce AI Analysis permission and Daily Limit
    # Removed subscription checks
    
    transcription = body.transcription

    # Fetch Therapist theoretical approach
    supabase = get_supabase_client()
    therapist = (
        supabase.table("profiles")
        .select("theoretical_approach")
        .eq("id", user.user_id)
        .single()
        .execute()
    )
    approach = therapist.data.get("theoretical_approach", "Integrativa") if therapist.data else "Integrativa"

    try:
        system_prompt = (
            "Você é um assistente de apoio ao raciocínio clínico e à elaboração de prontuários e documentos psicológicos, "
            f"especialista na abordagem {approach}, com base nas normas éticas e técnicas do Conselho Federal de Psicologia (CFP), especialmente:\n\n"
            "• Resolução CFP nº 01/2009 (registro documental obrigatório)\n"
            "• Resolução CFP nº 06/2019 (elaboração de documentos psicológicos)\n"
            "• Manual Orientativo de Registro e Elaboração de Documentos Psicológicos publicado pelo CFP.\n\n"
            "Sua função é auxiliar o psicólogo(a) a organizar, qualificar e formular textos de prontuário, relatórios e "
            f"documentos psicológicos de acordo com os relatos do profissional no prontuário e na abordagem {approach}, "
            "dando oportunidade para o profissional editar. Você sugere possibilidades diagnósticas e sugere intervenções "
            f"de acordo com a abordagem {approach}.\n\n"
            "LINGUAGEM ÉTICA E TÉCNICA OBRIGATÓRIA:\n"
            "Sempre use expressões condicionais e não conclusivas, como:\n"
            "'observa-se', 'levanta-se hipótese', 'pode indicar', 'sugere possibilidade'.\n"
            "Nunca use linguagem determinista, diagnóstica ou prescritiva.\n\n"
            "Responda SEMPRE em JSON com as chaves:\n"
            "- registro_descritivo (descrição factual dos eventos, verbatim importantes, afetos e comportamentos observados)\n"
            f"- hipoteses_clinicas (formulação aberta e condicional, conectada com a abordagem {approach}, sugerindo possibilidades diagnósticas)\n"
            f"- direcoes_intervencao (sugestões hipotéticas compatíveis com a abordagem {approach}, indicando possíveis intervenções)\n"
            "- temas_relevantes (lista de strings com temas identificados)"
        )

        registro_prompt = (
            "Elabore um registro descritivo da sessão (5 a 10 linhas), documentando de forma factual e objetiva:\n"
            "- Os eventos relatados pelo paciente\n"
            "- Verbalizações importantes (verbatim quando relevante)\n"
            "- Afetos predominantes observados\n"
            "- Comportamentos não-verbais significativos\n"
            "Use linguagem técnica e factual, sem interpretações nesta seção."
        )

        hipoteses_prompt = (
            "Formule hipóteses clínicas de forma narrativa e condicional (NÃO use listas ou tópicos):\n"
            "1. Integre organicamente os conceitos teóricos mais pertinentes ao conteúdo trazido.\n"
            "2. Sugira possibilidades diagnósticas usando linguagem condicional ('pode indicar', 'sugere', 'observa-se padrão compatível com').\n"
            "3. Se houver crise de identidade ou vazio existencial, considere perspectivas existenciais (sentido, responsabilidade).\n"
            "4. Se houver material onírico ou simbólico rico, considere aspectos arquetípicos e simbólicos.\n"
            "5. Para conflitos relacionais, dinâmicas de desejo ou mecanismos de defesa, considere perspectivas psicodinâmicas.\n"
            "6. Evite frases clichês. Prefira construções como 'Observa-se...', 'Levanta-se a hipótese de...', 'O discurso sugere...'.\n"
            "Escreva um texto fluido, elegante e clinicamente preciso."
        )

        intervencoes_prompt = (
            "Sugira direções de intervenção de forma hipotética e condicional:\n"
            "1. Apresente possibilidades de intervenção compatíveis com as hipóteses levantadas.\n"
            "2. Use linguagem sugestiva: 'Pode-se considerar', 'Sugere-se explorar', 'Seria pertinente investigar'.\n"
            "3. Indique técnicas ou abordagens que possam ser úteis, sem prescrever.\n"
            "4. Mantenha o tom de sugestão, deixando a decisão final ao psicólogo responsável.\n"
            "Escreva de forma narrativa e profissional."
        )

        # Prepare Gemini Prompt
        prompt = f"{system_prompt}\n\n{registro_prompt}\n\n{hipoteses_prompt}\n\n{intervencoes_prompt}\n\nTranscrição completa da sessão:\n{transcription}\n\nResponda apenas em JSON."

        model = genai.GenerativeModel('gemini-2.5-flash', generation_config={"response_mime_type": "application/json"})
        response = model.generate_content(prompt)
        
        content = response.text or "{}"
        data = json.loads(content)

        registro_descritivo = data.get("registro_descritivo", "")
        hipoteses_clinicas = data.get("hipoteses_clinicas", "")
        direcoes_intervencao = data.get("direcoes_intervencao", "")
        temas_relevantes = data.get("temas_relevantes", []) or []

        if not isinstance(temas_relevantes, list):
            temas_relevantes = [str(temas_relevantes)]

        return schemas.AnalyzeResponse(
            registro_descritivo=registro_descritivo,
            hipoteses_clinicas=hipoteses_clinicas,
            direcoes_intervencao=direcoes_intervencao,
            temas_relevantes=[str(t) for t in temas_relevantes],
        )
    except Exception as e:
        logger.error(f"Erro análise GPT: {e}")
        raise HTTPException(status_code=500, detail="Erro ao analisar sessão")



@app.post("/analyze-text", response_model=schemas.AnalyzeResponse)
async def analyze_text(
    body: schemas.AnalyzeTextRequest,
    user: AuthUser = Depends(get_current_user),
):
    # Enforce AI Analysis permission and Daily Limit
    # Enforce AI Analysis permission and Daily Limit
    # Removed subscription checks
    
    text = body.text

    # Fetch Therapist theoretical approach
    supabase = get_supabase_client()
    therapist = (
        supabase.table("profiles")
        .select("theoretical_approach")
        .eq("id", user.user_id)
        .single()
        .execute()
    )
    approach = therapist.data.get("theoretical_approach", "Integrativa") if therapist.data else "Integrativa"

    try:
        system_prompt = (
            "Você é um assistente de apoio ao raciocínio clínico e à elaboração de prontuários e documentos psicológicos, "
            f"especialista na abordagem {approach}, com base nas normas éticas e técnicas do Conselho Federal de Psicologia (CFP), especialmente:\n\n"
            "• Resolução CFP nº 01/2009 (registro documental obrigatório)\n"
            "• Resolução CFP nº 06/2019 (elaboração de documentos psicológicos)\n"
            "• Manual Orientativo de Registro e Elaboração de Documentos Psicológicos publicado pelo CFP.\n\n"
            "Sua função é auxiliar o psicólogo(a) a organizar, qualificar e formular textos de prontuário, relatórios e "
            f"documentos psicológicos de acordo com os relatos do profissional no prontuário e na abordagem {approach}, "
            "dando oportunidade para o profissional editar. Você sugere possibilidades diagnósticas e sugere intervenções "
            f"de acordo com a abordagem {approach}.\n\n"
            "LINGUAGEM ÉTICA E TÉCNICA OBRIGATÓRIA:\n"
            "Sempre use expressões condicionais e não conclusivas, como:\n"
            "'observa-se', 'levanta-se hipótese', 'pode indicar', 'sugere possibilidade'.\n"
            "Nunca use linguagem determinista, diagnóstica ou prescritiva.\n\n"
            "Responda SEMPRE em JSON com as chaves:\n"
            "- registro_descritivo (descrição factual dos eventos, verbatim importantes, afetos e comportamentos observados)\n"
            f"- hipoteses_clinicas (formulação aberta e condicional, conectada com a abordagem {approach}, sugerindo possibilidades diagnósticas)\n"
            f"- direcoes_intervencao (sugestões hipotéticas compatíveis com a abordagem {approach}, indicando possíveis intervenções)\n"
            "- temas_relevantes (lista de strings com temas identificados)"
        )

        registro_prompt = (
            "Elabore um registro descritivo da sessão (5 a 10 linhas), documentando de forma factual e objetiva:\n"
            "- Os eventos relatados pelo paciente\n"
            "- Verbalizações importantes (verbatim quando relevante)\n"
            "- Afetos predominantes observados\n"
            "- Comportamentos não-verbais significativos\n"
            "Use linguagem técnica e factual, sem interpretações nesta seção."
        )

        hipoteses_prompt = (
            "Formule hipóteses clínicas de forma narrativa e condicional (NÃO use listas ou tópicos):\n"
            "1. Integre organicamente os conceitos teóricos mais pertinentes ao conteúdo trazido.\n"
            "2. Sugira possibilidades diagnósticas usando linguagem condicional ('pode indicar', 'sugere', 'observa-se padrão compatível com').\n"
            "3. Se houver crise de identidade ou vazio existencial, considere perspectivas existenciais (sentido, responsabilidade).\n"
            "4. Se houver material onírico ou simbólico rico, considere aspectos arquetípicos e simbólicos.\n"
            "5. Para conflitos relacionais, dinâmicas de desejo ou mecanismos de defesa, considere perspectivas psicodinâmicas.\n"
            "6. Evite frases clichês. Prefira construções como 'Observa-se...', 'Levanta-se a hipótese de...', 'O discurso sugere...'.\n"
            "Escreva um texto fluido, elegante e clinicamente preciso."
        )

        intervencoes_prompt = (
            "Sugira direções de intervenção de forma hipotética e condicional:\n"
            "1. Apresente possibilidades de intervenção compatíveis com as hipóteses levantadas.\n"
            "2. Use linguagem sugestiva: 'Pode-se considerar', 'Sugere-se explorar', 'Seria pertinente investigar'.\n"
            "3. Indique técnicas ou abordagens que possam ser úteis, sem prescrever.\n"
            "4. Mantenha o tom de sugestão, deixando a decisão final ao psicólogo responsável.\n"
            "Escreva de forma narrativa e profissional."
        )

        # Prepare Gemini Prompt
        prompt = f"{system_prompt}\n\n{registro_prompt}\n\n{hipoteses_prompt}\n\n{intervencoes_prompt}\n\nTexto completo da sessão:\n{text}\n\nResponda apenas em JSON."

        model = genai.GenerativeModel('gemini-2.5-flash', generation_config={"response_mime_type": "application/json"})
        response = model.generate_content(prompt)

        content = response.text or "{}"
        data = json.loads(content)

        registro_descritivo = data.get("registro_descritivo", "")
        hipoteses_clinicas = data.get("hipoteses_clinicas", "")
        direcoes_intervencao = data.get("direcoes_intervencao", "")
        temas_relevantes = data.get("temas_relevantes", []) or []

        if not isinstance(temas_relevantes, list):
            temas_relevantes = [str(temas_relevantes)]

        return schemas.AnalyzeResponse(
            registro_descritivo=registro_descritivo,
            hipoteses_clinicas=hipoteses_clinicas,
            direcoes_intervencao=direcoes_intervencao,
            temas_relevantes=[str(t) for t in temas_relevantes],
        )
    except Exception as e:
        logger.error(f"Erro análise GPT: {e}")
        raise HTTPException(status_code=500, detail="Erro ao analisar texto")



@app.post("/save-text-session", status_code=status.HTTP_201_CREATED)
async def save_text_session(
    body: schemas.SaveTextSessionRequest,
    user: AuthUser = Depends(get_current_user),
):
    # Enforce Daily Charts Limit
    # Enforce Daily Charts Limit
    # Removed usage limit checks

    supabase = get_supabase_client()

    patient = (
        supabase.table("patients")
        .select("id, user_id")
        .eq("id", body.patient_id)
        .single()
        .execute()
    )
    if not patient.data or patient.data["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Acesso negado ao paciente")

    # Support both CFP fields (preferred) and legacy fields
    registro_descritivo = body.registro_descritivo or body.summary or ""
    hipoteses_clinicas = body.hipoteses_clinicas or ""
    direcoes_intervencao = body.direcoes_intervencao or ""
    temas_relevantes = body.temas_relevantes or body.themes or []
    
    # For legacy compatibility, combine insights if using old format
    if body.insights and not body.hipoteses_clinicas:
        hipoteses_clinicas = body.insights

    themes_text = ", ".join(temas_relevantes)
    full_insights = f"{hipoteses_clinicas}\n\n{direcoes_intervencao}\n\nTemas recorrentes: {themes_text}"
    
    try:
        res = (
            supabase.table("sessions")
            .insert(
                {
                    "patient_id": body.patient_id,
                    "audio_url": None,
                    "transcription": body.text,
                    "summary": registro_descritivo,      # Now also used for legacy summary field
                    "insights": full_insights,           # Now also used for legacy insights field
                    "themes": temas_relevantes,          # Shared themes field
                    "registro_descritivo": registro_descritivo,
                    "hipoteses_clinicas": hipoteses_clinicas,
                    "direcoes_intervencao": direcoes_intervencao,
                }
            )
            .execute()
        )

        return {"id": res.data[0]["id"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro salvar sessão texto: {e}")
        raise HTTPException(status_code=500, detail="Erro interno")


@app.post("/save-session", status_code=status.HTTP_201_CREATED)
async def save_session(
    body: schemas.SaveSessionRequest,
    user: AuthUser = Depends(get_current_user),
):
    # Enforce Daily Charts Limit
    # Enforce Daily Charts Limit
    # Removed usage limit checks

    supabase = get_supabase_client()

    patient = (
        supabase.table("patients")
        .select("id, user_id")
        .eq("id", body.patient_id)
        .single()
        .execute()
    )
    if not patient.data or patient.data["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Acesso negado ao paciente")

    # Support both CFP fields (preferred) and legacy fields
    registro_descritivo = body.registro_descritivo or body.summary or ""
    hipoteses_clinicas = body.hipoteses_clinicas or ""
    direcoes_intervencao = body.direcoes_intervencao or ""
    temas_relevantes = body.temas_relevantes or body.themes or []
    
    # For legacy compatibility, combine insights if using old format
    if body.insights and not body.hipoteses_clinicas:
        hipoteses_clinicas = body.insights
    # Definir themes_text sempre antes de usar
    themes_text = ", ".join(temas_relevantes)
    full_insights = f"{hipoteses_clinicas}\n\n{direcoes_intervencao}\n\nTemas recorrentes: {themes_text}"
    audio_url_value = str(body.audio_url) if body.audio_url is not None else None
    
    try:
        res = (
            supabase.table("sessions")
            .insert(
                {
                    "patient_id": body.patient_id,
                    "audio_url": audio_url_value,
                    "transcription": body.transcription,
                    "summary": registro_descritivo,      # Now also used for legacy summary field
                    "insights": full_insights,           # Now also used for legacy insights field
                    "themes": temas_relevantes,          # Shared themes field
                    "registro_descritivo": registro_descritivo,
                    "hipoteses_clinicas": hipoteses_clinicas,
                    "direcoes_intervencao": direcoes_intervencao,
                }
            )
            .execute()
        )

        return {"id": res.data[0]["id"]}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erro salvar sessão: {e}")
        raise HTTPException(status_code=500, detail="Erro interno")


@app.get("/patient/{patient_id}", response_model=schemas.PatientOut)
async def get_patient(
    patient_id: str,
    user: AuthUser = Depends(get_current_user),
):
    supabase = get_supabase_client()

    patient = (
        supabase.table("patients")
        .select("id, user_id, name, email, phone, created_at")
        .eq("id", patient_id)
        .single()
        .execute()
    )

    if not patient.data or patient.data["user_id"] != user.user_id:
        raise HTTPException(status_code=404, detail="Paciente não encontrado")

    return patient.data


@app.get(
    "/patient/{patient_id}/sessions",
    response_model=schemas.SessionsListResponse,
)
async def get_patient_sessions(
    patient_id: str,
    user: AuthUser = Depends(get_current_user),
):
    supabase = get_supabase_client()

    patient = (
        supabase.table("patients")
        .select("id, user_id")
        .eq("id", patient_id)
        .single()
        .execute()
    )
    if not patient.data or patient.data["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Acesso negado ao paciente")

    try:
        res = (
            supabase.table("sessions")
            .select(
                "id, patient_id, audio_url, transcription, summary, insights, themes, registro_descritivo, hipoteses_clinicas, direcoes_intervencao, created_at"
            )
            .eq("patient_id", patient_id)
            .order("created_at", desc=True)
            .execute()
        )

        return schemas.SessionsListResponse(sessions=res.data or [])
    except Exception as e:
        logger.error(f"Erro listar sessões: {e}")
        raise HTTPException(status_code=500, detail="Erro interno")


@app.get("/session/{session_id}", response_model=schemas.SessionOut)
async def get_session(
    session_id: str,
    user: AuthUser = Depends(get_current_user),
):
    supabase = get_supabase_client()

    session = (
        supabase.table("sessions")
        .select("*")
        .eq("id", session_id)
        .single()
        .execute()
    )

    if not session.data:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    patient = (
        supabase.table("patients")
        .select("user_id")
        .eq("id", session.data["patient_id"])
        .single()
        .execute()
    )

    if not patient.data or patient.data["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Acesso negado à sessão")

    return session.data


@app.get("/session/{session_id}/record")
async def get_session_record(
    session_id: str,
    format: str = "pdf",
    document_type: str = "registro_documental",
    user: AuthUser = Depends(get_current_user),
):
    supabase = get_supabase_client()

    session = (
        supabase.table("sessions")
        .select("*")
        .eq("id", session_id)
        .single()
        .execute()
    )
    if not session.data:
        raise HTTPException(status_code=404, detail="Sessão não encontrada")

    patient = (
        supabase.table("patients")
        .select("*")
        .eq("id", session.data["patient_id"])
        .single()
        .execute()
    )
    if not patient.data or patient.data["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    # Fetch Therapist Data
    therapist = (
        supabase.table("profiles")
        .select("*")
        .eq("id", user.user_id)
        .single()
        .execute()
    )
    therapist_data = therapist.data if therapist.data else {}
    approach = therapist_data.get("theoretical_approach", "Integrativa")

    try:
        content = generate_clinical_record_content(
            session_data=session.data,
            patient_data=patient.data,
            document_type=document_type,
            approach=approach
        )
        
        if format == "json":
            return content

        pdf_bytes = generate_clinical_record_pdf(
            record_data=content,
            patient_data=patient.data,
            session_date=datetime.fromisoformat(session.data["created_at"]).strftime("%d/%m/%Y"),
            therapist_data=therapist_data,
            document_type=document_type
        )
        
        filename = f"{document_type}_{session_id[:8]}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except Exception as e:
        logger.error(f"Erro ao gerar documento {document_type}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/patients/{patient_id}/reports")
async def generate_patient_report(
    patient_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    report_type: str = "summary",
    user: AuthUser = Depends(get_current_user)
):
    supabase = get_supabase_client()
    try:
        patient = supabase.table("patients").select("*").eq("id", patient_id).single().execute()
        if not patient.data or patient.data["user_id"] != user.user_id:
            raise HTTPException(status_code=403, detail="Acesso negado")

        query = supabase.table("sessions").select("*").eq("patient_id", patient_id)
        
        if start_date:
            query = query.gte("created_at", start_date.isoformat())
        if end_date:
            query = query.lte("created_at", end_date.isoformat())
            
        sessions = query.execute().data

        report = {
            "patient": patient.data,
            "sessions_count": len(sessions),
            "period": {
                "start": start_date.isoformat() if start_date else None,
                "end": end_date.isoformat() if end_date else None
            },
            "analysis": {
                "sentiment_trends": calculate_sentiment_trends(sessions),
                "topics": extract_common_topics(sessions),
                "session_frequency": calculate_session_frequency(sessions)
            }
        }

        if report_type == "pdf":
            pdf_content = generate_pdf_report(report)
            return Response(
                content=pdf_content,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=relatorio_{patient_id}.pdf"}
            )
            
        return report

    except Exception as e:
        logger.error(f"Erro ao gerar relatório: {str(e)}")
        raise HTTPException(status_code=500, detail="Erro ao gerar relatório")

def generate_pdf_report(report_data):
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib import colors
        from io import BytesIO
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        elements = []
        
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=18,
            spaceAfter=20,
            alignment=1
        )
        
        subtitle_style = ParagraphStyle(
            'Subtitle',
            parent=styles['Heading2'],
            fontSize=14,
            spaceAfter=10,
            textColor=colors.darkblue
        )
        
        normal_style = styles['Normal']
        
        elements.append(Paragraph("Relatório de Sessões Terapêuticas", title_style))
        
        patient = report_data.get('patient', {})
        elements.append(Paragraph(f"Paciente: {patient.get('name', 'N/A')}", subtitle_style))
        elements.append(Paragraph(f"Idade: {patient.get('age', 'N/A')} anos", normal_style))
        elements.append(Paragraph(f"Gênero: {patient.get('gender', 'N/A')}", normal_style))
        
        period = report_data.get('period', {})
        elements.append(Spacer(1, 20))
        elements.append(Paragraph("Período do Relatório:", subtitle_style))
        elements.append(Paragraph(f"De: {period.get('start', 'N/A')} até {period.get('end', 'N/A')}", normal_style))
        
        elements.append(Spacer(1, 15))
        elements.append(Paragraph("Estatísticas Gerais:", subtitle_style))
        
        stats_data = [
            ["Total de Sessões:", str(report_data.get('sessions_count', 0))],
            ["Média de Sessões por Semana:", f"{report_data.get('analysis', {}).get('session_frequency', {}).get('sessions_per_week', 0):.1f}"],
            ["Dia Mais Comum:", report_data.get('analysis', {}).get('session_frequency', {}).get('most_common_day', {}).get('day', 'N/A')],
        ]
        
        table = Table(stats_data, colWidths=[200, 100])
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(table)
        
        sentiment = report_data.get('analysis', {}).get('sentiment_trends', {})
        if sentiment:
            elements.append(Spacer(1, 20))
            elements.append(Paragraph("Análise de Sentimento:", subtitle_style))
            elements.append(Paragraph(f"Média de Sentimento: {sentiment.get('average_score', 0):.2f}", normal_style))
            elements.append(Paragraph(f"Tendência: {sentiment.get('trend', 'N/A').capitalize()}", normal_style))
        
        topics = report_data.get('analysis', {}).get('topics', [])
        if topics:
            elements.append(Spacer(1, 15))
            elements.append(Paragraph("Tópicos Mais Comuns:", subtitle_style))
            topics_data = [["Tópico", "Frequência"]]
            for topic in topics:
                topics_data.append([topic['topic'].capitalize(), str(topic['count'])])
            
            table = Table(topics_data, colWidths=[300, 100])
            table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.black),
                ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.white),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ]))
            elements.append(table)
        
        doc.build(elements)
        buffer.seek(0)
        return buffer.getvalue()
        
    except Exception as e:
        logger.error(f"Erro ao gerar PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Erro ao gerar relatório em PDF: {str(e)}")

# --- Copilot Chat Endpoints ---

@app.post("/copilot/chat", response_model=schemas.CopilotResponse)
async def chat_copilot(
    body: schemas.ChatRequest,
    user: AuthUser = Depends(get_current_user),
):
    supabase = get_supabase_client()
    conversation_id = body.conversation_id

    # 1. Se não houver conversa, cria uma
    if not conversation_id:
        res = supabase.table("copilot_conversations").insert(
            {"user_id": user.user_id, "title": "Nova Conversa"}
        ).execute()
        conversation_id = res.data[0]["id"]
    
    # Valida conversa pertencente ao usuário
    conv = supabase.table("copilot_conversations").select("*").eq("id", conversation_id).single().execute()
    if not conv.data or conv.data["user_id"] != user.user_id:
         # Se não encontrou ou não é do usuário, cria nova (fallback ou erro. Aqui, vou criar uma nova se não existir ou assumir erro se ID passado for inválido)
         if body.conversation_id:
             raise HTTPException(status_code=403, detail="Conversa não encontrada ou acesso negado.")

    # 2. Salva mensagem do usuário
    supabase.table("copilot_messages").insert({
        "conversation_id": conversation_id,
        "role": "user",
        "content": body.message
    }).execute()

    # 3. Recupera histórico recente para contexto (limitando para não estourar tokens)
    history_res = (
        supabase.table("copilot_messages")
        .select("role, content")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .limit(20) # últimos 20
        .execute()
    )
    
    # Obter hora atual no fuso do usuário (ajustado para Brasília por padrão para este contexto)
    from datetime import timezone, timedelta
    br_tz = timezone(timedelta(hours=-3))
    current_time_str = datetime.now(br_tz).strftime("%Y-%m-%d %H:%M")
    
    messages = [
        {"role": "system", "content": f"""
# ASSISTENTE CLÍNICO E GESTOR v3.0 (CFP COMPLIANT)

Você é um assistente especializado em apoio ao raciocínio clínico, gestão de consultório e elaboração de documentos psicológicos, operando estritamente sob as normas do Conselho Federal de Psicologia (CFP), especialmente as Resoluções 01/2009 e 06/2019.

Sua função é auxiliar o psicólogo(a) em duas frentes:
1. **Raciocínio Clínico e Documentação**: Apoiar na organização de prontuários e documentos, usando linguagem ética e técnica (expressões condicionais como 'observa-se', 'sugere-se', 'levanta-se hipótese'). Você pode sugerir possibilidades diagnósticas e intervenções baseadas na abordagem teórica do profissional.
2. **Gestão Administrativa**: Auxiliar no agendamento, cadastro de pacientes e registro de queixas usando as ferramentas disponíveis.

LINGUAGEM OBRIGATÓRIA:
- NUNCA seja determinista, diagnóstico ou prescritivo em tom conclusivo.
- Use sempre tom de apoio e sugestão para o profissional responsável.

**REFERÊNCIA DE TEMPO**:
- Data e Hora Atual do Usuário: {current_time_str}
- Fuso Horário: Brasília (UTC-3)
"""},
    ]

    # 4. Adiciona histórico
    if history_res.data:
        for msg in history_res.data:
            messages.append({"role": msg["role"], "content": msg["content"]})
            
    # 5. Adiciona mensagem atual (se já não estiver no histórico, o que geralmente não está pois pegamos só o anterior)
    # Nota: No código original, a mensagem do user já foi salva no passo 2.
    # Mas o histórico recuperado no passo 3 PODE conter a mensagem atual se o 'limit' permitir e o tempo de commit for rápido.
    # Para garantir consistência e evitar duplicação, vamos checar se a última mensagem do histórico é igual à atual.
    
    is_last_msg_current = False
    if messages and messages[-1].get("content") == body.message:
        is_last_msg_current = True
    
    if not is_last_msg_current:
         messages.append({"role": "user", "content": body.message})

    # 6. Loop de execução de ferramentas (multi-turn) usando Gemini
    # Usamos gemini-2.5-flash para o Copilot por ser mais rápido e eficiente para chat interativo.
    model = genai.GenerativeModel(
        model_name='gemini-2.5-flash',
        system_instruction=messages[0]["content"],
        tools=[
            tools.search_patients,
            tools.create_patient,
            tools.create_appointment,
            tools.create_session_note
        ]
    )
    
    # Prepara o histórico para o formato do Gemini
    # Gemini usa 'user' e 'model'. No histórico do banco temos 'user' e 'assistant'.
    gemini_history = []
    if history_res.data:
        for msg in history_res.data:
            role = "user" if msg["role"] == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg["content"]]})
    
    # Inicia chat com o histórico
    chat = model.start_chat(history=gemini_history)
    
    try:
        # Envia a mensagem atual. 
        # O Gemini SDK pode lidar com a execução automática de ferramentas se passarmos enable_automatic_function_calling=False
        # Mas como precisamos injetar o user_id, faremos o controle manual das chamadas.
        
        response = chat.send_message(body.message)
        
        iteration = 0
        while iteration < MAX_ITERATIONS:
            iteration += 1
            
            # Verifica se há chamadas de função na resposta
            # No SDK do Gemini, as chamadas ficam em response.candidates[0].content.parts
            function_calls = [part.function_call for part in response.candidates[0].content.parts if part.function_call]
            
            if not function_calls:
                # Se não houver chamadas, a resposta final está no texto
                final_reply = response.text
                break
            
            # Se houver chamadas, processa cada uma
            tool_responses = {}
            for fc in function_calls:
                function_name = fc.name
                # Converte os argumentos (que vêm como Map/Proto) para dict
                function_args = {arg: val for arg, val in fc.args.items()}
                
                logger.info(f"GEMINI TOOL CALL: {function_name} | ARGS: {function_args}")
                
                tool_output = f"Erro: Ferramenta {function_name} desconhecida."
                
                try:
                    if function_name == "search_patients":
                        tool_output = tools.search_patients(function_args.get("query"), user.user_id)
                    elif function_name == "create_patient":
                        tool_output = tools.create_patient(
                            function_args.get("name"), 
                            function_args.get("email"), 
                            function_args.get("phone"), 
                            user.user_id
                        )
                    elif function_name == "create_appointment":
                        tool_output = tools.create_appointment(
                            function_args.get("patient_id"),
                            function_args.get("date_str") or function_args.get("date"), # Suporta variação de nome
                            function_args.get("time_str") or function_args.get("time"),
                            function_args.get("duration_minutes", 50),
                            function_args.get("price", 150.0),
                            user.user_id
                        )
                    elif function_name == "create_session_note":
                        tool_output = tools.create_session_note(
                            function_args.get("patient_id"),
                            function_args.get("note"),
                            user.user_id
                        )
                except Exception as e:
                    tool_output = f"Erro na execução da ferramenta: {str(e)}"
                    logger.error(f"Tool Execution Error: {e}")
                
                tool_responses[function_name] = tool_output

            # Envia as respostas das ferramentas de volta para o modelo
            # No Gemini SDK, enviamos uma lista de partes com as respostas
            response = chat.send_message([
                genai.protos.Part(function_response=genai.protos.FunctionResponse(name=name, response={"result": str(out)}))
                for name, out in tool_responses.items()
            ])
            
    except Exception as e:
        logger.error(f"Erro no chat copilot: {e}")
        final_reply = "Desculpe, ocorreu um erro ao processar sua mensagem. Tente novamente."

    # 9. Salva resposta do assistente no banco
    supabase.table("copilot_messages").insert({
        "conversation_id": conversation_id,
        "role": "assistant",
        "content": final_reply
    }).execute()

    # Atualiza titulo se for a primeira troca
    if len(history_res.data) <= 2:
        try:
             title_model = genai.GenerativeModel('gemini-2.5-flash')
             title_prompt = f"Resuma a mensagem do usuário em um título curto de 3-5 palavras para uma conversa: {body.message}"
             title_res = title_model.generate_content(title_prompt)
             new_title = title_res.text.strip().strip('"')
             supabase.table("copilot_conversations").update({"title": new_title}).eq("id", conversation_id).execute()
        except Exception as e:
            logger.error(f"Erro ao gerar título: {e}")
            pass

    return schemas.CopilotResponse(conversation_id=conversation_id, reply=final_reply)


@app.get("/copilot/conversations", response_model=List[schemas.ConversationOut])
async def list_conversations(
    user: AuthUser = Depends(get_current_user),
):
    supabase = get_supabase_client()
    res = (
        supabase.table("copilot_conversations")
        .select("*")
        .eq("user_id", user.user_id)
        .order("updated_at", desc=True)
        .execute()
    )
    return res.data


@app.get("/copilot/conversations/{conversation_id}/messages", response_model=List[schemas.MessageOut])
async def get_conversation_messages(
    conversation_id: str,
    user: AuthUser = Depends(get_current_user),
):
    supabase = get_supabase_client()
    
    # Verifica permissão
    conv = supabase.table("copilot_conversations").select("user_id").eq("id", conversation_id).single().execute()
    if not conv.data or conv.data["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Acesso negado")

    res = (
        supabase.table("copilot_messages")
        .select("*")
        .eq("conversation_id", conversation_id)
        .order("created_at", desc=False)
        .execute()
    )
    return res.data

@app.get("/api/profile", response_model=schemas.ProfileOut)
async def get_profile(user: AuthUser = Depends(get_current_user)):
    supabase = get_supabase_client()
    res = supabase.table("profiles").select("*").eq("id", user.user_id).single().execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return res.data

@app.put("/api/profile", response_model=schemas.ProfileOut)
async def update_profile(
    body: schemas.ProfileUpdate,
    user: AuthUser = Depends(get_current_user)
):
    supabase = get_supabase_client()
    update_data = {k: v for k, v in body.dict().items() if v is not None}
    update_data["updated_at"] = datetime.utcnow().isoformat()
    
    res = supabase.table("profiles").update(update_data).eq("id", user.user_id).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Erro ao atualizar perfil")
    return res.data[0]

@app.post("/api/validate-crp", response_model=schemas.CRPValidationResponse)
async def validate_crp(
    body: schemas.CRPValidationRequest,
    # user: AuthUser = Depends(get_current_user) # Comentado para permitir validação antes do login se necessário no onboarding
):
    supabase = get_supabase_client()
    crp_input = body.crp.strip()
    
    # 1. Verificar se o CRP já existe no Theramind
    existing = supabase.table("profiles").select("id").eq("crp", crp_input).execute()
    exists_theramind = len(existing.data) > 0 if existing.data else False
    
    # 2. Tentar validar no CFP
    uf, registro = CFPService.parse_crp_input(crp_input)
    
    if not uf or not registro:
        return schemas.CRPValidationResponse(
            valid=False,
            exists_in_theramind=exists_theramind,
            error="Formato de CRP inválido. Use o padrão 'Região/Número' (ex: 04/44606)."
        )
    
    # Se já existe no Theramind, não precisamos nem consultar o CFP para bloquear duplicados
    if exists_theramind:
        return schemas.CRPValidationResponse(
            valid=True, # Tecnicamente válido no CFP mas duplicado no Theramind
            exists_in_theramind=True,
            error="Este CRP já está vinculado a outro profissional no Theramind."
        )

    # Consulta externa
    cfp_res = await CFPService.validate_crp(registro, uf)
    
    if cfp_res["valid"]:
        return schemas.CRPValidationResponse(
            valid=True,
            exists_in_theramind=False,
            professional_name=cfp_res["name"]
        )
    else:
        return schemas.CRPValidationResponse(
            valid=False,
            exists_in_theramind=False,
            error=cfp_res["error"]
        )

