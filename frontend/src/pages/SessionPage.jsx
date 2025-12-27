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
            const response = await api.get(`/session/${sessionId}/record`, {
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
            const response = await api.get(`/session/${sessionId}/record?format=json`);
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
        <div className="container mx-auto p-4 max-w-4xl">
            {/* Cabeçalho */}
            <div className="mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-4 flex items-center transition-colors"
                >
                    ← Voltar
                </button>
                <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
                    Sessão de {formatDate(session.created_at)}
                </h1>
            </div>

            <div className="flex justify-end mb-6">
                <button
                    onClick={handleViewRecord}
                    disabled={generatingRecord}
                    className="flex items-center px-4 py-2 bg-white text-indigo-600 border border-indigo-600 rounded-md hover:bg-indigo-50 mr-4 disabled:opacity-50"
                >
                    <Eye className="mr-2" size={18} />
                    Ver Prontuário
                </button>
                <button
                    onClick={handleDownloadRecord}
                    disabled={generatingRecord}
                    className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                    {generatingRecord ? 'Gerando...' : (
                        <>
                            <FileText className="mr-2" size={18} />
                            Baixar PDF
                        </>
                    )}
                </button>
            </div>

            {/* Conteúdo da Sessão */}
            <div className="space-y-6">
                {/* Texto Original / Transcrição */}
                <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm transition-colors">
                    <h2 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                        {session.audio_url ? 'Transcrição' : 'Texto Original'}
                    </h2>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {session.transcription || 'Sem transcrição disponível'}
                    </p>
                </div>

                {/* Resumo */}
                {session.summary && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 p-6 rounded-lg shadow-sm transition-colors">
                        <h2 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-3">
                            📝 Resumo
                        </h2>
                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                            {session.summary}
                        </p>
                    </div>
                )}

                {/* Insights */}
                {session.insights && (
                    <div className="bg-purple-50 dark:bg-purple-900/30 p-6 rounded-lg shadow-sm transition-colors">
                        <h2 className="text-lg font-semibold text-purple-900 dark:text-purple-200 mb-3">
                            💡 Insights
                        </h2>
                        <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                            {session.insights}
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
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 overflow-y-auto">
                    <div className="bg-white dark:bg-slate-800 rounded-lg max-w-3xl w-full my-8 flex flex-col max-h-[90vh]">
                        {/* Header Modal */}
                        <div className="p-6 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center sticky top-0 bg-white dark:bg-slate-800 rounded-t-lg z-10">
                            <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
                                <FileText className="mr-2" size={24} />
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
                        <div className="p-8 overflow-y-auto">
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">1. Queixa Principal</h3>
                                <p className="text-gray-800 dark:text-gray-200 leading-relaxed bg-gray-50 dark:bg-slate-700/50 p-4 rounded-md">
                                    {recordData.queixa_principal}
                                </p>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">2. Conteúdo da Sessão</h3>
                                <p className="text-gray-800 dark:text-gray-200 leading-relaxed bg-gray-50 dark:bg-slate-700/50 p-4 rounded-md whitespace-pre-line">
                                    {recordData.conteudo_sessao}
                                </p>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">3. Observações Clínicas</h3>
                                <p className="text-blue-900 dark:text-blue-100 leading-relaxed bg-blue-50 dark:bg-blue-900/30 p-4 rounded-md border-l-4 border-blue-500">
                                    {recordData.observacoes_clinicas}
                                </p>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="mb-6">
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">4. Intervenções</h3>
                                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed bg-gray-50 dark:bg-slate-700/50 p-4 rounded-md">
                                        {recordData.intervencoes}
                                    </p>
                                </div>
                                <div className="mb-6">
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">5. Evolução</h3>
                                    <p className="text-gray-800 dark:text-gray-200 leading-relaxed bg-gray-50 dark:bg-slate-700/50 p-4 rounded-md">
                                        {recordData.evolucao}
                                    </p>
                                </div>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">6. Riscos</h3>
                                <p className="text-red-900 dark:text-red-100 leading-relaxed bg-red-50 dark:bg-red-900/30 p-4 rounded-md border-l-4 border-red-500">
                                    {recordData.riscos}
                                </p>
                            </div>

                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-green-600 dark:text-green-400 uppercase tracking-wider mb-2">7. Plano Terapêutico</h3>
                                <p className="text-green-900 dark:text-green-100 leading-relaxed bg-green-50 dark:bg-green-900/30 p-4 rounded-md border-l-4 border-green-500">
                                    {recordData.plano_terapeutico}
                                </p>
                            </div>
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
