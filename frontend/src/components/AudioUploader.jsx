// src/components/TextAnalysisInput.jsx
import { useState } from 'react';
import { Upload, Type, Mic } from 'lucide-react';

export default function TextAnalysisInput({ patientId, onAnalysisComplete }) {
  const [inputMode, setInputMode] = useState('text'); // 'text' ou 'audio'
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleTextSubmit = async (e) => {
    e.preventDefault();
    if (!textInput.trim()) return;

    setIsProcessing(true);
    setError(null);

    try {
      // 1. Enviar texto para análise
      const analysis = await api.post('/analyze-text', {
        text: textInput,
        patient_id: patientId
      });

      // 2. Salvar a sessão
      await api.post('/save-text-session', {
        patient_id: patientId,
        text: textInput,
        analysis: analysis.results
      });

      if (onAnalysisComplete) {
        onAnalysisComplete();
      }
    } catch (err) {
      console.error('Erro ao processar o texto:', err);
      setError('Erro ao processar o texto. Tente novamente.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Seletor de modo de entrada */}
      <div className="flex border-b">
        <button
          className={`flex-1 py-2 px-4 text-center font-medium ${
            inputMode === 'text'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setInputMode('text')}
        >
          <Type className="inline-block mr-2" size={16} />
          Digitar Texto
        </button>
        <button
          className={`flex-1 py-2 px-4 text-center font-medium ${
            inputMode === 'audio'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
          onClick={() => setInputMode('audio')}
        >
          <Mic className="inline-block mr-2" size={16} />
          Enviar Áudio
        </button>
      </div>

      {/* Formulário de texto */}
      {inputMode === 'text' && (
        <form onSubmit={handleTextSubmit} className="space-y-4">
          <div>
            <label htmlFor="session-text" className="block text-sm font-medium text-gray-700 mb-1">
              Digite o texto da sessão
            </label>
            <textarea
              id="session-text"
              rows={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Digite o conteúdo da sessão aqui..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={isProcessing}
            ></textarea>
          </div>
          
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!textInput.trim() || isProcessing}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {isProcessing ? 'Processando...' : 'Analisar Texto'}
            </button>
          </div>
        </form>
      )}

      {/* Upload de áudio (componente existente) */}
      {inputMode === 'audio' && (
        <AudioUploader 
          patientId={patientId} 
          onUploadComplete={onAnalysisComplete} 
        />
      )}

      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 rounded text-sm">
          {error}
        </div>
      )}
    </div>
  );
}