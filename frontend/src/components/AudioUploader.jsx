import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../lib/api';
import { UpgradeModal } from './UpgradeModal';

export default function AudioUploader({ patientId, onUploadComplete }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [status, setStatus] = useState('idle'); // idle, recording, transcribed, analyzing, saving, success, error
  const [error, setError] = useState(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  const [isSupported, setIsSupported] = useState(true);
  const recognitionRef = useRef(null);
  const transcriptionRef = useRef('');
  const processedResultsRef = useRef(new Set());

  // Refs to avoid closure issues in handlers
  const isRecordingRef = useRef(isRecording);
  const isPausedRef = useRef(isPaused);

  useEffect(() => {
    isRecordingRef.current = isRecording;
    isPausedRef.current = isPaused;
  }, [isRecording, isPaused]);

  useEffect(() => {
    // Check if Web Speech API is supported
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Seu navegador não suporta transcrição direta. Recomendamos usar Chrome ou Edge.');
      console.warn('Web Speech API not supported in this browser');
      return;
    }

    // Initialize Speech Recognition
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'pt-BR';

    recognition.onstart = () => {
      console.log('SpeechRecognition.onstart');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const result = event.results[i];
        // Create unique ID based on index and transcript to detect duplicates
        const resultId = `${i}-${result[0].transcript}`;

        if (result.isFinal) {
          // Only add if not already processed
          if (!processedResultsRef.current.has(resultId)) {
            final += result[0].transcript;
            processedResultsRef.current.add(resultId);
            console.log('New final result added:', resultId);
          } else {
            console.log('Duplicate result skipped:', resultId);
          }
        } else {
          interim += result[0].transcript;
        }
      }

      if (final) {
        console.log('Transcription (final):', final);
        const newText = transcriptionRef.current + ' ' + final;
        transcriptionRef.current = newText;
        setTranscription(newText);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Permissão ao microfone negada. Habilite nas configurações do navegador.');
      } else if (event.error === 'no-speech') {
        console.warn('No speech detected');
      } else {
        setError(`Erro na transcrição: ${event.error}`);
        setStatus('error');
        setIsRecording(false);
        isRecordingRef.current = false;
      }
    };

    recognition.onend = () => {
      console.log('SpeechRecognition.onend | isRecording:', isRecordingRef.current, 'isPaused:', isPausedRef.current);
      // Se ainda estiver no modo recording e NÃO estiver pausado, reinicia
      if (isRecordingRef.current && !isPausedRef.current) {
        try {
          console.log('Restarting recognition...');
          recognition.start();
        } catch (e) {
          console.error("Erro ao reiniciar recognition:", e);
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      console.log('Cleaning up recognition effect...');
      isRecordingRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []); // Only run once on mount

  const startRecording = () => {
    if (!recognitionRef.current) return;
    console.log('Action: startRecording');

    isRecordingRef.current = true;
    isPausedRef.current = false;
    transcriptionRef.current = '';
    processedResultsRef.current.clear(); // Clear processed results history

    setError(null);
    setTranscription('');
    setInterimTranscript('');
    setStatus('recording');
    setIsRecording(true);
    setIsPaused(false);

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("Error starting recognition:", e);
    }
  };

  const pauseRecording = () => {
    if (!recognitionRef.current || !isRecording) return;
    console.log('Action: pauseRecording');

    isPausedRef.current = true;
    setIsPaused(true);

    recognitionRef.current.stop();
  };

  const resumeRecording = () => {
    if (!recognitionRef.current || !isRecording) return;
    console.log('Action: resumeRecording');

    isPausedRef.current = false;
    setIsPaused(false);

    try {
      recognitionRef.current.start();
    } catch (e) {
      console.error("Error resuming recognition:", e);
    }
  };

  const stopRecording = async () => {
    if (!recognitionRef.current) return;
    console.log('Action: stopRecording');

    isRecordingRef.current = false;
    isPausedRef.current = false;

    setIsRecording(false);
    setIsPaused(false);
    recognitionRef.current.stop();

    const finalFullText = (transcriptionRef.current + ' ' + interimTranscript).trim();

    if (!finalFullText) {
      setStatus('idle');
      return;
    }

    setTranscription(finalFullText);
    transcriptionRef.current = finalFullText;
    setStatus('transcribed');
    console.log('Final text saved to state:', finalFullText);
  };

  const processTranscription = async (text) => {
    console.log('Starting processTranscription with text length:', text?.length);
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
      console.error('DEBUG: Erro no processamento:', err);
      // Silenciando erros de assinatura/limite para testes
      if (err.message && (err.message.includes('403') || err.message.includes('Limite diário') || err.message.includes('plano'))) {
        console.warn('Bloqueio de assinatura detectado e ignorado (Modo Teste)');
        setStatus('idle');
        return;
      }
      setError(err.message || 'Erro ao analisar a sessão. Tente novamente.');
      setStatus('error');
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'recording':
        return isPaused ? 'Gravação pausada' : 'Ouvindo e transcrevendo...';
      case 'analyzing': return 'Processando análise clínica (IA)...';
      case 'saving': return 'Salvando prontuário...';
      case 'success': return 'Sessão registrada com sucesso!';
      case 'error': return 'Ocorreu um erro.';
      case 'transcribed': return 'Transcrição concluída';
      default: return 'Pronto para iniciar';
    }
  };

  if (!isSupported) {
    return (
      <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg text-sm text-amber-700 text-center">
        {error}
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700">
      <div className="flex flex-col items-center justify-center space-y-6">

        {/* Visual Feedback Circle */}
        <div className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${isRecording ? (isPaused ? 'bg-amber-100 dark:bg-amber-900/30' : 'bg-red-100 dark:bg-red-900/30') : 'bg-blue-50 dark:bg-blue-900/20'
          }`}>
          {isRecording && !isPaused && (
            <div className="absolute inset-0 rounded-full animate-ping bg-red-400/20" />
          )}

          {status === 'success' ? (
            <CheckCircle size={40} className="text-green-500 animate-bounce" />
          ) : status === 'error' ? (
            <AlertCircle size={40} className="text-red-500" />
          ) : status === 'analyzing' || status === 'saving' ? (
            <Loader2 size={40} className="text-blue-500 animate-spin" />
          ) : (
            <Mic className={`${isRecording ? (isPaused ? 'text-amber-500' : 'text-red-500') : 'text-blue-500'}`} size={32} />
          )}
        </div>

        {/* Action Controls */}
        <div className="w-full max-w-sm">
          {status === 'idle' || status === 'recording' ? (
            <div className="flex flex-col space-y-4">
              {!isRecording ? (
                <button
                  onClick={startRecording}
                  className="w-full py-4 rounded-xl text-white shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-95 bg-blue-600 hover:bg-blue-700 font-bold flex items-center justify-center"
                >
                  <Mic size={20} className="mr-2" />
                  INICIAR GRAVAÇÃO
                </button>
              ) : (
                <div className="flex space-x-4">
                  <button
                    onClick={isPaused ? resumeRecording : pauseRecording}
                    className={`flex-1 py-4 px-6 rounded-xl text-white shadow-md transition-all duration-200 hover:scale-105 active:scale-95 flex items-center justify-center font-bold ${isPaused ? 'bg-green-500 hover:bg-green-600' : 'bg-amber-500 hover:bg-amber-600'
                      }`}
                  >
                    {isPaused ? <><Mic size={20} className="mr-2" /> RETOMAR</> : <><div className="flex space-x-1 mr-2"><div className="w-1.5 h-4 bg-white rounded-full" /><div className="w-1.5 h-4 bg-white rounded-full" /></div> PAUSAR</>}
                  </button>

                  <button
                    onClick={stopRecording}
                    className="flex-1 py-4 px-6 rounded-xl text-white shadow-md transition-all duration-200 hover:scale-105 active:scale-95 bg-red-500 hover:bg-red-600 flex items-center justify-center font-bold"
                  >
                    <Square size={20} className="mr-2" fill="white" />
                    FINALIZAR
                  </button>
                </div>
              )}
            </div>
          ) : status === 'transcribed' ? (
            <div className="flex flex-col space-y-4">
              <button
                onClick={() => {
                  console.log('BOTÃO ANALISAR CLICADO. Texto para enviar:', transcription);
                  processTranscription(transcription);
                }}
                className="w-full py-4 rounded-xl text-white shadow-lg transition-all duration-200 hover:scale-[1.02] active:scale-95 bg-green-600 hover:bg-green-700 font-bold flex items-center justify-center"
              >
                <CheckCircle size={20} className="mr-2" />
                ANALISAR AGORA
              </button>
              <button
                onClick={() => setStatus('idle')}
                className="text-slate-500 hover:text-slate-700 text-sm font-medium"
              >
                Descartar e gravar novamente
              </button>
            </div>
          ) : status === 'success' ? (
            <div className="text-center">
              <p className="text-green-600 font-bold mb-2">Concluido!</p>
              <button
                onClick={() => setStatus('idle')}
                className="text-blue-600 hover:underline text-sm"
              >
                Nova análise
              </button>
            </div>
          ) : null}
        </div>

        {/* Status Message */}
        <div className="text-center">
          <p className={`text-sm font-semibold uppercase tracking-wider ${isRecording ? (isPaused ? 'text-amber-500' : 'text-red-500') : 'text-slate-500 dark:text-slate-400'
            }`}>
            {getStatusMessage()}
          </p>
        </div>

        {/* Live Transcription Preview */}
        {(isRecording || transcription) && (
          <div className="w-full space-y-2">
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider ml-1">
              Transcrição da Sessão {status === 'transcribed' && '(Você pode editar)'}
            </label>
            <div className="w-full p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner">
              {status === 'transcribed' ? (
                <textarea
                  className="w-full bg-transparent text-sm text-slate-700 dark:text-slate-300 italic focus:outline-none resize-none"
                  rows={6}
                  value={transcription}
                  onChange={(e) => {
                    setTranscription(e.target.value);
                    transcriptionRef.current = e.target.value;
                  }}
                />
              ) : (
                <p className="text-sm text-slate-700 dark:text-slate-300 italic">
                  {transcription}
                  <span className="text-slate-400 dark:text-slate-500">{interimTranscript}</span>
                  {isRecording && <span className="inline-block w-1.5 h-4 ml-1 bg-blue-500 animate-pulse align-middle" />}
                </p>
              )}
            </div>
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

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
      />
    </div>
  );
}