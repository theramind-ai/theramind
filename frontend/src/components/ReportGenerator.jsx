// src/components/ReportGenerator.jsx
import { useState } from 'react';
import { Download, FileText, Calendar, ArrowLeft, Activity, TrendingUp, Hash } from 'lucide-react';
import api from '../lib/api';

export default function ReportGenerator({ patientId }) {
  const [dateRange, setDateRange] = useState({
    start: null,
    end: null
  });
  const [reportType, setReportType] = useState('summary');
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);

  const handleGenerateReport = async () => {
    try {
      setIsGenerating(true);
      const params = new URLSearchParams();

      // Convert string dates to ISO format properly
      if (dateRange.start) {
        const startDate = new Date(dateRange.start);
        params.append('start_date', startDate.toISOString());
      }
      if (dateRange.end) {
        const endDate = new Date(dateRange.end);
        params.append('end_date', endDate.toISOString());
      }
      params.append('report_type', reportType);

      const response = await api.get(
        `/api/patients/${patientId}/reports?${params.toString()}`,
        { responseType: reportType === 'pdf' ? 'blob' : 'json' }
      );

      if (reportType === 'pdf') {
        // response is already a Blob from api.get with responseType 'blob'
        const url = window.URL.createObjectURL(response);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `relatorio_paciente_${patientId}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // Processar relatório em JSON
        console.log('Relatório:', response);
        setReportData(response);
      }
    } catch (error) {
      console.error('Erro ao gerar relatório:', error);
      alert('Erro ao gerar relatório. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (reportData) {
    return (
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm transition-colors">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xl font-bold text-gray-800 dark:text-white flex items-center">
            <Activity className="mr-2 text-blue-500" size={24} />
            Relatório de Análise
          </h3>
          <button
            onClick={() => setReportData(null)}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
        </div>

        <div className="mb-6 pb-4 border-b border-gray-100 dark:border-slate-700">
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Paciente</p>
          <p className="text-lg font-semibold text-gray-800 dark:text-white">{reportData.patient?.name || 'Não informado'}</p>

          <div className="flex items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
            <Calendar size={14} className="mr-1" />
            <span>Período: </span>
            <span className="ml-1 font-medium">
              {reportData.period?.start ? new Date(reportData.period.start).toLocaleDateString() : 'Início'}
              {' - '}
              {reportData.period?.end ? new Date(reportData.period.end).toLocaleDateString() : 'Hoje'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Card: Frequência */}
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center">
              <Calendar className="mr-2" size={18} />
              Frequência
            </h4>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
              {reportData.sessions_count} <span className="text-sm font-normal text-blue-700 dark:text-blue-300">sessões no período</span>
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
              Média: {reportData.analysis?.session_frequency?.sessions_per_week || 0} sessões/semana
            </p>
          </div>

          {/* Card: Sentimento */}
          <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg">
            <h4 className="font-semibold text-purple-800 dark:text-purple-200 mb-2 flex items-center">
              <TrendingUp className="mr-2" size={18} />
              Sentimento
            </h4>
            <div className="flex items-end space-x-2">
              <span className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                {reportData.analysis?.sentiment_trends?.trend || 'N/A'}
              </span>
            </div>
            <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
              Score Médio: {reportData.analysis?.sentiment_trends?.average_score || 0}
            </p>
          </div>
        </div>

        {/* Tópicos Recorrentes */}
        <div className="mb-6">
          <h4 className="font-semibold text-gray-800 dark:text-white mb-3 flex items-center">
            <Hash className="mr-2" size={18} />
            Tópicos Recorrentes
          </h4>
          <div className="flex flex-wrap gap-2">
            {reportData.analysis?.topics?.map((topic, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-gray-100 dark:bg-slate-700 text-gray-800 dark:text-gray-200 rounded-full text-sm font-medium flex items-center"
              >
                {topic.topic}
                <span className="ml-2 bg-gray-200 dark:bg-slate-600 px-1.5 rounded-full text-xs">
                  {topic.count}
                </span>
              </span>
            ))}
            {(!reportData.analysis?.topics || reportData.analysis.topics.length === 0) && (
              <p className="text-gray-500 dark:text-gray-400">Nenhum tópico significativo detectado.</p>
            )}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-slate-700">
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            Relatório gerado em {new Date().toLocaleDateString()} • TheraMind AI
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm transition-colors">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <FileText className="mr-2" size={20} />
        Gerar Relatório
      </h3>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Período
          </label>
          <div className="flex space-x-2">
            <input
              type="date"
              className="border rounded-md px-3 py-2 text-sm w-full"
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            />
            <span className="self-center">até</span>
            <input
              type="date"
              className="border rounded-md px-3 py-2 text-sm w-full"
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Tipo de Relatório
          </label>
          <select
            className="border rounded-md px-3 py-2 text-sm w-full"
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
          >
            <option value="summary">Resumo</option>
            <option value="detailed">Detalhado</option>
            <option value="pdf">PDF</option>
          </select>
        </div>

        <button
          onClick={handleGenerateReport}
          disabled={isGenerating}
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                     flex items-center justify-center w-full disabled:opacity-50"
        >
          {isGenerating ? (
            'Gerando...'
          ) : (
            <>
              <Download className="mr-2" size={16} />
              {reportType === 'pdf' ? 'Baixar PDF' : 'Gerar Relatório'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}