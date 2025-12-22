import os
import tempfile
from typing import List, Optional
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status, Response
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger
import httpx
from openai import OpenAI
import json

from .db import get_supabase_client
from .deps import get_current_user, AuthUser
from . import schemas
from . import tools

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
if not origins:
    origins = ["http://localhost:3000"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
BUCKET = os.getenv("SUPABASE_BUCKET", "theramind")

# NUNCA logar conteúdo sensível: só metadados
logger.add(
    "theramind.log",
    rotation="10 MB",
    level="INFO",
    backtrace=False,
    diagnose=False,
)

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

# ... (Existing audio/transcribe/analyze endpoints remain unchanged) ...
@app.post("/upload-audio", response_model=schemas.UploadAudioResponse)
async def upload_audio(
    file: UploadFile = File(..., description=".mp3 da sessão"),
    patient_id: str = Form(...),
    user: AuthUser = Depends(get_current_user),
):
    if file.content_type not in ("audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav"):
        raise HTTPException(status_code=400, detail="Tipo de arquivo inválido")

    supabase = get_supabase_client()

    # Checa se paciente pertence ao usuário
    patient = (
        supabase.table("patients")
        .select("id, user_id")
        .eq("id", patient_id)
        .single()
        .execute()
    )
    if not patient.data or patient.data["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Acesso negado ao paciente")

    path = f"{user.user_id}/{patient_id}/{file.filename}"

    try:
        content = await file.read()
        res = supabase.storage.from_(BUCKET).upload(
            path,
            content,
            {"content-type": file.content_type},
        )

        public_url = supabase.storage.from_(BUCKET).get_public_url(path)
        return schemas.UploadAudioResponse(audio_url=public_url)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Falha upload áudio: {e}")
        raise HTTPException(status_code=500, detail="Erro interno")


@app.post("/transcribe", response_model=schemas.TranscribeResponse)
async def transcribe_audio(
    body: schemas.TranscribeRequest,
    user: AuthUser = Depends(get_current_user),
):
    audio_url = str(body.audio_url)

    try:
        async with httpx.AsyncClient(timeout=120) as http_client:
            resp = await http_client.get(audio_url)
            resp.raise_for_status()
            with tempfile.NamedTemporaryFile(delete=False, suffix=".mp3") as tmp:
                tmp.write(resp.content)
                tmp_path = tmp.name

        with open(tmp_path, "rb") as f:
            transcription = client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="text",
            )

        return schemas.TranscribeResponse(transcription=str(transcription))
    except httpx.HTTPError as e:
        logger.error(f"Erro download áudio: {e}")
        raise HTTPException(status_code=400, detail="Não foi possível baixar o áudio")
    except Exception as e:
        logger.error(f"Erro transcrição: {e}")
        raise HTTPException(status_code=500, detail="Erro ao transcrever áudio")


@app.post("/analyze", response_model=schemas.AnalyzeResponse)
async def analyze_transcription(
    body: schemas.AnalyzeRequest,
    user: AuthUser = Depends(get_current_user),
):
    transcription = body.transcription

    try:
        system_prompt = (
            "Você é um assistente clínico sênior com vasta experiência em Psicologia Profunda (Psicanálise Freudiana e Lacaniana, Psicologia Analítica Junguiana e Logoterapia). "
            "Sua análise deve ser integrativa, fluida e sofisticada, evitando estruturas rígidas ou repetitivas. "
            "Ao invés de listar o que cada autor diria, entrelace os conceitos teóricos diretamente na interpretação do caso. "
            "Identifique a queixa principal e os detalhes da sessão para selecionar dinamicamente a lente teórica mais adequada "
            "(ex: questões de sentido/vazio -> Frankl; simbologia/inconsciente coletivo -> Jung; desejos/pulsões -> Freud/Lacan). "
            "Sua escrita deve soar como a de um supervisor clínico experiente discutindo o caso."
            "Responda SEMPRE em JSON com as chaves: summary, insights, themes (lista de strings)."
        )

        summary_prompt = (
            "Resuma a sessão em um parágrafo coeso (5 a 10 linhas), capturando a essência do discurso e os afetos predominantes."
        )

        insights_prompt = (
            "Gere uma análise clínica profunda e narrativa (NÃO use listas ou tópicos):\n"
            "1. Integre organicamente os conceitos teóricos mais pertinentes ao conteúdo trazido.\n"
            "2. Se houver crise de identidade ou vazio existencial, traga a perspectiva da Logoterapia (sentido, responsabilidade).\n"
            "3. Se houver material onírico ou simbólico rico, utilize a Psicologia Analítica (arquétipos, sombras).\n"
            "4. Para conflitos pulsionais, dinâmicas de desejo ou mecanismos de defesa, ancore-se na Psicanálise (Freud/Lacan).\n"
            "5. Evite frases clichês como 'Freud diria que...'. Prefira construções como 'Sob a ótica do inconsciente...', 'Nota-se uma dinâmica...', 'O discurso aponta para...' \n"
            "6. O objetivo é fornecer 'insights' que ajudem o terapeuta a compreender as camadas subjacentes do caso.\n\n"
            "Escreva um texto fluido, elegante e clinicamente preciso."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"{summary_prompt}\n\n{insights_prompt}\n\n"
                    "Transcrição completa da sessão (NÃO logar este conteúdo em lugar nenhum):\n"
                    f"{transcription}\n\n"
                    "Responda apenas em JSON válido, por exemplo:\n"
                    '{ "summary": "...", "insights": "...", "themes": ["tema1", "tema2"] }'
                ),
            },
        ]

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            response_format={"type": "json_object"},
        )

        content = completion.choices[0].message.content or "{}"
        data = json.loads(content)

        summary = data.get("summary", "")
        insights = data.get("insights", "")
        themes = data.get("themes", []) or []

        if not isinstance(themes, list):
            themes = [str(themes)]

        return schemas.AnalyzeResponse(
            summary=summary,
            insights=insights,
            themes=[str(t) for t in themes],
        )
    except Exception as e:
        logger.error(f"Erro análise GPT: {e}")
        raise HTTPException(status_code=500, detail="Erro ao analisar sessão")


@app.post("/analyze-text", response_model=schemas.AnalyzeResponse)
async def analyze_text(
    body: schemas.AnalyzeTextRequest,
    user: AuthUser = Depends(get_current_user),
):
    text = body.text

    try:
        system_prompt = (
            "Você é um assistente clínico sênior com vasta experiência em Psicologia Profunda (Psicanálise Freudiana e Lacaniana, Psicologia Analítica Junguiana e Logoterapia). "
            "Sua análise deve ser integrativa, fluida e sofisticada, evitando estruturas rígidas ou repetitivas. "
            "Ao invés de listar o que cada autor diria, entrelace os conceitos teóricos diretamente na interpretação do caso. "
            "Identifique a queixa principal e os detalhes da sessão para selecionar dinamicamente a lente teórica mais adequada "
            "(ex: questões de sentido/vazio -> Frankl; simbologia/inconsciente coletivo -> Jung; desejos/pulsões -> Freud/Lacan). "
            "Sua escrita deve soar como a de um supervisor clínico experiente discutindo o caso."
            "Responda SEMPRE em JSON com as chaves: summary, insights, themes (lista de strings)."
        )

        summary_prompt = (
            "Resuma a sessão em um parágrafo coeso (5 a 10 linhas), capturando a essência do discurso e os afetos predominantes."
        )

        insights_prompt = (
            "Gere uma análise clínica profunda e narrativa (NÃO use listas ou tópicos):\n"
            "1. Integre organicamente os conceitos teóricos mais pertinentes ao conteúdo trazido.\n"
            "2. Se houver crise de identidade ou vazio existencial, traga a perspectiva da Logoterapia (sentido, responsabilidade).\n"
            "3. Se houver material onírico ou simbólico rico, utilize a Psicologia Analítica (arquétipos, sombras).\n"
            "4. Para conflitos pulsionais, dinâmicas de desejo ou mecanismos de defesa, ancore-se na Psicanálise (Freud/Lacan).\n"
            "5. Evite frases clichês como 'Freud diria que...'. Prefira construções como 'Sob a ótica do inconsciente...', 'Nota-se uma dinâmica...', 'O discurso aponta para...' \n"
            "6. O objetivo é fornecer 'insights' que ajudem o terapeuta a compreender as camadas subjacentes do caso.\n\n"
            "Escreva um texto fluido, elegante e clinicamente preciso."
        )

        messages = [
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": (
                    f"{summary_prompt}\n\n{insights_prompt}\n\n"
                    "Texto completo da sessão (NÃO logar este conteúdo em lugar nenhum):\n"
                    f"{text}\n\n"
                    "Responda apenas em JSON válido, por exemplo:\n"
                    '{ "summary": "...", "insights": "...", "themes": ["tema1", "tema2"] }'
                ),
            },
        ]

        completion = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            response_format={"type": "json_object"},
        )

        content = completion.choices[0].message.content or "{}"
        data = json.loads(content)

        summary = data.get("summary", "")
        insights = data.get("insights", "")
        themes = data.get("themes", []) or []

        if not isinstance(themes, list):
            themes = [str(themes)]

        return schemas.AnalyzeResponse(
            summary=summary,
            insights=insights,
            themes=[str(t) for t in themes],
        )
    except Exception as e:
        logger.error(f"Erro análise GPT: {e}")
        raise HTTPException(status_code=500, detail="Erro ao analisar texto")


@app.post("/save-text-session", status_code=status.HTTP_201_CREATED)
async def save_text_session(
    body: schemas.SaveTextSessionRequest,
    user: AuthUser = Depends(get_current_user),
):
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

    themes_text = ", ".join(body.themes)
    full_insights = f"{body.insights}\n\nTemas recorrentes: {themes_text}"
    
    try:
        res = (
            supabase.table("sessions")
            .insert(
                {
                    "patient_id": body.patient_id,
                    "audio_url": None,
                    "transcription": body.text,
                    "summary": body.summary,
                    "insights": full_insights,
                    "themes": body.themes,
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

    themes_text = ", ".join(body.themes)
    full_insights = f"{body.insights}\n\nTemas recorrentes: {themes_text}"
    audio_url_value = str(body.audio_url) if body.audio_url is not None else None
    try:
        res = (
            supabase.table("sessions")
            .insert(
                {
                    "patient_id": body.patient_id,
                    "audio_url": audio_url_value,
                    "transcription": body.transcription,
                    "summary": body.summary,
                    "insights": full_insights,
                    "themes": body.themes,
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
                "id, patient_id, audio_url, transcription, summary, insights, themes, created_at"
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
        .select("id, patient_id, audio_url, transcription, summary, insights, themes, created_at")
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

    try:
        content = generate_clinical_record_content(
            session_data=session.data,
            patient_data=patient.data,
            client=client
        )
        
        if format == "json":
            return content

        pdf_bytes = generate_clinical_record_pdf(
            record_data=content,
            patient_data=patient.data,
            session_date=datetime.fromisoformat(session.data["created_at"]).strftime("%d/%m/%Y")
        )
        
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=prontuario_{session_id[:8]}.pdf"}
        )
    except Exception as e:
        logger.error(f"Erro ao gerar prontuário: {e}")
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
# COPILOTO PSICANALÍTICO POLÍMATA v2.0
## Sistema de Análise Clínica Integrada e Gestão

Você é um assistente especializado em psicanálise E gestão de clínica.
Sua função é dupla:
1. Analisar material clínico (teorias Freudianas, Lacanianas, Junguianas, etc).
2. Auxiliar nas tarefas administrativas (agendar, cadastrar pacientes, anotar queixas) usando as ferramentas disponíveis.

**REFERÊNCIA DE TEMPO PARA AGENDAMENTOS**:
- Data e Hora Atual do Usuário: {current_time_str}
- Fuso Horário: Brasília (UTC-3)
Use esta data como referência para resolver "hoje", "amanhã", etc.
Se o usuário disser "hoje às 14h", envie "14:00" para a ferramenta.

REGRAS DE AGENDAMENTO:
1. SEMPRE use a ferramenta `create_appointment` após obter o `patient_id`.
2. O horário deve ser EXATAMENTE o que o usuário pedir.
3. Se ele não der o ID, use `search_patients` primeiro.
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

    # 6. Loop de execução de ferramentas (multi-turn)
    # Permite que o modelo chame "search" -> receba resultado -> chame "create" -> receba resultado -> resposta final
    
    final_reply = ""
    MAX_ITERATIONS = 5
    iteration = 0
    
    try:
        while iteration < MAX_ITERATIONS:
            iteration += 1
            
            # Chama o modelo
            completion = client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                tools=TOOLS_SCHEMA,
                tool_choice="auto", 
            )
            
            response_message = completion.choices[0].message
            tool_calls = response_message.tool_calls
            
            # Se não houver tool calls, é a resposta final (ou pergunta ao usuário)
            if not tool_calls:
                final_reply = response_message.content
                break
            
            # Se houver tool calls, processa
            messages.append(response_message) # Adiciona a intenção do assistente ao histórico
            
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)
                
                logger.info(f"TOOL CALL: {function_name} | ARGS: {function_args}")
                
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
                            function_args.get("date"),
                            function_args.get("time"),
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
                
                # Adiciona resultado ao histórico
                messages.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": function_name,
                    "content": str(tool_output)
                })
            
            # Loop continua para a próxima iteração (modelo vai ler os outputs e decidir o próximo passo)

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
             title_comp = client.chat.completions.create(
                 model="gpt-4o-mini",
                 messages=[
                     {"role": "system", "content": "Resuma a mensagem do usuário em um título curto de 3-5 palavras para uma conversa."},
                     {"role": "user", "content": body.message}
                 ]
             )
             new_title = title_comp.choices[0].message.content.strip('"')
             supabase.table("copilot_conversations").update({"title": new_title}).eq("id", conversation_id).execute()
        except:
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