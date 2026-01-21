
from pydantic import BaseModel, HttpUrl, Field
from typing import List, Optional
from datetime import datetime


class AnalyzeRequest(BaseModel):
    transcription: str = Field(min_length=10)


class AnalyzeTextRequest(BaseModel):
    text: str = Field(min_length=10)


class AnalyzeResponse(BaseModel):
    # CFP-compliant field names
    registro_descritivo: str
    hipoteses_clinicas: str
    direcoes_intervencao: str
    temas_relevantes: List[str]
    
    # Backward compatibility properties (deprecated)
    @property
    def summary(self) -> str:
        """Deprecated: Use registro_descritivo instead"""
        return self.registro_descritivo
    
    @property
    def insights(self) -> str:
        """Deprecated: Use hipoteses_clinicas and direcoes_intervencao instead"""
        return f"{self.hipoteses_clinicas}\n\n{self.direcoes_intervencao}"
    
    @property
    def themes(self) -> List[str]:
        """Deprecated: Use temas_relevantes instead"""
        return self.temas_relevantes


class SaveSessionRequest(BaseModel):
    patient_id: str
    audio_url: Optional[HttpUrl] = None
    transcription: str
    # CFP-compliant fields (preferred)
    registro_descritivo: Optional[str] = None
    hipoteses_clinicas: Optional[str] = None
    direcoes_intervencao: Optional[str] = None
    temas_relevantes: Optional[List[str]] = None
    # Legacy fields (for backward compatibility)
    summary: Optional[str] = None
    insights: Optional[str] = None
    themes: Optional[List[str]] = None


class SaveTextSessionRequest(BaseModel):
    patient_id: str
    text: str
    # CFP-compliant fields (preferred)
    registro_descritivo: Optional[str] = None
    hipoteses_clinicas: Optional[str] = None
    direcoes_intervencao: Optional[str] = None
    temas_relevantes: Optional[List[str]] = None
    # Legacy fields (for backward compatibility)
    summary: Optional[str] = None
    insights: Optional[str] = None
    themes: Optional[List[str]] = None


class PatientOut(BaseModel):
    id: str
    user_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    created_at: datetime


class SessionOut(BaseModel):
    id: str
    patient_id: str
    audio_url: Optional[str] = None
    transcription: Optional[str] = None
    summary: Optional[str] = None
    insights: Optional[str] = None
    themes: Optional[List[str]] = None
    registro_descritivo: Optional[str] = None
    hipoteses_clinicas: Optional[str] = None
    direcoes_intervencao: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None


class SessionsListResponse(BaseModel):
    sessions: List[SessionOut]


class ReportRequest(BaseModel):
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    report_type: str = "summary"


class ReportResponse(BaseModel):
    patient: dict
    sessions_count: int
    period: dict
    analysis: dict


# Copilot Chat Schemas
class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    message: str


class MessageOut(BaseModel):
    id: str
    role: str
    content: str
    created_at: datetime


class ConversationOut(BaseModel):
    id: str
    title: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    last_message: Optional[str] = None



class CopilotResponse(BaseModel):
    conversation_id: str
    reply: str


class ProfileOut(BaseModel):
    id: str
    name: Optional[str] = None
    crp: Optional[str] = None
    theoretical_approach: Optional[str] = "Integrativa"
    updated_at: Optional[datetime] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    crp: Optional[str] = None
    theoretical_approach: Optional[str] = None




class CRPValidationRequest(BaseModel):
    crp: str


class CRPValidationResponse(BaseModel):
    valid: bool
    exists_in_theramind: bool
    professional_name: Optional[str] = None
    error: Optional[str] = None

