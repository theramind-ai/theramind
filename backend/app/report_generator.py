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

def generate_clinical_record_content(session_data: Dict[str, Any], patient_data: Dict[str, Any], client: Any) -> Dict[str, Any]:
    """Generates structured clinical record content using OpenAI."""
    
    system_prompt = (
        "Você é um supervisor clínico psicanalítico rigoroso. "
        "Sua tarefa é estruturar um Prontuário Clínico formal com base nos dados da sessão."
    )
    
    user_prompt = f"""
    Dados do Paciente: {patient_data.get('name')}
    Dados da Sessão: {session_data.get('created_at')}
    Transcrição/Resumo: {session_data.get('transcription') or session_data.get('summary')}
    Insights Anteriores: {session_data.get('insights')}
    
    Gere um JSON com os seguintes campos exatos para o prontuário:
    1. queixa_principal: (foco da sessão)
    2. conteudo_sessao: (associações, relatos). Resuma em parágrafos.
    3. observacoes_clinicas: (afetos, defesas, dinâmica transferencial). Use terminologia técnica (Freud/Lacan).
    4. intervencoes: (pontuações, cortes, interpretações do analista).
    5. evolucao: (processos em curso).
    6. riscos: (suicídio, autolesão, etc - seja conservador).
    7. plano_terapeutico: (próximos passos).
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

def generate_clinical_record_pdf(record_data: Dict[str, Any], patient_data: Dict[str, Any], session_date: str) -> bytes:
    """Generates the PDF file for the clinical record."""
    from reportlab.lib.pagesizes import letter
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from io import BytesIO
    
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []
    
    # Styles
    title_style = ParagraphStyle('Title', parent=styles['Heading1'], fontSize=16, spaceAfter=20, alignment=1)
    header_style = ParagraphStyle('Header', parent=styles['Normal'], fontSize=10, textColor=colors.gray)
    section_style = ParagraphStyle('Section', parent=styles['Heading2'], fontSize=12, spaceBefore=15, spaceAfter=10, textColor=colors.darkblue)
    text_style = ParagraphStyle('Text', parent=styles['Normal'], fontSize=11, leading=14)
    
    # Header Info
    elements.append(Paragraph("Prontuário Clínico – Sessão Psicanalítica", title_style))
    elements.append(Spacer(1, 10))
    
    # Format Patient Data for the section
    patient_info = (
        f"<b>Nome:</b> {patient_data.get('name') or 'N/A'}\n"
        f"<b>Email:</b> {patient_data.get('email') or 'N/A'}\n"
        f"<b>Telefone:</b> {patient_data.get('phone') or 'N/A'}\n"
        f"<b>Data da sessão:</b> {session_date}"
    )

    # Sections
    sections = [
        ("👤 Dados do Paciente", patient_info),
        ("🧠 1. Queixa principal / Motivo da sessão", record_data.get('queixa_principal', '-')),
        ("🗣️ 2. Conteúdo da sessão", record_data.get('conteudo_sessao', '-')),
        ("🔍 3. Observações clínicas", record_data.get('observacoes_clinicas', '-')),
        ("🔄 4. Intervenções do analista", record_data.get('intervencoes', '-')),
        ("📈 5. Evolução / Processos em curso", record_data.get('evolucao', '-')),
        ("⚠️ 6. Riscos / Observações importantes", record_data.get('riscos', '-')),
        ("📝 7. Plano terapêutico / Encaminhamentos", record_data.get('plano_terapeutico', '-'))
    ]
    
    for title, content in sections:
        elements.append(Paragraph(title, section_style))
        elements.append(Paragraph(content.replace('\n', '<br/>'), text_style))
        elements.append(Spacer(1, 10))
        
    # Signature
    elements.append(Spacer(1, 30))
    elements.append(Paragraph("_______________________________", text_style))
    elements.append(Paragraph("Assinatura do Profissional", text_style))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer.getvalue()