import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import TextAnalysisInput from '../components/TextAnalysisInput';
import ReportGenerator from '../components/ReportGenerator';

export default function PatientPage() {
  const { id: patientId } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('sessions'); // 'sessions', 'new', 'reports'

  const fetchPatientData = async () => {
    try {
      // Buscar dados do paciente
      const patientData = await api.get(`/patient/${patientId}`);
      setPatient(patientData);

      // Buscar sessões do paciente
      await fetchSessions();
    } catch (err) {
      setError('Falha ao carregar os dados do paciente');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSessions = async () => {
    try {
      const sessionsData = await api.get(`/patient/${patientId}/sessions`);
      setSessions(sessionsData.sessions || []);
    } catch (err) {
      console.error('Erro ao carregar sessões:', err);
      throw err;
    }
  };

  useEffect(() => {
    fetchPatientData();
  }, [patientId]);

  const handleAnalysisComplete = async () => {
    try {
      await fetchSessions();
      setActiveTab('sessions'); // Volta para a aba de sessões
    } catch (err) {
      console.error('Erro ao recarregar sessões:', err);
    }
  };

  const formatSessionDate = (dateString) => {
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

  return (
    <div className="container mx-auto p-3 sm:p-4 max-w-4xl">
      {/* Cabeçalho do Paciente */}
      <div className="mb-6 sm:mb-8 bg-white dark:bg-slate-800 p-4 sm:p-6 rounded-lg shadow-sm transition-colors">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 dark:text-white">
              {patient?.name || 'Paciente'}
            </h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300 mt-1">
              {patient?.email || 'Sem informações de contato'}
            </p>
            {patient?.phone && (
              <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
                Telefone: {patient.phone}
              </p>
            )}
          </div>
          <button
            onClick={() => navigate(`/patient/${patientId}/edit`)}
            className="px-4 py-3 sm:py-2 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-200 dark:hover:bg-slate-600 text-sm transition-colors w-full sm:w-auto"
          >
            Editar Paciente
          </button>
        </div>
      </div>

      {/* Abas */}
      <div className="mb-4 sm:mb-6 border-b border-gray-200 dark:border-slate-700 overflow-x-auto">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'sessions'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
          >
            Sessões
          </button>
          <button
            onClick={() => setActiveTab('new')}
            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'new'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
          >
            Nova Análise
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`py-3 sm:py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${activeTab === 'reports'
              ? 'border-blue-500 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-slate-600'
              }`}
          >
            Relatórios
          </button>
        </nav>
      </div>

      {/* Conteúdo das Abas */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm p-4 sm:p-6 transition-colors">
        {activeTab === 'new' ? (
          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 dark:text-white">Nova Análise</h2>
            <TextAnalysisInput
              patientId={patientId}
              onAnalysisComplete={handleAnalysisComplete}
            />
          </div>
        ) : activeTab === 'reports' ? (
          <div>
            <h2 className="text-lg sm:text-xl font-semibold mb-4 sm:mb-6 dark:text-white">Relatórios</h2>
            <ReportGenerator patientId={patientId} />
          </div>
        ) : (
          <div>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0 mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-semibold dark:text-white">Sessões Anteriores</h2>
              <button
                onClick={() => setActiveTab('new')}
                className="px-4 py-3 sm:py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition-colors w-full sm:w-auto"
              >
                + Nova Análise
              </button>
            </div>

            {sessions.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-4">Nenhuma sessão encontrada.</p>
                <button
                  onClick={() => setActiveTab('new')}
                  className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                >
                  Comece criando uma nova análise
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                  .map((session) => (
                    <div
                      key={session.id}
                      className="p-4 border rounded-lg hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-700 transition-colors cursor-pointer"
                      onClick={() => navigate(`/session/${session.id}`)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {formatSessionDate(session.created_at)}
                          </h3>
                          <p className="text-gray-600 dark:text-gray-300 text-sm mt-1 line-clamp-2">
                            {session.registro_descritivo ||
                              session.summary ||
                              session.transcription?.substring(0, 150) ||
                              'Sem conteúdo disponível'}...
                          </p>
                          {session.insights?.sentiment && (
                            <span className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${session.insights.sentiment === 'positivo'
                              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                              : session.insights.sentiment === 'negativo'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                              }`}>
                              {session.insights.sentiment}
                            </span>
                          )}
                        </div>
                        <div className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium">
                          Ver detalhes →
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}