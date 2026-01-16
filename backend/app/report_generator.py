from datetime import datetime, timedelta
from collections import defaultdict, Counter
from typing import List, Dict, Any
import re
from datetime import datetime

# Padrões para análise de tópicos
TOPIC_KEYWORDS = {
    'ansiedade': ['ansio', 'preocup', 'nervos', 'medo', 'pânico', 'angústia', 'tensão', 'inquietação'],
    'depressão': ['triste', 'vazio', 'desesperanç', 'desânimo', 'cansaço', 'culpa', 'inútil', 'morte', 'suicídio'],
    'estresse': ['estress', 'sobrecarr', 'pressão', 'sobrecarregado', 'exausto', 'esgotado'],
    'relacionamentos': ['namorado', 'namorada', 'esposo', 'esposa', 'marido', 'mulher', 'pai', 'mãe', 'filho', 'filha', 'amigo', 'amiga', 'colega', 'chefe'],
    'trabalho': ['trabalho', 'emprego', 'carreira', 'profissional', 'chefe', 'colegas', 'demissão', 'promoção'],
    'autoestima': ['feio', 'feia', 'inseguro', 'insegurança', 'confiança', 'autoestima', 'auto-imagem', 'aparência'],
    'conquista': ['consegui', 'venci', 'superei', 'melhorei', 'evoluí', 'entendi', 'descobri', 'feliz', 'alegre', 'paz', 'tranquilo'],
}

def estimate_sentiment(text: str) -> float:
    """
    Estima um score de sentimento (-1.0 a 1.0) baseado em palavras-chave simples.
    Usado quando o score da IA não está disponível no banco.
    """
    if not text:
        return 0.0
        
    text = text.lower()
    score = 0.0
    
    # Pesos simples
    negatives = TOPIC_KEYWORDS['ansiedade'] + TOPIC_KEYWORDS['depressão'] + TOPIC_KEYWORDS['estresse']
    positives = TOPIC_KEYWORDS['conquista']
    
    # Contagem básica
    neg_count = sum(1 for word in negatives if word in text)
    pos_count = sum(1 for word in positives if word in text)
    
    total = neg_count + pos_count
    if total == 0:
        return 0.0
        
    # Normaliza entre -1 e 1
    return (pos_count - neg_count) / max(total, 1)

def calculate_sentiment_trends(sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Analisa as tendências de sentimento ao longo das sessões.
    Retorna estatísticas sobre o sentimento geral e sua evolução.
    """
    if not sessions:
        return {}
    
    sentiment_scores = []
    sentiment_by_date = defaultdict(list)
    
    for session in sessions:
        # Tenta pegar do banco, senão calcula
        score = 0.0
        if session.get('analysis') and isinstance(session['analysis'], dict):
             sentiment = session['analysis'].get('sentiment', {})
             score = sentiment.get('score', 0)
        else:
             # Fallback: calcula na hora usando transcrição ou resumo
             text = session.get('transcription') or session.get('summary') or ""
             score = estimate_sentiment(text)
            
        try:
            # Converte a string de data para objeto datetime
            created_at = datetime.fromisoformat(session['created_at'].replace('Z', '+00:00'))
            date_str = created_at.strftime('%Y-%m-%d')
            
            sentiment_scores.append(score)
            sentiment_by_date[date_str].append(score)
        except (KeyError, ValueError) as e:
            continue
    
    
    # Calcula estatísticas de sentimento
    if not sentiment_scores:
        return {}
    
    avg_sentiment = sum(sentiment_scores) / len(sentiment_scores)
    
    # Calcula tendência (melhorando, piorando ou estável)
    trend = 'estável'
    if len(sentiment_scores) > 1:
        first_half = sentiment_scores[:len(sentiment_scores)//2]
        second_half = sentiment_scores[len(sentiment_scores)//2:]
        
        avg_first = sum(first_half) / len(first_half)
        avg_second = sum(second_half) / len(second_half)
        
        if avg_second > avg_first + 0.1:
            trend = 'melhorando'
        elif avg_second < avg_first - 0.1:
            trend = 'piorando'
    
    # Prepara dados para gráfico de evolução
    evolution_data = [
        {'date': date, 'avg_score': sum(scores)/len(scores)}
        for date, scores in sorted(sentiment_by_date.items())
    ]
    
    return {
        'average_score': round(avg_sentiment, 2),
        'trend': trend,
        'total_sessions_analyzed': len(sentiment_scores),
        'evolution': evolution_data
    }

def extract_common_topics(sessions: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extrai tópicos comuns das transcrições das sessões.
    Retorna uma lista de tópicos com suas frequências.
    """
    if not sessions:
        return []
    
    topic_counter = Counter()
    
    for session in sessions:
        if not session.get('transcription'):
            continue
            
        text = session['transcription'].lower()
        
        # Conta ocorrências de cada tópico
        for topic, keywords in TOPIC_KEYWORDS.items():
            for keyword in keywords:
                if keyword in text:
                    topic_counter[topic] += 1
                    break  # Conta o tópico apenas uma vez por sessão
    
    # Ordena por frequência e retorna os 5 principais
    common_topics = [
        {'topic': topic, 'count': count}
        for topic, count in topic_counter.most_common(5)
    ]
    
    return common_topics

def calculate_session_frequency(sessions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Calcula a frequência das sessões ao longo do tempo.
    Retorna estatísticas sobre a regularidade das sessões.
    """
    if not sessions:
        return {}
    
    # Extrai e ordena as datas das sessões
    try:
        session_dates = [
            datetime.fromisoformat(s['created_at'].replace('Z', '+00:00'))
            for s in sessions
            if s.get('created_at')
        ]
        session_dates.sort()
    except (KeyError, ValueError):
        return {}
    
    if not session_dates:
        return {}
    
    # Calcula intervalo médio entre sessões
    intervals = []
    for i in range(1, len(session_dates)):
        delta = session_dates[i] - session_dates[i-1]
        intervals.append(delta.days)
    
    avg_interval = sum(intervals) / len(intervals) if intervals else 0
    
    # Conta sessões por dia da semana
    weekday_counts = defaultdict(int)
    for date in session_dates:
        weekday = date.strftime('%A')
        weekday_counts[weekday] += 1
    
    # Encontra o dia mais comum
    most_common_day = max(weekday_counts.items(), key=lambda x: x[1]) if weekday_counts else (None, 0)
    
    return {
        'total_sessions': len(session_dates),
        'first_session': session_dates[0].isoformat(),
        'last_session': session_dates[-1].isoformat(),
        'avg_days_between_sessions': round(avg_interval, 1),
        'sessions_per_week': round(7 / avg_interval, 1) if avg_interval > 0 else 0,
        'most_common_day': {
            'day': most_common_day[0],
            'count': most_common_day[1]
        } if most_common_day[0] else None,
        'sessions_by_weekday': dict(weekday_counts)
    }

def generate_clinical_record_content(
    session_data: Dict[str, Any], 
    patient_data: Dict[str, Any], 
    client: Any, 
    document_type: str = "registro_documental",
    approach: str = "Integrativa"
) -> Dict[str, Any]:
    """
    Gera conteúdo estruturado para documentos psicológicos seguindo normas CFP.
    Tipos: registro_documental, relatorio, laudo, parecer, declaracao, atestado.
    """
    
    document_structures = {
        "registro_documental": "- registro_descritivo\n- hipoteses_clinicas\n- direcoes_intervencao",
        "relatorio": "- identificacao\n- descricao_demanda\n- procedimento\n- analise\n- conclusao",
        "laudo": "- identificacao\n- descricao_demanda\n- procedimento\n- analise\n- diagnostico_provisorio\n- conclusao",
        "parecer": "- identificacao\n- quesitos_analise\n- analise_tecnica\n- conclusao",
        "declaracao": "- finalidade\n- informacoes_atendimento",
        "atestado": "- finalidade\n- justificativa_ausencia_ou_aptidao"
    }
    
    structure = document_structures.get(document_type, document_structures["registro_documental"])
    
    system_prompt = (
        "Você é um assistente especializado em redação de documentos psicológicos conforme as normas do "
        "Conselho Federal de Psicologia (CFP), especialmente a Resolução CFP nº 06/2019."
        f"Você redige na abordagem {approach}."
        "Use linguagem ética, condicional e técnica. NUNCA seja determinista."
    )
    
    user_prompt = f"""
    Tipo de Documento: {document_type}
    Dados do Paciente: {patient_data.get('name')}
    Abordagem do Terapeuta: {approach}
    Conteúdo Base da Sessão: {session_data.get('transcription') or session_data.get('summary')}
    Hipóteses e Direções: {session_data.get('insights') or (session_data.get('hipoteses_clinicas', '') + ' ' + session_data.get('direcoes_intervencao', ''))}
    
    Gere um JSON com os campos correspondentes a esta estrutura:
    {structure}
    
    Instruções Adicionais:
    1. Identificação: Nome, finalidade, solicitante (se não houver, use 'A própria pessoa').
    2. Analise: Integre os dados com a abordagem {approach}.
    3. Conclusão: Sempre condicional, sugerindo encaminhamentos ou próximos passos.
    """
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        response_format={"type": "json_object"}
    )
    
    import json
    return json.loads(response.choices[0].message.content)

def generate_clinical_record_pdf(
    record_data: Dict[str, Any], 
    patient_data: Dict[str, Any], 
    session_date: str, 
    therapist_data: Dict[str, Any] = None,
    document_type: str = "registro_documental"
) -> bytes:
    """Generates the PDF file for the clinical record / psychological document."""
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from io import BytesIO
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []
    
    document_titles = {
        "registro_documental": "Registro Documental de Sessão",
        "relatorio": "Relatório Psicológico",
        "laudo": "Laudo Psicológico",
        "parecer": "Parecer Psicológico",
        "declaracao": "Declaração",
        "atestado": "Atestado Psicológico"
    }
    
    title_text = document_titles.get(document_type, "Documento Psicológico")
    
    # Styles
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=16, spaceAfter=20, alignment=1)
    section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=12, spaceBefore=15, spaceAfter=10, textColor=colors.darkblue)
    text_style = ParagraphStyle('Text', parent=styles['Normal'], fontSize=11, leading=14)
    
    # Header Info
    elements.append(Paragraph(title_text, title_style))
    elements.append(Spacer(1, 10))
    
    # Format Patient Data for the section
    patient_info = (
        f"<b>Nome:</b> {patient_data.get('name') or 'N/A'}\n"
        f"<b>Data:</b> {session_date}"
    )
    elements.append(Paragraph("👤 Identificação", section_style))
    elements.append(Paragraph(patient_info, text_style))

    # Field Mappings (technical to display name)
    field_labels = {
        "registro_descritivo": "📝 Registro Descritivo",
        "hipoteses_clinicas": "🧠 Hipóteses Clínicas",
        "direcoes_intervencao": "🎯 Direções de Intervenção",
        "descricao_demanda": "📋 Descrição da Demanda",
        "procedimento": "⚙️ Procedimento",
        "analise": "🔍 Análise",
        "conclusao": "✅ Conclusão",
        "diagnostico_provisorio": "🩺 Diagnóstico Provisório",
        "quesitos_analise": "❓ Quesitos de Análise",
        "analise_tecnica": "🔬 Análise Técnica",
        "finalidade": "🎯 Finalidade",
        "informacoes_atendimento": "ℹ️ Informações de Atendimento",
        "justificativa_ausencia_ou_aptidao": "✔️ Justificativa"
    }

    for key, value in record_data.items():
        if key in ["identificacao", "id"]: continue
        label = field_labels.get(key, key.replace('_', ' ').title())
        elements.append(Paragraph(label, section_style))
        elements.append(Paragraph(str(value).replace('\n', '<br/>'), text_style))
        elements.append(Spacer(1, 10))
        
    # Therapist Info & Signature
    elements.append(Spacer(1, 30))
    
    if therapist_data:
        therapist_name = therapist_data.get('name') or "Terapeuta"
        therapist_crp = therapist_data.get('crp') or ""
        therapist_email = therapist_data.get('recovery_email') or therapist_data.get('email') or ""
        
        details = [f"<b>{therapist_name}</b>"]
        if therapist_crp:
            details.append(f"CRP: {therapist_crp}")
        if therapist_email:
            details.append(therapist_email)
            
        elements.append(Paragraph("<br/>".join(details), text_style))
        elements.append(Spacer(1, 15))

    elements.append(Paragraph("_______________________________", text_style))
    elements.append(Paragraph("Assinatura do Profissional", text_style))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()