import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../lib/api';

export default function AudioUploader({ patientId, onUploadComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [status, setStatus] = useState('idle'); // idle, recording, analyzing, saving, success, error
  const [error, setError] = useState(null);

  const recognitionRef = useRef(null);

  useEffect(() => {
    // Inicializar SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'pt-BR';

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final += event.results[i][0].transcript;
          } else {
            interim += event.results[i][0].transcript;
          }
        }

        setTranscription(prev => prev + ' ' + final);
        setInterimTranscript(interim);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        if (event.error === 'not-allowed') {
          setError('Permissão ao microfone negada.');
        } else {
          setError('Erro na transcrição automática.');
        }
        setStatus('error');
        setIsRecording(false);
      };

      recognition.onend = () => {
        // Se ainda estiver no modo recording, reinicia (evita paradas automáticas do browser)
        if (isRecording) {
          recognition.start();
        }
      };

      recognitionRef.current = recognition;
    } else {
      setError('Seu navegador não suporta transcrição direta. Recomendamos usar Chrome ou Edge.');
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [isRecording]);

  const startRecording = () => {
    if (!recognitionRef.current) return;

    setError(null);
    setTranscription('');
    setInterimTranscript('');
    setStatus('recording');
    setIsRecording(true);
    recognitionRef.current.start();
  };

  const stopRecording = async () => {
    if (!recognitionRef.current) return;

    setIsRecording(false);
    recognitionRef.current.stop();

    const finalFullText = (transcription + ' ' + interimTranscript).trim();

    if (!finalFullText) {
      setStatus('idle');
      return;
    }

    processTranscription(finalFullText);
  };

  const processTranscription = async (text) => {
    setStatus('analyzing');
    try {
      // 1. Analyze (CFP Prompt)
      const analysis = await api.post('/analyze', { transcription: text });

      // 2. Save Session
      setStatus('saving');
      await api.post('/save-session', {
        patient_id: patientId,
        audio_url: null, // Não estamos salvando o arquivo de áudio para simplificar/economizar
        transcription: text,
        registro_descritivo: analysis.registro_descritivo,
        hipoteses_clinicas: analysis.hipoteses_clinicas,
        direcoes_intervencao: analysis.direcoes_intervencao,
        temas_relevantes: analysis.temas_relevantes
      });

      setStatus('success');
      if (onUploadComplete) onUploadComplete();

    } catch (err) {
      console.error('Erro no processamento:', err);
      setError(err.message || 'Erro ao analisar a sessão. Tente novamente.');
      setStatus('error');
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'recording': return 'Ouvindo e transcrevendo...';
      case 'analyzing': return 'Processando análise clínica (IA)...';
      case 'saving': return 'Salvando prontuário...';
      case 'success': return 'Sessão registrada com sucesso!';
      case 'error': return 'Ocorreu um erro.';
      default: return 'Pronto para iniciar';
    }
  };

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
      <div className="flex flex-col items-center justify-center space-y-6">

        {/* Visual Feedback Circle */}
        <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording ? 'bg-red-100 dark:bg-red-900/30' : 'bg-blue-50 dark:bg-blue-900/20'
          }`}>
          {isRecording && (
            <div className="absolute inset-0 rounded-full animate-ping bg-red-400/20" />
          )}

          {status === 'idle' || status === 'recording' ? (
            <button
              onClick={isRecording ? stopRecording : startRecording}
              className={`p-5 rounded-full text-white shadow-lg transition-all duration-200 hover:scale-110 active:scale-95 ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-600 hover:bg-blue-700'
                }`}
            >
              {isRecording ? <Square size={24} fill="white" /> : <Mic size={24} />}
            </button>
          ) : status === 'success' ? (
            <CheckCircle size={40} className="text-green-500 animate-bounce" />
          ) : status === 'error' ? (
            <AlertCircle size={40} className="text-red-500" />
          ) : (
            <Loader2 size={40} className="text-blue-500 animate-spin" />
          )}
        </div>

        {/* Status Message */}
        <div className="text-center">
          <p className={`text-sm font-semibold uppercase tracking-wider ${isRecording ? 'text-red-500' : 'text-slate-500 dark:text-slate-400'}`}>
            {getStatusMessage()}
          </p>
        </div>

        {/* Live Transcription Preview */}
        {(isRecording || transcription) && (
          <div className="w-full max-h-40 overflow-y-auto p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner">
            <p className="text-sm text-slate-700 dark:text-slate-300 italic">
              {transcription}
              <span className="text-slate-400 dark:text-slate-500">{interimTranscript}</span>
              {isRecording && <span className="inline-block w-1.5 h-4 ml-1 bg-blue-500 animate-pulse align-middle" />}
            </p>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="w-full p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Instructions */}
        {status === 'idle' && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center max-w-xs">
            Clique no ícone para iniciar a transcrição em tempo real da sessão.
          </p>
        )}

        {status === 'success' && (
          <button
            onClick={() => setStatus('idle')}
            className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
          >
            Nova sessão
          </button>
        )}
      </div>
    </div>
  );
}