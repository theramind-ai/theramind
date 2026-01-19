import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FileText, Download, Eye, X } from 'lucide-react';
import api from '../lib/api';

export default function SessionPage() {
    const { id: sessionId } = useParams();
    const navigate = useNavigate();
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [generatingRecord, setGeneratingRecord] = useState(false);
    const [viewingRecord, setViewingRecord] = useState(false);
    const [recordData, setRecordData] = useState(null);
    const [documentType, setDocumentType] = useState('registro_documental');

    useEffect(() => {
        fetchSession();
    }, [sessionId]);

    const fetchSession = async () => {
        try {
            setLoading(true);
            const sessionData = await api.get(`/session/${sessionId}`);
            setSession(sessionData);
        } catch (err) {
            console.error('Erro ao carregar sessão:', err);
            setError('Falha ao carregar os dados da sessão');
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadRecord = async () => {
        try {
            setGeneratingRecord(true);
            const response = await api.get(`/session/${sessionId}/record?document_type=${documentType}`, {
                responseType: 'blob'
            });

            // response is already a Blob from api.get with responseType 'blob'
            console.log("PDF Blob received:", response);

            const url = window.URL.createObjectURL(response);
            console.log("Blob URL created:", url);

            const link = document.createElement('a');
            link.href = url;
            const filename = `prontuario_sessao_${sessionId ? sessionId.slice(0, 8) : 'unknown'}.pdf`;
            link.download = filename; // Use property instead of setAttribute

            console.log("Triggering download with filename:", filename);

            document.body.appendChild(link);
            link.click();
            link.remove();

            // Add a small timeout before revoking to ensure download starts
            setTimeout(() => {
                window.URL.revokeObjectURL(url);
            }, 100);
        } catch (err) {
            console.error('Erro ao gerar prontuário:', err);
            alert('Erro ao gerar prontuário. Tente novamente.');
        } finally {
            setGeneratingRecord(false);
        }
    };

    const handleViewRecord = async () => {
        try {
            setGeneratingRecord(true);
            const response = await api.get(`/session/${sessionId}/record?format=json&document_type=${documentType}`);
            setRecordData(response);
            setViewingRecord(true);
        } catch (err) {
            console.error('Erro ao gerar prontuário:', err);
            alert('Erro ao gerar prontuário. Tente novamente.');
        } finally {
            setGeneratingRecord(false);
        }
    };

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    if (loading) return <div className="p-4">Carregando...</div>;
    if (error) return <div className="p-4 text-red-500">{error}</div>;
    if (!session) return <div className="p-4">Sessão não encontrada</div>;

    return (
        <div className="container mx-auto p-3 sm:p-4 max-w-4xl">
            {/* Cabeçalho */}
            <div className="mb-4 sm:mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-3 sm:mb-4 flex items-center transition-colors min-h-[44px]"
                >
                    ← Voltar
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
                    Sessão de {formatDate(session.created_at)}
                </h1>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 sm:mb-6">
                <div className="flex-1 w-full max-w-xs">
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Tipo de Documento
                    </label>
                    <select
                        value={documentType}
                        onChange={(e) => setDocumentType(e.target.value)}
                        className="w-full bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-md text-sm py-2 px-3 focus:ring-blue-500"
                    >
                        <option value="registro_documental">Registro Documental</option>
                        <option value="relatorio">Relatório Psicológico</option>
                        <option value="laudo">Laudo Pericial</option>
                        <option value="parecer">Parecer Técnico</option>
                        <option value="declaracao">Declaração</option>
                        <option value="atestado">Atestado Psicológico</option>
                    </select>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <button
                        onClick={handleViewRecord}
                        disabled={generatingRecord}
                        className="flex items-center justify-center px-4 py-3 sm:py-2 bg-white text-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-50 disabled:opacity-50 transition-colors"
                    >
                        <Eye className="mr-2" size={18} />
                        Visualizar
                    </button>
                    <button
                        onClick={handleDownloadRecord}
                        disabled={generatingRecord}
                        className="flex items-center justify-center px-4 py-3 sm:py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                    >
                        {generatingRecord ? 'Gerando...' : (
                            <>
                                <FileText className="mr-2" size={18} />
                                Baixar PDF
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Conteúdo da Sessão */}
            <div className="space-y-6">
                {/* Texto Original / Transcrição */}
                <div className="bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-sm transition-colors">
                    <h2 className="text-base sm:text-lg font-semibold text-gray-800 dark:text-white mb-3">
                        {session.audio_url ? 'Transcrição' : 'Texto Original'}
                    </h2>
                    <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {session.transcription || 'Sem transcrição disponível'}
                    </p>
                </div>

                {/* Registro Descritivo (CFP) */}
                {(session.registro_descritivo || session.summary) && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-lg shadow-sm transition-colors">
                        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3 flex items-center">
                            <span className="mr-2">📝</span> Registro Descritivo
                        </h2>
                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                            {session.registro_descritivo || session.summary}
                        </p>
                    </div>
                )}

                {/* Hipóteses Clínicas (CFP) */}
                {(session.hipoteses_clinicas || (session.insights && !session.direcoes_intervencao)) && (
                    <div className="bg-purple-50 dark:bg-purple-900/30 p-6 rounded-lg shadow-sm transition-colors">
                        <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-200 mb-3 flex items-center">
                            <span className="mr-2">💡</span> Hipóteses Clínicas
                        </h2>
                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                            {session.hipoteses_clinicas || session.insights}
                        </p>
                    </div>
                )}

                {/* Direções de Intervenção (CFP) */}
                {session.direcoes_intervencao && (
                    <div className="bg-amber-50 dark:bg-amber-900/30 p-6 rounded-lg shadow-sm transition-colors">
                        <h2 className="text-lg font-semibold text-amber-900 dark:text-amber-200 mb-3 flex items-center">
                            <span className="mr-2">🎯</span> Direções de Intervenção
                        </h2>
                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                            {session.direcoes_intervencao}
                        </p>
                    </div>
                )}

                {/* Temas */}
                {session.themes && session.themes.length > 0 && (
                    <div className="bg-green-50 dark:bg-green-900/30 p-6 rounded-lg shadow-sm transition-colors">
                        <h2 className="text-lg font-semibold text-green-900 dark:text-green-200 mb-3">
                            🏷️ Temas Identificados
                        </h2>
                        <div className="flex flex-wrap gap-2">
                            {session.themes.map((theme, index) => (
                                <span
                                    key={index}
                                    className="px-3 py-1 bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-100 rounded-full text-sm font-medium"
                                >
                                    {theme}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Áudio (se houver) */}
                {session.audio_url && (
                    <div className="bg-gray-50 dark:bg-slate-700 p-6 rounded-lg shadow-sm transition-colors">
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                            🎤 Áudio Original
                        </h2>
                        <audio controls className="w-full">
                            <source src={session.audio_url} type="audio/mpeg" />
                            Seu navegador não suporta o elemento de áudio.
                        </audio>
                    </div>
                )}
            </div>

            {/* Modal Prontuário */}
            {viewingRecord && recordData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-800 rounded-lg max-w-3xl w-full my-4 sm:my-8 flex flex-col max-h-[90vh]">
                        {/* Header Modal */}
                        <div className="p-4 sm:p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 rounded-t-lg z-10">
                            <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white flex items-center">
                                <FileText className="mr-2" size={20} />
                                Prontuário Clínico
                            </h2>
                            <button
                                onClick={() => setViewingRecord(false)}
                                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Conteúdo Modal */}
                        <div className="p-4 sm:p-6 md:p-8 overflow-y-auto">
                            {Object.entries(recordData).map(([key, value], index) => {
                                if (['identificacao', 'id'].includes(key)) return null;

                                const fieldLabels = {
                                    "registro_descritivo": "Registro Descritivo",
                                    "hipoteses_clinicas": "Hipóteses Clínicas",
                                    "direcoes_intervencao": "Direções de Intervenção",
                                    "descricao_demanda": "Descrição da Demanda",
                                    "procedimento": "Procedimento",
                                    "analise": "Análise",
                                    "conclusao": "Conclusão",
                                    "diagnostico_provisorio": "Diagnóstico Provisório",
                                    "quesitos_analise": "Quesitos de Análise",
                                    "analise_tecnica": "Análise Técnica",
                                    "finalidade": "Finalidade",
                                    "informacoes_atendimento": "Informações de Atendimento",
                                    "justificativa_ausencia_ou_aptidao": "Justificativa",
                                    "evolucao": "Evolução",
                                    "riscos": "Riscos",
                                    "plano_terapeutico": "Plano Terapêutico",
                                    "queixa_principal": "Queixa Principal",
                                    "conteudo_sessao": "Conteúdo da Sessão",
                                    "observacoes_clinicas": "Observações Clínicas",
                                    "intervencoes": "Intervenções"
                                };

                                const label = fieldLabels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

                                return (
                                    <div key={key} className="mb-6">
                                        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                                            {index + 1}. {label}
                                        </h3>
                                        <div className={`text-gray-800 dark:text-gray-200 leading-relaxed p-4 rounded-md whitespace-pre-line ${key === 'riscos' ? 'bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 text-red-900 dark:text-red-100' :
                                                key === 'analise' || key === 'observacoes_clinicas' ? 'bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 text-blue-900 dark:text-blue-100' :
                                                    'bg-gray-50 dark:bg-slate-700/50'
                                            }`}>
                                            {value}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Footer Modal */}
                        <div className="p-6 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 rounded-b-lg flex justify-end">
                            <button
                                onClick={handleDownloadRecord}
                                disabled={generatingRecord}
                                className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                            >
                                {generatingRecord ? 'Gerando...' : (
                                    <>
                                        <Download className="mr-2" size={18} />
                                        Baixar PDF
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
