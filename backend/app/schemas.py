
from pydantic import BaseModel, HttpUrl, Field
from typing import List, Optional
from datetime import datetime


class UploadAudioResponse(BaseModel):
    audio_url: HttpUrl


class TranscribeRequest(BaseModel):
    audio_url: HttpUrl


class TranscribeResponse(BaseModel):
    transcription: str


class AnalyzeRequest(BaseModel):
    transcription: str = Field(min_length=10)


class AnalyzeTextRequest(BaseModel):
    text: str = Field(min_length=10)


class AnalyzeResponse(BaseModel):
    summary: str
    insights: str
    themes: List[str]


class SaveSessionRequest(BaseModel):
    patient_id: str
    audio_url: Optional[HttpUrl] = None
    transcription: str
    summary: str
    insights: str
    themes: List[str]


class SaveTextSessionRequest(BaseModel):
    patient_id: str
    text: str
    summary: str
    insights: str
    themes: List[str]


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
