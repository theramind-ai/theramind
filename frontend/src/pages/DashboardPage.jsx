import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient.js'

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({
    totalPatients: 0,
    totalSessions: 0,
    activePatients: 0
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchMetrics()
  }, [])

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      // Fetch total patients
      const { count: patientCount, data: patients } = await supabase
        .from('patients')
        .select('id', { count: 'exact' })
        .eq('user_id', user.id)

      // Fetch recent sessions (last 30 days) to calculate "active"
      // Simplification: just count total sessions for now
      // RLS might limit what we can see if not careful, but we disabled it for now.

      // Get all patient IDs to filter sessions
      const patientIds = patients ? patients.map(p => p.id) : []

      let sessionCount = 0
      if (patientIds.length > 0) {
        const { count } = await supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .in('patient_id', patientIds)

        sessionCount = count || 0
      }

      setMetrics({
        totalPatients: patientCount || 0,
        totalSessions: sessionCount,
        activePatients: patientCount || 0 // Placeholder logic
      })

    } catch (err) {
      console.error('Erro ao carregar métricas:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-8">Dashboard</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        {/* Card 1: Total Pacientes */}
        <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg transition-colors">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-slate-400 truncate">Total de Pacientes</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
              {loading ? '...' : metrics.totalPatients}
            </dd>
          </div>
        </div>

        {/* Card 2: Sessões Realizadas */}
        <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg transition-colors">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-slate-400 truncate">Sessões Realizadas</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
              {loading ? '...' : metrics.totalSessions}
            </dd>
          </div>
        </div>

        {/* Card 3: Pacientes Ativos (Placeholder) */}
        <div className="bg-white dark:bg-slate-800 overflow-hidden shadow rounded-lg transition-colors">
          <div className="px-4 py-5 sm:p-6">
            <dt className="text-sm font-medium text-gray-500 dark:text-slate-400 truncate">Pacientes Ativos</dt>
            <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
              {loading ? '...' : metrics.activePatients}
            </dd>
          </div>
        </div>
      </div>

      {/* Future Charts Area */}
      <div className="bg-white dark:bg-slate-800 shadow rounded-lg p-6 transition-colors">
        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">Evolução Mensal (Em Breve)</h3>
        <div className="h-64 bg-gray-50 dark:bg-slate-700/50 border-2 border-dashed border-gray-300 dark:border-slate-600 rounded-lg flex items-center justify-center">
          <span className="text-gray-500 dark:text-slate-400">Gráficos de tendências serão exibidos aqui</span>
        </div>
      </div>
    </div>
  )
}
