import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient.js'
import { useNavigate } from 'react-router-dom'

export default function SessionsPage() {
    const [sessions, setSessions] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const navigate = useNavigate()

    useEffect(() => {
        fetchSessions()
    }, [])

    const fetchSessions = async () => {
        try {
            setLoading(true)
            const { data: { user } } = await supabase.auth.getUser()

            if (!user) {
                throw new Error('Usuário não autenticado')
            }

            // Buscar sessões de TODOS os pacientes do usuário
            // Precisamos fazer um join manual ou usar view, mas por enquanto vamos buscar tudo
            // A query abaixo depende de como o Supabase/Postgrest lida com RLS e joins.
            // Vamos tentar buscar sessions onde patient_id está em (meus pacientes)

            const { data: patients } = await supabase
                .from('patients')
                .select('id, name')
                .eq('user_id', user.id)

            if (!patients || patients.length === 0) {
                setSessions([])
                return
            }

            const patientIds = patients.map(p => p.id)

            const { data, error } = await supabase
                .from('sessions')
                .select('*')
                .in('patient_id', patientIds)
                .order('created_at', { ascending: false })
                .limit(20) // Limite inicial

            if (error) throw error

            // Enriquecer sessões com nomes dos pacientes
            const sessionsWithNames = data.map(session => {
                const patient = patients.find(p => p.id === session.patient_id)
                return {
                    ...session,
                    patient_name: patient ? patient.name : 'Desconhecido'
                }
            })

            setSessions(sessionsWithNames || [])
        } catch (err) {
            console.error('Erro ao buscar sessões:', err)
            setError('Erro ao carregar sessões. Tente novamente.')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-8">Últimas Sessões</h1>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">Carregando sessões...</p>
                    </div>
                </div>
            ) : error ? (
                <div className="text-red-600">{error}</div>
            ) : sessions.length === 0 ? (
                <div className="text-center text-gray-500 py-12">Nenhuma sessão registrada.</div>
            ) : (
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                    <ul className="divide-y divide-gray-200">
                        {sessions.map((session) => (
                            <li key={session.id} className="px-4 py-4 sm:px-6 hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/patient/${session.patient_id}`)}>
                                <div className="flex items-center justify-between">
                                    <div className="text-sm font-medium text-blue-600 truncate">
                                        {session.patient_name}
                                    </div>
                                    <div className="ml-2 flex-shrink-0 flex">
                                        <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                            {new Date(session.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="mt-1">
                                    <p className="text-sm text-gray-900 line-clamp-2">{session.summary || "Sem resumo disponível"}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
