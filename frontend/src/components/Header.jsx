import { Link, useNavigate } from 'react-router-dom'
import { Logo } from './Logo'
import { supabase } from '../lib/supabaseClient'
import { useState, useEffect } from 'react'
import { ThemeSwitch } from './ThemeSwitch'
import { MessageSquare, Menu, X, LogOut } from 'lucide-react'
import { CopilotChat } from './CopilotChat'

export function Header() {
  const navigate = useNavigate()
  const [userEmail, setUserEmail] = useState('')
  const [isChatOpen, setIsChatOpen] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

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

  const handleNavClick = (path) => {
    navigate(path)
    setIsMobileMenuOpen(false)
  }

  return (
    <>
      <header className="bg-white dark:bg-slate-800 shadow transition-colors duration-200 relative z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div
              className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => navigate('/dashboard')}
            >
              <div className="h-10 w-10 overflow-hidden rounded-lg flex-shrink-0">
                <Logo />
              </div>
              <h1 className="ml-3 text-lg sm:text-xl font-bold text-gray-900 dark:text-white">TheraMind</h1>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex space-x-6">
              <Link to="/dashboard" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium transition-colors">
                Dashboard
              </Link>
              <Link to="/patients" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium transition-colors">
                Pacientes
              </Link>
              <Link to="/sessions" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium transition-colors">
                Sessões
              </Link>
              <Link to="/appointments" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium transition-colors">
                Agendamentos
              </Link>
              <Link to="/settings" className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white font-medium transition-colors">
                Configurações
              </Link>
            </nav>

            {/* Desktop Actions */}
            <div className="hidden lg:flex items-center space-x-4">
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700 transition-colors"
                title="Copiloto Clínico"
              >
                <MessageSquare className="h-5 w-5" />
              </button>
              <ThemeSwitch />
              {userEmail && (
                <span className="text-sm text-gray-500 dark:text-gray-400 hidden xl:block">
                  {userEmail}
                </span>
              )}
              <button
                onClick={handleLogout}
                className="text-sm font-medium text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300 flex items-center transition-colors"
              >
                <LogOut className="h-5 w-5 mr-1" />
                Sair
              </button>
            </div>

            {/* Mobile Actions */}
            <div className="flex lg:hidden items-center space-x-2">
              <button
                onClick={() => setIsChatOpen(!isChatOpen)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700 transition-colors"
                title="Copiloto Clínico"
              >
                <MessageSquare className="h-5 w-5" />
              </button>
              <ThemeSwitch />
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700 transition-colors"
                aria-label="Menu"
              >
                {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        {isMobileMenuOpen && (
          <>
            {/* Overlay */}
            <div
              className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
              onClick={() => setIsMobileMenuOpen(false)}
            />

            {/* Drawer */}
            <div className="fixed top-0 right-0 bottom-0 w-64 bg-white dark:bg-slate-800 shadow-xl z-50 lg:hidden transform transition-transform duration-300 ease-in-out">
              <div className="flex flex-col h-full">
                {/* Drawer Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Menu</h2>
                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-slate-700 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* User Info */}
                {userEmail && (
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-slate-700">
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{userEmail}</p>
                  </div>
                )}

                {/* Navigation Links */}
                <nav className="flex-1 overflow-y-auto py-4">
                  <button
                    onClick={() => handleNavClick('/dashboard')}
                    className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors font-medium"
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => handleNavClick('/patients')}
                    className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors font-medium"
                  >
                    Pacientes
                  </button>
                  <button
                    onClick={() => handleNavClick('/sessions')}
                    className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors font-medium"
                  >
                    Sessões
                  </button>
                  <button
                    onClick={() => handleNavClick('/appointments')}
                    className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors font-medium"
                  >
                    Agendamentos
                  </button>
                  <button
                    onClick={() => handleNavClick('/settings')}
                    className="w-full text-left px-4 py-3 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors font-medium"
                  >
                    Configurações
                  </button>
                </nav>

                {/* Logout Button */}
                <div className="p-4 border-t border-gray-200 dark:border-slate-700">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-center px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors font-medium"
                  >
                    <LogOut className="h-5 w-5 mr-2" />
                    Sair
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      <CopilotChat isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
    </>
  )
}
