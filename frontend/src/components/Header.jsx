import { Link, useNavigate } from 'react-router-dom'
import { Logo } from './Logo'
import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { ThemeSwitch } from './ThemeSwitch'
import { MessageSquare } from 'lucide-react'
import { CopilotChat } from './CopilotChat'

export function Header() {
  const navigate = useNavigate()
  const [userEmail, setUserEmail] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserEmail(user.email)
      }
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <>
      <header className="bg-white dark:bg-slate-800 shadow transition-colors duration-200 relative z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div
            className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => navigate('/dashboard')}
          >
            <div className="h-10 w-10 overflow-hidden rounded-lg">
              <Logo />
            </div>
            <h1 className="ml-3 text-xl font-bold text-gray-900 dark:text-white">TheraMind</h1>
          </div>

          <nav className="flex space-x-6">
            <Link to="/dashboard" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium">
              Dashboard
            </Link>
            <Link to="/patients" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium">
              Pacientes
            </Link>
            <Link to="/sessions" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium">
              Sessões
            </Link>
            <Link to="/appointments" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium">
              Agendamentos
            </Link>
            <Link to="/settings" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium">
              Configurações
            </Link>
          </nav>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700 transition-colors"
              title="Copiloto Psicanalista"
            >
              <MessageSquare className="h-5 w-5" />
            </button>
            <ThemeSwitch />
            {userEmail && (
              <span className="text-sm text-gray-500 hidden sm:block">
                {userEmail}
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm font-medium text-red-600 hover:text-red-800 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
              </svg>
              Sair
            </button>
          </div>
        </div>
      </header>

      <CopilotChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  )
}
